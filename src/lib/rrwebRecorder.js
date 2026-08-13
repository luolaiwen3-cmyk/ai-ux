/**
 * rrweb 录制封装模块
 * 负责：开始录制、停止录制、存储事件、读取事件
 * 含安全截断机制，防止内存溢出导致页面卡死
 */
import { record } from 'rrweb'
import { snapshot } from 'rrweb-snapshot'

let stopFn = null
let events = []
let onEventCallback = null
let autoStopTimer = null
let maxEventsTimer = null

// 安全限制配置
const SAFETY_LIMITS = {
  maxDuration: 120000,     // 最大录制时长 120s（自动停止）
  maxEvents: 10000,        // 最大事件数（超过自动停止）
  maxDataSize: 10 * 1024 * 1024  // 最大数据量 10MB（超过自动停止）
}

/**
 * 估算当前事件数据大小（字节）
 */
const estimateDataSize = () => {
  // 快速估算：取前 100 个事件的平均大小 × 总数
  if (events.length === 0) return 0
  const sampleSize = Math.min(100, events.length)
  let sampleBytes = 0
  for (let i = 0; i < sampleSize; i++) {
    sampleBytes += JSON.stringify(events[i]).length
  }
  return (sampleBytes / sampleSize) * events.length
}

/**
 * 检查是否超出安全限制，超出则自动停止
 * @returns {boolean} 是否触发了截断
 */
const checkSafetyLimits = () => {
  // 检查事件数
  if (events.length >= SAFETY_LIMITS.maxEvents) {
    console.warn(`[rrweb] 事件数达到上限 ${SAFETY_LIMITS.maxEvents}，自动停止录制`)
    stopRecording('maxEvents')
    return true
  }

  // 检查数据量（每 500 个事件检查一次，避免频繁计算）
  if (events.length % 500 === 0) {
    const dataSize = estimateDataSize()
    if (dataSize >= SAFETY_LIMITS.maxDataSize) {
      console.warn(`[rrweb] 数据量达到上限 ${(SAFETY_LIMITS.maxDataSize / 1024 / 1024).toFixed(1)}MB，自动停止录制`)
      stopRecording('maxDataSize')
      return true
    }
  }

  return false
}

/**
 * 开始录制
 * @param {Function} onEvent - 每收到一个 event 的回调（可选，用于实时统计）
 * @param {number} maxDuration - 自定义最大录制时长（ms），默认 60s
 */
export const startRecording = (onEvent, maxDuration) => {
  if (stopFn) {
    console.warn('Recording already started')
    return
  }

  events = []
  onEventCallback = onEvent || null

  // 设置自动停止定时器
  const duration = maxDuration || SAFETY_LIMITS.maxDuration
  autoStopTimer = setTimeout(() => {
    console.warn(`[rrweb] 录制时长达到 ${duration / 1000}s 上限，自动停止`)
    stopRecording('timeout')
  }, duration)

  stopFn = record({
    emit(event) {
      events.push(event)
      if (onEventCallback) onEventCallback(event)
      // 每次 emit 检查安全限制
      checkSafetyLimits()
    },
    // 隐私脱敏 + 排除录制提示元素（防止反馈循环）
    maskTextSensitive: true,
    maskAllInputs: true,
    blockSelector: '[data-no-record], .animate-ping, .animate-blink, .animate-spin, .animate-scan, [class*="animate-"]',
    // 采样配置（更高的频率 = 更流畅的回放）
    sampling: {
      mousemove: 50,       // 每 50ms 一次鼠标位置（20fps，更流畅）
      mouseInteraction: true,  // 鼠标交互全量
      scroll: 100,         // 每 100ms 一次滚动
      input: 'last',
      media: 800
    },
    // 每 5s 生成一个 FullSnapshot（确保短录制也有快照）
    checkoutEveryNms: 5000
  })

  return events
}

/**
 * 停止录制
 * @param {string} reason - 停止原因（'manual' | 'timeout' | 'maxEvents' | 'maxDataSize'）
 * @returns {Array} 录制到的事件数组
 */
