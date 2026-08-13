const severityRank = { P0: 0, P1: 1, P2: 2, NONE: 3 }

const decisionLabel = {
  applied: '使用优惠券',
  declined: '放弃优惠券',
  none: '未记录决策'
}

export function createRuleDiagnosis(session) {
  const metrics = session.metrics || {}
  const hesitationSeconds = Number(metrics.hesitationMs || 0) / 1000
  const peakStress = Number(metrics.peakStress || 0)
  const backAndForth = Number(metrics.backAndForth || 0)
  const severity = metrics.severity || 'P2'

  let summary = '任务流程整体顺畅，未发现显著体验阻碍'
  let rootCause = '行为与面部数据未达到高摩擦阈值。'
  let recommendations = ['保留当前交互方案，并通过更多被试验证一致性。']

  if (severity === 'P0') {
    summary = '关键决策节点出现高认知压力与明显犹豫'
    rootCause = `用户累计停顿 ${hesitationSeconds.toFixed(1)} 秒，压力峰值达到 ${(peakStress * 100).toFixed(0)}%，当前选项的后果和主次关系不够清晰。`
    recommendations = [
      '将优惠券选择改为单一主操作，并明确展示使用后的实际减免。',
      '降低次要操作的视觉权重，并将“稍后再用”改为可预判后果的文案。',
      '在相同任务上再次测试，比较决策时长和压力峰值。'
    ]
  } else if (severity === 'P1') {
    summary = '决策步骤存在可感知的交互摩擦'
    rootCause = `检测到 ${backAndForth} 次方向反转和 ${hesitationSeconds.toFixed(1)} 秒停顿，用户需要额外确认选项含义。`
    recommendations = [
      '强化推荐选项的视觉层级，并补充简短结果说明。',
      '减少弹窗中的竞争性操作，避免两个按钮使用相近的行动文案。'
    ]
  }

  const evidence = [
    {
      source: 'behavior',
      label: '决策停顿',
      value: `${hesitationSeconds.toFixed(1)}s`,
      timestampMs: metrics.firstClickMs || 0
    },
    {
      source: session.hasFace ? 'face' : 'behavior',
      label: session.hasFace ? '认知压力峰值' : '行为严重程度',
      value: session.hasFace ? `${(peakStress * 100).toFixed(0)}%` : severity,
      timestampMs: metrics.peakTimeMs || 0
    },
    {
      source: 'result',
      label: '最终选择',
      value: decisionLabel[session.couponDecision] || session.couponDecision,
      timestampMs: metrics.totalDurationMs || 0
    }
  ]

  const confidence = Number(Math.min(0.96, 0.68 + (session.eventCount > 20 ? 0.1 : 0) + (session.hasFace ? 0.12 : 0) + (severity === 'P0' ? 0.04 : 0)).toFixed(2))
  return {
    severity,
    confidence,
    summary,
    rootCause,
    evidence,
    recommendations,
    expectedImpact: severity === 'P0' ? '优先降低关键决策时长与放弃率' : '降低交互理解成本',
    similarCases: []
  }
}

const stripJsonFence = (text) => {
  const trimmed = String(text || '').trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  return fenced ? fenced[1] : trimmed
}

const normalizeDiagnosis = (value, fallback) => {
  const severity = ['P0', 'P1', 'P2', 'NONE'].includes(value?.severity) ? value.severity : fallback.severity
  const evidence = Array.isArray(value?.evidence) ? value.evidence.slice(0, 8).map((item) => ({
    source: String(item?.source || 'model').slice(0, 40),
    label: String(item?.label || '模型证据').slice(0, 80),
    value: String(item?.value || '').slice(0, 160),
    timestampMs: Math.max(0, Number(item?.timestampMs) || 0)
  })) : fallback.evidence
  const recommendations = Array.isArray(value?.recommendations)
    ? value.recommendations.slice(0, 6).map((item) => String(item).slice(0, 300))
    : fallback.recommendations
  return {
    severity,
    confidence: Number(Math.max(0, Math.min(1, Number(value?.confidence) || fallback.confidence)).toFixed(2)),
    summary: String(value?.summary || fallback.summary).slice(0, 400),
    rootCause: String(value?.rootCause || fallback.rootCause).slice(0, 1200),
    evidence,
    recommendations,
    expectedImpact: String(value?.expectedImpact || fallback.expectedImpact).slice(0, 500),
    similarCases: []
  }
}

export async function diagnoseSession(session, config) {
  const fallback = createRuleDiagnosis(session)
  if (!config.dashscopeApiKey) {
    return { provider: 'local-rules', model: 'insightux-rules-v1', result: fallback, fallbackReason: null }
  }

  const images = (session.faceFrames || [])
    .filter((frame) => typeof frame?.snapshot === 'string' && frame.snapshot.startsWith('data:image/'))
    .slice(0, 3)
  const prompt = `你是 UX 研究分析师。请只基于给定的会话指标和截图诊断，不要臆造界面事实。输出一个 JSON 对象，字段为 severity(P0/P1/P2/NONE)、confidence(0-1)、summary、rootCause、evidence 数组(source,label,value,timestampMs)、recommendations 字符串数组、expectedImpact。\n\n会话数据：${JSON.stringify({
    task: session.taskName,
    participant: session.participantCode,
    couponDecision: session.couponDecision,
    metrics: session.metrics
  })}`

  const content = [{ type: 'text', text: prompt }]
  images.forEach((url) => content.push({ type: 'image_url', image_url: { url } }))

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    const response = await fetch(`${config.qwenBaseUrl.replace(/\/$/, '')}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.dashscopeApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: config.qwenModel,
        messages: [
          { role: 'system', content: '你只输出符合要求的 JSON，不输出 Markdown。' },
          { role: 'user', content }
        ],
        temperature: 0.1
      }),
      signal: controller.signal
    })
    clearTimeout(timeout)
    if (!response.ok) throw new Error(`Qwen API 返回 ${response.status}`)
    const payload = await response.json()
    const text = payload?.choices?.[0]?.message?.content
    const parsed = JSON.parse(stripJsonFence(text))
    return {
      provider: 'dashscope',
      model: config.qwenModel,
      result: normalizeDiagnosis(parsed, fallback),
      fallbackReason: null
    }
  } catch (error) {
    return {
      provider: 'local-rules',
      model: 'insightux-rules-v1',
      result: fallback,
      fallbackReason: error.name === 'AbortError' ? 'Qwen 请求超时' : error.message
    }
  }
}

export const compareDiagnosisSeverity = (left, right) =>
  (severityRank[left] ?? 99) - (severityRank[right] ?? 99)
