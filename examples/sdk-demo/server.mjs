import { createServer } from 'node:http'
import { existsSync, statSync } from 'node:fs'
import { readFile, writeFile, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const demoRoot = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(demoRoot, 'public')
const defaultConfigPath = path.join(demoRoot, '.sdk-config.json')
const defaultOrigins = ['http://localhost:5173', 'http://127.0.0.1:5173']
const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
}

export function extraInsightuxOrigins(value = process.env.INSIGHTUX_ORIGINS) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export function allowedParentOrigins(extra = extraInsightuxOrigins()) {
  return [...new Set([...defaultOrigins, ...extra])]
}

function escapeAttr(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
}

function send(response, status, headers, body) {
  response.writeHead(status, headers)
  response.end(body)
}

function json(response, status, payload) {
  send(response, status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  }, JSON.stringify(payload))
}

function originFrom(value) {
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('origin must use http or https')
  }
  return url.origin
}

function optionalUrl(value) {
  if (!value) return ''
  const url = new URL(value)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('sdk src must use http or https')
  }
  return url.href
}

export function normalizeSdkConfig(input = {}) {
  const taskId = String(input.taskId || '').trim()
  if (!taskId) return { taskId: '', parentOrigin: '', sdkSrc: '' }
  if (taskId.length > 80 || /[^a-zA-Z0-9._-]/u.test(taskId)) {
    throw new Error('taskId is invalid')
  }
  const parentOrigin = originFrom(input.parentOrigin || 'http://localhost:5173')
  const sdkSrc = optionalUrl(input.sdkSrc) || `${parentOrigin}/insightux-recorder.js`
  return { taskId, parentOrigin, sdkSrc }
}

export function sdkScriptTag(config) {
  if (!config?.taskId) return ''
  return [
    '<script',
    ` src="${escapeAttr(config.sdkSrc)}"`,
    ` data-task-id="${escapeAttr(config.taskId)}"`,
    ` data-parent-origin="${escapeAttr(config.parentOrigin)}"`,
    '></script>'
  ].join('')
}

export function injectSdk(html, config) {
  const tag = sdkScriptTag(config)
  if (!tag) return html
  if (html.includes('insightux-recorder.js')) return html
  return html.includes('</body>') ? html.replace('</body>', `${tag}\n</body>`) : `${html}${tag}`
}

function resolvePublicFile(pathname) {
  const requestedPath = pathname === '/' || pathname === '/no-sdk' ? '/index.html' : pathname
  let requested
  try {
    requested = decodeURIComponent(requestedPath)
  } catch {
    return null
  }
  const candidate = path.resolve(publicDir, `.${requested}`)
  if (candidate !== publicDir && !candidate.startsWith(`${publicDir}${path.sep}`)) return null
  if (!existsSync(candidate)) return null
  const stats = statSync(candidate)
  if (stats.isFile()) return candidate
  if (stats.isDirectory()) {
    const indexFile = path.join(candidate, 'index.html')
    return existsSync(indexFile) ? indexFile : null
  }
  return null
}

async function readConfig(configFile) {
  if (!existsSync(configFile)) return { taskId: '', parentOrigin: '', sdkSrc: '' }
  try {
    return normalizeSdkConfig(JSON.parse(await readFile(configFile, 'utf8')))
  } catch {
    return { taskId: '', parentOrigin: '', sdkSrc: '' }
  }
}

function configFromRequest(url, saved) {
  const query = {
    taskId: url.searchParams.get('taskId') || saved.taskId,
    parentOrigin: url.searchParams.get('parentOrigin') || saved.parentOrigin,
    sdkSrc: url.searchParams.get('sdkSrc') || saved.sdkSrc
  }
  if (!query.taskId) return { taskId: '', parentOrigin: '', sdkSrc: '' }
  return normalizeSdkConfig(query)
}

function contentSecurityPolicy(config) {
  const extra = [
    ...extraInsightuxOrigins(),
    ...(config.parentOrigin ? [config.parentOrigin] : []),
    ...(config.sdkSrc ? [originFrom(config.sdkSrc)] : [])
  ]
  const origins = allowedParentOrigins(extra)
  const allow = origins.join(' ')
  return [
    `frame-ancestors 'self' ${allow}`,
    `script-src 'self' ${allow}`,
    "style-src 'self'",
    "img-src 'self' data:",
    "connect-src 'self'",
    "default-src 'self'"
  ].join('; ')
}

async function readJsonBody(request) {
  const chunks = []
  for await (const chunk of request) chunks.push(chunk)
  const raw = Buffer.concat(chunks).toString('utf8')
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    throw new Error('JSON is invalid')
  }
}

export function createDemoServer({ configFile = defaultConfigPath } = {}) {
  return createServer(async (request, response) => {
    try {
      const url = new URL(request.url, 'http://127.0.0.1')
      if (url.pathname === '/health') {
        send(response, 200, { 'Content-Type': 'text/plain; charset=utf-8' }, 'ok')
        return
      }

      if (url.pathname === '/sdk-config' && request.method === 'GET') {
        json(response, 200, await readConfig(configFile))
        return
      }

      if (url.pathname === '/sdk-config' && request.method === 'POST') {
        const config = normalizeSdkConfig(await readJsonBody(request))
        await writeFile(configFile, `${JSON.stringify(config, null, 2)}\n`)
        json(response, 200, config)
        return
      }

      if (url.pathname === '/sdk-config' && request.method === 'DELETE') {
        if (existsSync(configFile)) await unlink(configFile)
        json(response, 200, { taskId: '', parentOrigin: '', sdkSrc: '' })
        return
      }

      if (request.method !== 'GET' && request.method !== 'HEAD') {
        send(response, 405, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Method Not Allowed')
        return
      }

      const filePath = resolvePublicFile(url.pathname)
      if (!filePath || !existsSync(filePath)) {
        send(response, 404, { 'Content-Type': 'text/plain; charset=utf-8' }, 'Not Found')
        return
      }

      const extension = path.extname(filePath).toLowerCase()
      const skipSdk = url.pathname === '/no-sdk' || url.searchParams.get('sdk') === 'off'
      const saved = skipSdk ? { taskId: '', parentOrigin: '', sdkSrc: '' } : await readConfig(configFile)
      const config = skipSdk ? saved : configFromRequest(url, saved)
      const headers = {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=60',
        'Content-Security-Policy': contentSecurityPolicy(config),
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }

      if (request.method === 'HEAD') {
        send(response, 200, headers)
        return
      }

      if (extension !== '.html') {
        send(response, 200, headers, await readFile(filePath))
        return
      }

      const html = await readFile(filePath, 'utf8')
      send(response, 200, headers, injectSdk(html, config))
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unexpected error'
      const status = /invalid|must use|JSON/u.test(message) ? 400 : 500
      json(response, status, { error: message })
    }
  })
}

export function listenDemoServer(options = {}) {
  const port = Number(options.port ?? process.env.PORT ?? 5174)
  const host = options.host ?? process.env.HOST ?? '127.0.0.1'
  const server = createDemoServer(options)
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, host, () => {
      const address = server.address()
      resolve({
        server,
        host: address.address,
        port: address.port,
        url: `http://${address.address}:${address.port}`
      })
    })
  })
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
if (isMain) {
  const demo = await listenDemoServer()
  const stop = () => demo.server.close(() => process.exit(0))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
  console.log(`Harbor Market SDK demo: ${demo.url}`)
  console.log(`Health check:           ${demo.url}/health`)
  console.log('Create an InsightUX URL task, paste the generated SDK snippet on the shop homepage, then verify the task.')
}
