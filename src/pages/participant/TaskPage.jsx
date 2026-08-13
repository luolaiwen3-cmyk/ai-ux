import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import CheckoutPage from '../../components/participant/CheckoutPage.jsx'
import { startRecording, stopRecording, saveToStorage, deleteSession } from '../../lib/rrwebRecorder.js'
import { initMediaPipe, getCameraStream, startTracking, stopTracking, saveFrame, loadFrames, deleteFaceSession } from '../../lib/mediaPipeTracker.js'
import { api, clearParticipantSession, getParticipantToken } from '../../lib/apiClient.js'

/**
 * P3 测试任务页 —— 被试实际操作的核心页面
 * 真实比例的电商结算页，可交互
 * + rrweb 行为录制（含安全截断机制）
 * + MediaPipe 面部采集（后台静默运行）
 */
export default function TaskPage() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const [recording, setRecording] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const [stopReason, setStopReason] = useState(null)
  const [couponDecision, setCouponDecision] = useState('none')
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [sessionReady, setSessionReady] = useState(false)
  const recordingRef = useRef(false)
  const pendingPayloadRef = useRef(null)
  const eventCountRef = useRef(0)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const lastFaceCaptureRef = useRef(0)

  // 先校验匿名会话凭证，再开始任何采集。
  useEffect(() => {
    let cancelled = false
    if (!getParticipantToken(sessionId)) {
      navigate('/', { replace: true })
      return undefined
    }

    api.participant.getSession(sessionId)
      .then(({ session }) => {
        if (cancelled) return
        if (!['created', 'recording'].includes(session.status)) {
          navigate('/thanks', { replace: true })
          return
        }
        setSessionReady(true)
      })
      .catch(() => {
        if (!cancelled) navigate('/', { replace: true })
      })

    return () => { cancelled = true }
  }, [sessionId, navigate])

  // 会话通过服务端校验后开始录制 + 面部采集。
  useEffect(() => {
    if (!sessionReady) return undefined

    // 1. 开始 rrweb 录制
    const onEvent = (event) => {
      if (event.type === '_stopped') {
        setStopReason(event.reason)
        return
      }
      eventCountRef.current += 1
    }
    startRecording(onEvent)
    setRecording(true)
    recordingRef.current = true

    // 每 500ms 同步一次计数到 state
    const timer = setInterval(() => {
      if (eventCountRef.current > 0) {
        setEventCount(eventCountRef.current)
      }
    }, 500)

    // 2. 开始 MediaPipe 面部采集（后台静默）
    if (!location.state?.behaviorOnly) startFaceCapture()

    return () => {
      clearInterval(timer)
      // 停止录制并保存
      if (recordingRef.current) stopRecording()
      // 停止面部采集
      stopTracking()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
      if (videoRef.current) {
        videoRef.current.srcObject = null
        videoRef.current.remove()
        videoRef.current = null
      }
    }
  }, [sessionId, sessionReady, location.state?.behaviorOnly])

  // 启动面部采集
  const startFaceCapture = async () => {
    try {
      // 初始化 MediaPipe
      const mpReady = await initMediaPipe()
      if (!mpReady) {
        console.warn('[TaskPage] MediaPipe 不可用，跳过面部采集')
        return
      }

      // 获取摄像头（后台静默，不显示视频）
      const stream = await getCameraStream()
      if (!stream) {
        console.warn('[TaskPage] 摄像头不可用，跳过面部采集')
        return
      }
      streamRef.current = stream

      // 创建隐藏视频元素用于推理
      if (!videoRef.current) {
        const video = document.createElement('video')
        video.srcObject = stream
        video.play()
        video.style.display = 'none'
        document.body.appendChild(video)
        videoRef.current = video
      }

      // 开始追踪
      await startTracking(videoRef.current, (result) => {
        // 降采样存储：每 200ms 存一帧
        const now = Date.now()
        if (now - lastFaceCaptureRef.current > 200) {
          lastFaceCaptureRef.current = now
          saveFrame(sessionId, result)
        }
      })
    } catch (err) {
      console.error('[TaskPage] 面部采集启动失败:', err)
    }
  }

  const submitPayload = useCallback(async (payload) => {
    setSubmitting(true)
    setSubmitError('')
    try {
      await api.participant.completeSession(sessionId, payload)
      pendingPayloadRef.current = null
      deleteSession(sessionId)
      deleteFaceSession(sessionId)
      clearParticipantSession(sessionId)
      navigate('/thanks', { replace: true })
    } catch (error) {
      setSubmitError(`${error.message}。录制数据已暂存在本机，请重试提交。`)
      setSubmitting(false)
    }
  }, [sessionId, navigate])

  // 任务完成 —— 只有点击"提交订单"才停止录制 → 保存后进入感谢页
  const handleTaskComplete = useCallback(async ({ selectedCount, couponApplied }) => {
    if (!recordingRef.current || submitting) return // 防止重复触发
    const events = stopRecording()
    recordingRef.current = false
    setRecording(false)
    setEventCount(events.length)

    // 本地备份用于网络失败重试
    saveToStorage(sessionId)
    stopTracking()
    streamRef.current?.getTracks().forEach((track) => track.stop())

    const firstTimestamp = events[0]?.timestamp || Date.now()
    const lastTimestamp = events.at(-1)?.timestamp || firstTimestamp
    const payload = {
      events,
      faceFrames: location.state?.behaviorOnly ? [] : loadFrames(sessionId),
      couponDecision: couponDecision === 'none' && couponApplied ? 'applied' : couponDecision,
      duration: Math.max(0, lastTimestamp - firstTimestamp),
      metrics: { selectedCount, couponApplied }
    }
    pendingPayloadRef.current = payload
    await submitPayload(payload)
  }, [sessionId, couponDecision, location.state?.behaviorOnly, submitting, submitPayload])

  const handleExit = async () => {
    if (!window.confirm('确认退出？尚未提交的数据将从服务器和本机删除。')) return
    stopRecording()
    recordingRef.current = false
    stopTracking()
    streamRef.current?.getTracks().forEach((track) => track.stop())
    try {
      await api.participant.abandonSession(sessionId)
    } finally {
      deleteSession(sessionId)
      deleteFaceSession(sessionId)
      clearParticipantSession(sessionId)
      navigate('/', { replace: true })
    }
  }

  // 优惠券决策仅记录，不停止录制（已移除 15s 自动停止定时器）

  // 截断原因文案
  const stopReasonText = {
    timeout: '达到时长上限自动停止',
    maxEvents: '事件数达到上限自动停止',
    maxDataSize: '数据量达到上限自动停止',
    manual: '手动停止'
  }

  return (
    <div className="relative z-10 min-h-screen bg-[#F5F5F7]">
      {/* 极小的记录提示 —— 不打扰用户 */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-slate-200 shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[10px] text-slate-500 font-medium">测试记录中</span>
        {recording && (
          <span className="text-[9px] text-slate-400 font-mono" data-no-record>
            · {eventCount} events
          </span>
        )}
      </div>

      <button onClick={handleExit} className="fixed top-3 left-3 z-50 px-2.5 py-1 rounded-full bg-white/80 border border-slate-200 text-[10px] text-slate-500 hover:text-red-600" data-no-record>
        退出并删除数据
      </button>

      {/* 真实的结算页 */}
      <CheckoutPage onDecision={(use) => setCouponDecision(use ? 'applied' : 'declined')} onSubmit={handleTaskComplete} />

      {submitting && <div className="fixed inset-0 z-[80] bg-slate-950/30 flex items-center justify-center" data-no-record><div className="bg-white rounded-xl px-6 py-4 text-sm text-slate-700 shadow-xl">正在安全保存测试数据…</div></div>}

      {submitError && <div className="fixed bottom-4 right-4 z-[90] max-w-sm rounded-xl bg-red-600 text-white p-4 shadow-xl" data-no-record><p className="text-xs leading-relaxed">{submitError}</p><button onClick={() => pendingPayloadRef.current && submitPayload(pendingPayloadRef.current)} className="mt-3 px-3 py-1.5 rounded bg-white text-red-700 text-xs font-medium">重新提交</button></div>}

      {/* 截断提示 */}
      {stopReason && stopReason !== 'manual' && (
        <div className="fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs shadow-lg" data-no-record>
          ⚠ {stopReasonText[stopReason] || '录制已自动停止'}
        </div>
      )}
    </div>
  )
}
