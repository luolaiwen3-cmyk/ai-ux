export class ApiError extends Error {
  constructor(message, status, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.details = details
  }
}

export async function apiRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    credentials: 'same-origin',
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers
    }
  })

  if (!response.ok) {
    let details
    try { details = await response.json() } catch { details = null }
    throw new ApiError(details?.detail || '请求失败', response.status, details)
  }
  if (response.status === 204) return null
  return response.json()
}

export const authApi = {
  me: () => apiRequest('/auth/me'),
  login: (username, password) => apiRequest('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => apiRequest('/auth/logout', { method: 'POST' })
}

export const tasksApi = {
  list: () => apiRequest('/tasks'),
  create: (payload) => apiRequest('/tasks', { method: 'POST', body: JSON.stringify(payload) }),
  update: (id, payload) => apiRequest(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  getPublic: (token) => apiRequest(`/public/tasks/${token}`)
}

export const sessionsApi = {
  create: (taskToken) => apiRequest(`/public/tasks/${taskToken}/sessions`, { method: 'POST' }),
  uploadBatch: (sessionId, uploadToken, payload) => apiRequest(`/public/sessions/${sessionId}/batches`, { method: 'POST', headers: { 'X-Upload-Token': uploadToken }, body: JSON.stringify(payload) }),
  complete: (sessionId, uploadToken, payload) => apiRequest(`/public/sessions/${sessionId}/complete`, { method: 'POST', headers: { 'X-Upload-Token': uploadToken }, body: JSON.stringify(payload) }),
  list: () => apiRequest('/sessions'),
  detail: (id) => apiRequest(`/sessions/${id}`),
  rrweb: (id) => apiRequest(`/sessions/${id}/rrweb`),
  faceFrames: (id) => apiRequest(`/sessions/${id}/face-frames`),
  remove: (id) => apiRequest(`/sessions/${id}`, { method: 'DELETE' })
}
