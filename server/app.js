import cookie from '@fastify/cookie'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'
import Fastify from 'fastify'
import { ADMIN_COOKIE_NAME, verifyPassword } from './auth.js'
import { openDatabase } from './database.js'
import { AppError, unauthorized } from './errors.js'
import { createRepositories } from './repositories.js'
import { authRoutes } from './routes/auth.js'
import { participantRoutes } from './routes/participant.js'
import { sessionRoutes } from './routes/sessions.js'
import { taskRoutes } from './routes/tasks.js'
import { createServices } from './services.js'

const runtimeLogger = {
  level: 'info',
  redact: {
    paths: ['req.headers.cookie', 'req.headers.authorization'],
    censor: '[REDACTED]'
  }
}

const errorPayload = (request, code, message, details) => ({
  error: {
    code,
    message,
    ...(details ? { details } : {}),
    requestId: request.id
  }
})

export function createApp({ config, database: suppliedDatabase, logger } = {}) {
  if (!config) throw new Error('createApp 必须提供 config')

  const app = Fastify({
    bodyLimit: 12 * 1024 * 1024,
    logger: logger ?? runtimeLogger
  })
  const database = suppliedDatabase || openDatabase(config.databasePath)
  const repositories = createRepositories(database)
  const services = createServices({ repositories, config })

  app.decorate('config', config)
  app.decorate('repositories', repositories)
  app.decorate('services', services)
  app.decorate('verifyAdminPassword', (password) => verifyPassword(password, config.adminPassword))

  app.register(cookie, { secret: config.sessionSecret, hook: 'onRequest' })
  app.decorate('requireAdmin', async (request) => {
    const signed = request.cookies[ADMIN_COOKIE_NAME]
    const parsed = signed ? request.unsignCookie(signed) : null
    if (!parsed?.valid || parsed.value !== 'admin') {
      throw unauthorized('UNAUTHORIZED', '请先登录')
    }
  })

  app.register(swagger, {
    openapi: {
      info: { title: 'InsightUX API', version: '1.0.0' },
      components: {
        securitySchemes: {
          participantToken: { type: 'http', scheme: 'bearer' }
        }
      },
      tags: [
        { name: 'system', description: '服务状态' },
        { name: 'auth', description: '管理员认证' },
        { name: 'tasks', description: '测试任务' },
        { name: 'sessions', description: '测试会话与诊断' },
        { name: 'participant', description: '参与者流程' }
      ]
    }
  })
  app.register((api, _options, done) => {
    api.get('/api/v1/health', {
      schema: {
        tags: ['system'],
        response: {
          200: {
            type: 'object',
            required: ['data'],
            properties: {
              data: {
                type: 'object',
                required: ['status', 'storage'],
                properties: {
                  status: { type: 'string' },
                  storage: { type: 'string' }
                }
              }
            }
          }
        }
      }
    }, async () => ({ data: { status: 'ok', storage: 'better-sqlite3' } }))
    api.register(authRoutes, { prefix: '/api/v1/auth' })
    api.register(participantRoutes, { prefix: '/api/v1' })
    api.register(taskRoutes, { prefix: '/api/v1' })
    api.register(sessionRoutes, { prefix: '/api/v1' })
    done()
  })
  if (!config.isProduction) {
    app.register(swaggerUi, { routePrefix: '/docs' })
  }

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof AppError) {
      return reply.code(error.statusCode).send(
        errorPayload(request, error.code, error.message, error.details)
      )
    }
    if (error.validation) {
      return reply.code(400).send(errorPayload(
        request,
        'VALIDATION_ERROR',
        '请求数据无效',
        error.validation.map(({ instancePath, message, params }) => ({ instancePath, message, params }))
      ))
    }
    if (error.code === 'FST_ERR_CTP_INVALID_JSON_BODY') {
      return reply.code(400).send(errorPayload(request, 'INVALID_JSON', '请求体必须是有效 JSON'))
    }
    if (error.code === 'FST_ERR_CTP_BODY_TOO_LARGE') {
      return reply.code(413).send(errorPayload(request, 'PAYLOAD_TOO_LARGE', '请求数据超过大小限制'))
    }
    request.log.error({ err: error }, 'request failed')
    return reply.code(500).send(errorPayload(request, 'INTERNAL_ERROR', '服务器内部错误'))
  })

  app.setNotFoundHandler((request, reply) => reply.code(404).send(
    errorPayload(request, 'NOT_FOUND', '接口不存在')
  ))

  app.addHook('onReady', async () => {
    if (config.seedDemo) services.tasks.seedDemo()
  })
  app.addHook('onClose', async () => {
    database.close()
  })

  return app
}
