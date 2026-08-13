import {
  clearAdminCookie,
  createAdminCookie,
  isAdminRequest,
  verifyPassword
} from './auth.js'
import { HttpError, readJson, requireText, sendJson } from './http.js'
import { diagnoseSession } from './diagnosis.js'

const TASK_STATUSES = new Set(['draft', 'active', 'paused'])
const TASK_TARGET_TYPES = new Set(['builtin', 'upload', 'url'])
const SESSION_STATUSES = new Set(['created', 'recording', 'completed', 'abandoned'])
const COUPON_DECISIONS = new Set(['none', 'applied', 'declined'])

const validateSteps = (steps) => {
  if (!Array.isArray(steps) || steps.length < 1 || steps.length > 10) {
    throw new HttpError(400, '任务步骤必须包含 1-10 项', 'VALIDATION_ERROR')
  }
  return steps.map((step, index) => requireText(step, `第 ${index + 1} 个步骤`, { max: 120 }))
}

const taskInput = (body, partial = false) => {
  const result = {}
  if (!partial || body.name !== undefined) result.name = requireText(body.name, '任务名称', { max: 100 })
  if (!partial || body.description !== undefined) {
    result.description = typeof body.description === 'string' ? body.description.trim().slice(0, 1000) : ''
  }
  if (!partial || body.steps !== undefined) result.steps = validateSteps(body.steps)
  if (!partial || body.targetType !== undefined) {
    const targetType = body.targetType || 'builtin'
    if (!TASK_TARGET_TYPES.has(targetType)) throw new HttpError(400, '测试网页类型无效', 'VALIDATION_ERROR')
    result.targetType = targetType
  }
  if (body.targetUrl !== undefined) {
    if (typeof body.targetUrl !== 'string' || body.targetUrl.length > 2000) {
      throw new HttpError(400, '测试网页 URL 无效', 'VALIDATION_ERROR')
    }
    try {
      const parsed = new URL(body.targetUrl)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
      result.targetUrl = parsed.toString()
    } catch {
      throw new HttpError(400, '测试网页 URL 必须是有效的 HTTP(S) 地址', 'VALIDATION_ERROR')
    }
  }
  if (!partial && result.targetType === 'url' && !result.targetUrl) {
    throw new HttpError(400, 'URL 类型任务必须填写测试网页地址', 'VALIDATION_ERROR')
  }
  if (body.status !== undefined) {
    if (!TASK_STATUSES.has(body.status)) throw new HttpError(400, '任务状态无效', 'VALIDATION_ERROR')
    result.status = body.status
  }
  return result
}

const requireAdmin = (request, config) => {
  if (!isAdminRequest(request, config.sessionSecret)) {
    throw new HttpError(401, '请先登录', 'UNAUTHORIZED')
  }
}

const sessionToken = (request) => String(request.headers['x-session-token'] || '')

