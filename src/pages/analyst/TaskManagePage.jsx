import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import { api, saveParticipantSession } from '../../lib/apiClient.js'

const DEFAULT_STEPS = ['确认页面内容', '完成指定操作', '点击完成测试']
const statusLabels = { active: '进行中', draft: '草稿', paused: '已暂停' }
const targetLabels = { builtin: '内置结算模板', upload: '上传静态网站', url: '外部 URL' }
const initialTask = () => ({
  name: '', description: '', steps: DEFAULT_STEPS.join('\n'), status: 'active',
  targetType: 'builtin', targetUrl: '', siteFile: null
})

export default function TaskManagePage() {
  const navigate = useNavigate()
  const [tasks, setTasks] = useState([])
  const [publicAppUrl, setPublicAppUrl] = useState(window.location.origin)
  const [showCreate, setShowCreate] = useState(false)
  const [createStep, setCreateStep] = useState(1)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [copiedId, setCopiedId] = useState('')
  const [editingId, setEditingId] = useState('')
  const [editTask, setEditTask] = useState(null)
  const [validatingId, setValidatingId] = useState('')
  const [newTask, setNewTask] = useState(initialTask)

  const loadTasks = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const result = await api.tasks.list()
      setTasks(result.data)
      if (result.meta.publicAppUrl) setPublicAppUrl(result.meta.publicAppUrl)
    } catch (requestError) {
      setError(requestError.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadTasks() }, [loadTasks])

  const replaceTask = (task) => setTasks((current) => current.map((item) => item.id === task.id ? task : item))

  const handleCreate = async () => {
    const steps = parseSteps(newTask.steps)
    if (!newTask.name.trim() || steps.length === 0) return
    if (newTask.targetType === 'upload' && !newTask.siteFile) {
      setError('请选择包含 index.html 的 ZIP 文件')
      return
    }
    setSaving(true)
    setError('')
    try {
      const requestedStatus = newTask.status
      const result = await api.tasks.create({
        name: newTask.name.trim(), description: newTask.description.trim(), steps,
        targetType: newTask.targetType,
        targetUrl: newTask.targetType === 'url' ? newTask.targetUrl.trim() : undefined,
        status: newTask.targetType === 'builtin' ? requestedStatus : 'draft'
      })
      let task = result
      if (newTask.targetType === 'upload') {
        task = (await api.tasks.uploadSite(task.id, newTask.siteFile)).task
        if (requestedStatus === 'active') task = await api.tasks.update(task.id, { status: 'active' })
      }
      setTasks((current) => [task, ...current])
      setNewTask(initialTask())
      setCreateStep(1)
      setShowCreate(false)
      if (task.targetType === 'url') setValidatingId(task.id)
    } catch (requestError) {
      setError(requestError.message)
      await loadTasks()
    } finally {
      setSaving(false)
    }
  }

  const updateStatus = async (task, status) => {
    setError('')
    try { replaceTask(await api.tasks.update(task.id, { status })) }
    catch (requestError) { setError(requestError.message) }
  }

  const startTrial = async (task) => {
    setSaving(true)
    setError('')
    try {
      const result = await api.tasks.createTrial(task.id)
      saveParticipantSession(result)
      navigate(`/calibrate/${result.id}`, { state: { trial: true } })
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  const uploadReplacement = async (task, file) => {
    if (!file) return
    setSaving(true)
    setError('')
    try { replaceTask((await api.tasks.uploadSite(task.id, file)).task) }
    catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  const beginEdit = (task) => {
    setEditingId(task.id)
    setEditTask({ name: task.name, description: task.description, steps: task.steps.join('\n'), targetUrl: task.targetUrl || '' })
  }

  const saveEdit = async () => {
    const steps = parseSteps(editTask.steps)
    if (!editTask.name.trim() || steps.length === 0) return
    setSaving(true)
    setError('')
    try {
      const current = tasks.find((item) => item.id === editingId)
      const result = await api.tasks.update(editingId, {
        name: editTask.name.trim(), description: editTask.description.trim(), steps,
        ...(current?.targetType === 'url' ? { targetUrl: editTask.targetUrl.trim() } : {})
      })
      replaceTask(result)
      setEditingId('')
      setEditTask(null)
    } catch (requestError) { setError(requestError.message) }
    finally { setSaving(false) }
  }

  const taskLink = (task) => `${window.location.origin}${window.location.pathname}#/join/${task.token}`
  const targetUrl = (task) => task.targetType === 'upload'
    ? `/test-content/${task.contentToken}/index.html`
    : task.targetUrl
  const sdkSnippet = (task) => {
    const sdkOrigin = new URL(publicAppUrl, window.location.origin).origin
    return `<script src="${sdkOrigin}/insightux-recorder.js" data-task-id="${task.id}" data-parent-origin="${window.location.origin}"></script>`
  }

  const copyText = async (id, value) => {
    try {
      await navigator.clipboard.writeText(value)
      setCopiedId(id)
      window.setTimeout(() => setCopiedId(''), 1600)
    } catch { setError('复制失败，请手动选择文本') }
  }

  return (
    <AnalystLayout>
      <div className="analyst-page">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
          <div><div className="analyst-eyebrow mb-1.5">Research tasks</div><h1 className="analyst-title">任务管理</h1><p className="analyst-subtitle">创建测试、接入目标网页并分享给参与者</p></div>
          <button onClick={() => { setShowCreate(true); setCreateStep(1) }} className="self-start sm:self-auto px-4 py-2.5 rounded-xl bg-slate-950 hover:bg-indigo-600 text-white text-xs font-semibold shadow-sm transition-colors">+ 新建任务</button>
        </div>

        {error && <div role="alert" className="mb-4 px-4 py-3 rounded-lg border border-red-200 bg-red-50 text-sm text-red-700">{error}</div>}
        {showCreate && <CreateWizard task={newTask} setTask={setNewTask} step={createStep} setStep={setCreateStep} saving={saving} onCreate={handleCreate} onCancel={() => setShowCreate(false)} />}

        {loading ? <EmptyState title="正在加载任务…" /> : tasks.length === 0 ? <EmptyState title="暂无任务，创建第一个测试任务吧。" /> : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <div key={task.id} className="glass rounded-2xl p-4 sm:p-5 hover:border-indigo-200 transition-colors">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono text-slate-500">{task.id.slice(0, 8)}</span>
                      <Badge tone={task.status === 'active' ? 'green' : 'gray'}>{statusLabels[task.status]}</Badge>
                      <Badge tone={task.targetStatus === 'ready' ? 'cyan' : 'amber'}>{targetLabels[task.targetType]} · {task.targetStatus === 'ready' ? '已验证' : '待验证'}</Badge>
                    </div>
                    <div className="text-[14px] font-medium text-slate-100">{task.name}</div>
                    <div className="text-[11px] text-slate-500 mt-0.5">{task.steps.length} 个步骤 · 创建于 {new Date(task.createdAt).toLocaleDateString('zh-CN')}</div>
                    {task.description && <p className="text-[11px] text-slate-500 mt-1 line-clamp-2">{task.description}</p>}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end lg:max-w-md">
                    <div className="text-right mr-2"><div className="text-[14px] font-semibold font-mono text-cyan-glow">{task.sessionCount}</div><div className="text-[9px] text-slate-500">正式会话</div></div>
                    {task.targetStatus === 'ready' && task.targetType !== 'builtin' && <button onClick={() => window.open(targetUrl(task), '_blank', 'noopener,noreferrer')} className="task-action">预览</button>}
                    {task.targetStatus === 'ready' && <button onClick={() => startTrial(task)} disabled={saving} className="task-action disabled:opacity-40">试跑</button>}
                    {task.targetType === 'url' && <button onClick={() => setValidatingId(validatingId === task.id ? '' : task.id)} className="task-action">{task.targetStatus === 'ready' ? '重新验证' : '接入并验证'}</button>}
                    {task.targetType === 'upload' && <label className="task-action cursor-pointer">替换 ZIP<input type="file" accept=".zip,application/zip" className="hidden" onChange={(event) => uploadReplacement(task, event.target.files?.[0])} /></label>}
                    <button onClick={() => beginEdit(task)} className="task-action">编辑</button>
                    {task.status === 'active'
                      ? <button onClick={() => updateStatus(task, 'paused')} className="task-action">暂停</button>
                      : <button onClick={() => updateStatus(task, 'active')} disabled={task.targetStatus !== 'ready'} className="task-action disabled:opacity-40">发布</button>}
                  </div>
                </div>

                {validatingId === task.id && task.targetType === 'url' && <UrlValidator task={task} snippet={sdkSnippet(task)} onValidated={(updated) => { replaceTask(updated); setValidatingId('') }} onCopy={() => copyText(`sdk-${task.id}`, sdkSnippet(task))} copied={copiedId === `sdk-${task.id}`} />}
                {editingId === task.id && editTask && <EditForm task={task} value={editTask} setValue={setEditTask} saving={saving} onSave={saveEdit} onCancel={() => { setEditingId(''); setEditTask(null) }} />}

                {task.status === 'active' && <div className="mt-4 flex items-center gap-2 px-3 py-2.5 rounded-xl bg-slate-50 border border-slate-200"><span className="text-[10px] text-slate-500 shrink-0">测试链接</span><code className="text-[11px] font-mono text-indigo-600 truncate flex-1">{taskLink(task)}</code><button onClick={() => copyText(task.id, taskLink(task))} className="px-2 py-1 rounded-md text-[10px] font-medium text-indigo-600 hover:bg-indigo-50">{copiedId === task.id ? '已复制' : '复制'}</button></div>}
              </div>
            ))}
          </div>
        )}
      </div>
    </AnalystLayout>
  )
}

