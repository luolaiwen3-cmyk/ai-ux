import { createApp } from './app.js'
import { config, validateConfig } from './config.js'

const apiOnly = process.argv.includes('--dev')

validateConfig()
const app = createApp({ config, apiOnly })

try {
  await app.listen({ port: config.port, host: config.host })
  app.log.info(`[InsightUX] ${apiOnly ? 'API' : '应用'}服务已启动：http://localhost:${config.port}`)
} catch (error) {
  app.log.error(error)
  process.exit(1)
}

const shutdown = async () => {
  await app.close()
  process.exit(0)
}

process.once('SIGINT', shutdown)
process.once('SIGTERM', shutdown)
