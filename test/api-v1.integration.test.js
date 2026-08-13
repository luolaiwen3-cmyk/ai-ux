import assert from 'node:assert/strict'
import test from 'node:test'
import { createApp } from '../server/app.js'
import { openDatabase } from '../server/database.js'

const config = {
  adminPassword: 'test-password',
  sessionSecret: 'test-secret-with-more-than-thirty-two-characters',
  publicAppUrl: 'http://localhost:8787',
  dashscopeApiKey: '',
  qwenBaseUrl: '',
  qwenModel: '',
  isProduction: false,
  seedDemo: false
}

const buildApp = () => createApp({ config, database: openDatabase(':memory:'), logger: false })

const login = async (app) => {
  const response = await app.inject({
    method: 'POST', url: '/api/v1/auth/login', payload: { password: 'test-password' }
  })
  return response.headers['set-cookie'].split(';')[0]
}

test('v1 API 完成任务、参与者、诊断和分享报告主链路', async () => {
  const app = buildApp()
  try {
    const cookie = await login(app)
    const created = await app.inject({
      method: 'POST',
      url: '/api/v1/tasks',
      headers: { cookie },
      payload: {
        name: 'v1 主链路', description: '新接口', steps: ['操作', '提交'],
        targetType: 'builtin', status: 'active'
      }
    })
    assert.equal(created.statusCode, 201)
    const task = created.json().data

    const publicTask = await app.inject({
      method: 'GET', url: `/api/v1/participant/tasks/${task.token}`
    })
    assert.equal(publicTask.json().data.name, task.name)
    assert.equal(publicTask.json().data.token, undefined)

    const sessionResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/participant/tasks/${task.token}/sessions`,
      payload: { consent: true }
    })
    const session = sessionResponse.json().data
    const authorization = `Bearer ${session.uploadToken}`

    const started = await app.inject({
      method: 'POST',
      url: `/api/v1/participant/sessions/${session.id}/start`,
      headers: { authorization }
    })
    assert.equal(started.json().data.status, 'recording')

    const completed = await app.inject({
      method: 'POST',
      url: `/api/v1/participant/sessions/${session.id}/complete`,
      headers: { authorization },
      payload: {
        couponDecision: 'applied',
        events: [
          { type: 0, timestamp: 1000, data: {} },
          { type: 3, timestamp: 3000, data: { type: 2, x: 1, y: 1 } }
        ],
        faceFrames: [],
        metrics: {},
        result: {}
      }
    })
    assert.equal(completed.json().data.status, 'completed')

    const diagnosisResponse = await app.inject({
      method: 'POST',
      url: `/api/v1/sessions/${session.id}/diagnosis`,
      headers: { cookie }
    })
    assert.equal(diagnosisResponse.statusCode, 200)
    const diagnosis = diagnosisResponse.json().data
    assert.equal(diagnosis.provider, 'local-rules')

    const report = await app.inject({
      method: 'GET', url: `/api/v1/reports/${diagnosis.shareToken}`
    })
    assert.equal(report.json().data.id, session.id)
    assert.equal(report.json().data.events, undefined)
    assert.equal(report.json().data.faceFrames, undefined)
  } finally {
    await app.close()
  }
})

test('v1 API 通过 Schema、Cookie 和 Bearer Token 拒绝非法请求', async () => {
  const app = buildApp()
  try {
    const unauthorized = await app.inject({ method: 'GET', url: '/api/v1/tasks' })
    assert.equal(unauthorized.statusCode, 401)
    assert.equal(unauthorized.json().error.code, 'UNAUTHORIZED')

    const cookie = await login(app)
    const invalid = await app.inject({
      method: 'POST', url: '/api/v1/tasks', headers: { cookie }, payload: { name: '' }
    })
    assert.equal(invalid.statusCode, 400)
    assert.equal(invalid.json().error.code, 'VALIDATION_ERROR')
    assert.ok(invalid.json().error.details.length > 0)
  } finally {
    await app.close()
  }
})
