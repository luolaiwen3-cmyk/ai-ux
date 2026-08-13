import assert from 'node:assert/strict'
import test from 'node:test'
import { analyzeSession } from '../server/metrics.js'

test('会话指标由实际事件和面部帧确定性计算', () => {
  const events = [
    { type: 0, timestamp: 1000, data: {} },
    { type: 3, timestamp: 2200, data: { type: 1, x: 10, y: 10 } },
    { type: 3, timestamp: 2300, data: { type: 1, x: 30, y: 10 } },
    { type: 3, timestamp: 2400, data: { type: 1, x: 10, y: 10 } },
    { type: 3, timestamp: 5000, data: { type: 2, x: 10, y: 10 } }
  ]
  const frames = [
    { t: 1000, emotion: { value: 0.2 } },
    { t: 3000, emotion: { value: 0.86 } }
  ]

  const metrics = analyzeSession(events, frames, 'declined')
  assert.equal(metrics.totalDurationMs, 4000)
  assert.equal(metrics.firstClickMs, 4000)
  assert.equal(metrics.totalClicks, 1)
  assert.equal(metrics.mouseDistance, 40)
  assert.equal(metrics.backAndForth, 1)
  assert.equal(metrics.peakStress, 0.86)
  assert.equal(metrics.peakTimeMs, 2000)
  assert.equal(metrics.finalDecision, 'declined')
  assert.equal(metrics.severity, 'P0')
  assert.deepEqual(metrics, analyzeSession(events, frames, 'declined'))
})

test('通用网页指标不会伪造优惠券最终决策', () => {
  const metrics = analyzeSession([
    { type: 0, timestamp: 1000 }, { type: 3, timestamp: 2000, data: { type: 2, x: 1, y: 1 } }
  ], [], { finalDecision: null })
  assert.equal(metrics.finalDecision, null)
  assert.equal(metrics.totalClicks, 1)
})
