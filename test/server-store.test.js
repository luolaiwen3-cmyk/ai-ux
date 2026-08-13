import assert from 'node:assert/strict'
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
