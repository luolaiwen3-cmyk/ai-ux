const parseJson = (value, fallback) => {
  if (!value) return fallback
  try {
    return JSON.parse(value)
  } catch {
    return fallback
  }
}

const taskSelect = `
  SELECT tasks.*, task_targets.type AS target_type,
    task_targets.status AS target_status,
    task_targets.url AS target_url,
    task_targets.origin AS target_origin,
    task_targets.content_token,
    task_targets.content_revision,
    task_targets.validated_at,
    (SELECT COUNT(*) FROM sessions
      WHERE sessions.task_id = tasks.id AND sessions.mode = 'participant') AS session_count
  FROM tasks
  JOIN task_targets ON task_targets.task_id = tasks.id
`

const sessionSelect = `
  SELECT sessions.*, tasks.name AS task_name, tasks.scenario AS task_scenario,
    task_targets.type AS task_target_type,
    task_targets.status AS task_target_status,
    task_targets.url AS task_target_url,
    task_targets.origin AS task_target_origin,
    task_targets.content_token AS task_content_token,
    task_targets.content_revision AS task_content_revision,
    diagnoses.status AS diagnosis_status,
    json_extract(diagnoses.result_json, '$.severity') AS severity
  FROM sessions
  JOIN tasks ON tasks.id = sessions.task_id
  JOIN task_targets ON task_targets.task_id = tasks.id
  LEFT JOIN diagnoses ON diagnoses.session_id = sessions.id
`

