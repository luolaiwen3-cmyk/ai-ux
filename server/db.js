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
  scenario: row.target_type === 'builtin' ? row.scenario : 'generic-web',
  targetType: row.target_type || 'builtin',
  targetStatus: row.target_status || 'ready',
  targetUrl: row.target_url || null,
  targetOrigin: row.target_origin || null,
  contentToken: row.content_token || null,
  contentRevision: row.content_revision || null,
  validatedAt: row.validated_at || null,
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
  mode: row.mode || 'participant',
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
      target_type TEXT NOT NULL DEFAULT 'builtin' CHECK (target_type IN ('builtin', 'upload', 'url')),
      target_status TEXT NOT NULL DEFAULT 'ready' CHECK (target_status IN ('pending', 'ready', 'invalid')),
      target_url TEXT,
      target_origin TEXT,
      content_token TEXT,
      content_revision TEXT,
      validated_at TEXT,
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
      mode TEXT NOT NULL DEFAULT 'participant' CHECK (mode IN ('participant', 'trial')),
      status TEXT NOT NULL CHECK (status IN ('created', 'recording', 'completed', 'abandoned')),
      consent_at TEXT NOT NULL,
      started_at TEXT,
      completed_at TEXT,
      coupon_decision TEXT NOT NULL DEFAULT 'none' CHECK (coupon_decision IN ('none', 'applied', 'declined')),
      rrweb_events_json TEXT,
      face_frames_json TEXT,
      metrics_json TEXT,
      result_json TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0,
      event_count INTEGER NOT NULL DEFAULT 0,
      frame_count INTEGER NOT NULL DEFAULT 0,
      last_emotion_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS diagnoses (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id) ON DELETE CASCADE,
      status TEXT NOT NULL CHECK (status IN ('completed', 'failed')),
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      result_json TEXT,
      fallback_reason TEXT,
      share_token TEXT NOT NULL UNIQUE,
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

  const ensureColumn = (table, column, definition) => {
    const columns = database.prepare(`PRAGMA table_info(${table})`).all()
    if (!columns.some((item) => item.name === column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
    }
  }

  ensureColumn('tasks', 'target_type', "TEXT NOT NULL DEFAULT 'builtin' CHECK (target_type IN ('builtin', 'upload', 'url'))")
  ensureColumn('tasks', 'target_status', "TEXT NOT NULL DEFAULT 'ready' CHECK (target_status IN ('pending', 'ready', 'invalid'))")
  ensureColumn('tasks', 'target_url', 'TEXT')
  ensureColumn('tasks', 'target_origin', 'TEXT')
  ensureColumn('tasks', 'content_token', 'TEXT')
  ensureColumn('tasks', 'content_revision', 'TEXT')
  ensureColumn('tasks', 'validated_at', 'TEXT')
  ensureColumn('sessions', 'mode', "TEXT NOT NULL DEFAULT 'participant' CHECK (mode IN ('participant', 'trial'))")
  ensureColumn('sessions', 'result_json', 'TEXT')

  const taskSelect = `
    SELECT tasks.*,
      (SELECT COUNT(*) FROM sessions WHERE sessions.task_id = tasks.id AND sessions.mode = 'participant') AS session_count
    FROM tasks
  `

  const sessionSelect = `
    SELECT sessions.*, tasks.name AS task_name,
      tasks.target_type AS task_target_type,
      tasks.target_status AS task_target_status,
      tasks.target_url AS task_target_url,
      tasks.target_origin AS task_target_origin,
      tasks.content_token AS task_content_token,
      tasks.content_revision AS task_content_revision,
      tasks.scenario AS task_scenario,
      tasks.steps_json AS task_steps_json,
      diagnoses.status AS diagnosis_status,
      json_extract(diagnoses.result_json, '$.severity') AS severity
    FROM sessions
    JOIN tasks ON tasks.id = sessions.task_id
    LEFT JOIN diagnoses ON diagnoses.session_id = sessions.id
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
        targetType: 'builtin',
        targetStatus: 'ready',
        steps: ['确认购物车商品', '处理优惠券提示', '提交订单'],
        status: 'active'
      }
      database.prepare(`
        INSERT INTO tasks (id, token, name, description, scenario, target_type, target_status, validated_at, steps_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.token, task.name, task.description, task.scenario, task.targetType, task.targetStatus, timestamp, JSON.stringify(task.steps), task.status, timestamp, timestamp)
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
        targetType: input.targetType || 'builtin',
        targetStatus: (input.targetType || 'builtin') === 'builtin' ? 'ready' : 'pending',
        targetUrl: input.targetUrl || null,
        steps: input.steps,
        status: input.status || 'draft'
      }
      if (task.status === 'active' && task.targetStatus !== 'ready') {
        throw new HttpError(409, '测试网页验证通过后才能发布', 'TARGET_NOT_READY')
      }
      database.prepare(`
        INSERT INTO tasks (id, token, name, description, scenario, target_type, target_status, target_url, validated_at, steps_json, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(task.id, task.token, task.name, task.description, task.scenario, task.targetType, task.targetStatus, task.targetUrl, task.targetStatus === 'ready' ? timestamp : null, JSON.stringify(task.steps), task.status, timestamp, timestamp)
      return store.getTask(task.id)
    },

    updateTask(id, input) {
      const current = store.getTask(id)
      if (!current) throw new HttpError(404, '任务不存在', 'TASK_NOT_FOUND')
      const next = {
        name: input.name ?? current.name,
        description: input.description ?? current.description,
        steps: input.steps ?? current.steps,
        status: input.status ?? current.status,
        targetUrl: input.targetUrl ?? current.targetUrl,
        targetStatus: input.targetStatus ?? current.targetStatus,
        targetOrigin: input.targetOrigin ?? current.targetOrigin,
        contentToken: input.contentToken ?? current.contentToken,
        contentRevision: input.contentRevision ?? current.contentRevision,
        validatedAt: input.validatedAt ?? current.validatedAt
      }
      if (input.targetUrl !== undefined && input.targetUrl !== current.targetUrl) {
        next.targetStatus = 'pending'
        next.targetOrigin = null
        next.validatedAt = null
        if (next.status === 'active') next.status = 'draft'
      }
      if (next.status === 'active' && next.targetStatus !== 'ready') {
        throw new HttpError(409, '测试网页验证通过后才能发布', 'TARGET_NOT_READY')
      }
      database.prepare(`
        UPDATE tasks SET name = ?, description = ?, steps_json = ?, status = ?, target_url = ?,
          target_status = ?, target_origin = ?, content_token = ?, content_revision = ?, validated_at = ?, updated_at = ?
        WHERE id = ?
      `).run(next.name, next.description, JSON.stringify(next.steps), next.status, next.targetUrl,
        next.targetStatus, next.targetOrigin, next.contentToken, next.contentRevision, next.validatedAt, nowIso(), id)
      return store.getTask(id)
    },

    createSession(taskId, { mode = 'participant', allowInactive = false } = {}) {
      const task = store.getTask(taskId)
      if (!task || (!allowInactive && task.status !== 'active')) {
        throw new HttpError(409, '任务当前不可参与', 'TASK_NOT_ACTIVE')
      }
      if (task.targetStatus !== 'ready') {
        throw new HttpError(409, '测试网页尚未验证', 'TARGET_NOT_READY')
      }
      const sequence = Number(database.prepare('SELECT COUNT(*) AS count FROM sessions WHERE task_id = ? AND mode = ?').get(taskId, mode).count) + 1
      const uploadToken = createOpaqueToken(24)
      const timestamp = nowIso()
      const session = {
        id: randomUUID(),
        participantCode: `${mode === 'trial' ? 'T' : 'P'}-${String(sequence).padStart(3, '0')}`,
        uploadToken
      }
      database.prepare(`
        INSERT INTO sessions (
          id, task_id, participant_code, upload_token_hash, mode, status, consent_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, 'created', ?, ?, ?)
      `).run(session.id, taskId, session.participantCode, hashToken(uploadToken), mode, timestamp, timestamp, timestamp)
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
      return {
        ...summary,
        scenario: row.task_target_type === 'builtin' ? row.task_scenario : 'generic-web',
        steps: parseJson(row.task_steps_json, []),
        target: {
          type: row.task_target_type,
          status: row.task_target_status,
          url: row.task_target_url,
          origin: row.task_target_origin,
          contentToken: row.task_content_token,
          revision: row.task_content_revision
        }
      }
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
          rrweb_events_json = ?, face_frames_json = ?, metrics_json = ?, result_json = ?,
          duration_ms = ?, event_count = ?, frame_count = ?, last_emotion_json = ?, updated_at = ?
        WHERE id = ?
      `).run(
        timestamp,
        input.couponDecision,
        JSON.stringify(events),
        JSON.stringify(frames),
        JSON.stringify({ ...metrics, taskResult: input.metrics || {} }),
        JSON.stringify(input.result || {}),
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

    listSessions({ status, sort = 'desc', scope = 'participant' } = {}) {
      const conditions = []
      const parameters = []
      if (status) {
        conditions.push('sessions.status = ?')
        parameters.push(status)
      }
      if (scope !== 'all') {
        conditions.push('sessions.mode = ?')
        parameters.push(scope === 'trial' ? 'trial' : 'participant')
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const direction = sort === 'asc' ? 'ASC' : 'DESC'
      return database.prepare(`${sessionSelect}${where} ORDER BY sessions.created_at ${direction}`).all(...parameters).map(mapSessionSummary)
    },

    getSession(id) {
      const row = database.prepare(`${sessionSelect} WHERE sessions.id = ?`).get(id)
      if (!row) return null
      const diagnosis = store.getDiagnosis(id)
      return {
        ...mapSessionSummary(row),
        events: parseJson(row.rrweb_events_json, []),
        faceFrames: parseJson(row.face_frames_json, []),
        metrics: parseJson(row.metrics_json, {}),
        result: parseJson(row.result_json, {}),
        diagnosis
      }
    },

    saveDiagnosis(sessionId, diagnosis) {
      const timestamp = nowIso()
      const existing = database.prepare('SELECT * FROM diagnoses WHERE session_id = ?').get(sessionId)
      const shareToken = existing?.share_token || createOpaqueToken(18)
      if (existing) {
        database.prepare(`
          UPDATE diagnoses SET status = 'completed', provider = ?, model = ?, result_json = ?,
            fallback_reason = ?, updated_at = ? WHERE session_id = ?
        `).run(diagnosis.provider, diagnosis.model, JSON.stringify(diagnosis.result), diagnosis.fallbackReason, timestamp, sessionId)
      } else {
        database.prepare(`
          INSERT INTO diagnoses (id, session_id, status, provider, model, result_json, fallback_reason, share_token, created_at, updated_at)
          VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
        `).run(randomUUID(), sessionId, diagnosis.provider, diagnosis.model, JSON.stringify(diagnosis.result), diagnosis.fallbackReason, shareToken, timestamp, timestamp)
      }
      return store.getDiagnosis(sessionId)
    },

    getDiagnosis(sessionId) {
      const row = database.prepare('SELECT * FROM diagnoses WHERE session_id = ?').get(sessionId)
      return row && {
        status: row.status,
        provider: row.provider,
        model: row.model,
        result: parseJson(row.result_json, null),
        fallbackReason: row.fallback_reason,
        shareToken: row.share_token,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }
    },

    getSharedReport(token) {
      const row = database.prepare('SELECT session_id FROM diagnoses WHERE share_token = ? AND status = \'completed\'').get(token)
      return row ? store.getSession(row.session_id) : null
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
