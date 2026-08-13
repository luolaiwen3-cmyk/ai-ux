import assert from 'node:assert/strict'
import { DatabaseSync } from 'node:sqlite'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { createStore } from '../server/db.js'

test('任务 Token 可以创建并完成唯一会话', () => {
  const store = createStore(':memory:')
  try {
    const task = store.createTask({
      name: '结算流程测试',
      description: '完成结算',
      steps: ['选择商品', '提交订单'],
      status: 'active'
    })

    assert.equal(store.getPublicTask(task.token).id, task.id)

    const first = store.createSession(task.id)
    const second = store.createSession(task.id)
    assert.notEqual(first.id, second.id)
    assert.equal(first.participantCode, 'P-001')
    assert.equal(second.participantCode, 'P-002')
    assert.equal(store.verifySessionToken(first.id, first.uploadToken), true)
    assert.equal(store.verifySessionToken(first.id, second.uploadToken), false)

    store.startSession(first.id)
    const completed = store.completeSession(first.id, {
      events: [{ type: 0, timestamp: 1000 }, { type: 3, timestamp: 4200 }],
      faceFrames: [{ t: 1000, emotion: { label: 'Focus', value: 0.4 } }],
      couponDecision: 'applied',
      duration: 3200,
      metrics: { totalClicks: 1 }
    })

    assert.equal(completed.status, 'completed')
    assert.equal(completed.couponDecision, 'applied')
    assert.equal(completed.duration, 3200)
    assert.equal(completed.eventCount, 2)
    assert.equal(completed.frameCount, 1)
    assert.equal(completed.metrics.totalDurationMs, 3200)
    assert.equal(completed.metrics.finalDecision, 'applied')
    assert.deepEqual(completed.metrics.taskResult, { totalClicks: 1 })
    assert.deepEqual(completed.result, {})

    const diagnosis = store.saveDiagnosis(first.id, {
      provider: 'local-rules',
      model: 'insightux-rules-v1',
      fallbackReason: null,
      result: {
        severity: 'P1', confidence: 0.82, summary: '存在摩擦', rootCause: '选择不清晰',
        evidence: [], recommendations: ['强化主次'], expectedImpact: '降低决策时长', similarCases: []
      }
    })
    assert.equal(diagnosis.provider, 'local-rules')
    assert.equal(store.getSharedReport(diagnosis.shareToken).id, first.id)
  } finally {
    store.close()
  }
})

test('暂停任务不能创建新会话，退出会话会清除采集数据', () => {
  const store = createStore(':memory:')
  try {
    const task = store.createTask({
      name: '可暂停任务',
      description: '',
      steps: ['完成任务'],
      status: 'active'
    })
    const session = store.createSession(task.id)
    store.abandonSession(session.id)
    assert.equal(store.getSession(session.id).status, 'abandoned')
    assert.equal(store.getSession(session.id).eventCount, 0)

    store.updateTask(task.id, { status: 'paused' })
    assert.throws(() => store.createSession(task.id), /不可参与/)
    assert.equal(store.getPublicTask(task.token), undefined)
  } finally {
    store.close()
  }
})

test('自定义网页任务验证前不能发布，试跑会话使用独立编号', () => {
  const store = createStore(':memory:')
  try {
    assert.throws(() => store.createTask({
      name: '上传网页任务', description: '', steps: ['完成页面操作'],
      targetType: 'upload', status: 'active'
    }), /验证通过/)

    const task = store.createTask({
      name: '上传网页任务', description: '', steps: ['完成页面操作'],
      targetType: 'upload', status: 'draft'
    })
    assert.equal(task.targetStatus, 'pending')
    const ready = store.updateTask(task.id, {
      targetStatus: 'ready', contentToken: 'content-token', contentRevision: 'r1', validatedAt: new Date().toISOString()
    })
    assert.equal(store.updateTask(task.id, { status: 'active' }).status, 'active')
    const trial = store.createSession(ready.id, { mode: 'trial', allowInactive: true })
    assert.equal(trial.participantCode, 'T-001')
    assert.equal(store.listSessions().length, 0)
    assert.equal(store.listSessions({ scope: 'trial' }).length, 1)
    store.startSession(trial.id)
    const completed = store.completeSession(trial.id, {
      events: [{ type: 0, timestamp: 1000 }], faceFrames: [], couponDecision: 'none',
      result: { completion: 'manual' }
    })
    assert.deepEqual(completed.result, { completion: 'manual' })
  } finally {
    store.close()
  }
})

test('旧版数据库会自动补齐自定义任务和试跑字段', () => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'insightux-migration-'))
  const databasePath = path.join(directory, 'legacy.db')
  const legacy = new DatabaseSync(databasePath)
  legacy.exec(`
    CREATE TABLE tasks (
      id TEXT PRIMARY KEY, token TEXT NOT NULL UNIQUE, name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '', scenario TEXT NOT NULL,
      steps_json TEXT NOT NULL DEFAULT '[]', status TEXT NOT NULL,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE sessions (
      id TEXT PRIMARY KEY, task_id TEXT NOT NULL, participant_code TEXT NOT NULL,
      upload_token_hash TEXT NOT NULL, status TEXT NOT NULL, consent_at TEXT NOT NULL,
      started_at TEXT, completed_at TEXT, coupon_decision TEXT NOT NULL DEFAULT 'none',
      rrweb_events_json TEXT, face_frames_json TEXT, metrics_json TEXT,
      duration_ms INTEGER NOT NULL DEFAULT 0, event_count INTEGER NOT NULL DEFAULT 0,
      frame_count INTEGER NOT NULL DEFAULT 0, last_emotion_json TEXT,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE diagnoses (
      id TEXT PRIMARY KEY, session_id TEXT NOT NULL UNIQUE, status TEXT NOT NULL,
      provider TEXT NOT NULL, model TEXT NOT NULL, result_json TEXT, fallback_reason TEXT,
      share_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
  `)
  legacy.prepare("INSERT INTO tasks VALUES ('t1','legacy','Legacy','', 'checkout-coupon','[\"done\"]','active',?,?)")
    .run(new Date().toISOString(), new Date().toISOString())
  legacy.close()

  const store = createStore(databasePath)
  try {
    const task = store.getTask('t1')
    assert.equal(task.targetType, 'builtin')
    assert.equal(task.targetStatus, 'ready')
  } finally {
    store.close()
  }
})
