export class ApiError extends Error {
  constructor(message, { status = 0, code = 'NETWORK_ERROR' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

async function requestEnvelope(path, options = {}) {
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

const request = async (path, options = {}) => (await requestEnvelope(path, options)).data

async function uploadZip(path, file) {
  let response
  try {
    response = await fetch(path, {
      method: 'PUT', credentials: 'same-origin',
      headers: { 'Content-Type': 'application/zip' }, body: file
    })
  } catch {
    throw new ApiError('无法连接 InsightUX 服务，请确认服务已启动')
  }
  const data = await response.json().catch(() => null)
  if (!response.ok) {
    throw new ApiError(data?.error?.message || `上传失败 (${response.status})`, {
      status: response.status, code: data?.error?.code || 'UPLOAD_ERROR'
    })
  }
  return data.data
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
  Authorization: `Bearer ${getParticipantToken(sessionId)}`
})

export const api = {
  auth: {
    me: () => request('/api/v1/auth/me'),
    login: (password) => request('/api/v1/auth/login', { method: 'POST', body: { password } }),
    logout: () => request('/api/v1/auth/logout', { method: 'POST' })
  },

  tasks: {
    list: () => requestEnvelope('/api/v1/tasks'),
    create: (input) => request('/api/v1/tasks', { method: 'POST', body: input }),
    update: (id, input) => request(`/api/v1/tasks/${encodeURIComponent(id)}`, { method: 'PATCH', body: input }),
    uploadSite: (id, file) => uploadZip(`/api/v1/tasks/${encodeURIComponent(id)}/site`, file),
    validateUrl: (id, input) => request(`/api/v1/tasks/${encodeURIComponent(id)}/url-validation`, { method: 'POST', body: input }),
    createTrial: (id) => request(`/api/v1/tasks/${encodeURIComponent(id)}/trials`, { method: 'POST' })
  },

  sessions: {
    list: ({ status, sort = 'desc', scope = 'participant' } = {}) => {
      const query = new URLSearchParams()
      if (status) query.set('status', status)
      query.set('sort', sort)
      query.set('mode', scope)
      return requestEnvelope(`/api/v1/sessions?${query}`)
    },
    get: (id) => request(`/api/v1/sessions/${encodeURIComponent(id)}`),
    diagnose: (id) => request(`/api/v1/sessions/${encodeURIComponent(id)}/diagnosis`, { method: 'POST' })
  },

  dashboard: {
    get: () => request('/api/v1/dashboard')
  },

  participant: {
    getTask: (token) => request(`/api/v1/participant/tasks/${encodeURIComponent(token)}`),
    createSession: (token) => request(`/api/v1/participant/tasks/${encodeURIComponent(token)}/sessions`, {
      method: 'POST',
      body: { consent: true }
    }),
    getSession: (id) => request(`/api/v1/participant/sessions/${encodeURIComponent(id)}`, {
      headers: participantHeaders(id)
    }),
    startSession: (id) => request(`/api/v1/participant/sessions/${encodeURIComponent(id)}/start`, {
      method: 'POST',
      headers: participantHeaders(id)
    }),
    completeSession: (id, input) => request(`/api/v1/participant/sessions/${encodeURIComponent(id)}/complete`, {
      method: 'POST',
      headers: participantHeaders(id),
      body: input
    }),
    abandonSession: (id) => request(`/api/v1/participant/sessions/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: participantHeaders(id)
    })
  },

  reports: {
    getShared: (token) => request(`/api/v1/reports/${encodeURIComponent(token)}`)
  }
}
