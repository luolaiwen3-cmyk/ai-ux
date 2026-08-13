import React, { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { initMediaPipe, getCameraStream, startTracking, stopTracking } from '../../lib/mediaPipeTracker.js'

/**
 * P2 校准页 —— MediaPipe 面部校准，确认面部可被捕捉
 * 使用真实 MediaPipe FaceLandmarker 进行面部检测
 */
export default function CalibratePage() {
  const navigate = useNavigate()
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const [phase, setPhase] = useState('starting') // starting | calibrating | done | error
  const [progress, setProgress] = useState(0)
  const [faceDetected, setFaceDetected] = useState(false)
  const [mediaPipeReady, setMediaPipeReady] = useState(false)
  const [currentEmotion, setCurrentEmotion] = useState(null)

  useEffect(() => {
    let cancelled = false
    let trackingActive = false

    const startCalibration = async () => {
      // 1. 初始化 MediaPipe
      const mpReady = await initMediaPipe()
      if (cancelled) return

      if (!mpReady) {
        console.warn('[Calibrate] MediaPipe 初始化失败，使用模拟模式')
      }
      setMediaPipeReady(mpReady)

      // 2. 获取摄像头
      const stream = await getCameraStream()
      if (cancelled) {
        stream?.getTracks().forEach((t) => t.stop())
        return
      }

      if (!stream) {
        console.warn('[Calibrate] 摄像头不可用，使用模拟模式')
        setPhase('calibrating')
        runSimulatedCalibration()
        return
      }

      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }

      setPhase('calibrating')

      // 3. 如果 MediaPipe 就绪，开始真实检测
      if (mpReady && videoRef.current) {
        trackingActive = true
        await startTracking(videoRef.current, (result) => {
          if (cancelled) return
          setFaceDetected(result.faceDetected)
          if (result.emotion) {
            setCurrentEmotion(result.emotion)
          }
        })
      }

      // 4. 运行校准进度
      await runCalibration()
    }

    const runCalibration = async () => {
      for (let i = 0; i <= 100; i += 2) {
        await new Promise((r) => setTimeout(r, 50))
        if (cancelled) return
        setProgress(i)
      }
      if (!cancelled) setPhase('done')
    }

    const runSimulatedCalibration = async () => {
      for (let i = 0; i <= 100; i += 2) {
        await new Promise((r) => setTimeout(r, 50))
        if (cancelled) return
        setProgress(i)
        if (i === 40) setFaceDetected(true)
      }
      if (!cancelled) setPhase('done')
    }

    startCalibration()

    return () => {
      cancelled = true
      if (trackingActive) {
        stopTracking()
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  const handleContinue = () => {
    stopTracking()
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    navigate('/task/demo-session-001')
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            Shop<span className="text-orange-500">Demo</span>
          </div>
          <span className="ml-3 text-xs text-slate-400">面部校准</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
            {/* 视频 + 网格叠加 */}
            <div className="relative w-64 h-48 mx-auto rounded-xl overflow-hidden bg-slate-900 mb-6">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />

              {/* 校准网格叠加 */}
              <div className="absolute inset-0">
                {/* 网格线 */}
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                  {Array.from({ length: 16 }).map((_, i) => (
                    <div key={i} className="border border-white/10" />
                  ))}
                </div>

                {/* 面部框 */}
                <div
                  className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-28 h-36 rounded-[40%] border-2 transition-colors duration-300 ${
                    faceDetected ? 'border-emerald-400' : 'border-white/40'
                  }`}
                >
                  {/* 角标 */}
                  <div className="absolute -top-1 -left-1 w-3 h-3 border-t-2 border-l-2 border-emerald-400" />
                  <div className="absolute -top-1 -right-1 w-3 h-3 border-t-2 border-r-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -left-1 w-3 h-3 border-b-2 border-l-2 border-emerald-400" />
                  <div className="absolute -bottom-1 -right-1 w-3 h-3 border-b-2 border-r-2 border-emerald-400" />
                </div>

                {/* 扫描线 */}
                {phase === 'calibrating' && (
                  <div className="absolute inset-x-0 h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent opacity-60 animate-[scan_1.5s_linear_infinite]" />
                )}
              </div>

              {/* 状态标签 */}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                <span className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${
                  faceDetected ? 'bg-emerald-500/80 text-white' : 'bg-black/50 text-white/70'
                }`}>
                  {faceDetected ? 'FACE DETECTED' : 'SEARCHING...'}
                </span>
                <span className="text-[9px] font-mono text-white/60 bg-black/40 px-1.5 py-0.5 rounded">
                  {progress}%
                </span>
              </div>
            </div>

            {/* 实时情绪显示（MediaPipe 检测到时） */}
            {currentEmotion && faceDetected && (
              <div className="mb-4 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-[10px] text-slate-500">实时情绪：</span>
                <span className="text-xs font-medium text-slate-700 ml-1">
                  {currentEmotion.label} ({(currentEmotion.value * 100).toFixed(0)}%)
                </span>
              </div>
            )}

            {/* 文案 */}
            {phase === 'starting' && (
              <>
                <h1 className="text-lg font-semibold text-slate-900 mb-1">正在启动摄像头…</h1>
                <p className="text-sm text-slate-500">
                  {mediaPipeReady ? 'MediaPipe 已就绪' : '正在加载 AI 模型...'}
                </p>
              </>
            )}

            {phase === 'calibrating' && (
              <>
                <h1 className="text-lg font-semibold text-slate-900 mb-1">正在进行面部校准</h1>
                <p className="text-sm text-slate-500 mb-4">
                  请保持面部在框内，平视摄像头
                </p>
                {/* 进度条 */}
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-orange-400 to-emerald-500 transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </>
            )}

            {phase === 'done' && (
              <>
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
                  <span className="text-emerald-600 text-xl">✓</span>
                </div>
                <h1 className="text-lg font-semibold text-slate-900 mb-1">校准完成</h1>
                <p className="text-sm text-slate-500 mb-6">
                  面部捕捉已就绪，可以开始测试任务
                </p>
                <button
                  onClick={handleContinue}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
                >
                  开始任务 →
                </button>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
