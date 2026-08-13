export class HttpError extends Error {
  constructor(status, message, code = 'REQUEST_ERROR') {
    super(message)
    this.status = status
    this.code = code
  }
}

export function sendJson(response, status, data, headers = {}) {
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  })
  response.end(JSON.stringify(data))
}

export async function readJson(request, maxBytes = 1024 * 1024) {
  const chunks = []
  let size = 0

  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      throw new HttpError(413, '请求数据超过大小限制', 'PAYLOAD_TOO_LARGE')
    }
    chunks.push(chunk)
  }

  if (chunks.length === 0) return {}
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw new HttpError(400, '请求体必须是有效 JSON', 'INVALID_JSON')
  }
}

export const requireText = (value, field, { min = 1, max = 500 } = {}) => {
  const text = typeof value === 'string' ? value.trim() : ''
  if (text.length < min || text.length > max) {
    throw new HttpError(400, `${field} 长度必须在 ${min}-${max} 个字符之间`, 'VALIDATION_ERROR')
  }
  return text
}
