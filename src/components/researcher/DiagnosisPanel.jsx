import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'

const providerLabels = {
  dashscope: 'Qwen 多模态',
  'local-rules': '本地规则引擎'
}

export default function DiagnosisPanel({ sessionId, initialDiagnosis = null, onDiagnosed }) {
  const [diagnosis, setDiagnosis] = useState(initialDiagnosis)
  const [diagnosing, setDiagnosing] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => setDiagnosis(initialDiagnosis), [initialDiagnosis])

  const handleDiagnose = async () => {
    setDiagnosing(true)
    setError('')
    try {
      const result = await api.sessions.diagnose(sessionId)
      setDiagnosis(result.diagnosis)
      onDiagnosed?.(result.diagnosis)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setDiagnosing(false)
    }
  }

  const report = diagnosis?.result

  return (
    <div className="glass-strong rounded-xl p-4 flex flex-col gap-3 shrink-0">
      <div className="flex items-center justify-between gap-3">
        <div>
          <span className="text-[12px] font-mono text-slate-400 tracking-wide">AGENT · 智能诊断</span>
          {diagnosis && <div className="text-[9px] text-slate-500 mt-0.5">{providerLabels[diagnosis.provider] || diagnosis.provider} · {diagnosis.model}</div>}
        </div>
        <button onClick={handleDiagnose} disabled={diagnosing} className="px-3 py-1.5 rounded-lg font-medium text-[11px] flex items-center gap-2 bg-gradient-to-r from-cyan-glow/90 to-cyan-soft/90 text-ink-900 disabled:opacity-50">
          {diagnosing && <span className="w-3 h-3 rounded-full border-2 border-ink-900/30 border-t-ink-900 animate-spin" />}
          {diagnosing ? '分析中…' : diagnosis ? '重新诊断' : '开始智能诊断'}
        </button>
      </div>

      {error && <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      {!diagnosing && !report && !error && <div className="text-center py-6 text-[11px] text-slate-500">系统将基于当前会话的行为、面部和任务结果生成诊断</div>}

      {diagnosing && <div className="space-y-2 py-2"><div className="h-3 rounded shimmer w-3/4" /><div className="h-3 rounded shimmer" /><div className="h-16 rounded shimmer" /></div>}

      {report && !diagnosing && (
        <div className="space-y-3 animate-[fadeIn_.3s_ease-out]">
          {diagnosis.fallbackReason && <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[10px] text-amber-700">Qwen 暂不可用，本报告已明确降级为本地规则诊断：{diagnosis.fallbackReason}</div>}

          <div className="rounded-lg border border-cyan-glow/15 bg-ink-800/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <Severity value={report.severity} />
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-100 text-slate-600 border border-slate-200">置信度 {report.confidence.toFixed(2)}</span>
            </div>
            <div className="text-[13px] font-semibold text-slate-100 leading-snug">{report.summary}</div>
            <p className="text-[11px] text-slate-400 leading-relaxed mt-2">{report.rootCause}</p>
          </div>

          <Section title="MULTIMODAL_EVIDENCE · 证据链">
            <div className="space-y-1.5">
              {report.evidence.map((item, index) => (
                <div key={`${item.label}-${index}`} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-2.5 py-2">
                  <span className="text-[9px] font-mono text-slate-500 w-14">{item.source}</span>
                  <span className="text-[10px] text-slate-700 flex-1">{item.label}</span>
                  <span className="text-[10px] font-mono font-medium text-slate-900">{item.value}</span>
                  <span className="text-[9px] font-mono text-slate-400">{(item.timestampMs / 1000).toFixed(1)}s</span>
                </div>
              ))}
            </div>
          </Section>

          <Section title="OPTIMIZATION · 优化建议" tone="success">
            <ol className="space-y-1.5 text-[11px] text-slate-700">
              {report.recommendations.map((item, index) => <li key={item} className="flex gap-2"><span className="text-emerald-500">{index + 1}.</span><span>{item}</span></li>)}
            </ol>
            <div className="mt-2 text-[10px] text-emerald-700">预期方向：{report.expectedImpact}</div>
          </Section>

          <Link to={`/report/${sessionId}`} className="block w-full rounded-lg bg-slate-950 text-white text-xs font-medium text-center py-2.5">查看并分享完整报告 →</Link>
        </div>
      )}
    </div>
  )
}

function Severity({ value }) {
  const style = value === 'P0' ? 'bg-danger/15 text-danger border-danger/30' : value === 'P1' ? 'bg-warn/15 text-warn border-warn/30' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
  return <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold border ${style}`}>{value}</span>
}

function Section({ title, tone, children }) {
  return <div className={`rounded-lg border p-3 ${tone === 'success' ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 bg-slate-50'}`}><div className={`text-[10px] font-mono tracking-wide mb-2 ${tone === 'success' ? 'text-emerald-600' : 'text-slate-500'}`}>{title}</div>{children}</div>
}
