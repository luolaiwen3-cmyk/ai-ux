import React, { useState } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'

export default function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event) => {
    event.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await login(password)
      navigate(location.state?.from || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative z-10 min-h-screen bg-[#f6f7fb] flex items-center justify-center overflow-hidden px-5 py-10">
      <div className="absolute -top-40 -left-28 w-96 h-96 rounded-full bg-indigo-200/40 blur-3xl" />
      <div className="absolute -bottom-44 -right-28 w-[28rem] h-[28rem] rounded-full bg-violet-200/40 blur-3xl" />
      <div className="relative w-full max-w-md bg-white/95 border border-white rounded-3xl shadow-[0_24px_80px_rgba(49,46,129,0.12)] p-7 sm:p-9">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center shadow-lg shadow-indigo-500/20 font-semibold text-sm">IX</div>
          <div><div className="text-sm font-semibold text-slate-950">InsightUX</div><div className="text-[11px] text-slate-400">研究分析工作台</div></div>
        </div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-indigo-500 mb-2">Welcome back</div>
        <h1 className="text-2xl font-semibold tracking-tight text-slate-950">欢迎回来</h1>
        <p className="text-sm text-slate-500 mt-1.5">登录后继续管理测试任务和诊断报告</p>

        <form className="mt-7 space-y-5" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700 mb-1.5">管理员密码</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-password-input w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-white text-sm text-slate-900 caret-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-400"
              required
              autoFocus
            />
          </div>
          {error && <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-slate-950 text-white text-sm font-semibold hover:bg-indigo-600 shadow-sm hover:shadow-md transition-all disabled:opacity-50"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
        <p className="mt-7 text-center text-[11px] text-slate-400">仅限已授权的研究人员访问</p>
      </div>
    </div>
  )
}