export function createApiRouter({ store, config, siteStorage = null }) {
  return async function route(request, response) {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`)
    const { pathname } = url

    if (request.method === 'GET' && pathname === '/api/health') {
      sendJson(response, 200, { status: 'ok', storage: 'sqlite' })
      return true
    }

    if (request.method === 'POST' && pathname === '/api/auth/login') {
      const body = await readJson(request, 16 * 1024)
      if (!verifyPassword(body.password, config.adminPassword)) {
        throw new HttpError(401, '管理员密码错误', 'INVALID_CREDENTIALS')
      }
      sendJson(response, 200, { authenticated: true, user: { role: 'admin', name: 'Admin' } }, {
        'Set-Cookie': createAdminCookie(config.sessionSecret, config.isProduction)
      })
      return true
    }

    if (request.method === 'POST' && pathname === '/api/auth/logout') {
      sendJson(response, 200, { authenticated: false }, {
        'Set-Cookie': clearAdminCookie(config.isProduction)
      })
      return true
    }

    if (request.method === 'GET' && pathname === '/api/auth/me') {
      const authenticated = isAdminRequest(request, config.sessionSecret)
      sendJson(response, authenticated ? 200 : 401, authenticated
        ? { authenticated: true, user: { role: 'admin', name: 'Admin' } }
        : { authenticated: false, error: { code: 'UNAUTHORIZED', message: '请先登录' } })
      return true
    }

    const publicTaskMatch = pathname.match(/^\/api\/public\/tasks\/([^/]+)$/)
    if (request.method === 'GET' && publicTaskMatch) {
      const task = store.getPublicTask(decodeURIComponent(publicTaskMatch[1]))
      if (!task) throw new HttpError(404, '测试链接无效或任务已暂停', 'TASK_NOT_AVAILABLE')
      const { token: _token, ...publicTask } = task
      sendJson(response, 200, {
        task: {
          ...publicTask,
          diagnosisProvider: config.dashscopeApiKey ? 'dashscope' : 'local-rules'
        }
      })
      return true
    }

    const publicSessionCreateMatch = pathname.match(/^\/api\/public\/tasks\/([^/]+)\/sessions$/)
    if (request.method === 'POST' && publicSessionCreateMatch) {
      const token = decodeURIComponent(publicSessionCreateMatch[1])
      const task = store.getPublicTask(token)
      if (!task) throw new HttpError(404, '测试链接无效或任务已暂停', 'TASK_NOT_AVAILABLE')
      const body = await readJson(request, 16 * 1024)
      if (body.consent !== true) throw new HttpError(400, '必须确认知情同意', 'CONSENT_REQUIRED')
      const session = store.createSession(task.id)
      sendJson(response, 201, { session })
      return true
    }

    const publicReportMatch = pathname.match(/^\/api\/public\/reports\/([^/]+)$/)
    if (request.method === 'GET' && publicReportMatch) {
      const report = store.getSharedReport(decodeURIComponent(publicReportMatch[1]))
      if (!report) throw new HttpError(404, '分享报告不存在或已失效', 'REPORT_NOT_FOUND')
      const { events: _events, faceFrames: _faceFrames, ...safeReport } = report
      sendJson(response, 200, { report: safeReport })
      return true
    }

    const publicSessionMatch = pathname.match(/^\/api\/public\/sessions\/([^/]+)$/)
    if (publicSessionMatch) {
      const id = decodeURIComponent(publicSessionMatch[1])
      if (!store.verifySessionToken(id, sessionToken(request))) {
        throw new HttpError(401, '会话凭证无效', 'INVALID_SESSION_TOKEN')
      }
      if (request.method === 'GET') {
        sendJson(response, 200, { session: store.getPublicSession(id) })
        return true
      }
      if (request.method === 'DELETE') {
        store.abandonSession(id)
        sendJson(response, 200, { deleted: true })
        return true
      }
    }

    const publicSessionStartMatch = pathname.match(/^\/api\/public\/sessions\/([^/]+)\/start$/)
    if (request.method === 'POST' && publicSessionStartMatch) {
      const id = decodeURIComponent(publicSessionStartMatch[1])
      if (!store.verifySessionToken(id, sessionToken(request))) {
        throw new HttpError(401, '会话凭证无效', 'INVALID_SESSION_TOKEN')
      }
      sendJson(response, 200, { session: store.startSession(id) })
      return true
    }

    const publicSessionCompleteMatch = pathname.match(/^\/api\/public\/sessions\/([^/]+)\/complete$/)
    if (request.method === 'POST' && publicSessionCompleteMatch) {
      const id = decodeURIComponent(publicSessionCompleteMatch[1])
      if (!store.verifySessionToken(id, sessionToken(request))) {
        throw new HttpError(401, '会话凭证无效', 'INVALID_SESSION_TOKEN')
      }
      const body = await readJson(request, 12 * 1024 * 1024)
      if (!COUPON_DECISIONS.has(body.couponDecision)) {
        throw new HttpError(400, '优惠券决策无效', 'VALIDATION_ERROR')
      }
      if (body.events !== undefined && !Array.isArray(body.events)) {
        throw new HttpError(400, '行为事件格式无效', 'VALIDATION_ERROR')
      }
      if (body.faceFrames !== undefined && !Array.isArray(body.faceFrames)) {
        throw new HttpError(400, '面部帧格式无效', 'VALIDATION_ERROR')
      }
      if ((body.events?.length || 0) > 10000) {
        throw new HttpError(413, '行为事件超过 10000 条上限', 'EVENT_LIMIT_EXCEEDED')
      }
      if ((body.faceFrames?.length || 0) > 600) {
        throw new HttpError(413, '面部帧超过 600 条上限', 'FRAME_LIMIT_EXCEEDED')
      }
      const session = store.completeSession(id, body)
      sendJson(response, 200, { session })
      return true
    }

    if (pathname.startsWith('/api/tasks') || pathname.startsWith('/api/sessions') || pathname.startsWith('/api/dashboard')) {
      requireAdmin(request, config)
    }

    if (request.method === 'GET' && pathname === '/api/tasks') {
      sendJson(response, 200, { tasks: store.listTasks(), publicAppUrl: config.publicAppUrl })
      return true
    }

    if (request.method === 'POST' && pathname === '/api/tasks') {
      const body = taskInput(await readJson(request, 64 * 1024))
      sendJson(response, 201, { task: store.createTask(body) })
      return true
    }

    const taskSiteMatch = pathname.match(/^\/api\/tasks\/([^/]+)\/site$/)
    if (request.method === 'PUT' && taskSiteMatch) {
      if (!siteStorage) throw new HttpError(503, '网页存储服务未配置', 'SITE_STORAGE_UNAVAILABLE')
      const id = decodeURIComponent(taskSiteMatch[1])
      const task = store.getTask(id)
      if (!task) throw new HttpError(404, '任务不存在', 'TASK_NOT_FOUND')
      if (task.targetType !== 'upload') throw new HttpError(409, '只有 ZIP 类型任务可以上传网页', 'INVALID_TARGET_TYPE')
      const installed = await siteStorage.installZip(request, task)
      const updated = store.updateTask(id, installed)
      sendJson(response, 200, {
        task: updated,
        site: {
          fileCount: installed.fileCount,
          expandedBytes: installed.expandedBytes,
          launchUrl: `/test-content/${updated.contentToken}/index.html`
        }
      })
      return true
    }

    const taskMatch = pathname.match(/^\/api\/tasks\/([^/]+)$/)
    if (taskMatch) {
      const id = decodeURIComponent(taskMatch[1])
      if (request.method === 'GET') {
        const task = store.getTask(id)
        if (!task) throw new HttpError(404, '任务不存在', 'TASK_NOT_FOUND')
        sendJson(response, 200, { task })
        return true
      }
      if (request.method === 'PATCH') {
        const task = store.updateTask(id, taskInput(await readJson(request, 64 * 1024), true))
        sendJson(response, 200, { task })
        return true
      }
    }

    if (request.method === 'GET' && pathname === '/api/sessions') {
      const status = url.searchParams.get('status') || undefined
      if (status && !SESSION_STATUSES.has(status)) throw new HttpError(400, '会话状态无效', 'VALIDATION_ERROR')
      const sort = url.searchParams.get('sort') === 'asc' ? 'asc' : 'desc'
      sendJson(response, 200, { sessions: store.listSessions({ status, sort }) })
      return true
    }

    if (request.method === 'GET' && pathname === '/api/dashboard') {
      sendJson(response, 200, { stats: store.getDashboardStats() })
      return true
    }

    const sessionMatch = pathname.match(/^\/api\/sessions\/([^/]+)$/)
    if (request.method === 'GET' && sessionMatch) {
      const session = store.getSession(decodeURIComponent(sessionMatch[1]))
      if (!session) throw new HttpError(404, '会话不存在', 'SESSION_NOT_FOUND')
      sendJson(response, 200, { session })
      return true
    }

    const diagnoseMatch = pathname.match(/^\/api\/sessions\/([^/]+)\/diagnose$/)
    if (request.method === 'POST' && diagnoseMatch) {
      const session = store.getSession(decodeURIComponent(diagnoseMatch[1]))
      if (!session) throw new HttpError(404, '会话不存在', 'SESSION_NOT_FOUND')
      if (session.status !== 'completed') throw new HttpError(409, '会话完成后才能诊断', 'SESSION_NOT_COMPLETED')
      const diagnosis = await diagnoseSession(session, config)
      sendJson(response, 200, { diagnosis: store.saveDiagnosis(session.id, diagnosis) })
      return true
    }

    return false
  }
}

export function handleApiError(error, response) {
  if (response.headersSent) {
    response.end()
    return
  }
  if (error instanceof HttpError) {
    sendJson(response, error.status, { error: { code: error.code, message: error.message } })
    return
  }
  console.error('[api]', error)
  sendJson(response, 500, { error: { code: 'INTERNAL_ERROR', message: '服务器内部错误' } })
}