const mapTaskRow = (row, steps) => row && ({
  id: row.id,
  token: row.public_token,
  name: row.name,
  description: row.description,
  scenario: row.target_type === 'builtin' ? row.scenario : 'generic-web',
  targetType: row.target_type,
  targetStatus: row.target_status,
  targetUrl: row.target_url,
  targetOrigin: row.target_origin,
  contentToken: row.content_token,
  contentRevision: row.content_revision,
  validatedAt: row.validated_at,
  steps,
  status: row.status,
  sessionCount: Number(row.session_count || 0),
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

const mapSessionSummary = (row) => row && ({
  id: row.id,
  taskId: row.task_id,
  taskName: row.task_name,
  scenario: row.task_target_type === 'builtin' ? row.task_scenario : 'generic-web',
  targetType: row.task_target_type,
  participantCode: row.participant_code,
  mode: row.mode,
  status: row.status,
  couponDecision: row.coupon_decision || 'none',
  duration: Number(row.duration_ms || 0),
  eventCount: Number(row.event_count || 0),
  frameCount: Number(row.frame_count || 0),
  hasFace: Number(row.frame_count || 0) > 0,
  lastEmotion: parseJson(row.last_emotion_json, null),
  diagnosisStatus: row.diagnosis_status || null,
  severity: row.severity || null,
  consentAt: row.consent_at,
  startedAt: row.started_at,
  completedAt: row.completed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at
})

export function createRepositories(database) {
  const stepsForTask = database.prepare(`
    SELECT instruction FROM task_steps WHERE task_id = ? ORDER BY position
  `)
  const taskById = database.prepare(`${taskSelect} WHERE tasks.id = ?`)

  const mapTask = (row) => mapTaskRow(
    row,
    row ? stepsForTask.all(row.id).map((step) => step.instruction) : []
  )

  const tasks = {
    count() {
      return Number(database.prepare('SELECT COUNT(*) count FROM tasks').get().count)
    },

    list() {
      return database.prepare(`${taskSelect} ORDER BY tasks.created_at DESC`).all().map(mapTask)
    },

    findById(id) {
      return mapTask(taskById.get(id))
    },

    findByPublicToken(token) {
      return mapTask(database.prepare(`${taskSelect}
        WHERE tasks.public_token = ? AND tasks.status = 'active'
      `).get(token))
    },

    findByContentToken(token) {
      return mapTask(database.prepare(`${taskSelect}
        WHERE task_targets.content_token = ?
      `).get(token))
    },

    create(task) {
      database.transaction(() => {
        database.prepare(`
          INSERT INTO tasks (
            id, public_token, name, description, scenario, status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id, task.token, task.name, task.description, task.scenario,
          task.status, task.createdAt, task.updatedAt
        )
        const insertStep = database.prepare(`
          INSERT INTO task_steps (task_id, position, instruction) VALUES (?, ?, ?)
        `)
        task.steps.forEach((instruction, position) => insertStep.run(task.id, position, instruction))
        database.prepare(`
          INSERT INTO task_targets (
            task_id, type, status, url, origin, content_token, content_revision, validated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          task.id, task.targetType, task.targetStatus, task.targetUrl,
          task.targetOrigin, task.contentToken, task.contentRevision, task.validatedAt
        )
      })()
      return tasks.findById(task.id)
    },

    update(id, task) {
      database.transaction(() => {
        database.prepare(`
          UPDATE tasks SET name = ?, description = ?, status = ?, updated_at = ? WHERE id = ?
        `).run(task.name, task.description, task.status, task.updatedAt, id)
        database.prepare(`
          UPDATE task_targets SET status = ?, url = ?, origin = ?, content_token = ?,
            content_revision = ?, validated_at = ? WHERE task_id = ?
        `).run(
          task.targetStatus, task.targetUrl, task.targetOrigin, task.contentToken,
          task.contentRevision, task.validatedAt, id
        )
        if (task.steps) {
          database.prepare('DELETE FROM task_steps WHERE task_id = ?').run(id)
          const insertStep = database.prepare(`
            INSERT INTO task_steps (task_id, position, instruction) VALUES (?, ?, ?)
          `)
          task.steps.forEach((instruction, position) => insertStep.run(id, position, instruction))
        }
      })()
      return tasks.findById(id)
    }
  }

  const sessions = {
    create({ id, taskId, tokenHash, mode, consentAt, createdAt }) {
      return database.transaction(() => {
        const sequenceNumber = Number(database.prepare(`
          SELECT COALESCE(MAX(sequence_number), 0) + 1 AS next
          FROM sessions WHERE task_id = ? AND mode = ?
        `).get(taskId, mode).next)
        const participantCode = `${mode === 'trial' ? 'T' : 'P'}-${String(sequenceNumber).padStart(3, '0')}`
        database.prepare(`
          INSERT INTO sessions (
            id, task_id, sequence_number, participant_code, session_token_hash,
            mode, status, consent_at, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, 'created', ?, ?, ?)
        `).run(
          id, taskId, sequenceNumber, participantCode, tokenHash,
          mode, consentAt, createdAt, createdAt
        )
        return { id, participantCode }
      })()
    },

    findAccessRecord(id) {
      return database.prepare('SELECT * FROM sessions WHERE id = ?').get(id) || null
    },

    findPublic(id) {
      const row = database.prepare(`${sessionSelect} WHERE sessions.id = ?`).get(id)
      if (!row) return null
      return {
        ...mapSessionSummary(row),
        steps: stepsForTask.all(row.task_id).map((step) => step.instruction),
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

    markStarted(id, timestamp) {
      database.prepare(`
        UPDATE sessions SET status = 'recording', started_at = COALESCE(started_at, ?),
          updated_at = ? WHERE id = ?
      `).run(timestamp, timestamp, id)
      return sessions.findPublic(id)
    },

    complete(id, summary, recording, timestamp) {
      database.transaction(() => {
        database.prepare(`
          UPDATE sessions SET status = 'completed', completed_at = ?, coupon_decision = ?,
            duration_ms = ?, event_count = ?, frame_count = ?, last_emotion_json = ?,
            updated_at = ? WHERE id = ?
        `).run(
          timestamp, summary.couponDecision, summary.duration, summary.eventCount,
          summary.frameCount, summary.lastEmotion ? JSON.stringify(summary.lastEmotion) : null,
          timestamp, id
        )
        database.prepare(`
          INSERT INTO session_recordings (
            session_id, rrweb_events_json, face_frames_json, metrics_json,
            task_result_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(session_id) DO UPDATE SET
            rrweb_events_json = excluded.rrweb_events_json,
            face_frames_json = excluded.face_frames_json,
            metrics_json = excluded.metrics_json,
            task_result_json = excluded.task_result_json,
            updated_at = excluded.updated_at
        `).run(
          id, JSON.stringify(recording.events), JSON.stringify(recording.faceFrames),
          JSON.stringify(recording.metrics), JSON.stringify(recording.result), timestamp, timestamp
        )
      })()
      return sessions.findDetail(id)
    },

    abandon(id, timestamp) {
      database.transaction(() => {
        database.prepare(`
          UPDATE sessions SET status = 'abandoned', duration_ms = 0, event_count = 0,
            frame_count = 0, last_emotion_json = NULL, updated_at = ? WHERE id = ?
        `).run(timestamp, id)
        database.prepare('DELETE FROM session_recordings WHERE session_id = ?').run(id)
      })()
    },

    list({ status, mode = 'participant', sort = 'desc' } = {}) {
      const conditions = []
      const parameters = []
      if (status) {
        conditions.push('sessions.status = ?')
        parameters.push(status)
      }
      if (mode !== 'all') {
        conditions.push('sessions.mode = ?')
        parameters.push(mode)
      }
      const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : ''
      const direction = sort === 'asc' ? 'ASC' : 'DESC'
      return database.prepare(`${sessionSelect}${where}
        ORDER BY sessions.created_at ${direction}
      `).all(...parameters).map(mapSessionSummary)
    },

    findDetail(id) {
      const row = database.prepare(`${sessionSelect} WHERE sessions.id = ?`).get(id)
      if (!row) return null
      const recording = database.prepare(`
        SELECT * FROM session_recordings WHERE session_id = ?
      `).get(id)
      return {
        ...mapSessionSummary(row),
        events: parseJson(recording?.rrweb_events_json, []),
        faceFrames: parseJson(recording?.face_frames_json, []),
        metrics: parseJson(recording?.metrics_json, {}),
        result: parseJson(recording?.task_result_json, {})
      }
    }
  }

  const diagnoses = {
    findBySessionId(sessionId) {
      const row = database.prepare('SELECT * FROM diagnoses WHERE session_id = ?').get(sessionId)
      return row && {
        id: row.id,
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

    save({ id, sessionId, provider, model, result, fallbackReason, shareToken, timestamp }) {
      database.prepare(`
        INSERT INTO diagnoses (
          id, session_id, status, provider, model, result_json, fallback_reason,
          share_token, created_at, updated_at
        ) VALUES (?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(session_id) DO UPDATE SET
          status = 'completed', provider = excluded.provider, model = excluded.model,
          result_json = excluded.result_json, fallback_reason = excluded.fallback_reason,
          updated_at = excluded.updated_at
      `).run(
        id, sessionId, provider, model, JSON.stringify(result), fallbackReason,
        shareToken, timestamp, timestamp
      )
      return diagnoses.findBySessionId(sessionId)
    },

    findSessionIdByShareToken(token) {
      return database.prepare(`
        SELECT session_id FROM diagnoses WHERE share_token = ? AND status = 'completed'
      `).get(token)?.session_id || null
    }
  }

  return { tasks, sessions, diagnoses }
}
