import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import Database from 'better-sqlite3'
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
    assert.equal(database.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count, 2)
    const diagnosisColumns = database.prepare('PRAGMA table_info(diagnoses)').all()
      .map((column) => column.name)
    assert.ok(diagnosisColumns.includes('attempt_count'))
    assert.ok(diagnosisColumns.includes('next_attempt_at'))

    migrateDatabase(database)
    assert.equal(database.prepare('SELECT COUNT(*) count FROM schema_migrations').get().count, 2)
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

test('异步诊断迁移保留旧版已完成报告', () => {
  const database = new Database(':memory:')
  const now = new Date().toISOString()
  try {
    database.pragma('foreign_keys = ON')
    database.exec(`
      CREATE TABLE schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL
      ) STRICT
    `)
    database.exec(readFileSync('server/db/migrations/001_initial.sql', 'utf8'))
    database.prepare(`
      INSERT INTO schema_migrations (version, name, applied_at)
      VALUES (1, '001_initial.sql', ?)
    `).run(now)
    database.prepare(`
      INSERT INTO tasks (id, public_token, name, scenario, status, created_at, updated_at)
      VALUES ('task-legacy', 'legacy-token', '旧任务', 'checkout-coupon', 'active', ?, ?)
    `).run(now, now)
    database.prepare(`
      INSERT INTO sessions (
        id, task_id, sequence_number, participant_code, session_token_hash,
        mode, status, consent_at, created_at, updated_at
      ) VALUES (
        'session-legacy', 'task-legacy', 1, 'P-001', 'hash',
        'participant', 'completed', ?, ?, ?
      )
    `).run(now, now, now)
    database.prepare(`
      INSERT INTO diagnoses (
        id, session_id, status, provider, model, result_json,
        share_token, created_at, updated_at
      ) VALUES (
        'diagnosis-legacy', 'session-legacy', 'completed', 'local-rules',
        'rules-v1', '{"severity":"P2"}', 'share-legacy', ?, ?
      )
    `).run(now, now)

    migrateDatabase(database)
    const diagnosis = database.prepare(`
      SELECT * FROM diagnoses WHERE session_id = 'session-legacy'
    `).get()
    assert.equal(diagnosis.status, 'completed')
    assert.equal(diagnosis.attempt_count, 1)
    assert.equal(diagnosis.share_token, 'share-legacy')
    assert.equal(JSON.parse(diagnosis.result_json).severity, 'P2')
  } finally {
    database.close()
  }
})
