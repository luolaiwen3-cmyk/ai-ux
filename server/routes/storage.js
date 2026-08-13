import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import fastifyStatic from '@fastify/static'
import { AppError, notFound } from '../errors.js'

export function siteRoutes(app, _options, done) {
  app.get('/test-content/:contentToken/*', {
    schema: {
      tags: ['participant'],
      params: {
        type: 'object',
        required: ['contentToken', '*'],
        properties: {
          contentToken: { type: 'string', minLength: 1, maxLength: 200 },
          '*': { type: 'string', maxLength: 4000 }
        }
      }
    }
  }, async (request, reply) => {
    const task = app.services.tasks.getByContentToken(request.params.contentToken)
    if (!task) throw notFound('SITE_NOT_FOUND', '测试网页不存在')
    const asset = await app.siteStorage.resolveAsset(task, request.params['*'])
    if (!asset) throw notFound('SITE_FILE_NOT_FOUND', '测试网页文件不存在')
    Object.entries(asset.headers).forEach(([name, value]) => reply.header(name, value))
    return reply.send(asset.body)
  })

  done()
}

export async function registerApplicationAssets(app, { distDir }) {
  if (!existsSync(distDir)) return
  await app.register(fastifyStatic, {
    root: distDir,
    wildcard: false,
    setHeaders(response, filePath) {
      response.setHeader('Cache-Control', filePath.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable')
    }
  })

  app.get('/*', async (request, reply) => {
    const requested = request.params['*'] || 'index.html'
    const candidate = path.resolve(distDir, requested)
    const isAsset = candidate.startsWith(`${distDir}${path.sep}`) &&
      existsSync(candidate) && statSync(candidate).isFile()
    if (isAsset) {
      return reply.header('Cache-Control', requested.endsWith('.html')
        ? 'no-cache'
        : 'public, max-age=31536000, immutable').sendFile(requested)
    }
    const index = path.join(distDir, 'index.html')
    if (!existsSync(index)) throw new AppError(404, 'NOT_FOUND', '页面不存在')
    return reply.header('Cache-Control', 'no-cache').sendFile('index.html')
  })
}
