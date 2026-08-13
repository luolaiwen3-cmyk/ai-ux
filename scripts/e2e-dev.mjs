import { rmSync } from 'node:fs'
import { spawn } from 'node:child_process'

const databasePath = '/tmp/insightux-ai-ux-e2e.db'
const siteDir = '/tmp/insightux-ai-ux-e2e-sites'
rmSync(databasePath, { force: true })
rmSync(`${databasePath}-shm`, { force: true })
rmSync(`${databasePath}-wal`, { force: true })
rmSync(siteDir, { recursive: true, force: true })

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const child = spawn(npmCommand, ['run', 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ADMIN_PASSWORD: 'e2e-password',
    ADMIN_SESSION_SECRET: 'e2e-secret-with-more-than-thirty-two-characters',
    INSIGHTUX_DB_PATH: databasePath,
    INSIGHTUX_SITE_DIR: siteDir,
    PUBLIC_APP_URL: 'http://127.0.0.1:5173'
  }
})

const stop = (signal) => { if (!child.killed) child.kill(signal) }
process.on('SIGINT', () => stop('SIGINT'))
process.on('SIGTERM', () => stop('SIGTERM'))
child.on('exit', (code) => { process.exitCode = code || 0 })

