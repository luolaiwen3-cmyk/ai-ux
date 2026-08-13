import path from 'node:path'
import { loadEnvFile } from 'node:process'

try {
  loadEnvFile('.env')
} catch (error) {
  if (error.code !== 'ENOENT') throw error
}

const isProduction = process.env.NODE_ENV === 'production'

export const config = {
  host: process.env.HOST || '0.0.0.0',
  port: Number(process.env.PORT || 8787),
  databasePath: path.resolve(process.env.INSIGHTUX_DB_PATH || './data/insightux.db'),
  siteDir: path.resolve(process.env.INSIGHTUX_SITE_DIR || './data/task-sites'),
  adminPassword: process.env.ADMIN_PASSWORD || 'insightux-demo',
  sessionSecret: process.env.ADMIN_SESSION_SECRET || 'insightux-development-secret-change-me',
  publicAppUrl: process.env.PUBLIC_APP_URL || 'http://localhost:8787',
  dashscopeApiKey: process.env.DASHSCOPE_API_KEY || '',
  qwenBaseUrl: process.env.QWEN_BASE_URL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  qwenModel: process.env.QWEN_MODEL || 'qwen3-vl-plus',
  isProduction
}

export function validateConfig() {
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('PORT 必须是 1-65535 之间的整数')
  }

  if (isProduction) {
    if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD === 'change-me') {
      throw new Error('生产环境必须设置安全的 ADMIN_PASSWORD')
    }
    if (!process.env.ADMIN_SESSION_SECRET || process.env.ADMIN_SESSION_SECRET.length < 32) {
      throw new Error('生产环境 ADMIN_SESSION_SECRET 至少需要 32 个字符')
    }
  }
}
