import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useParams } from 'react-router-dom'
import CheckoutPage from '../../components/participant/CheckoutPage.jsx'
import { startRecording, stopRecording, saveToStorage } from '../../lib/rrwebRecorder.js'

/**
 * P3 测试任务页 —— 被试实际操作的核心页面
 * 真实比例的电商结算页，可交互
 * + rrweb 行为录制（含安全截断机制）
 */
export default function TaskPage() {
  const { sessionId } = useParams()
  const [recording, setRecording] = useState(false)
  const [recordComplete, setRecordComplete] = useState(false)
  const [eventCount, setEventCount] = useState(0)
  const [stopReason, setStopReason] = useState(null)
  const recordingRef = useRef(false)
  const eventCountRef = useRef(0)

  // 页面加载时开始录制
  useEffect(() => {
    const onEvent = (event) => {
      // 检测停止信号
      if (event.type === '_stopped') {
        setStopReason(event.reason)
        return
      }
      // 使用 ref 计数，避免 setState 触发 DOM 变化导致反馈循环
      eventCountRef.current += 1
    }

    startRecording(onEvent)
    setRecording(true)
    recordingRef.current = true

    // 每 500ms 同步一次计数到 state（避免频繁渲染）
    const timer = setInterval(() => {
      if (eventCountRef.current > 0) {
        setEventCount(eventCountRef.current)
      }
    }, 500)

    return () => {
      clearInterval(timer)
      // 组件卸载时停止录制并保存
      if (recordingRef.current) {
        stopRecording()
        saveToStorage(sessionId)
      }
    }
  }, [sessionId])

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
    // 15s 后自动判定任务完成（简化版）
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

      {/* 录制完成提示（data-no-record 防止被录制） */}
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
