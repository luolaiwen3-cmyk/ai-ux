import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
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

const buildApp = () => createApp({
  config,
  database: openDatabase(':memory:'),
  logger: false,
  apiOnly: true
})

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

test('Fastify 生产静态服务提供 SPA 和 Recorder SDK', async () => {
  const assetsDir = mkdtempSync(path.join(os.tmpdir(), 'insightux-assets-'))
  writeFileSync(path.join(assetsDir, 'index.html'), '<!doctype html><div id="root"></div>')
  writeFileSync(path.join(assetsDir, 'insightux-recorder.js'), 'window.recorderReady = true')
  const app = createApp({
    config: { ...config, isProduction: true },
    database: openDatabase(':memory:'),
    logger: false,
    assetsDir
  })
  try {
    const index = await app.inject({ method: 'GET', url: '/nested/react/route' })
    assert.equal(index.statusCode, 200)
    assert.match(index.body, /id="root"/)
    assert.equal(index.headers['cache-control'], 'no-cache')

    const sdk = await app.inject({ method: 'GET', url: '/insightux-recorder.js' })
    assert.equal(sdk.statusCode, 200)
    assert.match(sdk.body, /recorderReady/)
  } finally {
    await app.close()
  }
})
