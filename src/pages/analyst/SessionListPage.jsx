import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { getSessionList } from '../../lib/sessionDataService.js'

/**
 * A2 会话列表 —— 所有被试会话总览，支持筛选/排序
 * 完全使用真实数据
 */
export default function SessionListPage() {
  const [filter, setFilter] = useState('all') // all | p0 | p1 | completed | face
  const [sessions, setSessions] = useState([])

  // 从 localStorage 读取真实录制会话
  useEffect(() => {
    const list = getSessionList()
    const formatted = list.map((s, i) => ({
      id: s.id,
      task: '电商结算页优惠券弹窗测试',
      participant: `P-${String(i + 1).padStart(3, '0')}`,
      duration: s.duration ? `${(s.duration / 1000).toFixed(1)}s` : '0s',
      status: 'completed',
      severity: s.hasFace && s.lastEmotion?.value > 0.7 ? 'P0' : 'P1',
      issue: s.hasFace
        ? `检测到 ${s.lastEmotion?.label || '未知'} 情绪`
        : '行为录制（无面部数据）',
      createdAt: new Date(s.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
      hasReport: false,
      eventCount: s.eventCount,
      frameCount: s.frameCount,
      hasFace: s.hasFace,
      lastEmotion: s.lastEmotion
    }))
    setSessions(formatted)
  }, [])

  const filteredSessions = sessions.filter((s) => {
    if (filter === 'all') return true
    if (filter === 'p0') return s.severity === 'P0'
    if (filter === 'p1') return s.severity === 'P1'
    if (filter === 'completed') return s.status === 'completed'
    if (filter === 'face') return s.hasFace
    return true
  })

  const severityColors = {
    P0: 'bg-danger/15 text-danger border-danger/30',
    P1: 'bg-warn/15 text-warn border-warn/30',
    P2: 'bg-cyan-soft/15 text-cyan-soft border-cyan-soft/30'
  }

  const statusLabels = {
    completed: { label: '已完成', color: 'text-emerald-400' },
    reviewing: { label: '分析中', color: 'text-warn' }
  }

  // 空状态
  if (sessions.length === 0) {
    return (
      <AnalystLayout>
        <div className="p-6">
          <h1 className="text-lg font-semibold text-slate-100 mb-6">会话列表</h1>
          <div className="glass rounded-xl p-12 text-center">
            <div className="w-16 h-16 rounded-2xl bg-ink-700/60 border border-cyan-glow/15 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                <path d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="#22E6C8" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="text-sm text-slate-300 font-medium">暂无录制会话</div>
            <p className="text-xs text-slate-500 mt-2 max-w-[300px] mx-auto">
              请先让被试完成测试任务，录制数据会自动显示在这里
            </p>
            <Link
              to="/tasks"
              className="inline-block mt-4 px-4 py-2 rounded-lg bg-cyan-glow/15 border border-cyan-glow/25 text-cyan-glow text-xs font-medium hover:bg-cyan-glow/25 transition-colors"
            >
              创建测试任务 →
            </Link>
          </div>
        </div>
      </AnalystLayout>
    )
  }

  return (
    <AnalystLayout>
      <div className="p-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">会话列表</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              共 {sessions.length} 个会话 · {sessions.filter(s => s.severity === 'P0').length} 个 P0 问题 ·
              <span className="text-emerald-400"> {sessions.filter(s => s.hasFace).length} 个含面部数据</span>
            </p>
          </div>
        </div>

        {/* 筛选 */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { key: 'all', label: '全部' },
            { key: 'p0', label: 'P0 紧急' },
            { key: 'p1', label: 'P1 重要' },
            { key: 'face', label: '含面部数据' }
          ].map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                filter === f.key
                  ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/25'
                  : 'text-slate-500 hover:text-slate-300 border border-transparent'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* 列表 */}
        <div className="space-y-2">
          {filteredSessions.map((s) => (
            <Link
              key={s.id}
              to={`/sessions/${s.id}`}
              className="block glass rounded-xl p-4 hover:border-cyan-glow/25 transition-colors group"
            >
              <div className="flex items-center gap-4">
                {/* 严重程度 */}
                <div className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border shrink-0 ${severityColors[s.severity]}`}>
                  {s.severity}
                </div>

                {/* 信息 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[12px] font-medium text-slate-100 group-hover:text-cyan-glow transition-colors">
                      {s.id}
                    </span>
                    <span className="text-[10px] text-slate-500">·</span>
                    <span className="text-[11px] text-slate-400">{s.participant}</span>
                    {s.hasFace && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                        FACE
                      </span>
                    )}
                    <span className={`text-[10px] font-mono ${statusLabels[s.status]?.color || 'text-slate-500'}`}>
                      ● {statusLabels[s.status]?.label || s.status}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {s.issue}
                  </div>
                </div>

                {/* 元信息 */}
                <div className="flex items-center gap-4 shrink-0 text-[10px] font-mono text-slate-500">
                  <span>{s.duration}</span>
                  <span>{s.eventCount}e</span>
                  {s.hasFace && <span>{s.frameCount}f</span>}
                  <span>{s.createdAt}</span>
                </div>

                {/* 箭头 */}
                <span className="text-slate-600 group-hover:text-cyan-glow transition-colors">→</span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </AnalystLayout>
  )
}
