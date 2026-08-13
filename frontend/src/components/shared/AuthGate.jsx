import React, { useEffect, useState } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { authApi } from '../../api/client.js'

export default function AuthGate({ children }) {
  const location = useLocation()
  const [state, setState] = useState('loading')

  useEffect(() => {
    authApi.me().then(() => setState('ready')).catch(() => setState('unauthorized'))
  }, [])

  if (state === 'loading') return <div className="min-h-screen bg-white flex items-center justify-center text-sm text-slate-500">正在验证登录状态…</div>
  if (state === 'unauthorized') return <Navigate to="/login" state={{ from: location }} replace />
  return children
}
