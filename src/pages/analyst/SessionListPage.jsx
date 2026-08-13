import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { api } from '../../lib/apiClient.js'

const statusLabels = {
  created: '待开始',
  recording: '进行中',
  completed: '已完成',
  abandoned: '已退出'
}

export default function SessionListPage() {
  const [filter, setFilter] = useState('all')
  const [sort, setSort] = useState('desc')
  const [scope, setScope] = useState('participant')
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const loadSessions = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.sessions.list({ sort, scope })
      setSessions(result.data)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [sort, scope])

  useEffect(() => {
    loadSessions()
  }, [loadSessions])

  const visibleSessions = useMemo(() => sessions.filter((session) => {
    if (filter === 'all') return true
    if (filter === 'face') return session.hasFace
    if (filter === 'p0') return session.severity === 'P0'
    return session.status === filter
  }), [sessions, filter])

  return (
    <AnalystLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">会话列表</h1>
            <p className="text-xs text-slate-500 mt-0.5">{scope === 'trial' ? '试跑验收' : '正式测试'} · 共 {sessions.length} 个会话 · {sessions.filter((item) => item.status === 'completed').length} 个已完成</p>
          </div>
          <div className="flex items-center gap-2">
            <select aria-label="会话排序" value={sort} onChange={(event) => setSort(event.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-xs">
              <option value="desc">最新优先</option>
              <option value="asc">最早优先</option>
            </select>
            <button onClick={loadSessions} className="px-3 py-2 rounded-lg border border-slate-200 text-xs text-slate-600">刷新</button>
          </div>
        </div>

        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}

        <div className="flex items-center gap-2 mb-4 overflow-x-auto">
          <button onClick={() => { setScope('participant'); setFilter('all') }} className={`px-3 py-1.5 rounded-lg text-[11px] ${scope === 'participant' ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/25' : 'text-slate-500 border border-transparent'}`}>正式会话</button>
          <button onClick={() => { setScope('trial'); setFilter('all') }} className={`px-3 py-1.5 rounded-lg text-[11px] ${scope === 'trial' ? 'bg-amber-500/15 text-amber-400 border border-amber-500/25' : 'text-slate-500 border border-transparent'}`}>试跑会话</button>
          <div className="w-px h-5 bg-slate-700 mx-1" />
          {[
            ['all', '全部'],
            ['completed', '已完成'],
            ['recording', '进行中'],
            ['abandoned', '已退出'],
            ['face', '含面部数据'],
            ['p0', 'P0 紧急']
          ].map(([key, label]) => (
            <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-[11px] font-mono whitespace-nowrap ${filter === key ? 'bg-cyan-glow/15 text-cyan-glow border border-cyan-glow/25' : 'text-slate-500 border border-transparent'}`}>{label}</button>
          ))}
        </div>

        {loading ? (
          <EmptyState title="正在加载会话…" />
        ) : visibleSessions.length === 0 ? (
          <EmptyState title={sessions.length ? '没有符合条件的会话' : '暂无会话'} detail={sessions.length ? '请调整筛选条件' : '请先发布任务并让被试完成测试'} />
        ) : (
          <div className="space-y-2">
            {visibleSessions.map((session) => (
              <Link key={session.id} to={`/sessions/${session.id}`} className="block glass rounded-xl p-4 hover:border-cyan-glow/25 transition-colors group">
                <div className="flex items-center gap-4">
                  <div className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border shrink-0 ${session.severity === 'P0' ? 'bg-danger/15 text-danger border-danger/30' : session.severity === 'P1' ? 'bg-warn/15 text-warn border-warn/30' : 'bg-slate-100 text-slate-500 border-slate-200'}`}>{session.severity || '—'}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2"><span className="text-[12px] font-medium text-slate-100 group-hover:text-cyan-glow">{session.participantCode}</span><span className="text-[10px] text-slate-500">{session.taskName}</span>{session.mode === 'trial' && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/15 text-amber-400 border border-amber-500/20">TRIAL</span>}{session.hasFace && <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">FACE</span>}</div>
                    <div className="text-[10px] text-slate-500 mt-0.5 font-mono">{session.id}</div>
                  </div>
                  <div className="hidden md:flex items-center gap-4 shrink-0 text-[10px] font-mono text-slate-500">
                    <span>{statusLabels[session.status] || session.status}</span>
                    <span>{(session.duration / 1000).toFixed(1)}s</span>
                    <span>{session.eventCount}e</span>
                    {session.hasFace && <span>{session.frameCount}f</span>}
                    <span>{new Date(session.createdAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <span className="text-slate-600 group-hover:text-cyan-glow">→</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AnalystLayout>
  )
}

function EmptyState({ title, detail }) {
  return <div className="glass rounded-xl p-12 text-center"><div className="text-sm text-slate-300 font-medium">{title}</div>{detail && <p className="text-xs text-slate-500 mt-2">{detail}</p>}</div>
}
