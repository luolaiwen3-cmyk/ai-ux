import React, { useEffect, useState } from 'react'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { tasksApi } from '../../api/client.js'

const scenarioLabels = {
  'checkout-coupon': '电商结算页 + 优惠券弹窗',
  'signup-flow': '注册流程',
  'saas-dashboard': 'SaaS 仪表盘导航'
}

export default function TaskManagePage() {
  const [tasks, setTasks] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', scenario: 'checkout-coupon' })
  const [state, setState] = useState('loading')
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState(null)

  const loadTasks = async () => {
    setState('loading')
    try {
      setTasks(await tasksApi.list())
      setState('ready')
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }
  useEffect(() => { loadTasks() }, [])

  const handleCreate = async () => {
    if (!newTask.name.trim()) return
    try {
      const task = await tasksApi.create({ ...newTask, name: newTask.name.trim() })
      setTasks((current) => [task, ...current])
      setNewTask({ name: '', scenario: 'checkout-coupon' })
      setShowCreate(false)
    } catch (err) { setError(err.message) }
  }

  const taskLink = (task) => `${window.location.origin}${window.location.pathname}#/join/${task.public_token}`
  const copyLink = async (task) => {
    await navigator.clipboard.writeText(taskLink(task))
    setCopiedId(task.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return <AnalystLayout><div className="p-6">
    <div className="flex items-center justify-between mb-6"><div><h1 className="text-lg font-semibold text-slate-100">任务管理</h1><p className="text-xs text-slate-500 mt-0.5">创建测试任务并生成本机测试链接</p></div><button onClick={() => setShowCreate(true)} className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold">+ 新建任务</button></div>
    {error && <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>}
    {showCreate && <div className="glass rounded-xl p-5 mb-6"><div className="grid grid-cols-1 md:grid-cols-3 gap-4"><input value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="任务名称" className="px-3 py-2 rounded-lg border text-sm" /><select value={newTask.scenario} onChange={(e) => setNewTask({ ...newTask, scenario: e.target.value })} className="px-3 py-2 rounded-lg border text-sm">{Object.entries(scenarioLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select><div className="flex gap-2"><button onClick={handleCreate} className="flex-1 rounded-lg bg-slate-900 text-white text-xs">创建并生成链接</button><button onClick={() => setShowCreate(false)} className="px-3 rounded-lg border text-xs">取消</button></div></div></div>}
    {state === 'loading' && <div className="text-sm text-slate-500">正在加载任务…</div>}
    {state === 'error' && <button onClick={loadTasks} className="text-sm underline">重新加载</button>}
    {state === 'ready' && tasks.length === 0 && <div className="glass rounded-xl p-10 text-center text-sm text-slate-500">尚未创建任务</div>}
    <div className="space-y-3">{tasks.map((task) => <div key={task.id} className="glass rounded-xl p-4"><div className="flex justify-between gap-4"><div><div className="flex gap-2 items-center"><span className="text-[10px] font-mono text-slate-500">{task.id.slice(0, 8)}</span><span className="px-1.5 py-0.5 rounded text-[9px] bg-emerald-50 text-emerald-700 border border-emerald-200">{task.status === 'active' ? '进行中' : task.status}</span></div><div className="text-sm font-medium text-slate-900 mt-1">{task.name}</div><div className="text-[11px] text-slate-500 mt-0.5">{scenarioLabels[task.scenario] || task.scenario} · {new Date(task.created_at).toLocaleDateString('zh-CN')}</div></div><div className="text-right"><div className="font-semibold">{task.session_count}</div><div className="text-[9px] text-slate-500">会话数</div></div></div><div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200"><code className="text-[11px] truncate flex-1 text-slate-700">{taskLink(task)}</code><button onClick={() => copyLink(task)} className="text-[10px] font-mono">{copiedId === task.id ? '已复制 ✓' : '复制'}</button></div></div>)}</div>
  </div></AnalystLayout>
}
