import React, { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'

const CHANNEL = 'insightux-recorder'

const CustomWebTask = forwardRef(function CustomWebTask({ session, onEvents, onRecordingChange, onStopped, onComplete, disabled }, ref) {
  const frameRef = useRef(null)
  const nonceRef = useRef(crypto.randomUUID())
  const stopResolverRef = useRef(null)
  const [connection, setConnection] = useState('loading')
  const launchUrl = session.target.type === 'upload'
    ? `/test-content/${session.target.contentToken}/index.html`
    : session.target.url
  const expectedOrigin = useMemo(() => {
    if (session.target.type === 'upload') return 'null'
    try { return new URL(session.target.url).origin } catch { return '' }
  }, [session.target.type, session.target.url])

  useImperativeHandle(ref, () => ({
    stop() {
      if (connection === 'stopped') return Promise.resolve()
      return new Promise((resolve) => {
        stopResolverRef.current = resolve
        frameRef.current?.contentWindow?.postMessage({
          channel: CHANNEL, type: 'STOP', taskId: session.taskId, nonce: nonceRef.current
        }, session.target.type === 'upload' ? '*' : expectedOrigin)
        window.setTimeout(() => {
          if (stopResolverRef.current === resolve) {
            stopResolverRef.current = null
            resolve()
          }
        }, 1500)
      })
    }
  }), [connection, expectedOrigin, session.taskId, session.target.type])

  useEffect(() => {
    const timeout = window.setTimeout(() => setConnection('error'), 10000)
    const listener = (event) => {
      if (event.source !== frameRef.current?.contentWindow || event.origin !== expectedOrigin) return
      const data = event.data
      if (data?.channel !== CHANNEL || data.taskId !== session.taskId) return
      if (data.type === 'READY') {
        window.clearTimeout(timeout)
        frameRef.current.contentWindow.postMessage({
          channel: CHANNEL, type: 'START', taskId: session.taskId, nonce: nonceRef.current
        }, session.target.type === 'upload' ? '*' : expectedOrigin)
      }
      if (data.type === 'STARTED' && data.nonce === nonceRef.current) {
        setConnection('recording')
        onRecordingChange(true)
      }
      if (data.type === 'EVENT_BATCH' && data.nonce === nonceRef.current && Array.isArray(data.events)) onEvents(data.events)
      if (data.type === 'STOPPED' && data.nonce === nonceRef.current) {
        setConnection('stopped')
        onRecordingChange(false)
        onStopped(data.reason)
        stopResolverRef.current?.()
        stopResolverRef.current = null
      }
    }
    window.addEventListener('message', listener)
    return () => { window.clearTimeout(timeout); window.removeEventListener('message', listener) }
  }, [expectedOrigin, onEvents, onRecordingChange, onStopped, session.taskId, session.target.type])

  const sandbox = session.target.type === 'url'
    ? 'allow-scripts allow-forms allow-modals allow-popups allow-same-origin'
    : 'allow-scripts allow-forms allow-modals allow-popups'

  return <div className="h-screen w-full bg-slate-100 flex flex-col">
    <div className="h-12 shrink-0 bg-white border-b border-slate-200 px-4 flex items-center justify-between" data-no-record>
      <div className="min-w-0"><div className="text-xs font-medium text-slate-800 truncate">{session.taskName}</div><div className="text-[10px] text-slate-400 truncate">{session.steps.join(' · ')}</div></div>
      <button onClick={onComplete} disabled={disabled || connection === 'loading' || connection === 'error'} className="ml-4 px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-medium disabled:opacity-40">完成测试</button>
    </div>
    {connection === 'error' && <div role="alert" className="m-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-xs text-red-700">测试网页无法连接录制 SDK，请退出并联系研究人员。</div>}
    <iframe ref={frameRef} title={session.taskName} src={launchUrl} sandbox={sandbox} className="flex-1 w-full border-0 bg-white" />
  </div>
})

export default CustomWebTask

