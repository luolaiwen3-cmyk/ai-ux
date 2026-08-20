import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import ErrorBoundary from './ErrorBoundary.jsx'
import { useAuth } from '../../context/AuthContext.jsx'

/**
 * 分析人员端共享布局 —— 左侧导航 + 右侧内容区
 */
export default function AnalystLayout({ children }) {
  const location = useLocation()
  const { user, logout } = useAuth()

  const navItems = [
    { path: '/', label: '仪表盘', icon: 'dashboard' },
    { path: '/tasks', label: '任务管理', icon: 'tasks' },
    { path: '/sessions', label: '会话列表', icon: 'sessions' }
  ]

  const isActive = (path) => path === '/'
    ? location.pathname === '/'
    : location.pathname.startsWith(path) || (path === '/sessions' && location.pathname.startsWith('/report/'))

  return (
    <div className="analyst-theme relative z-10 flex h-screen text-slate-900">
      {/* 左侧导航 */}
      <aside className="hidden md:flex w-60 shrink-0 border-r border-slate-200/80 bg-white flex-col">
        {/* Logo */}
        <div className="px-5 h-[72px] border-b border-slate-100 flex items-center">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/20 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14l6 3-6 3z" fill="#FFFFFF" />
              </svg>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-semibold tracking-tight text-slate-950">InsightUX</div>
              <div className="text-[10px] text-slate-400">研究分析工作台</div>
            </div>
          </div>
        </div>

        {/* 导航 */}
        <nav aria-label="主导航" className="flex-1 px-3 py-5 space-y-1.5">
          <div className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">工作空间</div>
          {navItems.map((item) => {
            const active = isActive(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all ${
                  active
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-500 hover:text-slate-950 hover:bg-slate-50'
                }`}
                aria-current={active ? 'page' : undefined}
              >
                {active && <span className="absolute left-0 w-1 h-5 rounded-r-full bg-indigo-500" />}
                <NavIcon name={item.icon} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        {/* 底部用户信息 */}
        <div className="m-3 px-3 py-3 rounded-xl border border-slate-200 bg-slate-50/80">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs text-indigo-700 font-semibold">
              {(user?.name || 'Admin').slice(0, 1).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-slate-900 truncate">{user?.name || 'Admin'}</div>
              <div className="text-[10px] text-slate-400">研究员账户</div>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-white" aria-label="退出登录"><LogoutIcon /></button>
          </div>
        </div>
      </aside>

      {/* 右侧内容 */}
      <div className="flex-1 min-w-0 overflow-y-auto pb-16 md:pb-0">
        <div className="md:hidden sticky top-0 z-50 h-14 bg-white/90 backdrop-blur-xl border-b border-slate-200/80 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5"><div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-[10px] font-bold">IX</div><span className="font-semibold text-sm text-slate-950">InsightUX</span></div>
          <button onClick={logout} className="p-2 rounded-lg text-slate-400 hover:bg-slate-100" aria-label="退出登录"><LogoutIcon /></button>
        </div>
        <ErrorBoundary>{children}</ErrorBoundary>
      </div>

      <nav aria-label="移动端主导航" className="md:hidden fixed z-50 bottom-0 inset-x-0 h-16 bg-white/95 backdrop-blur-xl border-t border-slate-200 flex items-center justify-around px-3 pb-[env(safe-area-inset-bottom)]">
        {navItems.map((item) => {
          const active = isActive(item.path)
          return <Link key={item.path} to={item.path} aria-current={active ? 'page' : undefined} className={`min-w-[72px] h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium ${active ? 'text-indigo-600 bg-indigo-50' : 'text-slate-400'}`}><NavIcon name={item.icon} />{item.label}</Link>
        })}
      </nav>
    </div>
  )
}

function NavIcon({ name }) {
  const paths = {
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="2" /><rect x="14" y="3" width="7" height="7" rx="2" /><rect x="3" y="14" width="7" height="7" rx="2" /><rect x="14" y="14" width="7" height="7" rx="2" /></>,
    tasks: <><path d="M9 5H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-3" /><rect x="9" y="3" width="6" height="4" rx="1" /><path d="m9 14 2 2 4-4" /></>,
    sessions: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z" /><path d="M8 7h8M8 11h6" /></>
  }
  return <svg aria-hidden="true" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function LogoutIcon() {
  return <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M10 17l5-5-5-5M15 12H3" /><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /></svg>
}
