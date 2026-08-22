import assert from 'node:assert/strict'
import test from 'node:test'
import { createDiagnosisWorker } from '../server/diagnosisWorker.js'
import { openDatabase } from '../server/database.js'
import { createRepositories } from '../server/repositories.js'
import { createServices } from '../server/services.js'

const config = {
  dashscopeApiKey: '',
  qwenBaseUrl: '',
  qwenModel: '',
  publicAppUrl: 'http://localhost:8787',
  diagnosisMaxAttempts: 3,
  isProduction: false
}

const waitUntil = async (predicate) => {
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const value = predicate()
    if (value) return value
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  assert.fail('后台诊断任务未在预期时间内结束')
}

const completedSession = (services, name) => {
  const task = services.tasks.create({
    name, steps: ['完成操作'], targetType: 'builtin', status: 'active'
  })
  const session = services.sessions.createParticipant(task.token, true)
  services.sessions.start(session.id, session.uploadToken)
  services.sessions.complete(session.id, session.uploadToken, {
    couponDecision: 'none', events: [], faceFrames: [], metrics: {}, result: {}
  })
  return session
}

const diagnosisResult = {
  provider: 'local-rules',
  model: 'test-rules',
  result: {
    severity: 'P2', confidence: 0.8, summary: '完成', rootCause: '无',
    evidence: [], recommendations: [], expectedImpact: '保持'
  },
  fallbackReason: null
}

test('诊断 Worker 自动重试并持久化最终失败', async () => {
  const database = openDatabase(':memory:')
  const repositories = createRepositories(database)
  const services = createServices({ repositories, config })
  const session = completedSession(services, '失败重试任务')
  services.analysis.enqueueDiagnosis(session.id)
  const worker = createDiagnosisWorker({
    diagnoses: repositories.diagnoses,
    execute: async () => { throw new Error('模型流水线异常') },
    retryDelayMs: 1
  })

  try {
    worker.start()
    const failed = await waitUntil(() => {
      const diagnosis = repositories.diagnoses.findBySessionId(session.id)
      return diagnosis.status === 'failed' ? diagnosis : null
    })
    assert.equal(failed.attemptCount, 3)
    assert.equal(failed.maxAttempts, 3)
    assert.match(failed.lastError, /模型流水线异常/)
    assert.equal(failed.shareToken, null)
  } finally {
    await worker.stop()
    database.close()
  }
})

test('诊断 Worker 启动时接管进程中断前已领取的任务', async () => {
  const database = openDatabase(':memory:')
  const repositories = createRepositories(database)
  const services = createServices({ repositories, config })
  const session = completedSession(services, '恢复任务')
  services.analysis.enqueueDiagnosis(session.id)
  assert.ok(repositories.diagnoses.claimNext(new Date().toISOString()))

  const worker = createDiagnosisWorker({
    diagnoses: repositories.diagnoses,
    execute: async () => diagnosisResult,
    retryDelayMs: 1
  })

  try {
    worker.start()
    const completed = await waitUntil(() => {
      const diagnosis = repositories.diagnoses.findBySessionId(session.id)
      return diagnosis.status === 'completed' ? diagnosis : null
    })
    assert.equal(completed.provider, 'local-rules')
    assert.equal(completed.attemptCount, 2)
    assert.ok(completed.shareToken)
  } finally {
    await worker.stop()
    database.close()
  }
})
