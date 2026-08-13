import { expect, test } from '@playwright/test'
import yazl from 'yazl'

const createZip = () => new Promise((resolve, reject) => {
  const zip = new yazl.ZipFile()
  const chunks = []
  zip.outputStream.on('data', (chunk) => chunks.push(chunk))
  zip.outputStream.on('error', reject)
  zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
  zip.addBuffer(Buffer.from(`<!doctype html><html><head><title>Uploaded target</title></head><body><h1>Uploaded target</h1><button id="try-action">Try action</button><p id="result"></p><script>document.querySelector('#try-action').onclick=()=>document.querySelector('#result').textContent='done'</script></body></html>`), 'index.html')
  zip.end()
})

async function login(page) {
  await page.goto('/#/login')
  await page.getByLabel('管理员密码').fill('e2e-password')
  await page.getByRole('button', { name: '登录' }).click()
  await expect(page).toHaveURL(/#\/$/)
}

async function taskByName(page, name) {
  const response = await page.request.get('/api/v1/tasks')
  expect(response.ok()).toBeTruthy()
  return (await response.json()).data.find((task) => task.name === name)
}

async function launchSession(page, task, mode = 'participant') {
  const response = mode === 'trial'
    ? await page.request.post(`/api/v1/tasks/${task.id}/trials`)
    : await page.request.post(`/api/v1/participant/tasks/${task.token}/sessions`, { data: { consent: true } })
  expect(response.ok()).toBeTruthy()
  const session = (await response.json()).data
  await page.evaluate(({ id, token }) => sessionStorage.setItem(`insightux-session-token:${id}`, token), { id: session.id, token: session.uploadToken })
  const started = await page.request.post(`/api/v1/participant/sessions/${session.id}/start`, { headers: { Authorization: `Bearer ${session.uploadToken}` } })
  expect(started.ok()).toBeTruthy()
  await page.goto(`/#/task/${session.id}`)
  await expect(page.locator('iframe')).toBeVisible()
  return session
}

test('上传 ZIP、发布、完成正式测试并回放，试跑不污染统计', async ({ page }) => {
  await login(page)
  await page.goto('/#/tasks')
  await page.getByRole('button', { name: '+ 新建任务' }).click()
  await page.getByLabel('任务名称').fill('E2E 上传网页任务')
  await page.getByLabel('被试说明').fill('验证上传网页测试闭环')
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: /上传网站 ZIP/ }).click()
  await page.locator('input[type=file]').setInputFiles({ name: 'site.zip', mimeType: 'application/zip', buffer: await createZip() })
  await page.getByRole('button', { name: '下一步' }).click()
  await page.getByRole('button', { name: '创建任务' }).click()
  await expect(page.getByText('上传静态网站 · 已验证')).toBeVisible()

  const task = await taskByName(page, 'E2E 上传网页任务')
  expect(task.status).toBe('active')
  expect(task.targetStatus).toBe('ready')
  const formal = await launchSession(page, task)
  await page.frameLocator('iframe').getByRole('button', { name: 'Try action' }).click()
  await expect(page.frameLocator('iframe').locator('#result')).toHaveText('done')
  await page.getByRole('button', { name: '完成测试' }).click()
  await expect(page).toHaveURL(/#\/thanks$/)

  await page.goto(`/#/sessions/${formal.id}`)
  await expect(page.getByText('rrweb 真实录制')).toBeVisible()
  const before = await (await page.request.get('/api/v1/dashboard')).json()

  const trial = await launchSession(page, task, 'trial')
  await page.frameLocator('iframe').getByRole('button', { name: 'Try action' }).click()
  await page.getByRole('button', { name: '完成测试' }).click()
  await expect(page).toHaveURL(new RegExp(`#\/sessions\/${trial.id}$`))
  await expect(page.getByText(/· 试跑/)).toBeVisible()
  await expect(page.getByText('试跑会话仅用于检查网页和录制回放')).toBeVisible()
  const after = await (await page.request.get('/api/v1/dashboard')).json()
  expect(after.data.totalSessions).toBe(before.data.totalSessions)
  expect(after.data.completedSessions).toBe(before.data.completedSessions)
})

test('URL 页面通过真实 SDK 握手验证，无 SDK 页面不能发布', async ({ page }) => {
  await login(page)
  const createResponse = await page.request.post('/api/v1/tasks', { data: {
    name: 'E2E URL 任务', description: '', steps: ['完成外部操作'], targetType: 'url',
    targetUrl: 'http://127.0.0.1:8899/?taskId=pending', status: 'draft'
  } })
  const created = (await createResponse.json()).data
  await page.request.patch(`/api/v1/tasks/${created.id}`, { data: { targetUrl: `http://127.0.0.1:8899/?taskId=${created.id}` } })
  await page.goto('/#/tasks')
  const card = page.locator('.glass').filter({ hasText: 'E2E URL 任务' }).first()
  await card.getByRole('button', { name: '接入并验证' }).click()
  await expect(card.getByText('外部 URL · 已验证')).toBeVisible()
  await card.getByRole('button', { name: '发布' }).click()
  await expect(card.getByText('进行中')).toBeVisible()

  const noSdkResponse = await page.request.post('/api/v1/tasks', { data: {
    name: 'E2E 无 SDK', description: '', steps: ['完成'], targetType: 'url',
    targetUrl: 'http://127.0.0.1:8899/no-sdk', status: 'draft'
  } })
  const noSdk = (await noSdkResponse.json()).data
  const publish = await page.request.patch(`/api/v1/tasks/${noSdk.id}`, { data: { status: 'active' } })
  expect(publish.status()).toBe(409)
  expect((await publish.json()).error.code).toBe('TARGET_NOT_READY')
})
