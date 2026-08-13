import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import test from 'node:test'
import yazl from 'yazl'
import { createStore } from '../server/db.js'
import { createSiteStorage } from '../server/siteStorage.js'

const createZip = (files) => new Promise((resolve, reject) => {
  const zip = new yazl.ZipFile()
  const chunks = []
  zip.outputStream.on('data', (chunk) => chunks.push(chunk))
  zip.outputStream.on('error', reject)
  zip.outputStream.on('end', () => resolve(Buffer.concat(chunks)))
  Object.entries(files).forEach(([name, content]) => zip.addBuffer(Buffer.from(content), name))
  zip.end()
})

const requestFor = (buffer) => {
  const request = Readable.from(buffer)
  request.headers = { 'content-type': 'application/zip', 'content-length': String(buffer.length) }
  return request
}

test('静态网站 ZIP 会被安全安装并生成不可预测访问标识', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'insightux-sites-'))
  const store = createStore(':memory:')
  try {
    const task = store.createTask({
      name: 'ZIP 任务', description: '', steps: ['完成'], targetType: 'upload', status: 'draft'
    })
    const archive = await createZip({
      'index.html': '<!doctype html><h1>Test</h1><script src="app.js"></script>',
      'app.js': 'document.body.dataset.ready = "yes"',
      'assets/logo.svg': '<svg xmlns="http://www.w3.org/2000/svg" />'
    })
    const installed = await createSiteStorage(root).installZip(requestFor(archive), task)
    assert.equal(installed.fileCount, 3)
    assert.equal(installed.targetStatus, 'ready')
    assert.match(installed.contentToken, /^[A-Za-z0-9_-]+$/)
  } finally {
    store.close()
  }
})

test('静态网站 ZIP 拒绝缺失入口和路径穿越', async () => {
  const root = mkdtempSync(path.join(os.tmpdir(), 'insightux-sites-'))
  const storage = createSiteStorage(root)
  const task = { id: 'task-1', contentToken: null, contentRevision: null }
  const missingIndex = await createZip({ 'page.html': '<h1>Missing</h1>' })
  await assert.rejects(() => storage.installZip(requestFor(missingIndex), task), /index\.html/)

  const safeArchive = await createZip({ 'index.html': '<h1>Safe</h1>', 'xx/escape': 'bad' })
  const maliciousArchive = Buffer.from(safeArchive)
  let offset = 0
  while ((offset = maliciousArchive.indexOf('xx/escape', offset)) >= 0) {
    maliciousArchive.write('../escape', offset, 'utf8')
    offset += 9
  }
  await assert.rejects(() => storage.installZip(requestFor(maliciousArchive), task), /不安全|损坏/)
})

