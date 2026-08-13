import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('登录密码框固定使用白色背景并覆盖浏览器自动填充颜色', () => {
  const page = readFileSync('src/pages/analyst/LoginPage.jsx', 'utf8')
  const styles = readFileSync('src/index.css', 'utf8')

  assert.match(page, /login-password-input[^"\n]*bg-white[^"\n]*text-slate-900/)
  assert.match(styles, /\.login-password-input:-webkit-autofill/)
  assert.match(styles, /-webkit-text-fill-color:\s*#0f172a/)
  assert.match(styles, /box-shadow:\s*0 0 0 1000px #ffffff inset/)
})
