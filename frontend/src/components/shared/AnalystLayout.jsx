import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'
import { adminApi } from '../../api/client.js'

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
    <div className="analyst-theme relative z-10 flex h-screen bg-white text-slate-900">
      {/* 左侧导航 */}
      <aside className="w-56 shrink-0 border-r border-slate-200 bg-white flex flex-col">
        {/* Logo */}
        <div className="px-5 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14l6 3-6 3z" fill="#FFFFFF" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-[13px] font-semibold text-slate-950">InsightUX</div>
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
                    ? 'bg-slate-100 text-slate-950 border border-slate-300'
                    : 'text-slate-600 hover:text-slate-950 hover:bg-slate-50'
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="px-4 py-3 border-t border-slate-200">
          <form method="post" action={adminApi.backupUrl} className="mb-2">
            <button className="w-full text-left px-2 py-1.5 rounded text-[10px] text-slate-500 hover:bg-slate-50 hover:text-slate-900">↓ 下载完整备份</button>
          </form>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-900 flex items-center justify-center text-[10px] text-white font-medium">
              A
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[11px] text-slate-900 truncate">Admin</div>
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