export const stopRecording = (reason = 'manual') => {
  // 清除自动停止定时器
  if (autoStopTimer) {
    clearTimeout(autoStopTimer)
    autoStopTimer = null
  }

  if (stopFn) {
    stopFn()
    stopFn = null
  }

  // 通知回调停止原因
  if (onEventCallback) {
    onEventCallback({ type: '_stopped', reason, count: events.length })
  }

  return events
}

/**
 * 获取当前录制的事件（实时）
 */
export const getEvents = () => events

/**
 * 获取录制状态信息
 */
export const getRecordingStatus = () => {
  return {
    isRecording: !!stopFn,
    eventCount: events.length,
    duration: getDuration(),
    dataSize: estimateDataSize()
  }
}

/**
 * 清空录制数据
 */
export const clearEvents = () => {
  events = []
}

/**
 * 获取录制时长（基于事件时间戳）
 */
export const getDuration = () => {
  if (events.length < 2) return 0
  const first = events[0].timestamp
  const last = events[events.length - 1].timestamp
  return last - first
}

/**
 * 将事件序列化存储到 localStorage（跨标签页共享）
 * @param {string} sessionId - 会话 ID
 */
export const saveToStorage = (sessionId = 'default-session') => {
  try {
    // 如果没有 FullSnapshot，手动捕获一个
    if (events.length > 0 && !events.some(e => e.type === 0)) {
      const domSnapshot = snapshot(document)
      if (domSnapshot) {
        events.unshift({
          type: 0,
          timestamp: events[0].timestamp - 1,
          data: {
            node: domSnapshot,
            initialOffset: { left: window.scrollX, top: window.scrollY }
          }
        })
      }
    }

    const key = `rrweb-events-${sessionId}`
    localStorage.setItem(key, JSON.stringify(events))

    // 同时更新会话索引
    const indexKey = 'rrweb-session-index'
    let index = []
    try {
      index = JSON.parse(localStorage.getItem(indexKey) || '[]')
    } catch { index = [] }

    // 去重并添加新会话
    const existingIdx = index.findIndex(s => s.id === sessionId)
    const sessionMeta = {
      id: sessionId,
      eventCount: events.length,
      duration: getDuration(),
      savedAt: Date.now()
    }
    if (existingIdx >= 0) {
      index[existingIdx] = sessionMeta
    } else {
      index.unshift(sessionMeta)
    }
    localStorage.setItem(indexKey, JSON.stringify(index))

    return true
  } catch (e) {
    console.error('Failed to save events:', e)
    return false
  }
}

/**
 * 从 localStorage 读取事件
 * @param {string} sessionId - 会话 ID
 */
export const loadFromStorage = (sessionId = 'default-session') => {
  try {
    const key = `rrweb-events-${sessionId}`
    const data = localStorage.getItem(key)
    return data ? JSON.parse(data) : []
  } catch (e) {
    console.error('Failed to load events:', e)
    return []
  }
}

/**
 * 获取所有已存储的会话列表
 */
export const getSessionIndex = () => {
  try {
    return JSON.parse(localStorage.getItem('rrweb-session-index') || '[]')
  } catch {
    return []
  }
}

/**
 * 检查是否有已存储的录制数据
 */
export const hasStoredSession = (sessionId) => {
  if (sessionId) {
    return !!localStorage.getItem(`rrweb-events-${sessionId}`)
  }
  // 检查任意会话
  return getSessionIndex().length > 0
}

/**
 * 删除指定会话
 */
export const deleteSession = (sessionId) => {
  try {
    localStorage.removeItem(`rrweb-events-${sessionId}`)
    const index = getSessionIndex().filter(s => s.id !== sessionId)
    localStorage.setItem('rrweb-session-index', JSON.stringify(index))
    return true
  } catch {
    return false
  }
}

/**
 * 清除所有录制数据
 */
export const clearAllSessions = () => {
  const index = getSessionIndex()
  index.forEach(s => localStorage.removeItem(`rrweb-events-${s.id}`))
  localStorage.removeItem('rrweb-session-index')
}
