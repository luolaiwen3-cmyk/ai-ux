import { randomUUID } from 'node:crypto'
import { createOpaqueToken, hashToken } from './auth.js'
import { diagnoseSession } from './diagnosis.js'
import { AppError, conflict, notFound, unauthorized } from './errors.js'
import { analyzeSession } from './metrics.js'

const taskStatuses = new Set(['draft', 'active', 'paused'])
const targetTypes = new Set(['builtin', 'upload', 'url'])
const sessionStatuses = new Set(['created', 'recording', 'completed', 'abandoned'])
const couponDecisions = new Set(['none', 'applied', 'declined'])

const nowIso = () => new Date().toISOString()

const text = (value, field, { max = 500 } = {}) => {
  const normalized = typeof value === 'string' ? value.trim() : ''
  if (!normalized || normalized.length > max) {
    throw new AppError(400, 'VALIDATION_ERROR', `${field}不能为空且不能超过 ${max} 个字符`)
  }
  return normalized
}

const steps = (value) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 10) {
    throw new AppError(400, 'VALIDATION_ERROR', '任务步骤必须包含 1-10 项')
  }
  return value.map((step, index) => text(step, `第 ${index + 1} 个步骤`, { max: 120 }))
}

const targetUrl = (value) => {
  if (typeof value !== 'string' || value.length > 2000) {
    throw new AppError(400, 'VALIDATION_ERROR', '测试网页 URL 无效')
  }
  try {
    const parsed = new URL(value)
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('protocol')
    return parsed.toString()
  } catch {
    throw new AppError(400, 'VALIDATION_ERROR', '测试网页 URL 必须是有效的 HTTP(S) 地址')
  }
}