function CreateWizard({ task, setTask, step, setStep, saving, onCreate, onCancel }) {
  const canContinue = step === 1
    ? task.name.trim() && parseSteps(task.steps).length
    : step === 2
      ? (task.targetType === 'upload' ? task.siteFile : task.targetType !== 'url' || task.targetUrl.trim())
      : true
  return <div className="glass rounded-xl p-5 mb-6">
    <div className="flex items-center gap-3 mb-5">{['基本信息', '测试网页', '确认创建'].map((label, index) => <React.Fragment key={label}><div className={`text-xs ${step === index + 1 ? 'text-cyan-glow' : step > index + 1 ? 'text-emerald-400' : 'text-slate-500'}`}>{index + 1}. {label}</div>{index < 2 && <div className="h-px flex-1 bg-slate-700" />}</React.Fragment>)}</div>
    {step === 1 && <div className="grid grid-cols-1 md:grid-cols-2 gap-4"><Field label="任务名称"><input value={task.name} onChange={(event) => setTask({ ...task, name: event.target.value })} placeholder="如：首页导航测试" className="form-control" /></Field><Field label="被试说明"><textarea rows={4} value={task.description} onChange={(event) => setTask({ ...task, description: event.target.value })} className="form-control resize-none" /></Field><div className="md:col-span-2"><Field label="任务步骤（每行一项）"><textarea rows={4} value={task.steps} onChange={(event) => setTask({ ...task, steps: event.target.value })} className="form-control resize-none" /></Field></div></div>}
    {step === 2 && <div><div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">{[['builtin', '内置结算模板', '立即可用，保留现有优惠券演示'], ['upload', '上传网站 ZIP', '由 InsightUX 安全托管静态网页'], ['url', '外部网页 URL', '需在目标站安装录制 SDK']].map(([type, title, detail]) => <button key={type} type="button" onClick={() => setTask({ ...task, targetType: type, status: type === 'url' ? 'draft' : task.status })} className={`text-left rounded-xl border p-4 ${task.targetType === type ? 'border-cyan-glow bg-cyan-glow/10' : 'border-slate-700'}`}><div className="text-sm text-slate-100">{title}</div><div className="text-[11px] text-slate-500 mt-1">{detail}</div></button>)}</div>{task.targetType === 'upload' && <Field label="网站 ZIP（根目录必须包含 index.html）"><input type="file" accept=".zip,application/zip" onChange={(event) => setTask({ ...task, siteFile: event.target.files?.[0] || null })} className="form-control" /></Field>}{task.targetType === 'url' && <Field label="测试网页 URL"><input value={task.targetUrl} onChange={(event) => setTask({ ...task, targetUrl: event.target.value })} placeholder="https://product.example.com/test" className="form-control" /></Field>}</div>}
    {step === 3 && <div className="rounded-xl border border-slate-700 p-4 text-xs text-slate-400 space-y-2"><p>任务：<span className="text-slate-100">{task.name}</span></p><p>网页：<span className="text-slate-100">{targetLabels[task.targetType]}</span></p>{task.targetType === 'url' && <p className="text-amber-400">创建后需安装 SDK 并通过连接验证，之后才能发布。</p>}<Field label="创建后状态"><select value={task.status} onChange={(event) => setTask({ ...task, status: event.target.value })} disabled={task.targetType === 'url'} className="form-control"><option value="active">验证后立即发布</option><option value="draft">保存为草稿</option></select></Field></div>}
    <div className="flex justify-between mt-5"><button onClick={step === 1 ? onCancel : () => setStep(step - 1)} className="task-action">{step === 1 ? '取消' : '上一步'}</button>{step < 3 ? <button onClick={() => setStep(step + 1)} disabled={!canContinue} className="px-4 py-2 rounded-lg bg-slate-950 text-white text-xs disabled:opacity-40">下一步</button> : <button onClick={onCreate} disabled={saving} className="px-4 py-2 rounded-lg bg-cyan-glow text-ink-900 text-xs font-semibold disabled:opacity-40">{saving ? '创建中…' : '创建任务'}</button>}</div>
  </div>
}

function UrlValidator({ task, snippet, onValidated, onCopy, copied }) {
  const frameRef = useRef(null)
  const [state, setState] = useState('waiting')
  const [message, setMessage] = useState('请先把下方 SDK 代码加入目标网页，然后等待连接。')
  const origin = useMemo(() => { try { return new URL(task.targetUrl).origin } catch { return '' } }, [task.targetUrl])
  useEffect(() => {
    const timeout = window.setTimeout(() => { setState('error'); setMessage('10 秒内未收到 SDK 握手。请确认代码已部署且网页允许 iframe。') }, 10000)
    const listener = async (event) => {
      const data = event.data
      if (event.source !== frameRef.current?.contentWindow || event.origin !== origin) return
      if (data?.channel !== 'insightux-recorder' || data.type !== 'READY' || data.taskId !== task.id) return
      window.clearTimeout(timeout)
      setState('checking')
      setMessage('SDK 已连接，正在保存验证结果…')
      try {
        const result = await api.tasks.validateUrl(task.id, { origin: event.origin, sdkVersion: data.version })
        setState('ready')
        setMessage('验证通过，可以发布并试跑。')
        onValidated(result)
      } catch (error) { setState('error'); setMessage(error.message) }
    }
    window.addEventListener('message', listener)
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', listener) }
  }, [task.id, origin, onValidated])
  return <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 lg:grid-cols-2 gap-4"><div><div className="text-xs text-slate-300 mb-2">1. 将录制 SDK 放入目标网页的 HTML：</div><div className="rounded-lg bg-black/40 border border-slate-700 p-3 flex gap-2"><code className="text-[10px] text-cyan-soft break-all flex-1">{snippet}</code><button onClick={onCopy} className="text-[10px] text-slate-400 shrink-0">{copied ? '已复制' : '复制'}</button></div><div className={`mt-3 text-xs ${state === 'error' ? 'text-red-400' : state === 'ready' ? 'text-emerald-400' : 'text-amber-400'}`}>{message}</div></div><div className="rounded-lg overflow-hidden bg-white h-56"><iframe ref={frameRef} title={`验证 ${task.name}`} src={task.targetUrl} sandbox="allow-scripts allow-forms allow-modals allow-popups allow-same-origin" className="w-full h-full border-0" /></div></div>
}

function EditForm({ task, value, setValue, saving, onSave, onCancel }) {
  return <div className="mt-4 pt-4 border-t border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3"><Field label="任务名称"><input value={value.name} onChange={(event) => setValue({ ...value, name: event.target.value })} className="form-control" /></Field><Field label="被试说明"><textarea rows={3} value={value.description} onChange={(event) => setValue({ ...value, description: event.target.value })} className="form-control resize-none" /></Field>{task.targetType === 'url' && <div className="md:col-span-2"><Field label="测试网页 URL（修改后需要重新验证）"><input value={value.targetUrl} onChange={(event) => setValue({ ...value, targetUrl: event.target.value })} className="form-control" /></Field></div>}<div className="md:col-span-2"><Field label="任务步骤（每行一项）"><textarea rows={3} value={value.steps} onChange={(event) => setValue({ ...value, steps: event.target.value })} className="form-control resize-none" /></Field></div><div className="md:col-span-2 flex justify-end gap-2"><button onClick={onCancel} className="task-action">取消</button><button onClick={onSave} disabled={saving} className="px-3 py-2 rounded-lg bg-slate-950 text-white text-xs disabled:opacity-50">{saving ? '保存中…' : '保存修改'}</button></div></div>
}

function Field({ label, children }) { return <label className="block"><span className="text-[11px] text-slate-500 mb-1.5 block">{label}</span>{children}</label> }
function Badge({ tone, children }) { const colors = { green: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20', cyan: 'bg-cyan-glow/10 text-cyan-glow border-cyan-glow/20', amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20', gray: 'bg-slate-500/10 text-slate-500 border-slate-700' }; return <span className={`px-1.5 py-0.5 rounded text-[9px] font-mono border ${colors[tone]}`}>{children}</span> }
function EmptyState({ title }) { return <div className="glass rounded-xl p-10 text-center text-sm text-slate-500">{title}</div> }
function parseSteps(value) { return value.split('\n').map((step) => step.trim()).filter(Boolean) }
