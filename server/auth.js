import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual
} from 'node:crypto'

export const ADMIN_COOKIE_NAME = 'insightux_admin'
const COOKIE_NAME = ADMIN_COOKIE_NAME
const SESSION_TTL_SECONDS = 12 * 60 * 60

export const createOpaqueToken = (bytes = 24) => randomBytes(bytes).toString('base64url')

export const hashToken = (token) =>
  createHash('sha256').update(String(token)).digest('hex')

const safeEqualText = (left, right) => {
  const leftBuffer = Buffer.from(String(left))
  const rightBuffer = Buffer.from(String(right))
  if (leftBuffer.length !== rightBuffer.length) return false
  return timingSafeEqual(leftBuffer, rightBuffer)
}

export const verifyPassword = (candidate, configuredPassword) =>
  safeEqualText(candidate, configuredPassword)

const sign = (value, secret) =>
  createHmac('sha256', secret).update(value).digest('base64url')

export function createAdminCookie(secret, secure = false) {
  const payload = Buffer.from(JSON.stringify({
    role: 'admin',
    exp: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
  })).toString('base64url')
  const value = `${payload}.${sign(payload, secret)}`
  const attributes = [
    `${COOKIE_NAME}=${value}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${SESSION_TTL_SECONDS}`
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export function clearAdminCookie(secure = false) {
  const attributes = [
    `${COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0'
  ]
  if (secure) attributes.push('Secure')
  return attributes.join('; ')
}

export function isAdminRequest(request, secret) {
  const cookies = Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((part) => part.trim().split('='))
      .filter(([key, value]) => key && value)
  )
  const token = cookies[COOKIE_NAME]
  if (!token) return false

  const separator = token.lastIndexOf('.')
  if (separator < 1) return false
  const payload = token.slice(0, separator)
  const signature = token.slice(separator + 1)
  if (!safeEqualText(signature, sign(payload, secret))) return false

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    return decoded.role === 'admin' && decoded.exp > Math.floor(Date.now() / 1000)
  } catch {
    return false
  }
}