export function createServices({ repositories, config }) {
  const taskService = {
    list() {
      return repositories.tasks.list()
    },

    get(id) {
      const task = repositories.tasks.findById(id)
      if (!task) throw notFound('TASK_NOT_FOUND', '任务不存在')
      return task
    },

    getPublic(token) {
      const task = repositories.tasks.findByPublicToken(token)
      if (!task) throw notFound('TASK_NOT_AVAILABLE', '测试链接无效或任务已暂停')
      const { token: _token, ...publicTask } = task
      return {
        ...publicTask,
        diagnosisProvider: config.dashscopeApiKey ? 'dashscope' : 'local-rules'
      }
    },

    getByContentToken(token) {
      return repositories.tasks.findByContentToken(token)
    },

    create(input) {
      const type = input.targetType || 'builtin'
      if (!targetTypes.has(type)) {
        throw new AppError(400, 'VALIDATION_ERROR', '测试网页类型无效')
      }
      const status = input.status || 'draft'
      if (!taskStatuses.has(status)) {
        throw new AppError(400, 'VALIDATION_ERROR', '任务状态无效')
      }
      const url = type === 'url' ? targetUrl(input.targetUrl) : null
      const targetStatus = type === 'builtin' ? 'ready' : 'pending'
      if (status === 'active' && targetStatus !== 'ready') {
        throw conflict('TARGET_NOT_READY', '测试网页验证通过后才能发布')
      }
      const timestamp = nowIso()
      return repositories.tasks.create({
        id: randomUUID(),
        token: createOpaqueToken(12),
        name: text(input.name, '任务名称', { max: 100 }),
        description: typeof input.description === 'string' ? input.description.trim().slice(0, 1000) : '',
        scenario: 'checkout-coupon',
        status,
        steps: steps(input.steps),
        targetType: type,
        targetStatus,
        targetUrl: url,
        targetOrigin: null,
        contentToken: null,
        contentRevision: null,
        validatedAt: targetStatus === 'ready' ? timestamp : null,
        createdAt: timestamp,
        updatedAt: timestamp
      })
    },

    update(id, input) {
      const current = taskService.get(id)
      const next = {
        ...current,
        name: input.name === undefined ? current.name : text(input.name, '任务名称', { max: 100 }),
        description: input.description === undefined
          ? current.description
          : String(input.description).trim().slice(0, 1000),
        steps: input.steps === undefined ? current.steps : steps(input.steps),
        status: input.status === undefined ? current.status : input.status,
        updatedAt: nowIso()
      }
      if (!taskStatuses.has(next.status)) {
        throw new AppError(400, 'VALIDATION_ERROR', '任务状态无效')
      }
      if (input.targetUrl !== undefined) {
        if (current.targetType !== 'url') {
          throw conflict('INVALID_TARGET_TYPE', '只有 URL 类型任务可以修改网页地址')
        }
        const url = targetUrl(input.targetUrl)
        if (url !== current.targetUrl) {
          next.targetUrl = url
          next.targetStatus = 'pending'
          next.targetOrigin = null
          next.validatedAt = null
          if (next.status === 'active') next.status = 'draft'
        }
      }
      if (next.status === 'active' && next.targetStatus !== 'ready') {
        throw conflict('TARGET_NOT_READY', '测试网页验证通过后才能发布')
      }
      return repositories.tasks.update(id, next)
    },

    validateUrl(id, handshake) {
      const task = taskService.get(id)
      if (task.targetType !== 'url' || !task.targetUrl) {
        throw conflict('INVALID_TARGET_TYPE', '只有 URL 类型任务可以执行连接验证')
      }
      const origin = new URL(task.targetUrl).origin
      if (handshake.origin !== origin || handshake.sdkVersion !== '1.0.0') {
        throw new AppError(400, 'RECORDER_HANDSHAKE_INVALID', '录制 SDK 握手信息与任务 URL 不匹配')
      }
      if (config.isProduction && !task.targetUrl.startsWith('https://')) {
        throw new AppError(400, 'HTTPS_REQUIRED', '生产环境 URL 测试仅允许 HTTPS 网页')
      }
      if (origin === new URL(config.publicAppUrl).origin) {
        throw new AppError(400, 'SELF_TARGET_NOT_ALLOWED', 'URL 测试不能指向 InsightUX 自身地址')
      }
      return repositories.tasks.update(id, {
        ...task,
        targetStatus: 'ready',
        targetOrigin: origin,
        validatedAt: nowIso(),
        updatedAt: nowIso()
      })
    },

    installSite(id, installed) {
      const task = taskService.get(id)
      if (task.targetType !== 'upload') {
        throw conflict('INVALID_TARGET_TYPE', '只有 ZIP 类型任务可以上传网页')
      }
      return repositories.tasks.update(id, {
        ...task,
        ...installed,
        targetStatus: 'ready',
        validatedAt: nowIso(),
        updatedAt: nowIso()
      })
    },

    seedDemo() {
      if (repositories.tasks.count() > 0) return null
      return taskService.create({
        name: '电商结算页优惠券测试',
        description: '请像日常购物一样检查商品、处理优惠券并提交订单。',
        steps: ['确认购物车商品', '处理优惠券提示', '提交订单'],
        targetType: 'builtin',
        status: 'active'
      })
    }
  }

  const requireSession = (id) => {
    const session = repositories.sessions.findAccessRecord(id)
    if (!session) throw notFound('SESSION_NOT_FOUND', '会话不存在')
    return session
  }

  const verifySession = (id, token) => {
    const session = requireSession(id)
    if (!token || session.session_token_hash !== hashToken(token)) {
      throw unauthorized('INVALID_SESSION_TOKEN', '会话凭证无效')
    }
    return session
  }

  const sessionService = {
    list(options) {
      if (options.status && !sessionStatuses.has(options.status)) {
        throw new AppError(400, 'VALIDATION_ERROR', '会话状态无效')
      }
      return repositories.sessions.list(options)
    },

    get(id) {
      const session = repositories.sessions.findDetail(id)
      if (!session) throw notFound('SESSION_NOT_FOUND', '会话不存在')
      return { ...session, diagnosis: repositories.diagnoses.findBySessionId(id) }
    },

    getPublic(id, token) {
      verifySession(id, token)
      return repositories.sessions.findPublic(id)
    },

    createForTask(task, mode) {
      if (!task || (mode === 'participant' && task.status !== 'active')) {
        throw conflict('TASK_NOT_ACTIVE', '任务当前不可参与')
      }
      if (task.targetStatus !== 'ready') {
        throw conflict('TARGET_NOT_READY', '测试网页尚未验证')
      }
      const uploadToken = createOpaqueToken(24)
      const timestamp = nowIso()
      const created = repositories.sessions.create({
        id: randomUUID(),
        taskId: task.id,
        tokenHash: hashToken(uploadToken),
        mode,
        consentAt: timestamp,
        createdAt: timestamp
      })
      return { ...created, uploadToken }
    },

    createParticipant(taskToken, consent) {
      if (consent !== true) {
        throw new AppError(400, 'CONSENT_REQUIRED', '必须确认知情同意')
      }
      const task = repositories.tasks.findByPublicToken(taskToken)
      if (!task) throw notFound('TASK_NOT_AVAILABLE', '测试链接无效或任务已暂停')
      return sessionService.createForTask(task, 'participant')
    },

    createTrial(taskId) {
      return sessionService.createForTask(taskService.get(taskId), 'trial')
    },

    start(id, token) {
      const session = verifySession(id, token)
      if (['completed', 'abandoned'].includes(session.status)) {
        throw conflict('SESSION_FINISHED', '会话已经结束')
      }
      return repositories.sessions.markStarted(id, nowIso())
    },

    complete(id, token, input) {
      const session = verifySession(id, token)
      if (session.status === 'completed') return sessionService.get(id)
      if (session.status === 'abandoned') {
        throw conflict('SESSION_ABANDONED', '会话已经退出')
      }
      if (!couponDecisions.has(input.couponDecision)) {
        throw new AppError(400, 'VALIDATION_ERROR', '优惠券决策无效')
      }
      const events = input.events || []
      const faceFrames = input.faceFrames || []
      if (events.length > 10000) {
        throw new AppError(413, 'EVENT_LIMIT_EXCEEDED', '行为事件超过 10000 条上限')
      }
      if (faceFrames.length > 600) {
        throw new AppError(413, 'FRAME_LIMIT_EXCEEDED', '面部帧超过 600 条上限')
      }
      const task = taskService.get(session.task_id)
      const lastEmotion = [...faceFrames].reverse().find((frame) => frame?.emotion)?.emotion || null
      const metrics = analyzeSession(events, faceFrames, {
        finalDecision: task.targetType === 'builtin' ? input.couponDecision : null
      })
      return repositories.sessions.complete(id, {
        couponDecision: input.couponDecision,
        duration: metrics.totalDurationMs || Math.max(0, Math.round(Number(input.duration) || 0)),
        eventCount: events.length,
        frameCount: faceFrames.length,
        lastEmotion
      }, {
        events,
        faceFrames,
        metrics: { ...metrics, taskResult: input.metrics || {} },
        result: input.result || {}
      }, nowIso())
    },

    abandon(id, token) {
      const session = verifySession(id, token)
      if (session.status === 'completed') {
        throw conflict('SESSION_COMPLETED', '已完成会话不能删除')
      }
      repositories.sessions.abandon(id, nowIso())
      return true
    }
  }

  const analysisService = {
    async diagnose(sessionId) {
      const session = sessionService.get(sessionId)
      if (session.status !== 'completed') {
        throw conflict('SESSION_NOT_COMPLETED', '会话完成后才能诊断')
      }
      if (session.mode === 'trial') {
        throw conflict('TRIAL_DIAGNOSIS_DISABLED', '试跑会话不生成诊断或报告')
      }
      const diagnosis = await diagnoseSession(session, config)
      const current = repositories.diagnoses.findBySessionId(sessionId)
      return repositories.diagnoses.save({
        id: current?.id || randomUUID(),
        sessionId,
        provider: diagnosis.provider,
        model: diagnosis.model,
        result: diagnosis.result,
        fallbackReason: diagnosis.fallbackReason,
        shareToken: current?.shareToken || createOpaqueToken(18),
        timestamp: nowIso()
      })
    },

    getSharedReport(token) {
      const sessionId = repositories.diagnoses.findSessionIdByShareToken(token)
      if (!sessionId) throw notFound('REPORT_NOT_FOUND', '分享报告不存在或已失效')
      const session = sessionService.get(sessionId)
      const { events: _events, faceFrames: _faceFrames, ...safeSession } = session
      return safeSession
    },

    dashboard() {
      const sessions = repositories.sessions.list({ mode: 'participant' })
      const completed = sessions.filter((session) => session.status === 'completed')
      const diagnosed = completed.filter((session) => session.severity)
      const p0Count = diagnosed.filter((session) => session.severity === 'P0').length
      const trend = new Map()
      completed.forEach((session) => {
        const day = session.completedAt?.slice(5, 10) || session.createdAt.slice(5, 10)
        const current = trend.get(day) || { day, sessions: 0, issues: 0 }
        current.sessions += 1
        if (['P0', 'P1'].includes(session.severity)) current.issues += 1
        trend.set(day, current)
      })
      return {
        totalSessions: sessions.length,
        completedSessions: completed.length,
        p0Count,
        totalIssues: diagnosed.filter((session) => session.severity !== 'P2').length,
        sessionsWithFace: sessions.filter((session) => session.hasFace).length,
        trendData: [...trend.values()].sort((left, right) => left.day.localeCompare(right.day)),
        issueDist: [
          { type: '高认知压力', count: p0Count },
          { type: '操作犹豫', count: diagnosed.filter((session) => session.severity === 'P1').length },
          { type: '流程顺畅', count: diagnosed.filter((session) => session.severity === 'P2').length }
        ],
        recentSessions: sessions.slice(0, 5)
      }
    }
  }

  return { tasks: taskService, sessions: sessionService, analysis: analysisService }
}
