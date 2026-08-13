import assert from 'node:assert/strict'
import test from 'node:test'
import { openDatabase } from '../server/database.js'
import { createRepositories } from '../server/repositories.js'
import { createServices } from '../server/services.js'

const config = {
  dashscopeApiKey: '',
  qwenBaseUrl: '',
  qwenModel: '',
  publicAppUrl: 'http://localhost:8787',
  isProduction: false
}

const createContext = () => {
  const database = openDatabase(':memory:')
  const repositories = createRepositories(database)
  return { database, services: createServices({ repositories, config }) }
}

test('任务服务执行发布规则和 URL 握手', () => {
  const { database, services } = createContext()
  try {
    const task = services.tasks.create({
      name: 'URL 任务', steps: ['完成操作'], targetType: 'url',
      targetUrl: 'https://example.test/path', status: 'draft'
    })
    assert.equal(task.targetStatus, 'pending')
    assert.throws(
      () => services.tasks.update(task.id, { status: 'active' }),
      (error) => error.code === 'TARGET_NOT_READY'
    )
    const validated = services.tasks.validateUrl(task.id, {
      origin: 'https://example.test', sdkVersion: '1.0.0'
    })
    assert.equal(validated.targetStatus, 'ready')
    assert.equal(services.tasks.update(task.id, { status: 'active' }).status, 'active')
  } finally {
    database.close()
  }
})

test('参与者服务完成会话并隔离试跑诊断', async () => {
  const { database, services } = createContext()
  try {
    const task = services.tasks.create({
      name: '正式任务', steps: ['完成操作'], targetType: 'builtin', status: 'active'
    })
    const created = services.sessions.createParticipant(task.token, true)
    services.sessions.start(created.id, created.uploadToken)
    const completed = services.sessions.complete(created.id, created.uploadToken, {
      couponDecision: 'applied',
      events: [{ type: 0, timestamp: 1000 }, { type: 3, timestamp: 2000, data: { type: 2 } }],
      faceFrames: [],
      metrics: {},
      result: {}
    })
    assert.equal(completed.status, 'completed')
    assert.equal(completed.events.length, 2)
    assert.equal((await services.analysis.diagnose(created.id)).provider, 'local-rules')

    const trial = services.sessions.createTrial(task.id)
    services.sessions.start(trial.id, trial.uploadToken)
    services.sessions.complete(trial.id, trial.uploadToken, {
      couponDecision: 'none', events: [], faceFrames: [], metrics: {}, result: {}
    })
    await assert.rejects(
      services.analysis.diagnose(trial.id),
      (error) => error.code === 'TRIAL_DIAGNOSIS_DISABLED'
    )
  } finally {
    database.close()
  }
})

test('开发演示任务使用固定入口并可重复初始化', () => {
  const { database, services } = createContext()
  try {
    services.tasks.create({
      name: '研究员已有任务', steps: ['完成操作'], targetType: 'builtin', status: 'draft'
    })
    const demo = services.tasks.seedDemo()
    assert.equal(demo.token, 'abc123')
    assert.equal(demo.name, '电商结算页优惠券测试')
    assert.equal(demo.status, 'active')
    assert.equal(demo.targetStatus, 'ready')
    assert.deepEqual(demo.steps, ['确认购物车商品', '处理优惠券提示', '提交订单'])

    const repeated = services.tasks.seedDemo()
    assert.equal(repeated.id, demo.id)
    assert.equal(services.tasks.list().filter((task) => task.token === 'abc123').length, 1)
  } finally {
    database.close()
  }
})

test('开发演示任务会接管新架构早期生成的随机入口', () => {
  const { database, services } = createContext()
  try {
    const previous = services.tasks.create({
      name: '电商结算页优惠券测试',
      description: '请像日常购物一样检查商品、处理优惠券并提交订单。',
      steps: ['确认购物车商品', '处理优惠券提示', '提交订单'],
      targetType: 'builtin',
      status: 'active'
    })
    assert.notEqual(previous.token, 'abc123')

    const restored = services.tasks.seedDemo()
    assert.equal(restored.id, previous.id)
    assert.equal(restored.token, 'abc123')
    assert.equal(services.tasks.list().length, 1)
  } finally {
    database.close()
  }
})
