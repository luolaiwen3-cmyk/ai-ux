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

test('Fastify 应用提供版本化健康检查和开发文档', async () => {
  const app = buildApp()
  try {
    const health = await app.inject({ method: 'GET', url: '/api/v1/health' })
    assert.equal(health.statusCode, 200)
    assert.deepEqual(health.json(), { data: { status: 'ok', storage: 'better-sqlite3' } })

    const docs = await app.inject({ method: 'GET', url: '/docs/json' })
    assert.equal(docs.statusCode, 200)
    assert.ok(docs.json().paths['/api/v1/health'])
  } finally {
    await app.close()
  }
})

test('Fastify 认证使用签名 Cookie 和统一错误响应', async () => {
  const app = buildApp()
  try {
    const invalid = await app.inject({
      method: 'POST', url: '/api/v1/auth/login', payload: { password: 'wrong' }
    })
    assert.equal(invalid.statusCode, 401)
    assert.equal(invalid.json().error.code, 'INVALID_CREDENTIALS')
    assert.ok(invalid.json().error.requestId)

    const login = await app.inject({
      method: 'POST', url: '/api/v1/auth/login', payload: { password: 'test-password' }
    })
    assert.equal(login.statusCode, 200)
    const cookie = login.headers['set-cookie'].split(';')[0]
    assert.match(cookie, /^insightux_admin=/)

    const me = await app.inject({ method: 'GET', url: '/api/v1/auth/me', headers: { cookie } })
    assert.equal(me.statusCode, 200)
    assert.equal(me.json().data.user.role, 'admin')

    const malformed = await app.inject({
      method: 'POST',
      url: '/api/v1/auth/login',
      headers: { 'content-type': 'application/json' },
      payload: '{'
    })
    assert.equal(malformed.statusCode, 400)
    assert.equal(malformed.json().error.code, 'INVALID_JSON')
  } finally {
    await app.close()
  }
})
