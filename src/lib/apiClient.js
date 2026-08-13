export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {})
  if (options.body !== undefined && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  let response
  try {
    response = await fetch(path, {
      ...options,
      headers,
      credentials: 'same-origin',
      body: options.body === undefined || typeof options.body === 'string'
        ? options.body
        : JSON.stringify(options.body)
    })
  } catch {
    throw new ApiError('无法连接 InsightUX 服务，请确认服务已启动')
  }

  let data = null
  try {
    data = await response.json()
  } catch {
    data = null
  }

  if (!response.ok) {
    throw new ApiError(data?.error?.message || `请求失败 (${response.status})`, {
      status: response.status,
      code: data?.error?.code || 'REQUEST_ERROR'
    })
  }
  return data
}

const sessionTokenKey = (sessionId) => `insightux-session-token:${sessionId}`

export const saveParticipantSession = (session) => {
  sessionStorage.setItem(sessionTokenKey(session.id), session.uploadToken)
}

export const getParticipantToken = (sessionId) =>
  sessionStorage.getItem(sessionTokenKey(sessionId)) || ''

export const clearParticipantSession = (sessionId) =>
  sessionStorage.removeItem(sessionTokenKey(sessionId))

const participantHeaders = (sessionId) => ({
  'X-Session-Token': getParticipantToken(sessionId)
})

export const api = {
  auth: {
    me: () => request('/api/auth/me'),
    login: (password) => request('/api/auth/login', { method: 'POST', body: { password } }),
    logout: () => request('/api/auth/logout', { method: 'POST' })
  },

  tasks: {
    list: () => request('/api/tasks'),
    create: (input) => request('/api/tasks', { method: 'POST', body: input }),
    update: (id, input) => request(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: input })
  },

  sessions: {
    list: ({ status, sort = 'desc' } = {}) => {
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      query.set('sort', sort)
      return request(`/api/sessions?${query}`)
    },
    get: (id) => request(`/api/sessions/${encodeURIComponent(id)}`)
  },

  participant: {
    getTask: (token) => request(`/api/public/tasks/${encodeURIComponent(token)}`),
    createSession: (token) => request(`/api/public/tasks/${encodeURIComponent(token)}/sessions`, {
      method: 'POST',
      body: { consent: true }
    }),
    getSession: (id) => request(`/api/public/sessions/${encodeURIComponent(id)}`, {
      headers: participantHeaders(id)
    }),
    startSession: (id) => request(`/api/public/sessions/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      headers: participantHeaders(id)
    }),
    completeSession: (id, input) => request(`/api/public/sessions/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      headers: participantHeaders(id),
      body: input
    }),
    abandonSession: (id) => request(`/api/public/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: participantHeaders(id)
    })
  }
}
