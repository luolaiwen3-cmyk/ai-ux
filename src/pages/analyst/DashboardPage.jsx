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
      <div className="p-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">仪表盘</h1>
            <p className="text-xs text-slate-500 mt-0.5">欢迎回来，今日已发现 {stats?.totalIssues ?? 0} 个 UX 问题</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setView('normal')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                view === 'normal'
                  ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/25'
                  : 'text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              普通视图
            </button>
            <button
              onClick={() => setView('admin')}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-mono transition-colors ${
                view === 'admin'
                  ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/25'
                  : 'text-slate-500 border border-transparent hover:text-slate-300'
              }`}
            >
              Admin 全局视图
            </button>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

        {/* 核心指标 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <StatCard label="总会话数" value={stats?.totalSessions || 0} delta={`+${stats?.totalSessions || 0}`} color="text-cyan-glow" />
          <StatCard label="P0 紧急" value={stats?.p0Count || 0} delta={`${stats?.sessionsWithFace || 0} 含面部`} color="text-danger" />
          <StatCard label="问题总数" value={stats?.totalIssues || 0} delta="自动检测" color="text-danger" />
          <StatCard label="面部数据" value={stats?.sessionsWithFace || 0} delta="MediaPipe" color="text-emerald-400" />
        </div>

        {/* 普通视图 */}
        {view === 'normal' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* 最近会话 */}
            <div className="lg:col-span-2 glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[12px] font-mono text-slate-400 tracking-wide">
                  RECENT_SESSIONS · 最近会话
                </span>
                <Link to="/sessions" className="text-[10px] font-mono text-cyan-glow hover:underline">
                  查看全部 →
                </Link>
              </div>
              <div className="space-y-2">
                {recentSessions.map((s) => (
                  <Link
                    key={s.id}
                    to={`/sessions/${s.id}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-ink-800/40 border border-cyan-glow/10 hover:border-cyan-glow/25 transition-colors"
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
                    <span className="text-[11px] font-mono text-slate-300 flex-1">{s.id}</span>
                    <span className="text-[10px] text-slate-500">{s.participantCode}</span>
                    <span className="text-[10px] text-slate-500">{new Date(s.createdAt).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</span>
                  </Link>
                ))}
              </div>
            </div>

            {/* 快速入口 */}
            <div className="glass rounded-xl p-4">
              <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-3">
                QUICK_ACTIONS · 快速操作
              </div>
              <div className="space-y-2">
                <QuickAction to="/tasks" label="创建新任务" icon="＋" />
                <QuickAction to="/sessions" label="查看会话列表" icon="◫" />
                <QuickAction to="/tasks" label="生成测试链接" icon="🔗" />
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
              <StatCard label="累计会话" value={stats?.totalSessions || 0} delta="+real" color="text-cyan-glow" />
              <StatCard label="累计问题" value={stats?.totalIssues || 0} delta="自动" color="text-danger" />
              <StatCard label="P0 紧急" value={stats?.p0Count || 0} delta="高优先级" color="text-danger" />
              <StatCard label="面部采集" value={stats?.sessionsWithFace || 0} delta="MediaPipe" color="text-emerald-400" />
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

function StatCard({ label, value, delta, color }) {
  return (
    <div className="glass rounded-xl p-4">
      <div className="text-[10px] text-slate-500 font-mono">{label}</div>
      <div className={`text-[20px] font-bold font-mono mt-1 ${color}`}>{value}</div>
      <div className="text-[10px] text-slate-500 mt-0.5">{delta}</div>
    </div>
  )
}

function QuickAction({ to, label, icon }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-ink-800/40 border border-cyan-glow/10 hover:border-cyan-glow/25 hover:bg-ink-800/60 transition-colors"
    >
      <span className="text-cyan-glow text-sm">{icon}</span>
      <span className="text-[12px] text-slate-300">{label}</span>
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
