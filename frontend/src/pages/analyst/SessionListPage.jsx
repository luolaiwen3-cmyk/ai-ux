import React, { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { sessionsApi } from '../../api/client.js'
import LegacyImport from '../../components/analyst/LegacyImport.jsx'

const severityColors = {
  P0: 'bg-red-50 text-red-700 border-red-200',
  P1: 'bg-amber-50 text-amber-700 border-amber-200',
  P2: 'bg-blue-50 text-blue-700 border-blue-200'
}

export default function SessionListPage() {
  const [filter, setFilter] = useState('all')
  const [sessions, setSessions] = useState([])
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')

  const load = async () => {
    setState('loading')
    try {
      setSessions(await sessionsApi.list())
      setState('ready')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }
  useEffect(() => { load() }, [])

  const filtered = useMemo(() => sessions.filter((session) => {
    if (filter === 'all') return true
    if (filter === 'p0' || filter === 'p1') return session.severity?.toLowerCase() === filter
    return session.status === filter
  }), [sessions, filter])

  const remove = async (event, session) => {
    event.preventDefault()
    if (!window.confirm(`确定删除会话 ${session.id} 及其全部录制数据吗？此操作不可撤销。`)) return
    try {
      await sessionsApi.remove(session.id)
      setSessions((current) => current.filter((item) => item.id !== session.id))
    } catch (err) { setError(err.message) }
  }

  return <AnalystLayout><div className="p-6">
    <div className="mb-6"><h1 className="text-lg font-semibold text-slate-100">会话列表</h1><p className="text-xs text-slate-500 mt-0.5">共 {sessions.length} 个真实会话 · 数据来自本机 SQLite</p></div>
    {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
    <LegacyImport onImported={load} />
    <div className="flex items-center gap-2 mb-4">{[
      ['all', '全部'], ['p0', 'P0 紧急'], ['p1', 'P1 重要'], ['recording', '录制中'], ['completed', '已完成']
    ].map(([key, label]) => <button key={key} onClick={() => setFilter(key)} className={`px-3 py-1.5 rounded-lg text-[11px] font-mono border ${filter === key ? 'bg-slate-900 text-white border-slate-900' : 'text-slate-600 border-transparent'}`}>{label}</button>)}</div>
    {state === 'loading' && <div className="py-12 text-center text-sm text-slate-500">正在加载会话…</div>}
    {state === 'error' && <button onClick={load} className="text-sm underline">重新加载</button>}
    {state === 'ready' && filtered.length === 0 && <div className="glass rounded-xl p-12 text-center"><div className="text-sm text-slate-700">暂无符合条件的真实会话</div><div className="text-xs text-slate-500 mt-1">从任务管理复制测试链接并完成一次测试后，会话会显示在这里。</div></div>}
    <div className="space-y-2">{filtered.map((session) => <Link key={session.id} to={`/sessions/${session.id}`} className="block glass rounded-xl p-4 hover:border-slate-400 transition-colors group"><div className="flex items-center gap-4"><div className={`px-2 py-1 rounded text-[10px] font-mono font-semibold border ${severityColors[session.severity] || 'bg-slate-50 text-slate-600 border-slate-200'}`}>{session.severity || '待分析'}</div><div className="flex-1 min-w-0"><div className="flex items-center gap-2"><span className="text-xs font-medium text-slate-900">{session.id}</span><span className="text-[11px] text-slate-500">{session.participant_id}</span><span className={`text-[10px] ${session.status === 'completed' ? 'text-emerald-600' : 'text-amber-600'}`}>● {session.status === 'completed' ? '已完成' : '录制中'}</span></div><div className="text-[11px] text-slate-500 mt-0.5 truncate">{session.issue_summary || `${session.task_name} · 待分析`}</div></div><div className="flex items-center gap-4 text-[10px] font-mono text-slate-500"><span>{(session.duration_ms / 1000).toFixed(1)}s</span><span>{session.event_count} events</span>{session.has_report && <span className="text-emerald-600">报告 ✓</span>}<button onClick={(event) => remove(event, session)} className="text-red-600 hover:underline">删除</button><span>→</span></div></div></Link>)}</div>
  </div></AnalystLayout>
}
