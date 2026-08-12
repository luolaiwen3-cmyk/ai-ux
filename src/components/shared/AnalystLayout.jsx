import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'

/**
 * 分析人员端共享布局 —— 左侧导航 + 右侧内容区
 */
export default function AnalystLayout({ children }) {
  const location = useLocation()

  const navItems = [
    { path: '/', label: '仪表盘', icon: '◧' },
    { path: '/tasks', label: '任务管理', icon: '◰' },
    { path: '/sessions', label: '会话列表', icon: '◫' }
  ]

  return (
    <div className="relative z-10 flex h-screen">
      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-cyan-glow/10 bg-ink-800/50 flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-cyan-glow/10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-glow to-cyan-soft flex items-center justify-center shadow-glow">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14l6 3-6 3z" fill="#070A0F" fillOpacity="0.85" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-gradient">InsightUX</div>
              <div className="text-[9px] text-slate-500 font-mono">分析工作台</div>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => {
            const active = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors ${
                  active
                    ? 'bg-cyan-glow/10 text-cyan-glow border border-cyan-glow/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-ink-700/50'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-3 border-t border-cyan-glow/10">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-cyan-glow/30 to-cyan-soft/30 flex items-center justify-center text-[10px] text-cyan-glow font-medium">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-slate-300 truncate">Admin</div>
              <div className="text-[9px] text-slate-500 font-mono truncate">admin@insightux.io</div>
            </div>
          </div>
        </div>
      </aside>

      {/* 右侧内容 */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>
    </div>
  )
}
