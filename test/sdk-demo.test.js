import assert from 'node:assert/strict'
import { mkdtemp, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import {
  injectSdk,
  listenDemoServer,
  normalizeSdkConfig,
  sdkScriptTag
} from '../examples/sdk-demo/server.mjs'

const fetchText = async (base, pathname) => {
  const response = await fetch(`${base}${pathname}`)
  return { response, body: await response.text(), headers: response.headers }
}

test('SDK 标签按任务 ID 和父源注入，且不会重复插入', () => {
  const config = normalizeSdkConfig({
    taskId: 'task-demo-1',
    parentOrigin: 'http://localhost:5173/'
  })
  assert.equal(config.parentOrigin, 'http://localhost:5173')
  assert.equal(config.sdkSrc, 'http://localhost:5173/insightux-recorder.js')
  const tag = sdkScriptTag(config)
  assert.match(tag, /data-task-id="task-demo-1"/)
  assert.match(tag, /data-parent-origin="http:\/\/localhost:5173"/)
  const html = injectSdk('<html><body>shop</body></html>', config)
  assert.match(html, /insightux-recorder\.js/)
  assert.equal(injectSdk(html, config), html)
})

test('Harbor Market demo 按查询参数和本地配置注入 SDK', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sdk-demo-'))
  const configFile = path.join(dir, 'sdk-config.json')
  const demo = await listenDemoServer({ port: 0, configFile })
  try {
    const health = await fetch(`${demo.url}/health`)
    assert.equal(health.status, 200)
    assert.equal(await health.text(), 'ok')

    const home = await fetchText(demo.url, '/')
    assert.equal(home.response.status, 200)
    assert.match(home.body, /北港市集/)
    assert.doesNotMatch(home.body, /insightux-recorder\.js/)
    assert.match(home.headers.get('content-security-policy') || '', /frame-ancestors/)

    const withQuery = await fetchText(demo.url, '/catalog.html?taskId=task-123&parentOrigin=http://127.0.0.1:5173')
    assert.match(withQuery.body, /data-task-id="task-123"/)
    assert.match(withQuery.body, /data-parent-origin="http:\/\/127.0.0.1:5173"/)
    assert.match(withQuery.headers.get('content-security-policy') || '', /http:\/\/127\.0\.0\.1:5173/)

    const saved = await fetch(`${demo.url}/sdk-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        taskId: 'task-saved',
        parentOrigin: 'http://localhost:5173',
        sdkSrc: 'http://localhost:5173/insightux-recorder.js'
      })
    })
    assert.equal(saved.status, 200)
    const configured = await fetchText(demo.url, '/cart.html')
    assert.match(configured.body, /data-task-id="task-saved"/)

    const override = await fetchText(demo.url, '/?taskId=task-query')
    assert.match(override.body, /data-task-id="task-query"/)
    assert.doesNotMatch(override.body, /data-task-id="task-saved"/)

    const noSdk = await fetchText(demo.url, '/no-sdk')
    assert.match(noSdk.body, /北港市集/)
    assert.doesNotMatch(noSdk.body, /insightux-recorder\.js/)

    const blocked = await fetch(`${demo.url}/sdk-config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId: '<script>', parentOrigin: 'http://localhost:5173' })
    })
    assert.equal(blocked.status, 400)

    const missing = await fetch(`${demo.url}/%2e%2e/server.mjs`)
    assert.equal(missing.status, 404)
  } finally {
    await new Promise((resolve) => demo.server.close(resolve))
  }
})

test('拒绝非法父源，并允许从已保存配置恢复', async () => {
  assert.throws(() => normalizeSdkConfig({ taskId: 'task-1', parentOrigin: 'ftp://x' }))
  const dir = await mkdtemp(path.join(os.tmpdir(), 'sdk-demo-'))
  const configFile = path.join(dir, 'sdk-config.json')
  await writeFile(configFile, JSON.stringify({
    taskId: 'task-file',
    parentOrigin: 'http://localhost:5173',
    sdkSrc: 'http://localhost:5173/insightux-recorder.js'
  }))
  const demo = await listenDemoServer({ port: 0, configFile })
  try {
    const page = await fetchText(demo.url, '/product.html')
    assert.match(page.body, /data-task-id="task-file"/)
    const cleared = await fetch(`${demo.url}/sdk-config`, { method: 'DELETE' })
    assert.equal(cleared.status, 200)
    const after = await fetchText(demo.url, '/')
    assert.doesNotMatch(after.body, /insightux-recorder\.js/)
  } finally {
    await new Promise((resolve) => demo.server.close(resolve))
  }
})
