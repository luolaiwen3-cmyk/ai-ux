import assert from 'node:assert/strict'
import test from 'node:test'
import { createRuleDiagnosis, diagnoseSession } from '../server/diagnosis.js'

const session = {
  taskName: '优惠券测试',
  participantCode: 'P-001',
  couponDecision: 'declined',
  eventCount: 42,
  hasFace: true,
  faceFrames: [],
  metrics: {
    hesitationMs: 9200,
    peakStress: 0.86,
    peakTimeMs: 4300,
    firstClickMs: 1800,
    totalDurationMs: 15000,
    backAndForth: 4,
    severity: 'P0'
  }
}

test('规则诊断可复现且包含可追溯证据', () => {
  const first = createRuleDiagnosis(session)
  const second = createRuleDiagnosis(session)
  assert.deepEqual(first, second)
  assert.equal(first.severity, 'P0')
  assert.equal(first.evidence[1].timestampMs, 4300)
  assert.ok(first.recommendations.length >= 2)
})

test('未配置 Qwen 时明确使用本地规则引擎', async () => {
  const diagnosis = await diagnoseSession(session, { dashscopeApiKey: '' })
  assert.equal(diagnosis.provider, 'local-rules')
  assert.equal(diagnosis.model, 'insightux-rules-v1')
  assert.equal(diagnosis.fallbackReason, null)
})
