import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import test from 'node:test'
import { createStore } from '../server/db.js'
import { createApiRouter, handleApiError } from '../server/router.js'

async function startTestApi() {
  const store = createStore(':memory:')
  const config = {
    adminPassword: 'test-password',
    sessionSecret: 'test-secret-with-more-than-thirty-two-characters',
    publicAppUrl: 'http://localhost',
    isProduction: false,
    dashscopeApiKey: '',
    qwenBaseUrl: '',
    qwenModel: ''
  }
  const route = createApiRouter({ store, config })
  const server = createServer(async (request, response) => {
    try {
      if (await route(request, response)) return
      response.writeHead(404).end()
    } catch (error) {
      handleApiError(error, response)
    }
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  return {
    baseUrl: `http://127.0.0.1:${address.port}`,
    close: () => new Promise((resolve) => server.close(() => { store.close(); resolve() }))
  }
}

const jsonRequest = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  })
  const data = await response.json()
  return { response, data }
}

test('API 完成登录、任务、匿名会话、诊断和分享报告主链路', async () => {
  const api = await startTestApi()
  try {
    const unauthenticated = await jsonRequest(`${api.baseUrl}/api/tasks`)
    assert.equal(unauthenticated.response.status, 401)

    const login = await jsonRequest(`${api.baseUrl}/api/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ password: 'test-password' })
    })
    assert.equal(login.response.status, 200)
    const cookie = login.response.headers.get('set-cookie').split(';')[0]

    const created = await jsonRequest(`${api.baseUrl}/api/tasks`, {
      method: 'POST',
      headers: { Cookie: cookie },
      body: JSON.stringify({
        name: 'API 全链路任务',
        description: '验证完整流程',
        steps: ['处理优惠券', '提交订单'],
        status: 'active'
      })
    })
    assert.equal(created.response.status, 201)
    const task = created.data.task

    const publicTask = await jsonRequest(`${api.baseUrl}/api/public/tasks/${task.token}`)
    assert.equal(publicTask.data.task.name, task.name)
    assert.equal(publicTask.data.task.token, undefined)
    assert.equal(publicTask.data.task.diagnosisProvider, 'local-rules')

    const createdSession = await jsonRequest(`${api.baseUrl}/api/public/tasks/${task.token}/sessions`, {
      method: 'POST',
      body: JSON.stringify({ consent: true })
    })
    const participantSession = createdSession.data.session
    const sessionHeaders = { 'X-Session-Token': participantSession.uploadToken }

    const started = await jsonRequest(`${api.baseUrl}/api/public/sessions/${participantSession.id}/start`, {
      method: 'POST',
      headers: sessionHeaders
    })
    assert.equal(started.data.session.status, 'recording')

    const completed = await jsonRequest(`${api.baseUrl}/api/public/sessions/${participantSession.id}/complete`, {
      method: 'POST',
      headers: sessionHeaders,
      body: JSON.stringify({
        couponDecision: 'applied',
        duration: 3000,
        metrics: { selectedCount: 3, couponApplied: true },
        events: [
          { type: 0, timestamp: 1000, data: {} },
          { type: 3, timestamp: 4000, data: { type: 2, x: 20, y: 30 } }
        ],
        faceFrames: [{ t: 1000, emotion: { label: 'Focus', value: 0.4 } }]
      })
    })
    assert.equal(completed.data.session.status, 'completed')

    const diagnosis = await jsonRequest(`${api.baseUrl}/api/sessions/${participantSession.id}/diagnose`, {
      method: 'POST',
      headers: { Cookie: cookie }
    })
    assert.equal(diagnosis.data.diagnosis.provider, 'local-rules')

    const shared = await jsonRequest(`${api.baseUrl}/api/public/reports/${diagnosis.data.diagnosis.shareToken}`)
    assert.equal(shared.data.report.id, participantSession.id)
    assert.equal(shared.data.report.events, undefined)
    assert.equal(shared.data.report.faceFrames, undefined)
    assert.equal(shared.data.report.diagnosis.result.finalDecision, undefined)
  } finally {
    await api.close()
  }
})

test('URL 任务必须完成匹配的 SDK 握手才能发布', async () => {
  const api = await startTestApi()
  try {
    const login = await jsonRequest(`${api.baseUrl}/api/auth/login`, {
      method: 'POST', body: JSON.stringify({ password: 'test-password' })
    })
    const cookie = login.response.headers.get('set-cookie').split(';')[0]
    const created = await jsonRequest(`${api.baseUrl}/api/tasks`, {
      method: 'POST', headers: { Cookie: cookie },
      body: JSON.stringify({
        name: 'URL 任务', description: '', steps: ['完成操作'], status: 'draft',
        targetType: 'url', targetUrl: 'https://example.test/demo'
      })
    })
    const task = created.data.task
    const invalid = await jsonRequest(`${api.baseUrl}/api/tasks/${task.id}/validate-url`, {
      method: 'POST', headers: { Cookie: cookie },
      body: JSON.stringify({ origin: 'https://wrong.test', sdkVersion: '1.0.0' })
    })
    assert.equal(invalid.response.status, 400)

    const valid = await jsonRequest(`${api.baseUrl}/api/tasks/${task.id}/validate-url`, {
      method: 'POST', headers: { Cookie: cookie },
      body: JSON.stringify({ origin: 'https://example.test', sdkVersion: '1.0.0' })
    })
    assert.equal(valid.data.task.targetStatus, 'ready')
    assert.equal(valid.data.task.targetOrigin, 'https://example.test')
  } finally {
    await api.close()
  }
})

test('管理员试跑会话可执行但不会进入正式列表或诊断', async () => {
  const api = await startTestApi()
  try {
    const login = await jsonRequest(`${api.baseUrl}/api/auth/login`, {
      method: 'POST', body: JSON.stringify({ password: 'test-password' })
    })
    const cookie = login.response.headers.get('set-cookie').split(';')[0]
    const created = await jsonRequest(`${api.baseUrl}/api/tasks`, {
      method: 'POST', headers: { Cookie: cookie },
      body: JSON.stringify({ name: '试跑任务', description: '', steps: ['完成'], status: 'draft', targetType: 'builtin' })
    })
    const trial = await jsonRequest(`${api.baseUrl}/api/tasks/${created.data.task.id}/trials`, {
      method: 'POST', headers: { Cookie: cookie }
    })
    assert.equal(trial.data.session.participantCode, 'T-001')
    const tokenHeaders = { 'X-Session-Token': trial.data.session.uploadToken }
    await jsonRequest(`${api.baseUrl}/api/public/sessions/${trial.data.session.id}/start`, { method: 'POST', headers: tokenHeaders })
    await jsonRequest(`${api.baseUrl}/api/public/sessions/${trial.data.session.id}/complete`, {
      method: 'POST', headers: tokenHeaders,
      body: JSON.stringify({ couponDecision: 'none', events: [{ type: 0, timestamp: 1 }], faceFrames: [], result: { completion: 'manual' } })
    })
    const formal = await jsonRequest(`${api.baseUrl}/api/sessions?scope=participant`, { headers: { Cookie: cookie } })
    const trials = await jsonRequest(`${api.baseUrl}/api/sessions?scope=trial`, { headers: { Cookie: cookie } })
    assert.equal(formal.data.sessions.length, 0)
    assert.equal(trials.data.sessions.length, 1)
    const diagnosis = await jsonRequest(`${api.baseUrl}/api/sessions/${trial.data.session.id}/diagnose`, { method: 'POST', headers: { Cookie: cookie } })
    assert.equal(diagnosis.response.status, 409)
    assert.equal(diagnosis.data.error.code, 'TRIAL_DIAGNOSIS_DISABLED')
  } finally { await api.close() }
})
