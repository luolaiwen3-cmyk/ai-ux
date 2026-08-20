import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar
} from 'recharts'
import { api } from '../../lib/apiClient.js'

/**
 * A5 仪表盘 —— 分析人员首页
 * - 普通视图：核心指标 + 最近会话
 * - Admin 全局视图：问题统计 + 趋势图表
 * 完全使用真实数据
 */
export default function DashboardPage() {
  const [view, setView] = useState('normal') // normal | admin
  const [stats, setStats] = useState(null)
  const [recentSessions, setRecentSessions] = useState([])
  const [error, setError] = useState('')

  // 加载真实数据
  useEffect(() => {
    let active = true
    api.dashboard.get()
      .then((nextStats) => {
        if (!active) return
        setStats(nextStats)
        setRecentSessions(nextStats.recentSessions)
      })
      .catch((requestError) => {
        if (active) setError(requestError.message)
      })
    return () => { active = false }
  }, [])

  return (
    <AnalystLayout>
      <div className="analyst-page">
        {/* 页头 */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
          <div>
            <div className="analyst-eyebrow mb-1.5">Overview</div>
            <h1 className="analyst-title">研究概览</h1>
            <p className="analyst-subtitle">集中查看测试进度、关键问题与最近会话</p>
          </div>
          <div className="analyst-segmented self-start sm:self-auto">
            <button
              onClick={() => setView('normal')}
              className={`analyst-segment ${view === 'normal' ? 'analyst-segment-active' : ''}`}
              aria-pressed={view === 'normal'}
            >
              工作视图
            </button>
            <button
              onClick={() => setView('admin')}
              className={`analyst-segment ${view === 'admin' ? 'analyst-segment-active' : ''}`}
              aria-pressed={view === 'admin'}
            >
              数据视图
            </button>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

        {/* 核心指标 */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <StatCard label="总会话数" value={stats?.totalSessions || 0} detail="全部研究会话" tone="indigo" icon="sessions" />
          <StatCard label="紧急问题" value={stats?.p0Count || 0} detail="P0 优先处理" tone="red" icon="alert" />
          <StatCard label="问题总数" value={stats?.totalIssues || 0} detail="自动诊断发现" tone="amber" icon="issues" />
          <StatCard label="面部数据" value={stats?.sessionsWithFace || 0} detail="已授权采集" tone="emerald" icon="face" />
        </div>

        {/* 普通视图 */}
        {view === 'normal' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 最近会话 */}
            <div className="lg:col-span-2 glass rounded-2xl p-4 sm:p-5">
              <div className="flex items-center justify-between mb-3">
                <div><h2 className="text-sm font-semibold text-slate-900">最近会话</h2><p className="text-[11px] text-slate-400 mt-0.5">最近进入的用户测试记录</p></div>
                <Link to="/sessions" className="text-xs font-medium text-indigo-600 hover:text-indigo-800">
                  查看全部 →
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/sessions/${s.id}`}
                    className="flex items-center gap-3 py-3 first:pt-2 last:pb-0 group"
                  >
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono font-semibold ${
                        s.severity === 'P0'
                          ? 'bg-danger/15 text-danger'
                          : s.severity === 'P1'
                          ? 'bg-warn/15 text-warn'
                          : 'bg-cyan-soft/15 text-cyan-soft'
                      }`}
                    >
                      {s.severity}
                    </span>
                    <span className="text-xs font-medium text-slate-700 flex-1 truncate group-hover:text-indigo-600">{s.participantCode}</span>
                    <span className="hidden sm:block text-[10px] font-mono text-slate-400">{s.id.slice(0, 8)}</span>
                    <span className="text-[11px] text-slate-400">{new Date(s.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </Link>
                ))}
                {recentSessions.length === 0 && <div className="py-10 text-center"><div className="text-sm text-slate-500">还没有会话记录</div><Link to="/tasks" className="inline-block mt-2 text-xs font-medium text-indigo-600">创建测试任务 →</Link></div>}
              </div>
            </div>

            {/* 快速入口 */}
            <div className="glass rounded-2xl p-4 sm:p-5">
              <div className="mb-3"><h2 className="text-sm font-semibold text-slate-900">快速操作</h2><p className="text-[11px] text-slate-400 mt-0.5">继续下一步研究工作</p></div>
              <div className="space-y-2">
                <QuickAction to="/tasks" label="创建新任务" detail="配置测试目标与步骤" icon="＋" />
                <QuickAction to="/sessions" label="查看会话列表" detail="分析用户行为记录" icon="↗" />
                <QuickAction to="/tasks" label="生成测试链接" detail="邀请参与者开始测试" icon="⌁" />
              </div>
            </div>
          </div>
        )}

        {/* Admin 全局视图 */}
        {view === 'admin' && (
          <div className="space-y-4">
            {/* 趋势图 */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="glass rounded-xl p-4">
                <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-3">
                  SESSION_TREND · 会话趋势
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={stats?.trendData || []}>
                      <defs>
                        <linearGradient id="sessGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22E6C8" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="#22E6C8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <XAxis dataKey="day" tick={{ fill: '#374151', fontSize: 10 }} stroke="#d1d5db" />
                      <YAxis tick={{ fill: '#374151', fontSize: 10 }} stroke="#d1d5db" />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 11,
                          color: '#111827'
                        }}
                      />
                      <Area type="monotone" dataKey="sessions" stroke="#22E6C8" fill="url(#sessGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="glass rounded-xl p-4">
                <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-3">
                  ISSUE_DISTRIBUTION · 问题类型分布
                </div>
                <div className="h-[180px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={stats?.issueDist || []} layout="vertical">
                      <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fill: '#374151', fontSize: 10 }} stroke="#d1d5db" />
                      <YAxis dataKey="type" type="category" tick={{ fill: '#374151', fontSize: 10 }} stroke="#d1d5db" width={70} />
                      <Tooltip
                        contentStyle={{
                          background: '#ffffff',
                          border: '1px solid #d1d5db',
                          borderRadius: 8,
                          fontSize: 11,
                          color: '#111827'
                        }}
                      />
                      <Bar dataKey="count" fill="#3FB7FF" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Admin 指标 */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="累计会话" value={stats?.totalSessions || 0} detail="全部研究数据" tone="indigo" icon="sessions" />
              <StatCard label="累计问题" value={stats?.totalIssues || 0} detail="自动诊断发现" tone="amber" icon="issues" />
              <StatCard label="P0 紧急" value={stats?.p0Count || 0} detail="高优先级问题" tone="red" icon="alert" />
              <StatCard label="面部采集" value={stats?.sessionsWithFace || 0} detail="MediaPipe 数据" tone="emerald" icon="face" />
            </div>

            {/* 系统设置入口 */}
            <div className="glass rounded-xl p-4">
              <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-3">
                SYSTEM · 系统设置
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <SettingItem label="分析引擎" value="确定性指标" status="ok" />
                <SettingItem label="面部采集" value="MediaPipe" status="ok" />
                <SettingItem label="数据存储" value="SQLite" status="ok" />
              </div>
            </div>
          </div>
        )}
      </div>
    </AnalystLayout>
  )
}

