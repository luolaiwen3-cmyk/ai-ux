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
    <div className="relative z-10 min-h-screen bg-slate-50 flex items-center justify-center px-5">
      <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-7">
        <div className="w-10 h-10 rounded-xl bg-slate-950 text-white flex items-center justify-center mb-5 font-semibold">IX</div>
        <h1 className="text-xl font-semibold text-slate-950">登录分析工作台</h1>
        <p className="text-sm text-slate-500 mt-1">管理任务、会话和诊断报告</p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="admin-password" className="block text-xs font-medium text-slate-700 mb-1.5">管理员密码</label>
            <input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="login-password-input w-full px-3 py-2.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 caret-slate-900 shadow-sm transition-colors focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-500"
              required
              autoFocus
            />
          </div>
          {error && <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</div>}
          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-slate-950 text-white text-sm font-medium hover:bg-slate-800 disabled:opacity-50"
          >
            {submitting ? '登录中…' : '登录'}
          </button>
        </form>
      </div>
    </div>
  )
}
