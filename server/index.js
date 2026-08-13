import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { config, validateConfig } from './config.js'
import { createStore } from './db.js'
import { handleApiError, createApiRouter } from './router.js'
import { createSiteStorage } from './siteStorage.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const distDir = path.join(rootDir, 'dist')
const apiOnly = process.argv.includes('--dev')

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

validateConfig()
const store = createStore(config.databasePath)
store.seedDemoTask()
const siteStorage = createSiteStorage(config.siteDir)
const routeApi = createApiRouter({ store, config, siteStorage })

function serveFile(response, filePath) {
  const extension = path.extname(filePath).toLowerCase()
  response.writeHead(200, {
    'Content-Type': mimeTypes[extension] || 'application/octet-stream',
    'Cache-Control': extension === '.html' ? 'no-cache' : 'public, max-age=31536000, immutable'
  })
  createReadStream(filePath).pipe(response)
}

function serveApp(request, response) {
  if (apiOnly || !existsSync(distDir)) return false
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
  const requested = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
  const candidate = path.resolve(distDir, `.${requested}`)
  if (candidate.startsWith(`${distDir}${path.sep}`) && existsSync(candidate) && statSync(candidate).isFile()) {
    serveFile(response, candidate)
    return true
  }
  serveFile(response, path.join(distDir, 'index.html'))
  return true
}

const server = createServer(async (request, response) => {
  try {
    if (await routeApi(request, response)) return
    if (siteStorage.serve(request, response, store)) return
    if (serveApp(request, response)) return
    response.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' })
    response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: '接口不存在' } }))
  } catch (error) {
    handleApiError(error, response)
  }
})

server.listen(config.port, config.host, () => {
  console.log(`[InsightUX] ${apiOnly ? 'API' : '应用'}服务已启动：http://localhost:${config.port}`)
})

const shutdown = () => {
  server.close(() => {
    store.close()
    process.exit(0)
  })
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
