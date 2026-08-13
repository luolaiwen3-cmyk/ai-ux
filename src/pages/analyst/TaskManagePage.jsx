import React, { useCallback, useEffect, useState } from 'react'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { api } from '../../lib/apiClient.js'

const DEFAULT_STEPS = [
  '确认购物车中的商品',
  '处理优惠券提示',
  '提交订单'
]

const statusLabels = {
  active: '进行中',
  draft: '草稿',
  paused: '已暂停'
}

export default function TaskManagePage() {
  const [tasks, setTasks] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [newTask, setNewTask] = useState({
    name: '',
    description: '',
    steps: DEFAULT_STEPS.join('\n'),
    status: 'active'
  })

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.tasks.list()
      setTasks(result.tasks)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadTasks()
  }, [loadTasks])

  const handleCreate = async () => {
    const steps = newTask.steps.split('\n').map((step) => step.trim()).filter(Boolean)
    if (!newTask.name.trim() || steps.length === 0) return
    setSaving(true)
    setError('')
    try {
      const result = await api.tasks.create({
        name: newTask.name.trim(),
        description: newTask.description.trim(),
        steps,
        status: newTask.status
      })
      setTasks((current) => [result.task, ...current])
      setNewTask({ name: '', description: '', steps: DEFAULT_STEPS.join('\n'), status: 'active' })
      setShowCreate(false)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (task, status) => {
    setError('')
    try {
      const result = await api.tasks.update(task.id, { status })
      setTasks((current) => current.map((item) => item.id === task.id ? result.task : item))
    } catch (err) {
      setError(err.message)
    }
  }

  const taskLink = (task) => `${window.location.origin}${window.location.pathname}#/join/${task.token}`

  const copyLink = async (task) => {
    try {
      await navigator.clipboard.writeText(taskLink(task))
      setCopiedId(task.id)
      window.setTimeout(() => setCopiedId(''), 1600)
    } catch {
      setError('复制失败，请手动选择测试链接')
    }
  }

  return (
    <AnalystLayout>
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">任务管理</h1>
            <p className="text-xs text-slate-500 mt-0.5">创建并发布真实可参与的测试任务</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-glow/90 to-cyan-soft/90 text-ink-900 text-xs font-semibold hover:shadow-glow transition-all"
          >
            + 新建任务
          </button>
        </div>

        {error && (
          <div role="alert" className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">
            {error}
          </div>
        )}

        {showCreate && (
          <div className="glass rounded-xl p-5 mb-6 animate-[fadeIn_.3s_ease-out]">
            <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-4">NEW_TASK · 创建新任务</div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Field label="任务名称">
                <input
                  value={newTask.name}
                  onChange={(event) => setNewTask({ ...newTask, name: event.target.value })}
                  placeholder="如：首页改版测试"
                  className="form-control"
                />
              </Field>
              <Field label="发布状态">
                <select
                  value={newTask.status}
                  onChange={(event) => setNewTask({ ...newTask, status: event.target.value })}
                  className="form-control"
                >
                  <option value="active">创建后立即发布</option>
                  <option value="draft">保存为草稿</option>
                </select>
              </Field>
              <Field label="被试说明">
                <textarea
                  value={newTask.description}
                  onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
                  rows={4}
                  placeholder="被试进入后看到的任务说明"
                  className="form-control resize-none"
                />
              </Field>
              <Field label="任务步骤（每行一项）">
                <textarea
                  value={newTask.steps}
                  onChange={(event) => setNewTask({ ...newTask, steps: event.target.value })}
                  rows={4}
                  className="form-control resize-none"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-slate-200 text-xs text-slate-600">取消</button>
              <button
                onClick={handleCreate}
                disabled={saving || !newTask.name.trim()}
                className="px-4 py-2 rounded-lg bg-slate-950 text-white text-xs font-medium disabled:opacity-50"
              >
                {saving ? '保存中…' : '创建任务'}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="glass rounded-xl p-10 text-center text-sm text-slate-500">正在加载任务…</div>
        ) : tasks.length === 0 ? (
          <div className="glass rounded-xl p-10 text-center text-sm text-slate-500">暂无任务，创建第一个测试任务吧。</div>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="glass rounded-xl p-4 hover:border-cyan-glow/25 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-500">{task.id.slice(0, 8)}</span>
                      <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${
                        task.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-500 border-emerald-500/20'
                          : 'bg-slate-500/10 text-slate-500 border-slate-300'
                      }`}>
                        {statusLabels[task.status]}
                      </span>
                    </div>
                    <div className="text-[14px] font-medium text-slate-100">{task.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">电商结算页 · {task.steps.length} 个步骤 · 创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <div className="text-[14px] font-semibold font-mono text-cyan-glow">{task.sessionCount}</div>
                      <div className="text-[9px] text-slate-500">会话数</div>
                    </div>
                    {task.status === 'active' ? (
                      <button onClick={() => updateStatus(task, 'paused')} className="px-2.5 py-1.5 rounded border border-slate-200 text-[10px] text-slate-600">暂停</button>
                    ) : (
                      <button onClick={() => updateStatus(task, 'active')} className="px-2.5 py-1.5 rounded border border-emerald-200 text-[10px] text-emerald-600">发布</button>
                    )}
                  </div>
                </div>

                {task.status === 'active' && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-900/60 border border-cyan-glow/10">
                    <span className="text-[10px] text-slate-500 shrink-0">测试链接：</span>
                    <code className="text-[11px] font-mono text-cyan-soft truncate flex-1">{taskLink(task)}</code>
                    <button onClick={() => copyLink(task)} className="px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-cyan-glow shrink-0">
                      {copiedId === task.id ? '已复制' : '复制'}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </AnalystLayout>
  )
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="text-[11px] text-slate-500 mb-1.5 block">{label}</span>
      {children}
    </label>
  )
}
