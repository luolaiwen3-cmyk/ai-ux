import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { migrateDatabase, openDatabase } from '../server/database.js'

test('新数据库按版本创建规范化表并可重复迁移', () => {
  const database = openDatabase(':memory:')
  try {
    const tables = database.prepare(`
      SELECT name FROM sqlite_schema
      WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all().map((row) => row.name)
    assert.deepEqual(tables, [
      'diagnoses',
      'schema_migrations',
      'session_recordings',
      'sessions',
      'task_steps',
      'task_targets',
      'tasks'
    ])
    assert.equal(database.pragma('foreign_keys', { simple: true }), 1)
    assert.equal(database.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count, 1)

    migrateDatabase(database)
    assert.equal(database.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count, 1)
  } finally {
    database.close()
  }
})

test('录制数据与会话摘要分表并受级联删除保护', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'insightux-database-'))
  const database = openDatabase(path.join(directory, 'data.db'))
  const now = new Date().toISOString()
  try {
    database.prepare(`
      INSERT INTO tasks (id, public_token, name, scenario, status, created_at, updated_at)
      VALUES ('task-1', 'public-1', '任务', 'generic-web', 'active', ?, ?)
    `).run(now, now)
    database.prepare(`
      INSERT INTO sessions (
        id, task_id, sequence_number, participant_code, session_token_hash,
        mode, status, consent_at, created_at, updated_at
      ) VALUES ('session-1', 'task-1', 1, 'P-001', 'hash', 'participant', 'created', ?, ?, ?)
    `).run(now, now, now)
    database.prepare(`
      INSERT INTO session_recordings (session_id, created_at, updated_at)
      VALUES ('session-1', ?, ?)
    `).run(now, now)

    assert.equal(database.prepare('SELECT COUNT(*) count FROM sessions').get().count, 1)
    assert.equal(database.prepare('SELECT COUNT(*) count FROM session_recordings').get().count, 1)
    database.prepare("DELETE FROM tasks WHERE id = 'task-1'").run()
    assert.equal(database.prepare('SELECT COUNT(*) count FROM sessions').get().count, 0)
    assert.equal(database.prepare('SELECT COUNT(*) count FROM session_recordings').get().count, 0)
  } finally {
    database.close()
  }
})
