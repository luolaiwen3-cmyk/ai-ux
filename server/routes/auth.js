import { ADMIN_COOKIE_NAME } from '../auth.js'
import { unauthorized } from '../errors.js'

const authData = {
  type: 'object',
  required: ['authenticated'],
  properties: {
    authenticated: { type: 'boolean' },
    user: {
      type: 'object',
      required: ['role', 'name'],
      properties: {
        role: { type: 'string' },
        name: { type: 'string' }
      }
    }
  }
}

const authenticated = {
  authenticated: true,
  user: { role: 'admin', name: 'Admin' }
}

export function authRoutes(app, _options, done) {
  app.post('/login', {
    bodyLimit: 16 * 1024,
    schema: {
      tags: ['auth'],
      body: {
        type: 'object',
        additionalProperties: false,
        required: ['password'],
        properties: { password: { type: 'string', minLength: 1, maxLength: 1024 } }
      },
      response: {
        200: {
          type: 'object', required: ['data'], properties: { data: authData }
        }
      }
    }
  }, async (request, reply) => {
    if (!app.verifyAdminPassword(request.body.password)) {
      throw unauthorized('INVALID_CREDENTIALS', '管理员密码错误')
    }
    reply.setCookie(ADMIN_COOKIE_NAME, app.createAdminSession(), {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: app.config.isProduction,
      signed: true,
      maxAge: 12 * 60 * 60
    })
    return { data: authenticated }
  })

  app.post('/logout', {
    schema: { tags: ['auth'] }
  }, async (_request, reply) => {
    reply.clearCookie(ADMIN_COOKIE_NAME, {
      path: '/',
      httpOnly: true,
      sameSite: 'strict',
      secure: app.config.isProduction
    })
    return { data: { authenticated: false } }
  })

  app.get('/me', {
    schema: { tags: ['auth'] }
  }, async (request) => {
    if (!app.isAdminRequest(request)) {
      throw unauthorized('UNAUTHORIZED', '请先登录')
    }
    return { data: authenticated }
  })

  done()
}
