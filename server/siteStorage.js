import { createReadStream, createWriteStream, existsSync, statSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rename, rm } from 'node:fs/promises'
import path from 'node:path'
import { randomBytes } from 'node:crypto'
import { pipeline } from 'node:stream/promises'
import { Transform } from 'node:stream'
import yauzl from 'yauzl'
import { createOpaqueToken } from './auth.js'
import { HttpError } from './http.js'

const MAX_ARCHIVE_BYTES = 20 * 1024 * 1024
const MAX_EXPANDED_BYTES = 100 * 1024 * 1024
const MAX_FILES = 1000

const allowedExtensions = new Set([
  '.css', '.gif', '.html', '.ico', '.jpeg', '.jpg', '.js', '.json', '.mjs',
  '.mp3', '.mp4', '.png', '.svg', '.ttf', '.webm', '.webp', '.woff', '.woff2'
])

const mimeTypes = {
  '.css': 'text/css; charset=utf-8', '.gif': 'image/gif', '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon', '.jpeg': 'image/jpeg', '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ttf': 'font/ttf', '.webm': 'video/webm',
  '.webp': 'image/webp', '.woff': 'font/woff', '.woff2': 'font/woff2'
}

const openZip = (filePath) => new Promise((resolve, reject) => {
  yauzl.open(filePath, { lazyEntries: true, decodeStrings: true, validateEntrySizes: true }, (error, zipFile) => {
    if (error) reject(error)
    else resolve(zipFile)
  })
})

const entryMode = (entry) => (entry.externalFileAttributes >>> 16) & 0xffff

