import { mkdirSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const migrationsDir = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  'db',
  'migrations'
)

const migrationFiles = () => readdirSync(migrationsDir)
  .filter((name) => /^\d+_.+\.sql$/.test(name))
  .sort((left, right) => left.localeCompare(right))

export function migrateDatabase(database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL
    ) STRICT
  `)

  const applied = new Map(
    database.prepare('SELECT version, name FROM schema_migrations').all()
      .map((migration) => [migration.version, migration.name])
  )
  const recordMigration = database.prepare(`
    INSERT INTO schema_migrations (version, name, applied_at)
    VALUES (?, ?, ?)
  `)

  for (const name of migrationFiles()) {
    const version = Number(name.split('_', 1)[0])
    if (applied.has(version)) {
      if (applied.get(version) !== name) {
        throw new Error(`数据库迁移版本 ${version} 已被 ${applied.get(version)} 占用`)
      }
      continue
    }

    const sql = readFileSync(path.join(migrationsDir, name), 'utf8')
    database.transaction(() => {
      database.exec(sql)
      recordMigration.run(version, name, new Date().toISOString())
    })()
  }
}

export function openDatabase(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const database = new Database(databasePath, { timeout: 5000 })
  database.pragma('foreign_keys = ON')
  database.pragma('journal_mode = WAL')
  migrateDatabase(database)
  return database
}
