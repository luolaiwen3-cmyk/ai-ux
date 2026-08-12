import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { getSessionIndex } from '../../lib/rrwebRecorder.js'

/**
 * A2 会话列表 —— 所有被试会话总览，支持筛选/排序
 * 优先从 localStorage 读取真实录制会话，降级到 mock 数据
 */
export default function SessionListPage() {
  const [filter, setFilter] = useState('all') // all | p0 | p1 | completed | reviewing
  const [realSessions, setRealSessions] = useState([])

  // 从 localStorage 读取真实录制会话
  useEffect(() => {
    const index = getSessionIndex()
    if (index.length > 0) {
      const sessions = index.map(s => ({
        id: s.id,
        task: '电商结算页优惠券弹窗测试',
        participant: 'P-Real',
        duration: `${(s.duration / 1000).toFixed(1)}s`,
        status: 'completed',
        severity: 'P0',
        issue: '待分析（rrweb 真实录制）',
        createdAt: new Date(s.savedAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
        hasReport: false,
        eventCount: s.eventCount,
        isReal: true
      }))
      setRealSessions(sessions)
    }
  }, [])

  const mockSessions = [
    {
      id: 'UX-0812-0037',
      task: '电商结算页优惠券弹窗测试',
      participant: 'P-042',
      duration: '20.0s',
      status: 'completed',
      severity: 'P0',
      issue: '优惠券弹窗双按钮文案歧义',
      createdAt: '13:21',
      hasReport: true
    },
    {
      id: 'UX-0812-0036',
      task: '电商结算页优惠券弹窗测试',
      participant: 'P-041',
      duration: '18.5s',
      status: 'completed',
      severity: 'P1',
      issue: '结算按钮位置不易发现',
      createdAt: '13:15',
      hasReport: true
    },
    {
      id: 'UX-0812-0035',
      task: '电商结算页优惠券弹窗测试',
      participant: 'P-040',
      duration: '22.1s',
      status: 'reviewing',
      severity: 'P0',
      issue: '待分析',
      createdAt: '13:08',
      hasReport: false
    },
    {
      id: 'UX-0812-0034',
      task: '注册流程简化测试',
      participant: 'P-039',
      duration: '45.3s',
      status: 'completed',
      severity: 'P2',
      issue: '表单字段过多导致放弃',
      createdAt: '12:55',
      hasReport: true
    },
    {
      id: 'UX-0812-0033',
      task: '注册流程简化测试',
      participant: 'P-038',
      duration: '38.7s',
      status: 'completed',
      severity: 'P1',
      issue: '验证码输入体验差',
      createdAt: '12:48',
      hasReport: true
    },
    {
      id: 'UX-0811-0032',
      task: '电商结算页优惠券弹窗测试',
      participant: 'P-037',
      duration: '16.2s',
      status: 'completed',
      severity: 'P0',
      issue: '优惠券弹窗双按钮文案歧义',
      createdAt: '18:32',
      hasReport: true
    }
  ]

  // 合并真实会话和 mock 会话，真实会话排在前面
  const allSessions = [...realSessions, ...mockSessions]

  const filteredSessions = allSessions.filter((s) => {
    if (filter === 'all') return true
    if (filter === 'p0') return s.severity === 'P0'
    if (filter === 'p1') return s.severity === 'P1'
    if (filter === 'completed') return s.status === 'completed'
    if (filter === 'reviewing') return s.status === 'reviewing'
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

  return (
    <AnalystLayout>
      <div className="p-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">会话列表</h1>
            <p className="text-xs text-slate-500 mt-0.5">共 {allSessions.length} 个会话 · {allSessions.filter((s) => s.severity === 'P0').length} 个 P0 问题 · <span className="text-emerald-400">{realSessions.length} 个真实录制</span></p>
          </div>
        </div>

        {/* 筛选 */}
        <div className="flex items-center gap-2 mb-4">
          {[
            { key: 'all', label: '全部' },
            { key: 'p0', label: 'P0 紧急' },
            { key: 'p1', label: 'P1 重要' },
            { key: 'reviewing', label: '分析中' },
            { key: 'completed', label: '已完成' }
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
                    <span
                      className={`text-[10px] font-mono ${statusLabels[s.status].color}`}
                    >
                      ● {statusLabels[s.status].label}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    {s.issue}
                  </div>
                </div>

                {/* 元信息 */}
                <div className="flex items-center gap-4 shrink-0 text-[10px] font-mono text-slate-500">
                  <span>{s.duration}</span>
                  <span>{s.createdAt}</span>
                  {s.hasReport && (
                    <span className="text-emerald-400">报告 ✓</span>
                  )}
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
