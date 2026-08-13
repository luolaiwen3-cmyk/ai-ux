import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, clearParticipantSession } from '../../lib/apiClient.js'
import { getCameraStream, initMediaPipe, startTracking, stopTracking } from '../../lib/mediaPipeTracker.js'

const CALIBRATION_MS = 2500

export default function CalibratePage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const faceSinceRef = useRef(null)
  const finishedRef = useRef(false)
  const [phase, setPhase] = useState('starting')
  const [progress, setProgress] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState(null)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      try {
        await api.participant.getSession(sessionId)
        const [modelReady, stream] = await Promise.all([initMediaPipe(), getCameraStream()])
        if (cancelled) {
          stream?.getTracks().forEach((track) => track.stop())
          return
        }
        if (!modelReady) throw new Error('MediaPipe 面部模型加载失败')
        if (!stream) throw new Error('无法访问摄像头')

        streamRef.current = stream
        if (!videoRef.current) throw new Error('摄像头画面未就绪')
        videoRef.current.srcObject = stream
        await videoRef.current.play()
        setPhase('calibrating')

        const started = await startTracking(videoRef.current, (result) => {
          if (cancelled || finishedRef.current) return
          setFaceDetected(result.faceDetected)
          setCurrentEmotion(result.emotion || null)
          if (!result.faceDetected) {
            faceSinceRef.current = null
            setProgress(0)
            return
          }

          if (faceSinceRef.current === null) faceSinceRef.current = performance.now()
          const nextProgress = Math.min(100, Math.round((performance.now() - faceSinceRef.current) / CALIBRATION_MS * 100))
          setProgress(nextProgress)
          if (nextProgress >= 100) {
            finishedRef.current = true
            stopTracking()
            setPhase('done')
          }
        })
        if (!started) throw new Error('面部追踪无法启动')
      } catch (runError) {
        if (!cancelled) {
          setError(runError.message)
          setPhase('error')
        }
      }
    }

    run()
    return () => {
      cancelled = true
      stopTracking()
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [sessionId])

  const continueToTask = async (behaviorOnly = false) => {
    setSubmitting(true)
    setError('')
    try {
      await api.participant.startSession(sessionId)
      stopTracking()
      streamRef.current?.getTracks().forEach((track) => track.stop())
      navigate(`/task/${sessionId}`, { state: { behaviorOnly } })
    } catch (requestError) {
      setError(requestError.message)
      setSubmitting(false)
    }
  }

  const cancelSession = async () => {
    try {
      await api.participant.abandonSession(sessionId)
    } finally {
      clearParticipantSession(sessionId)
      navigate('/', { replace: true })
    }
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <header className="bg-white border-b border-slate-200"><div className="max-w-3xl mx-auto px-6 h-14 flex items-center"><div className="text-lg font-bold text-slate-900">Insight<span className="text-orange-500">UX</span></div><span className="ml-3 text-xs text-slate-400">面部校准</span></div></header>
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
          <div className="relative w-64 h-48 mx-auto rounded-xl overflow-hidden bg-slate-900 mb-6">
            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
            <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">{Array.from({ length: 16 }).map((_, index) => <div key={index} className="border border-white/10" />)}</div>
            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-36 rounded-[40%] border-2 ${faceDetected ? 'border-emerald-400' : 'border-white/40'}`} />
            {phase === 'calibrating' && <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60 animate-[scan_1.5s_linear_infinite]" />}
            <div className="absolute bottom-2 left-2 right-2 flex justify-between"><span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${faceDetected ? 'bg-emerald-500/80 text-white' : 'bg-black/50 text-white/70'}`}>{faceDetected ? 'FACE DETECTED' : 'SEARCHING…'}</span><span className="text-[9px] font-mono text-white/70 bg-black/40 px-1.5 py-0.5 rounded">{progress}%</span></div>
          </div>

          {currentEmotion && faceDetected && <div className="mb-4 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-600">实时状态：<span className="font-medium">{currentEmotion.label} ({(currentEmotion.value * 100).toFixed(0)}%)</span></div>}

          {phase === 'starting' && <><h1 className="text-lg font-semibold text-slate-900 mb-1">正在启动面部模型…</h1><p className="text-sm text-slate-500">首次加载可能需要几秒</p></>}
          {phase === 'calibrating' && <><h1 className="text-lg font-semibold text-slate-900 mb-1">请连续保持面部在框内</h1><p className="text-sm text-slate-500 mb-4">检测中断时会重新开始计时</p><div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all" style={{ width: `${progress}%` }} /></div></>}
          {phase === 'done' && <><div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4 text-emerald-600 text-xl">✓</div><h1 className="text-lg font-semibold text-slate-900 mb-1">校准完成</h1><p className="text-sm text-slate-500 mb-6">面部捕捉已就绪，可以开始任务</p>{error && <ErrorMessage>{error}</ErrorMessage>}<button onClick={() => continueToTask(false)} disabled={submitting} className="primary-button disabled:opacity-50">{submitting ? '正在开始…' : '开始任务 →'}</button></>}
          {phase === 'error' && <><div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4 text-xl">⚠</div><h1 className="text-lg font-semibold text-slate-900 mb-1">面部校准不可用</h1><ErrorMessage>{error}</ErrorMessage><p className="text-xs text-slate-500 mb-4">您可以退出并删除本次会话，或明确选择仅记录页面行为。</p><div className="space-y-2"><button onClick={() => continueToTask(true)} disabled={submitting} className="primary-button disabled:opacity-50">仅记录行为并继续</button><button onClick={cancelSession} className="secondary-button">退出并删除数据</button></div></>}
        </div>
      </main>
    </div>
  )
}

function ErrorMessage({ children }) {
  return <div role="alert" className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2 my-4">{children}</div>
}
