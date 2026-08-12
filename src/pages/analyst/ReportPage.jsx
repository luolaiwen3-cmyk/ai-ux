import React, { useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'

/**
 * A4 报告导出 —— 诊断报告展示 + 导出 PDF / 分享链接
 */
export default function ReportPage() {
  const { id } = useParams()
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleExport = () => {
    setExporting(true)
    setTimeout(() => setExporting(false), 2000)
  }

  const handleCopyLink = () => {
    navigator.clipboard?.writeText(`https://demo.insightux.io/report/${id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <AnalystLayout>
      <div className="p-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/sessions"
              className="text-slate-500 hover:text-cyan-glow transition-colors"
            >
              ← 返回
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-slate-100">诊断报告</h1>
              <p className="text-xs text-slate-500 mt-0.5">会话 {id}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyLink}
              className="px-3 py-2 rounded-lg bg-ink-700/60 border border-cyan-glow/15 text-[11px] font-mono text-slate-300 hover:text-cyan-glow transition-colors"
            >
              {copied ? '✓ 链接已复制' : '🔗 分享链接'}
            </button>
            <button
              onClick={handleExport}
              disabled={exporting}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-glow/90 to-cyan-soft/90 text-ink-900 text-xs font-semibold hover:shadow-glow transition-all disabled:opacity-50"
            >
              {exporting ? '导出中…' : '📄 导出 PDF'}
            </button>
          </div>
        </div>

        {/* 报告内容 */}
        <div className="max-w-2xl mx-auto">
          <div className="glass rounded-xl p-8">
            {/* 报告头 */}
            <div className="text-center pb-6 border-b border-cyan-glow/10">
              <div className="text-[10px] font-mono text-slate-500 tracking-widest mb-2">
                INSIGHTUX · AI UX DIAGNOSIS REPORT
              </div>
              <h2 className="text-xl font-semibold text-slate-100">
                用户体验缺陷诊断报告
              </h2>
              <div className="text-[11px] text-slate-500 mt-2 font-mono">
                会话 {id} · 生成于 2026-08-12 13:25:30
              </div>
            </div>

            {/* 摘要 */}
            <div className="py-6 border-b border-cyan-glow/10">
              <div className="flex items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-danger/15 text-danger border border-danger/30">
                  P0 紧急
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-warn/10 text-warn border border-warn/25">
                  置信度 0.94
                </span>
              </div>
              <h3 className="text-[15px] font-semibold text-slate-100 mb-2">
                优惠券弹窗双按钮文案歧义导致决策困难
              </h3>
              <p className="text-[12px] text-slate-400 leading-relaxed">
                被试在优惠券弹窗出现后产生显著认知压力（峰值 0.94），
                在「稍后再用」与「立即使用」两个按钮间反复徘徊 11.5 秒，
                最终完成决策。双按钮视觉权重接近、文案未明确传递后果，
                是导致决策犹豫的核心原因。
              </p>
            </div>

            {/* 关键指标 */}
            <div className="py-6 border-b border-cyan-glow/10">
              <div className="text-[11px] font-mono text-slate-400 tracking-wide mb-3">
                KEY METRICS · 关键指标
              </div>
              <div className="grid grid-cols-3 gap-3">
                <MetricBox label="总停留时长" value="20.0s" color="text-cyan-glow" />
                <MetricBox label="决策犹豫" value="11.5s" color="text-danger" />
                <MetricBox label="认知峰值" value="0.94" color="text-danger" />
                <MetricBox label="来回徘徊" value="3 次" color="text-warn" />
                <MetricBox label="移动距离" value="1,247px" color="text-cyan-soft" />
                <MetricBox label="点击尝试" value="4 次" color="text-cyan-soft" />
              </div>
            </div>

            {/* 证据链 */}
            <div className="py-6 border-b border-cyan-glow/10">
              <div className="text-[11px] font-mono text-slate-400 tracking-wide mb-3">
                EVIDENCE CHAIN · 多模态证据链
              </div>
              <div className="space-y-2">
                <EvidenceLine tag="行为" value="停留 14.5s" desc="均值的 6.3 倍" />
                <EvidenceLine tag="认知" value="Confusion 0.82" desc="皱眉 + 视线徘徊" />
                <EvidenceLine tag="视觉" value="对比度 2.8:1" desc="缺少主次引导" />
              </div>
            </div>

            {/* 优化建议 */}
            <div className="py-6 border-b border-cyan-glow/10">
              <div className="text-[11px] font-mono text-slate-400 tracking-wide mb-3">
                RECOMMENDATIONS · 优化建议
              </div>
              <ul className="space-y-2 text-[12px] text-slate-300">
                <li className="flex gap-2">
                  <span className="text-emerald-400">1.</span>
                  <span>「稍后再用」→「放弃优惠」，强化损失厌恶心理</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">2.</span>
                  <span>主按钮增加微动效 + 高亮描边，对比度提升至 4.5:1</span>
                </li>
                <li className="flex gap-2">
                  <span className="text-emerald-400">3.</span>
                  <span>预期：转化率 +18.5%，停留时长下降 62%</span>
                </li>
              </ul>
            </div>

            {/* 案例匹配 */}
            <div className="pt-6">
              <div className="text-[11px] font-mono text-slate-400 tracking-wide mb-3">
                SIMILAR CASES · 匹配历史案例
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="px-2 py-1 rounded text-[10px] font-mono border border-cyan-glow/20 bg-cyan-glow/[0.05] text-cyan-glow">
                  #案例0089 ↑92%
                </span>
                <span className="px-2 py-1 rounded text-[10px] font-mono border border-cyan-glow/20 bg-cyan-glow/[0.05] text-cyan-glow">
                  #案例0104 ↑87%
                </span>
                <span className="px-2 py-1 rounded text-[10px] font-mono border border-cyan-glow/20 bg-cyan-glow/[0.05] text-cyan-glow">
                  #案例0156 ↑81%
                </span>
              </div>
            </div>

            {/* 页脚 */}
            <div className="mt-8 pt-4 border-t border-cyan-glow/10 text-center">
              <div className="text-[9px] font-mono text-slate-600">
                Generated by InsightUX · Qwen3-VL · 2026-08-12
              </div>
            </div>
          </div>
        </div>
      </div>
    </AnalystLayout>
  )
}

function MetricBox({ label, value, color }) {
  return (
    <div className="rounded-lg bg-ink-800/60 border border-cyan-glow/10 p-3">
      <div className="text-[9px] text-slate-500 font-mono">{label}</div>
      <div className={`text-[14px] font-semibold font-mono mt-0.5 ${color}`}>{value}</div>
    </div>
  )
}

function EvidenceLine({ tag, value, desc }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg bg-ink-800/40 border border-cyan-glow/10">
      <span className="text-[10px] font-mono text-slate-500 w-8">{tag}</span>
      <span className="text-[11px] font-mono font-medium text-slate-200 w-28">{value}</span>
      <span className="text-[10px] text-slate-500">{desc}</span>
    </div>
  )
}