function StatCard({ label, value, detail, tone, icon }) {
  const tones = {
    indigo: 'bg-indigo-50 text-indigo-600',
    red: 'bg-red-50 text-red-600',
    amber: 'bg-amber-50 text-amber-600',
    emerald: 'bg-emerald-50 text-emerald-600'
  }
  const symbols = { sessions: '↗', alert: '!', issues: '◇', face: '◎' }
  return (
    <div className="glass rounded-2xl p-4 sm:p-5 transition-transform hover:-translate-y-0.5">
      <div className="flex items-start justify-between gap-3">
        <div><div className="text-xs font-medium text-slate-500">{label}</div><div className="text-2xl sm:text-[28px] leading-none font-semibold tracking-tight text-slate-950 mt-2.5">{value}</div></div>
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm font-semibold ${tones[tone]}`}>{symbols[icon]}</div>
      </div>
      <div className="text-[11px] text-slate-400 mt-3">{detail}</div>
    </div>
  )
}

function QuickAction({ to, label, detail, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-3 rounded-xl border border-slate-100 bg-slate-50/70 hover:bg-indigo-50 hover:border-indigo-100 transition-colors group"
    >
      <span className="w-8 h-8 rounded-lg bg-white border border-slate-200 text-indigo-600 flex items-center justify-center text-sm group-hover:border-indigo-200">{icon}</span>
      <span className="flex-1"><span className="block text-xs font-medium text-slate-800">{label}</span><span className="block text-[10px] text-slate-400 mt-0.5">{detail}</span></span>
      <span className="text-slate-300 group-hover:text-indigo-500">→</span>
    </Link>
  )
}

function SettingItem({ label, value, status }) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-ink-800/40 border border-cyan-glow/10">
      <span className="text-[11px] text-slate-400">{label}</span>
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-mono text-slate-300">{value}</span>
        <span className={`w-1.5 h-1.5 rounded-full ${status === 'ok' ? 'bg-emerald-400' : 'bg-warn'}`} />
      </div>
    </div>
  )
}
