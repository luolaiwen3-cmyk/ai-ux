import React, { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { api } from '../../lib/apiClient.js'

export default function ReportPage() {
  const { id } = useParams()
  const [session, setSession] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let active = true
    api.sessions.get(id)
      .then((result) => { if (active) setSession(result) })
      .catch((requestError) => { if (active) setError(requestError.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  const copyShareLink = async () => {
    const token = session?.diagnosis?.shareToken
    if (!token) return
    const url = `${window.location.origin}${window.location.pathname}#/share/${token}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1800)
    } catch {
      setError('复制失败，请手动复制浏览器地址')
    }
  }

  if (loading) return <AnalystLayout><div className="p-12 text-center text-sm text-slate-500">正在加载报告…</div></AnalystLayout>

  return (
    <AnalystLayout>
      <ReportDocument
        session={session}
        error={error}
        actions={session?.diagnosis?.status === 'completed' ? <><button onClick={copyShareLink} className="report-action">{copied ? '✓ 链接已复制' : '🔗 分享链接'}</button><button onClick={() => window.print()} className="report-primary-action">📄 打印 / 导出 PDF</button></> : null}
      />
    </AnalystLayout>
  )
}

export function ReportDocument({ session, error, actions, publicView = false }) {
  const diagnosis = session?.diagnosis
  const report = diagnosis?.result
  const metrics = session?.metrics || {}

  return (
    <div className="report-page p-6 min-h-screen bg-slate-50">
      <div className="print-hidden flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {!publicView && <Link to={`/sessions/${session?.id || ''}`} className="text-slate-500 hover:text-slate-900">← 返回</Link>}
          <div><h1 className="text-lg font-semibold text-slate-900">诊断报告</h1><p className="text-xs text-slate-500 mt-0.5">{session ? `${session.participantCode} · ${session.taskName}` : '报告不可用'}</p></div>
        </div>
        <div className="flex items-center gap-2">{actions}</div>
      </div>

      {error && <div className="max-w-2xl mx-auto rounded-xl border border-red-200 bg-red-50 text-red-700 p-4 text-sm">{error}</div>}
      {!error && session && !report && <div className="max-w-2xl mx-auto rounded-xl border border-amber-200 bg-amber-50 p-8 text-center"><div className="text-sm font-medium text-amber-800">{diagnosis?.status === 'pending' ? '诊断正在后台生成' : diagnosis?.status === 'failed' ? '诊断生成失败' : '该会话尚未生成诊断'}</div><p className="text-xs text-amber-700 mt-2">{diagnosis?.status === 'pending' ? '请稍后刷新，完成后即可导出和分享。' : diagnosis?.status === 'failed' ? '请返回深度分析页查看失败原因并重试。' : '请返回深度分析页运行智能诊断。'}</p></div>}

      {report && (
        <div className="report-print-area max-w-2xl mx-auto bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-slate-900">
          <div className="text-center pb-6 border-b border-slate-200"><div className="text-[10px] font-mono text-slate-500 tracking-widest mb-2">INSIGHTUX · UX DIAGNOSIS REPORT</div><h2 className="text-xl font-semibold">用户体验缺陷诊断报告</h2><div className="text-[11px] text-slate-500 mt-2 font-mono">会话 {session.participantCode} · {formatDate(diagnosis.updatedAt)}</div></div>

          <section className="py-6 border-b border-slate-200">
            <div className="flex items-center gap-2 mb-3"><Severity value={report.severity} /><span className="report-badge">置信度 {report.confidence.toFixed(2)}</span><span className="report-badge">{diagnosis.provider === 'dashscope' ? 'Qwen 多模态' : '本地规则引擎'}</span></div>
            <h3 className="text-[15px] font-semibold mb-2">{report.summary}</h3><p className="text-[12px] text-slate-600 leading-relaxed">{report.rootCause}</p>
            {diagnosis.fallbackReason && <p className="text-[10px] text-amber-700 mt-3">模型调用失败，本报告已降级：{diagnosis.fallbackReason}</p>}
          </section>

          <ReportSection title="KEY METRICS · 关键指标"><div className="grid grid-cols-3 gap-3"><Metric label="总时长" value={`${(metrics.totalDurationMs / 1000).toFixed(1)}s`} /><Metric label="累计停顿" value={`${(metrics.hesitationMs / 1000).toFixed(1)}s`} /><Metric label="压力峰值" value={session.hasFace ? metrics.peakStress.toFixed(2) : '无面部数据'} /><Metric label="方向反转" value={`${metrics.backAndForth || 0} 次`} /><Metric label="点击次数" value={`${metrics.totalClicks || 0} 次`} />{session.scenario === 'checkout-coupon' ? <Metric label="最终决策" value={decisionLabel(metrics.finalDecision)} /> : <Metric label="完成方式" value={session.result?.completion === 'manual' ? '手动确认' : '已提交'} />}</div></ReportSection>

          <ReportSection title="EVIDENCE CHAIN · 证据链"><div className="space-y-2">{report.evidence.map((item, index) => <div key={`${item.label}-${index}`} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"><span className="text-[10px] font-mono text-slate-500 w-14">{item.source}</span><span className="text-[11px] flex-1">{item.label}</span><span className="text-[11px] font-mono font-medium">{item.value}</span><span className="text-[9px] text-slate-400">{(item.timestampMs / 1000).toFixed(1)}s</span></div>)}</div></ReportSection>

          <ReportSection title="RECOMMENDATIONS · 优化建议"><ol className="space-y-2 text-[12px] text-slate-700">{report.recommendations.map((item, index) => <li key={item} className="flex gap-2"><span className="text-emerald-600">{index + 1}.</span><span>{item}</span></li>)}</ol><div className="mt-3 rounded-lg bg-emerald-50 border border-emerald-100 px-3 py-2 text-[11px] text-emerald-800">预期方向：{report.expectedImpact}</div></ReportSection>

          <div className="mt-8 pt-4 border-t border-slate-200 text-center text-[9px] font-mono text-slate-400">Generated by InsightUX · {diagnosis.model} · {formatDate(diagnosis.updatedAt)}</div>
        </div>
      )}
    </div>
  )
}

function ReportSection({ title, children }) { return <section className="py-6 border-b border-slate-200 last:border-b-0"><div className="text-[11px] font-mono text-slate-500 tracking-wide mb-3">{title}</div>{children}</section> }
function Metric({ label, value }) { return <div className="rounded-lg bg-slate-50 border border-slate-200 p-3"><div className="text-[9px] text-slate-500 font-mono">{label}</div><div className="text-[14px] font-semibold font-mono mt-0.5">{value}</div></div> }
function Severity({ value }) { return <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold border ${value === 'P0' ? 'bg-red-50 text-red-700 border-red-200' : value === 'P1' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>{value}</span> }
function formatDate(value) { return value ? new Date(value).toLocaleString('zh-CN') : '—' }
function decisionLabel(value) { return ({ applied: '使用优惠券', declined: '放弃优惠券', none: '未记录' })[value] || '未记录' }
