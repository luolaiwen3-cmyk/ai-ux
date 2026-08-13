import React, { useState } from 'react'

/**
 * Agent 智能诊断报告面板 —— Qwen3-VL 多模态推理结果
 */
export default function DiagnosisPanel() {
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosed, setDiagnosed] = useState(false)

  const handleDiagnose = () => {
    setDiagnosing(true)
    setDiagnosed(false)
    setTimeout(() => {
      setDiagnosing(false)
      setDiagnosed(true)
    }, 2400)
  }

  return (
    <div className="glass-strong rounded-xl p-4 flex flex-col gap-3 shrink-0">
      {/* 触发按钮 */}
      <div className="flex items-center justify-between">
        <span className="text-[12px] font-mono text-slate-400 tracking-wide">
          AGENT · Qwen3-VL 智能诊断
        </span>
        <button
          onClick={handleDiagnose}
          disabled={diagnosing}
          className="group relative px-3 py-1.5 rounded-lg font-medium text-[11px] flex items-center gap-2 transition-all disabled:cursor-not-allowed
            bg-gradient-to-r from-cyan-glow/90 to-cyan-soft/90 text-ink-900 hover:shadow-glow
            disabled:from-cyan-glow/40 disabled:to-cyan-soft/40 disabled:text-slate-400"
        >
          {diagnosing && (
            <span className="w-3 h-3 rounded-full border-2 border-ink-900/40 border-t-ink-900 animate-spin" />
          )}
          {!diagnosing && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l2.4 7.4H22l-6 4.6 2.3 7L12 16.4 5.7 21l2.3-7L2 9.4h7.6L12 2z" fill="#070A0F" />
            </svg>
          )}
          {diagnosing ? '推理中…' : '触发智能诊断'}
        </button>
      </div>

      {/* 内容区 */}
      {!diagnosing && !diagnosed && (
        <div className="text-center py-6">
          <div className="text-[11px] text-slate-500">
            基于多模态回放数据，Qwen3-VL 将自动生成 UX 缺陷诊断
          </div>
        </div>
      )}

      {diagnosing && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-[10px] font-mono text-cyan-glow">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-glow animate-blink" />
            <span>Qwen3-VL · 多模态推理中</span>
          </div>
          <div className="space-y-1.5">
            <div className="h-2.5 rounded w-3/4 shimmer" />
            <div className="h-2.5 rounded w-full shimmer" />
            <div className="h-2.5 rounded w-5/6 shimmer" />
            <div className="h-10 rounded w-full shimmer mt-3" />
            <div className="h-2.5 rounded w-2/3 shimmer" />
            <div className="h-14 rounded w-full shimmer mt-2" />
          </div>
        </div>
      )}

      {diagnosed && (
        <div className="space-y-3 animate-[fadeIn_.4s_ease-out]">
          {/* 报告标题 */}
          <div className="rounded-lg border border-cyan-glow/15 bg-ink-800/60 p-3">
            <div className="flex items-center gap-2 mb-2">
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold bg-danger/15 text-danger border border-danger/30">
                P0 紧急
              </span>
              <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-warn/10 text-warn border border-warn/25">
                置信度 0.94
              </span>
            </div>
            <div className="text-[13px] font-semibold text-slate-100 leading-snug">
              优惠券弹窗双按钮文案歧义导致决策困难
            </div>
            <div className="text-[10px] text-slate-500 mt-1 font-mono">
              ID#UX-0812-0037 · 生成于 {new Date().toLocaleTimeString()}
            </div>
          </div>

          {/* 多模态证据链 */}
          <div className="rounded-lg border border-cyan-glow/15 bg-ink-800/60 p-3">
            <div className="text-[10px] font-mono text-slate-400 tracking-wide mb-2">
              MULTIMODAL_EVIDENCE · 证据链
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              <EvidenceBlock
                tag="行为异常"
                value="停留 14.5s"
                desc="平均 2.3s，当前为均值 6.3 倍"
                color="cyan"
              />
              <EvidenceBlock
                tag="认知状态"
                value="Confusion 0.82"
                desc="皱眉 + 视线在双按钮间徘徊"
                color="rose"
              />
              <EvidenceBlock
                tag="视觉层级"
                value="对比度 2.8:1"
                desc="双按钮视觉权重接近，缺少主次"
                color="amber"
              />
            </div>
          </div>

          {/* 优化建议 */}
          <div className="rounded-lg border border-emerald-400/20 bg-emerald-400/[0.04] p-3">
            <div className="text-[10px] font-mono text-emerald-400 tracking-wide mb-2">
              OPTIMIZATION · 优化建议
            </div>
            <ul className="space-y-1.5 text-[11px] text-slate-200">
              <li className="flex gap-2">
                <span className="text-emerald-400 mt-0.5">▸</span>
                <span>
                  「稍后再用」→「放弃优惠」，
                  <span className="text-emerald-400 font-medium">强化损失厌恶</span>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 mt-0.5">▸</span>
                <span>
                  主按钮增加微动效，
                  <span className="text-emerald-400 font-medium">对比度提升至 4.5:1</span>
                </span>
              </li>
              <li className="flex gap-2">
                <span className="text-emerald-400 mt-0.5">▸</span>
                <span>
                  预期：
                  <span className="text-cyan-glow font-mono font-medium">转化率 +18.5%</span>
                  ，停留 ↓62%
                </span>
              </li>
            </ul>
          </div>

          {/* 历史案例 */}
          <div className="rounded-lg border border-cyan-glow/15 bg-ink-800/60 p-3">
            <div className="text-[10px] font-mono text-slate-400 tracking-wide mb-2">
              SIMILAR_CASES · 匹配案例
            </div>
            <div className="flex flex-wrap gap-1.5">
              <CaseTag id="0089" match="92%" />
              <CaseTag id="0104" match="87%" />
              <CaseTag id="0156" match="81%" />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function EvidenceBlock({ tag, value, desc, color }) {
  const palette = {
    cyan: 'text-cyan-glow border-cyan-glow/20 bg-cyan-glow/[0.04]',
    rose: 'text-rose-400 border-rose-400/20 bg-rose-400/[0.04]',
    amber: 'text-amber-400 border-amber-400/20 bg-amber-400/[0.04]'
  }
  return (
    <div className={`rounded-md border p-2 ${palette[color]}`}>
      <div className="flex items-center justify-between">
        <span className="text-[9px] font-mono">{tag}</span>
        <span className="text-[10px] font-mono font-semibold">{value}</span>
      </div>
      <div className="text-[9px] text-slate-400 mt-0.5 font-mono">{desc}</div>
    </div>
  )
}

function CaseTag({ id, match }) {
  return (
    <span className="px-1.5 py-0.5 rounded text-[9px] font-mono border border-cyan-glow/20 bg-cyan-glow/[0.05] text-cyan-glow hover:bg-cyan-glow/10 transition-colors cursor-pointer flex items-center gap-1">
      <span className="opacity-70">#案例{id}</span>
      <span className="text-emerald-400">↑{match}</span>
    </span>
  )
}
