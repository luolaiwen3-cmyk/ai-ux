import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const runConfig = (environment) => spawnSync(
  process.execPath,
  ['--input-type=module', '-e', "import { config, validateConfig } from './server/config.js'; validateConfig(); console.log(config.adminPassword)"],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      PATH: process.env.PATH,
      ...environment
    }
  }
)

test('开发环境默认管理员密码为 demo', () => {
  const result = runConfig({ NODE_ENV: 'development' })
  assert.equal(result.status, 0)
  assert.equal(result.stdout.trim(), 'demo')
})

test('生产环境拒绝默认 demo 密码', () => {
  const result = runConfig({
    NODE_ENV: 'production',
    ADMIN_PASSWORD: 'demo',
    ADMIN_SESSION_SECRET: '12345678901234567890123456789012'
  })
  assert.notEqual(result.status, 0)
  assert.match(result.stderr, /生产环境必须设置安全的 ADMIN_PASSWORD/)
})
