import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import CheckoutPage from '../../components/participant/CheckoutPage.jsx'
import { startRecording, stopRecording, saveToStorage } from '../../lib/rrwebRecorder.js'
import { initMediaPipe, getCameraStream, startTracking, stopTracking, saveFrame } from '../../lib/mediaPipeTracker.js'

/**
 * P3 测试任务页 —— 被试实际操作的核心页面
 * 真实比例的电商结算页，可交互
 * + rrweb 行为录制（含安全截断机制）
 * + MediaPipe 面部采集（后台静默运行）
 */
export default function TaskPage() {
  const { sessionId } = useParams()
  const [recording, setRecording] = useState(false)
  const [recordComplete, setRecordComplete] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const [stopReason, setStopReason] = useState(null)
  const [faceEmotion, setFaceEmotion] = useState(null)
  const recordingRef = useRef(false)
  const eventCountRef = useRef(0)
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const lastFaceCaptureRef = useRef(0)

  // 页面加载时开始录制 + 面部采集
  useEffect(() => {
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
    startFaceCapture()

    return () => {
      clearInterval(timer)
      // 停止录制并保存
      if (recordingRef.current) {
        stopRecording()
        saveToStorage(sessionId)
      }
      // 停止面部采集
      stopTracking()
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [sessionId])

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
        if (result.emotion) {
          setFaceEmotion(result.emotion)
        }

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

  // 任务完成（优惠券决策后）
  const handleTaskComplete = useCallback(() => {
    const events = stopRecording()
    recordingRef.current = false
    setRecording(false)
    setRecordComplete(true)
    setEventCount(events.length)

    // 存储录制数据
    saveToStorage(sessionId)
    console.log(`录制完成：${events.length} 个事件`)
  }, [sessionId])

  // 监听优惠券弹窗关闭 = 任务关键节点
  useEffect(() => {
    const timer = setTimeout(() => {
      if (recording) {
        handleTaskComplete()
      }
    }, 15000)

    return () => clearTimeout(timer)
  }, [recording, handleTaskComplete])

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

      {/* 真实的结算页 */}
      <CheckoutPage onDecision={handleTaskComplete} />

      {/* 录制完成提示 */}
      {recordComplete && (
        <div className="fixed bottom-4 right-4 z-50 px-3 py-2 rounded-lg bg-emerald-500 text-white text-xs shadow-lg" data-no-record>
          ✓ 录制完成 · {eventCount} 个事件已保存
        </div>
      )}

      {/* 截断提示 */}
      {stopReason && stopReason !== 'manual' && (
        <div className="fixed bottom-4 left-4 z-50 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs shadow-lg" data-no-record>
          ⚠ {stopReasonText[stopReason] || '录制已自动停止'}
        </div>
      )}
    </div>
  )
}
