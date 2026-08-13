import React, { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { authApi } from '../../api/client.js'

export default function LoginPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError('')
    try {
      await authApi.login(username, password)
      navigate(location.state?.from?.pathname || '/', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return <div className="relative z-10 min-h-screen bg-slate-50 flex items-center justify-center px-6">
    <form onSubmit={submit} className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl shadow-sm p-8">
      <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center mb-5">◧</div>
      <h1 className="text-xl font-semibold text-slate-950">登录分析工作台</h1>
      <p className="text-sm text-slate-500 mt-1 mb-6">使用本机管理员账号访问测试数据</p>
      <label className="block text-xs text-slate-600 mb-1.5">用户名</label>
      <input value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900 mb-4" autoComplete="username" />
      <label className="block text-xs text-slate-600 mb-1.5">密码</label>
      <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm text-slate-900" autoComplete="current-password" autoFocus />
      {error && <div className="mt-3 text-xs text-red-600">{error}</div>}
      <button disabled={loading} className="w-full mt-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-medium disabled:opacity-50">{loading ? '登录中…' : '登录'}</button>
    </form>
  </div>
}