const safeEntryName = (name) => {
  if (!name || name.includes('\0') || name.includes('\\') || path.posix.isAbsolute(name)) return null
  const parts = name.split('/')
  if (parts.some((part) => part === '..')) return null
  const normalized = path.posix.normalize(name).replace(/^\.\//, '')
  return normalized && normalized !== '.' ? normalized : null
}

async function extractZip(zipPath, destination) {
  const zipFile = await openZip(zipPath)
  let fileCount = 0
  let expandedBytes = 0
  let hasIndex = false

  return new Promise((resolve, reject) => {
    let settled = false
    const fail = (error) => {
      if (settled) return
      settled = true
      zipFile.close()
      reject(error instanceof HttpError ? error : new HttpError(400, 'ZIP 文件损坏或无法读取', 'INVALID_ZIP'))
    }

    zipFile.on('error', fail)
    zipFile.on('end', () => {
      if (settled) return
      if (!hasIndex) {
        fail(new HttpError(400, 'ZIP 根目录必须包含 index.html', 'INDEX_HTML_REQUIRED'))
        return
      }
      settled = true
      resolve({ fileCount, expandedBytes })
    })
    zipFile.on('entry', async (entry) => {
      try {
        const name = safeEntryName(entry.fileName)
        if (!name) throw new HttpError(400, 'ZIP 包含不安全的文件路径', 'UNSAFE_ZIP_PATH')
        if ((entry.generalPurposeBitFlag & 0x1) !== 0) {
          throw new HttpError(400, '不支持加密 ZIP 文件', 'ENCRYPTED_ZIP')
        }
        const mode = entryMode(entry)
        if ((mode & 0o170000) === 0o120000) {
          throw new HttpError(400, 'ZIP 不允许包含符号链接', 'ZIP_SYMLINK_NOT_ALLOWED')
        }

        const isDirectory = name.endsWith('/')
        const target = path.resolve(destination, name)
        if (target !== destination && !target.startsWith(`${destination}${path.sep}`)) {
          throw new HttpError(400, 'ZIP 包含不安全的文件路径', 'UNSAFE_ZIP_PATH')
        }
        if (isDirectory) {
          await mkdir(target, { recursive: true })
          zipFile.readEntry()
          return
        }

        const extension = path.extname(name).toLowerCase()
        if (!allowedExtensions.has(extension)) {
          throw new HttpError(400, `ZIP 包含不支持的文件类型：${extension || name}`, 'UNSUPPORTED_SITE_FILE')
        }
        fileCount += 1
        expandedBytes += Number(entry.uncompressedSize || 0)
        if (fileCount > MAX_FILES || expandedBytes > MAX_EXPANDED_BYTES) {
          throw new HttpError(413, '解压后的网页超过 100 MiB 或 1000 个文件上限', 'SITE_TOO_LARGE')
        }
        if (name === 'index.html') hasIndex = true

        await mkdir(path.dirname(target), { recursive: true })
        const source = await new Promise((resolveStream, rejectStream) => {
          zipFile.openReadStream(entry, (error, stream) => error ? rejectStream(error) : resolveStream(stream))
        })
        await pipeline(source, createWriteStream(target, { flags: 'wx' }))
        zipFile.readEntry()
      } catch (error) {
        fail(error)
      }
    })
    zipFile.readEntry()
  })
}

export function createSiteStorage(rootDir) {
  const resolvedRoot = path.resolve(rootDir)

  return {
    async installZip(request, task) {
      const contentType = String(request.headers['content-type'] || '').split(';')[0].trim()
      if (!['application/zip', 'application/x-zip-compressed'].includes(contentType)) {
        throw new HttpError(415, '请上传 ZIP 格式的静态网站', 'UNSUPPORTED_MEDIA_TYPE')
      }
      const contentLength = Number(request.headers['content-length'] || 0)
      if (contentLength > MAX_ARCHIVE_BYTES) {
        throw new HttpError(413, 'ZIP 文件不能超过 20 MiB', 'SITE_ARCHIVE_TOO_LARGE')
      }

      await mkdir(resolvedRoot, { recursive: true })
      const temporary = await mkdtemp(path.join(resolvedRoot, '.incoming-'))
      const archivePath = path.join(temporary, 'site.zip')
      const extractPath = path.join(temporary, 'content')
      let received = 0
      try {
        await mkdir(extractPath)
        const limiter = new Transform({
          transform(chunk, _encoding, callback) {
            received += chunk.length
            callback(received > MAX_ARCHIVE_BYTES
              ? new HttpError(413, 'ZIP 文件不能超过 20 MiB', 'SITE_ARCHIVE_TOO_LARGE')
              : null, chunk)
          }
        })
        await pipeline(request, limiter, createWriteStream(archivePath, { flags: 'wx' }))
        if (received === 0) throw new HttpError(400, 'ZIP 文件不能为空', 'EMPTY_SITE_ARCHIVE')
        const details = await extractZip(archivePath, extractPath)

        const revision = randomBytes(8).toString('hex')
        const taskDirectory = path.join(resolvedRoot, task.id)
        const finalPath = path.join(taskDirectory, revision)
        await mkdir(taskDirectory, { recursive: true })
        await rename(extractPath, finalPath)
        if (task.contentRevision && task.contentRevision !== revision) {
          await rm(path.join(taskDirectory, task.contentRevision), { recursive: true, force: true })
        }
        return {
          contentToken: task.contentToken || createOpaqueToken(18),
          contentRevision: revision,
          targetStatus: 'ready',
          targetOrigin: null,
          validatedAt: new Date().toISOString(),
          ...details
        }
      } catch (error) {
        if (error instanceof HttpError) throw error
        throw new HttpError(400, 'ZIP 文件损坏或无法读取', 'INVALID_ZIP')
      } finally {
        await rm(temporary, { recursive: true, force: true })
      }
    },

    async resolveAsset(task, requestedPath = 'index.html') {
      if (!task?.contentRevision) return null
      let requested
      try {
        requested = decodeURIComponent(requestedPath || 'index.html')
      } catch {
        return null
      }
      const base = path.resolve(resolvedRoot, task.id, task.contentRevision)
      let candidate = path.resolve(base, requested)
      if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) return null
      if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = path.join(candidate, 'index.html')
      if (!existsSync(candidate) || !statSync(candidate).isFile()) return null

      const extension = path.extname(candidate).toLowerCase()
      const headers = {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals allow-popups; default-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' data: blob: https: http:;",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      }
      if (extension !== '.html') return { body: createReadStream(candidate), headers }

      const source = await readFile(candidate, 'utf8')
      const loader = `<script src="/insightux-recorder.js" data-task-id="${task.id}"></script>`
      return {
        body: source.includes('</head>')
          ? source.replace('</head>', `${loader}</head>`)
          : `${loader}${source}`,
        headers
      }
    },

    async serve(request, response, store) {
      const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
      const match = url.pathname.match(/^\/test-content\/([^/]+)(?:\/(.*))?$/)
      if (request.method !== 'GET' || !match) return false
      const task = store.getTaskByContentToken(decodeURIComponent(match[1]))
      if (!task?.contentRevision) return false
      let requested
      try {
        requested = decodeURIComponent(match[2] || 'index.html')
      } catch {
        return false
      }
      const base = path.resolve(resolvedRoot, task.id, task.contentRevision)
      let candidate = path.resolve(base, requested)
      if (candidate !== base && !candidate.startsWith(`${base}${path.sep}`)) return false
      if (existsSync(candidate) && statSync(candidate).isDirectory()) candidate = path.join(candidate, 'index.html')
      if (!existsSync(candidate) || !statSync(candidate).isFile()) return false

      const extension = path.extname(candidate).toLowerCase()
      response.writeHead(200, {
        'Content-Type': mimeTypes[extension] || 'application/octet-stream',
        'Cache-Control': extension === '.html' ? 'no-store' : 'public, max-age=31536000, immutable',
        'Content-Security-Policy': "sandbox allow-scripts allow-forms allow-modals allow-popups; default-src 'self' data: blob: https: http:; script-src 'self' 'unsafe-inline' data: blob: https: http:;",
        'X-Content-Type-Options': 'nosniff',
        'Referrer-Policy': 'no-referrer'
      })
      if (extension === '.html') {
        const source = await readFile(candidate, 'utf8')
        const loader = `<script src="/insightux-recorder.js" data-task-id="${task.id}"></script>`
        response.end(source.includes('</head>') ? source.replace('</head>', `${loader}</head>`) : `${loader}${source}`)
      } else {
        createReadStream(candidate).pipe(response)
      }
      return true
    }
  }
}
