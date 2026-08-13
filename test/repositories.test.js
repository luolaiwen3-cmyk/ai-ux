import assert from 'node:assert/strict'
import test from 'node:test'
import { openDatabase } from '../server/database.js'
import { createRepositories } from '../server/repositories.js'

const taskFixture = (timestamp) => ({
  id: 'task-1',
  token: 'public-token',
  name: '新架构任务',
  description: 'Repository 测试',
  scenario: 'checkout-coupon',
  status: 'active',
  steps: ['第一步', '第二步'],
  targetType: 'builtin',
  targetStatus: 'ready',
  targetUrl: null,
  targetOrigin: null,
  contentToken: null,
  contentRevision: null,
  validatedAt: timestamp,
  createdAt: timestamp,
  updatedAt: timestamp
})

test('任务 Repository 在事务中保存步骤与目标', () => {
  const database = openDatabase(':memory:')
  const repositories = createRepositories(database)
  const timestamp = new Date().toISOString()
  try {
    const task = repositories.tasks.create(taskFixture(timestamp))
    assert.equal(task.name, '新架构任务')
    assert.deepEqual(task.steps, ['第一步', '第二步'])
    assert.equal(task.targetStatus, 'ready')

    const updated = repositories.tasks.update(task.id, {
      ...task,
      name: '修改后的任务',
      steps: ['新步骤'],
      updatedAt: new Date().toISOString()
    })
    assert.equal(updated.name, '修改后的任务')
    assert.deepEqual(updated.steps, ['新步骤'])
  } finally {
    database.close()
  }
})

test('会话 Repository 分离摘要与录制正文并生成唯一序号', () => {
  const database = openDatabase(':memory:')
  const repositories = createRepositories(database)
  const timestamp = new Date().toISOString()
  try {
    repositories.tasks.create(taskFixture(timestamp))
    const first = repositories.sessions.create({
      id: 'session-1', taskId: 'task-1', tokenHash: 'hash-1',
      mode: 'participant', consentAt: timestamp, createdAt: timestamp
    })
    const second = repositories.sessions.create({
      id: 'session-2', taskId: 'task-1', tokenHash: 'hash-2',
      mode: 'participant', consentAt: timestamp, createdAt: timestamp
    })
    assert.equal(first.participantCode, 'P-001')
    assert.equal(second.participantCode, 'P-002')

    repositories.sessions.complete('session-1', {
      couponDecision: 'applied', duration: 1000, eventCount: 1,
      frameCount: 0, lastEmotion: null
    }, {
      events: [{ type: 0 }], faceFrames: [], metrics: { totalDurationMs: 1000 }, result: {}
    }, timestamp)

    const list = repositories.sessions.list()
    assert.equal(list[0].events, undefined)
    assert.equal(repositories.sessions.findDetail('session-1').events.length, 1)
  } finally {
    database.close()
  }
})
