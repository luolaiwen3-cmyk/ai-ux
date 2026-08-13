import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import { DatabaseSync } from 'node:sqlite'
import { createOpaqueToken, hashToken } from './auth.js'
import { HttpError } from './http.js'
import { analyzeSession } from './metrics.js'

const nowIso = () => new Date().toISOString()

const parseJson = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const mapTask = (row) => row && ({
  id: row.id,
  token: row.token,
  name: row.name,
  description: row.description,
  scenario: row.scenario,
  steps: parseJson(row.steps_json, []),
  status: row.status,
  sessionCount: Number(row.session_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapSessionSummary = (row) => row && ({
  id: row.id,
  taskId: row.task_id,
  taskName: row.task_name,
  participantCode: row.participant_code,
  status: row.status,
  couponDecision: row.coupon_decision,
  duration: Number(row.duration_ms || 0),
  eventCount: Number(row.event_count || 0),
  frameCount: Number(row.frame_count || 0),
  hasFace: Number(row.frame_count || 0) > 0,
  lastEmotion: parseJson(row.last_emotion_json, null),
  diagnosisStatus: row.diagnosis_status || null,
  severity: row.severity || parseJson(row.metrics_json, {}).severity || null,
  consentAt: row.consent_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export function createStore(databasePath) {
  if (databasePath !== ':memory:') {
    mkdirSync(path.dirname(databasePath), { recursive: true })
  }

  const database = new DatabaseSync(databasePath)
  database.exec('PRAGMA foreign_keys = ON')
  database.exec('PRAGMA journal_mode = WAL')

  const schemaStatements = [
    `CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      token TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      scenario TEXT NOT NULL CHECK (scenario IN ('checkout-coupon')),
      steps_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK (status IN ('draft', 'active', 'paused')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
      participant_code TEXT NOT NULL,
      upload_token_hash TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('created', 'recording', 'completed', 'abandoned')),
      consent_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      coupon_decision TEXT NOT NULL DEFAULT 'none' CHECK (coupon_decision IN ('none', 'applied', 'declined')),
      rrweb_events_json TEXT,
      face_frames_json TEXT,
      metrics_json TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      frame_count INTEGER NOT NULL DEFAULT 0,
      last_emotion_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    'CREATE INDEX IF NOT EXISTS sessions_task_id_idx ON sessions(task_id)',
    'CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions(created_at DESC)'
  ]
  database.exec('BEGIN')
  try {
    schemaStatements.forEach((statement) => database.prepare(statement).run())
    database.exec('COMMIT')
  } catch (error) {
    database.exec('ROLLBACK')
    throw error
  }

  const taskSelect = `
    SELECT tasks.*,
      (SELECT COUNT(*) FROM sessions WHERE sessions.task_id = tasks.id) AS session_count
    FROM tasks
  `

  const sessionSelect = `
    SELECT sessions.*, tasks.name AS task_name,
      NULL AS diagnosis_status, NULL AS severity
    FROM sessions
    JOIN tasks ON tasks.id = sessions.task_id
  `

  const store = {
    close() {
      database.close()
    },

    seedDemoTask() {
      const count = database.prepare('SELECT COUNT(*) AS count FROM tasks').get().count
      if (count > 0) return null
      const timestamp = nowIso()
      const task = {
        id: randomUUID(),
        token: 'abc123',
        name: '电商结算页优惠券测试',
        description: '请像日常购物一样检查商品、处理优惠券并提交订单。',
        scenario: 'checkout-coupon',
        steps: ['确认购物车商品', '处理优惠券提示', '提交订单'],
        status: 'active'
      }
      database.prepare(`
        INSERT INTO tasks (id, token, name, description, scenario, steps_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.token, task.name, task.description, task.scenario, JSON.stringify(task.steps), task.status, timestamp, timestamp)
      return task
    },

    listTasks() {
      return database.prepare(`${taskSelect} ORDER BY tasks.created_at DESC`).all().map(mapTask)
    },

    getTask(id) {
      return mapTask(database.prepare(`${taskSelect} WHERE tasks.id = ?`).get(id))
    },

    getPublicTask(token) {
      return mapTask(database.prepare(`${taskSelect} WHERE tasks.token = ? AND tasks.status = 'active'`).get(token))
    },

    createTask(input) {
      const timestamp = nowIso()
      const task = {
        id: randomUUID(),
        token: createOpaqueToken(12),
        name: input.name,
        description: input.description || '',
        scenario: 'checkout-coupon',
        steps: input.steps,
        status: input.status || 'draft'
      }
      database.prepare(`
        INSERT INTO tasks (id, token, name, description, scenario, steps_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.token, task.name, task.description, task.scenario, JSON.stringify(task.steps), task.status, timestamp, timestamp)
      return store.getTask(task.id)
    },

    updateTask(id, input) {
      const current = store.getTask(id)
      if (!current) throw new HttpError(404, '任务不存在', 'TASK_NOT_FOUND')
      const next = {
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        steps: input.steps ?? current.steps,
        status: input.status ?? current.status
      }
      database.prepare(`
        UPDATE tasks SET name = ?, description = ?, steps_json = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(next.name, next.description, JSON.stringify(next.steps), next.status, nowIso(), id)
      return store.getTask(id)
    },

    createSession(taskId) {
      const task = store.getTask(taskId)
      if (!task || task.status !== 'active') {
        throw new HttpError(409, '任务当前不可参与', 'TASK_NOT_ACTIVE')
      }
      const sequence = Number(database.prepare('SELECT COUNT(*) AS count FROM sessions WHERE task_id = ?').get(taskId).count) + 1
      const uploadToken = createOpaqueToken(24)
      const timestamp = nowIso()
      const session = {
        id: randomUUID(),
        participantCode: `P-${String(sequence).padStart(3, '0')}`,
        uploadToken
      }
      database.prepare(`
        INSERT INTO sessions (
          id, task_id, participant_code, upload_token_hash, status, consent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, 'created', ?, ?, ?)
      `).run(session.id, taskId, session.participantCode, hashToken(uploadToken), timestamp, timestamp, timestamp)
      return session
    },

    getSessionForUpload(id) {
      return database.prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null
    },

    verifySessionToken(id, token) {
      const session = store.getSessionForUpload(id)
      return Boolean(session && token && session.upload_token_hash === hashToken(token))
    },

    getPublicSession(id) {
      const row = database.prepare(`${sessionSelect} WHERE sessions.id = ?`).get(id)
      if (!row) return null
      const summary = mapSessionSummary(row)
      return { ...summary, scenario: 'checkout-coupon' }
    },

    startSession(id) {
      const session = store.getSessionForUpload(id)
      if (!session) throw new HttpError(404, '会话不存在', 'SESSION_NOT_FOUND')
      if (session.status === 'completed' || session.status === 'abandoned') {
        throw new HttpError(409, '会话已经结束', 'SESSION_FINISHED')
      }
      const timestamp = nowIso()
      database.prepare(`
        UPDATE sessions SET status = 'recording', started_at = COALESCE(started_at, ?), updated_at = ? WHERE id = ?
      `).run(timestamp, timestamp, id)
      return store.getPublicSession(id)
    },

    completeSession(id, input) {
      const session = store.getSessionForUpload(id)
      if (!session) throw new HttpError(404, '会话不存在', 'SESSION_NOT_FOUND')
      if (session.status === 'completed') return store.getSession(id)
      if (session.status === 'abandoned') throw new HttpError(409, '会话已经退出', 'SESSION_ABANDONED')

      const events = Array.isArray(input.events) ? input.events : []
      const frames = Array.isArray(input.faceFrames) ? input.faceFrames : []
      const lastEmotion = [...frames].reverse().find((frame) => frame?.emotion)?.emotion || null
      const metrics = analyzeSession(events, frames, input.couponDecision)
      const timestamp = nowIso()
      database.prepare(`
        UPDATE sessions SET
          status = 'completed', completed_at = ?, coupon_decision = ?,
          rrweb_events_json = ?, face_frames_json = ?, metrics_json = ?,
          duration_ms = ?, event_count = ?, frame_count = ?, last_emotion_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        timestamp,
        input.couponDecision,
        JSON.stringify(events),
        JSON.stringify(frames),
        JSON.stringify({ ...metrics, taskResult: input.metrics || {} }),
        metrics.totalDurationMs || Math.max(0, Math.round(Number(input.duration) || 0)),
        events.length,
        frames.length,
        lastEmotion ? JSON.stringify(lastEmotion) : null,
        timestamp,
        id
      )
      return store.getSession(id)
    },

    abandonSession(id) {
      const session = store.getSessionForUpload(id)
      if (!session) return false
      if (session.status === 'completed') throw new HttpError(409, '已完成会话不能删除', 'SESSION_COMPLETED')
      database.prepare(`
        UPDATE sessions SET status = 'abandoned', rrweb_events_json = NULL,
          face_frames_json = NULL, metrics_json = NULL, event_count = 0, frame_count = 0, updated_at = ?
        WHERE id = ?
      `).run(nowIso(), id)
      return true
    },

    listSessions({ status, sort = 'desc' } = {}) {
      const conditions = []
      const parameters = []
      if (status) {
        conditions.push('sessions.status = ?')
        parameters.push(status)
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const direction = sort === 'asc' ? 'ASC' : 'DESC'
      return database.prepare(`${sessionSelect}${where} ORDER BY sessions.created_at ${direction}`).all(...parameters).map(mapSessionSummary)
    },

    getSession(id) {
      const row = database.prepare(`${sessionSelect} WHERE sessions.id = ?`).get(id)
      if (!row) return null
      return {
        ...mapSessionSummary(row),
        events: parseJson(row.rrweb_events_json, []),
        faceFrames: parseJson(row.face_frames_json, []),
        metrics: parseJson(row.metrics_json, {})
      }
    },

    getDashboardStats() {
      const sessions = store.listSessions()
      const completed = sessions.filter((session) => session.status === 'completed')
      const diagnosed = completed.filter((session) => session.severity)
      const p0Count = diagnosed.filter((session) => session.severity === 'P0').length
      const issueCount = diagnosed.filter((session) => session.severity !== 'P2').length
      const trend = new Map()
      completed.forEach((session) => {
        const day = session.completedAt?.slice(5, 10) || session.createdAt.slice(5, 10)
        const current = trend.get(day) || { day, sessions: 0, issues: 0 }
        current.sessions += 1
        if (session.severity === 'P0' || session.severity === 'P1') current.issues += 1
        trend.set(day, current)
      })

      return {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        p0Count,
        totalIssues: issueCount,
        sessionsWithFace: sessions.filter((session) => session.hasFace).length,
        trendData: [...trend.values()].sort((left, right) => left.day.localeCompare(right.day)),
        issueDist: [
          { type: '高认知压力', count: p0Count },
          { type: '操作犹豫', count: diagnosed.filter((session) => session.severity === 'P1').length },
          { type: '流程顺畅', count: diagnosed.filter((session) => session.severity === 'P2').length }
        ],
        recentSessions: sessions.slice(0, 5)
      }
    }
  }

  return store
}
