import React from 'react'

/**
 * 行为统计数据卡片 —— 被试操作的关键指标
 * 支持真实数据和空状态
 */
export default function BehaviorCards({ stats, meta }) {
  // 如果没有数据，显示空状态
  if (!stats) {
    return (
      <div className="glass rounded-xl p-4 shrink-0">
        <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-3">
          BEHAVIOR_METRICS · 行为数据
        </div>
        <div className="text-center py-6 text-slate-500 text-xs">
          暂无行为录制数据
        </div>
      </div>
    )
  }

  const cards = [
    { label: '总停留时长', value: stats.totalDuration || '-', icon: '⏱', color: 'text-cyan-glow' },
    { label: '首次点击耗时', value: stats.timeToFirstClick || '-', icon: '⌖', color: 'text-cyan-soft' },
    { label: '总点击次数', value: stats.totalClicks || 0, icon: '◉', color: 'text-warn' },
    { label: '决策犹豫时长', value: stats.hesitationTime || '-', icon: '◌', color: 'text-danger' },
    { label: '鼠标移动距离', value: stats.mouseDistance || '-', icon: '↝', color: 'text-cyan-glow' },
    { label: '来回徘徊次数', value: stats.backAndForth || 0, icon: '⟲', color: 'text-danger' }
  ]

  return (
    <div className="glass rounded-xl p-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-mono text-slate-400 tracking-wide">
          BEHAVIOR_METRICS · 行为数据
        </span>
        <span className="text-[10px] font-mono text-slate-500">
          {meta?.id || meta?.task || ''}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {cards.map((c, i) => (
          <div
            key={i}
            className="rounded-lg bg-ink-800/60 border border-cyan-glow/10 p-2.5 hover:border-cyan-glow/25 transition-colors"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-slate-500 font-mono">{c.label}</span>
              <span className={`text-[12px] ${c.color}`}>{c.icon}</span>
            </div>
            <div className={`text-[14px] font-semibold font-mono ${c.color}`}>
              {c.value}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
