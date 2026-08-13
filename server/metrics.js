const isIncremental = (event, sourceType) =>
  event?.type === 3 && event?.data?.type === sourceType

export function analyzeSession(events = [], faceFrames = [], result = 'none') {
  const finalDecision = typeof result === 'string' ? result : result?.finalDecision ?? null
  const timestamps = events.map((event) => Number(event?.timestamp)).filter(Number.isFinite)
  const firstTimestamp = timestamps.length ? Math.min(...timestamps) : 0
  const lastTimestamp = timestamps.length ? Math.max(...timestamps) : firstTimestamp
  const durationMs = Math.max(0, lastTimestamp - firstTimestamp)

  const clicks = events.filter((event) => isIncremental(event, 2))
  const mouseMoves = events.filter((event) => isIncremental(event, 1))
  const firstClickMs = clicks.length ? Math.max(0, clicks[0].timestamp - firstTimestamp) : 0

  let mouseDistance = 0
  for (let index = 1; index < mouseMoves.length; index += 1) {
    const previous = mouseMoves[index - 1].data
    const current = mouseMoves[index].data
    mouseDistance += Math.hypot((current.x || 0) - (previous.x || 0), (current.y || 0) - (previous.y || 0))
  }

  let backAndForth = 0
  let lastDirection = 0
  for (let index = 1; index < mouseMoves.length; index += 1) {
    const dx = (mouseMoves[index].data.x || 0) - (mouseMoves[index - 1].data.x || 0)
    const direction = Math.abs(dx) >= 8 ? Math.sign(dx) : 0
    if (direction && lastDirection && direction !== lastDirection) backAndForth += 1
    if (direction) lastDirection = direction
  }

  const orderedEvents = [...events].filter((event) => Number.isFinite(Number(event?.timestamp))).sort((a, b) => a.timestamp - b.timestamp)
  let hesitationMs = 0
  for (let index = 1; index < orderedEvents.length; index += 1) {
    const gap = orderedEvents[index].timestamp - orderedEvents[index - 1].timestamp
    if (gap > 1000) hesitationMs += gap
  }

  let peakStress = 0
  let peakTimeMs = 0
  const stressData = faceFrames
    .filter((frame) => Number.isFinite(Number(frame?.t)))
    .map((frame) => ({
      t: Math.max(0, Number(frame.t) - (Number(faceFrames[0]?.t) || Number(frame.t))),
      stress: Math.max(0, Math.min(1, Number(frame.emotion?.value) || 0))
    }))
  stressData.forEach((point) => {
    if (point.stress > peakStress) {
      peakStress = point.stress
      peakTimeMs = point.t
    }
  })

  const severity = peakStress >= 0.8 || hesitationMs >= 8000
    ? 'P0'
    : peakStress >= 0.55 || hesitationMs >= 4000 || backAndForth >= 3
      ? 'P1'
      : 'P2'

  return {
    totalDurationMs: durationMs,
    firstClickMs,
    totalClicks: clicks.length,
    hesitationMs,
    mouseDistance: Math.round(mouseDistance),
    backAndForth,
    finalDecision,
    peakStress: Number(peakStress.toFixed(3)),
    peakTimeMs: Math.round(peakTimeMs),
    severity,
    stressData
  }
}
