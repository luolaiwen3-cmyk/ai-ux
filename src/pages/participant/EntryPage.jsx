import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, saveParticipantSession } from '../../lib/apiClient.js'
import { initMediaPipe, startTracking, stopTracking } from '../../lib/mediaPipeTracker.js'

export default function EntryPage() {
  const { token } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [task, setTask] = useState(null)
  const [loadingTask, setLoadingTask] = useState(true)
  const [pageError, setPageError] = useState('')
  const [step, setStep] = useState('intro')
  const [checks, setChecks] = useState({ camera: 'pending', face: 'pending' })
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    let active = true
    api.participant.getTask(token)
      .then((result) => {
        if (active) setTask(result.task)
      })
      .catch((error) => {
        if (active) setPageError(error.message)
      })
      .finally(() => {
        if (active) setLoadingTask(false)
      })
    return () => { active = false }
  }, [token])

  const stopDevices = () => {
    stopTracking()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  useEffect(() => stopDevices, [])

  const startDeviceCheck = async () => {
    setStep('checking')
    setPageError('')
    setChecks({ camera: 'pending', face: 'pending' })

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: 'user' },
        audio: false
      })
      streamRef.current = stream
      if (!videoRef.current) throw new Error('摄像头画面未就绪')
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setChecks((current) => ({ ...current, camera: 'pass' }))

      const ready = await initMediaPipe()
      if (!ready) throw new Error('面部检测模型加载失败')

      let settled = false
      await new Promise((resolve, reject) => {
        const timeout = window.setTimeout(() => {
          if (!settled) {
            settled = true
            reject(new Error('未检测到面部，请正对摄像头后重试'))
          }
        }, 8000)

        startTracking(videoRef.current, (result) => {
          if (!settled && result.faceDetected) {
            settled = true
            window.clearTimeout(timeout)
            setChecks({ camera: 'pass', face: 'pass' })
            resolve()
          }
        }).then((started) => {
          if (!started && !settled) {
            settled = true
            window.clearTimeout(timeout)
            reject(new Error('面部检测无法启动'))
          }
        })
      })

      stopTracking()
      setStep('ready')
    } catch (error) {
      stopTracking()
      setChecks((current) => ({
        camera: current.camera === 'pass' ? 'pass' : 'fail',
        face: 'fail'
      }))
      setPageError(error.message || '设备检测失败')
      setStep('error')
    }
  }

  const handleStart = async () => {
    setCreating(true)
    setPageError('')
    try {
      const result = await api.participant.createSession(token)
      saveParticipantSession(result.session)
      stopDevices()
      navigate(`/calibrate/${result.session.id}`)
    } catch (error) {
      setPageError(error.message)
      setCreating(false)
    }
  }

  const handleBehaviorOnly = async () => {
    setCreating(true)
    setPageError('')
    try {
      const result = await api.participant.createSession(token)
      saveParticipantSession(result.session)
      await api.participant.startSession(result.session.id)
      stopDevices()
      navigate(`/task/${result.session.id}`, { state: { behaviorOnly: true } })
    } catch (error) {
      setPageError(error.message)
      setCreating(false)
    }
  }

  if (loadingTask) return <ParticipantState title="正在验证测试链接…" />
  if (!task) return <ParticipantState title="无法开始测试" detail={pageError || '测试链接无效或任务已暂停'} tone="error" />

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <ParticipantHeader />
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepDot label="说明" active={step === 'intro' || step === 'consent'} done={!['intro', 'consent'].includes(step)} />
            <StepLine done={!['intro', 'consent'].includes(step)} />
            <StepDot label="设备检测" active={['checking', 'error'].includes(step)} done={step === 'ready'} />
            <StepLine done={step === 'ready'} />
            <StepDot label="开始" active={step === 'ready'} done={false} />
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {step === 'intro' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-5 text-3xl">🛍️</div>
                <div className="text-[10px] uppercase tracking-widest text-orange-500 font-semibold mb-2">{task.name}</div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">感谢您参与本次用户体验测试</h1>
                <p className="text-sm text-slate-500 leading-relaxed mb-5">{task.description || '请像日常使用产品一样自然完成下列任务。'}</p>
                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                  <div className="text-xs font-medium text-slate-700 mb-2">任务步骤</div>
                  <ol className="text-xs text-slate-500 space-y-1.5">
                    {task.steps.map((item, index) => <li key={item}>{index + 1}. {item}</li>)}
                  </ol>
                </div>
                <button onClick={() => setStep('consent')} className="primary-button">我已了解，继续</button>
              </div>
            )}

            {step === 'consent' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5 text-3xl">🔒</div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">知情同意</h1>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">开始前，请确认您了解本次采集范围：</p>
                <div className="bg-blue-50 rounded-xl p-4 text-left mb-6 border border-blue-100">
                  <ul className="text-xs text-slate-600 space-y-2">
                    <ConsentItem>采集页面点击、滚动、停留和鼠标轨迹用于回放分析</ConsentItem>
                    <ConsentItem>采集面部关键点、情绪估测和低清缩略图，不保存连续原始视频</ConsentItem>
                    <ConsentItem>数据保存在本次 InsightUX 私有部署中，仅供 UX 研究使用</ConsentItem>
                    <ConsentItem>任务提交前可以主动退出并删除本次采集数据</ConsentItem>
                  </ul>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setStep('intro')} className="secondary-button">返回</button>
                  <button onClick={startDeviceCheck} className="primary-button">同意并检测设备</button>
                </div>
              </div>
            )}

            {step === 'checking' && (
              <DevicePanel videoRef={videoRef} checks={checks} title="正在检测摄像头与面部…" />
            )}

            {step === 'ready' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto mb-5 text-3xl">✓</div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">设备检测通过</h1>
                <p className="text-sm text-slate-500 mb-6">摄像头和真实面部检测均已就绪</p>
                <div className="space-y-3 mb-6">
                  <CheckItem label="摄像头权限" status="pass" />
                  <CheckItem label="MediaPipe 面部检测" status="pass" />
                </div>
                {pageError && <ErrorMessage>{pageError}</ErrorMessage>}
                <button onClick={handleStart} disabled={creating} className="primary-button disabled:opacity-50">
                  {creating ? '正在创建会话…' : '进入面部校准 →'}
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5 text-3xl">⚠️</div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">设备检测未通过</h1>
                <ErrorMessage>{pageError}</ErrorMessage>
                <div className="space-y-3 mb-6">
                  <CheckItem label="摄像头权限" status={checks.camera} />
                  <CheckItem label="MediaPipe 面部检测" status={checks.face} />
                </div>
                <div className="space-y-2">
                  <button onClick={startDeviceCheck} className="primary-button">重新检测</button>
                  <button onClick={handleBehaviorOnly} disabled={creating} className="secondary-button disabled:opacity-50">{creating ? '正在创建会话…' : '确认仅记录页面行为'}</button>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function ParticipantHeader() {
  return <header className="bg-white border-b border-slate-200"><div className="max-w-3xl mx-auto px-6 h-14 flex items-center"><div className="text-lg font-bold text-slate-900">Shop<span className="text-orange-500">Demo</span></div><span className="ml-3 text-xs text-slate-400">用户体验测试</span></div></header>
}

function ParticipantState({ title, detail, tone }) {
  return <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6"><div className="bg-white border border-slate-200 rounded-2xl p-8 max-w-sm text-center"><div className={`text-lg font-semibold ${tone === 'error' ? 'text-red-700' : 'text-slate-900'}`}>{title}</div>{detail && <p className="text-sm text-slate-500 mt-2">{detail}</p>}</div></div>
}

function DevicePanel({ videoRef, checks, title }) {
  return <div className="text-center"><div className="w-48 h-36 rounded-xl bg-slate-900 mx-auto mb-5 overflow-hidden"><video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" /></div><h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1><p className="text-sm text-slate-500 mb-6">请正对摄像头并保持光线充足</p><div className="space-y-3"><CheckItem label="摄像头权限" status={checks.camera} /><CheckItem label="MediaPipe 面部检测" status={checks.face} /></div></div>
}

function ConsentItem({ children }) {
  return <li className="flex gap-2"><span className="text-blue-500">✓</span><span>{children}</span></li>
}

function ErrorMessage({ children }) {
  return <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 mb-5">{children}</div>
}

function StepDot({ label, active, done }) {
  return <div className="flex flex-col items-center gap-1.5"><div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${done ? 'bg-emerald-500 text-white' : active ? 'bg-orange-500 text-white' : 'bg-slate-200 text-slate-400'}`}>{done ? '✓' : ''}</div><span className={`text-[10px] ${active ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>{label}</span></div>
}

function StepLine({ done }) {
  return <div className={`w-12 h-0.5 rounded ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
}

function CheckItem({ label, status }) {
  return <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50"><span className="text-sm text-slate-700">{label}</span>{status === 'pending' && <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-orange-500 animate-spin" />}{status === 'pass' && <span className="text-emerald-500 text-sm">✓ 通过</span>}{status === 'fail' && <span className="text-red-500 text-sm">✗ 未通过</span>}</div>
}
