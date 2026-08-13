import React, { useState } from 'react'
import { sessionsApi } from '../../api/client.js'
import { syncPending } from '../../storage/uploadQueue.js'

/**
 * 测试完成页 —— 被试任务结束后的收尾
 * 仅致谢，不进入分析工作台
 */
export default function ThanksPage() {
  const activeSession = JSON.parse(sessionStorage.getItem('insightux-active-session') || 'null')
  const [syncState, setSyncState] = useState(sessionStorage.getItem('insightux-sync-status') || 'complete')
  const [error, setError] = useState(sessionStorage.getItem('insightux-sync-error') || '')

  const retry = async () => {
    if (!activeSession) return
    setSyncState('syncing')
    setError('')
    try {
      await syncPending(activeSession.id)
      await sessionsApi.complete(activeSession.id, activeSession.upload_token, { duration_ms: 0, stop_reason: 'manual' })
      sessionStorage.setItem('insightux-sync-status', 'complete')
      setSyncState('complete')
    } catch (err) {
      setError(err.message)
      setSyncState('pending')
    }
  }
  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            Shop<span className="text-orange-500">Demo</span>
          </div>
          <span className="ml-3 text-xs text-slate-400">用户体验测试</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
              <span className="text-3xl text-emerald-600">✓</span>
            </div>
            <h1 className="text-xl font-semibold text-slate-900 mb-2">
              测试已结束，感谢参与
            </h1>
            <p className="text-sm text-slate-500 leading-relaxed mb-6">
              您的操作已记录完成。数据仅用于本次用户体验研究，
              <br />
              您可以安全关闭此页面。
            </p>
            {syncState !== 'complete' && <div className="mb-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left"><div className="text-xs font-medium text-amber-800">{syncState === 'syncing' ? '正在同步测试数据…' : '部分数据尚未同步'}</div>{error && <div className="text-[11px] text-amber-700 mt-1">{error}</div>}<button onClick={retry} disabled={syncState === 'syncing'} className="mt-3 px-3 py-1.5 rounded-lg bg-amber-600 text-white text-xs disabled:opacity-50">重新同步</button></div>}
            <div className="bg-slate-50 rounded-xl p-4 text-left">
              <div className="text-xs font-medium text-slate-700 mb-2">接下来</div>
              <ul className="text-xs text-slate-500 space-y-1.5">
                <li>· 无需再进行任何操作</li>
                <li>· 关闭浏览器标签即可离开</li>
                <li>· 原始摄像头画面不会被保存</li>
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
