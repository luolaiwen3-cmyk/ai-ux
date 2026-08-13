import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Replayer } from 'rrweb'
import 'rrweb/dist/style.css'

/**
 * rrweb 回放组件
 * 基于 rrweb Replayer 实现真实 DOM 回放
 */

// 抑制 rrweb 播放时的 AbortError（play/pause 中断）—— unhandledrejection 事件
const suppressAbortError = (event) => {
  if (event.reason instanceof DOMException && event.reason.name === 'AbortError') {
    event.preventDefault()
  }
}

// 全局抑制 HTMLMediaElement.play() 产生的 AbortError
// rrweb 回放时对视频元素频繁 play/pause 会触发此错误，属于预期行为
const suppressMediaAbortErrors = () => {
  const originalPlay = HTMLMediaElement.prototype.play
  HTMLMediaElement.prototype.play = function (...args) {
    const playPromise = originalPlay.apply(this, args)
    if (playPromise && typeof playPromise.catch === 'function') {
      playPromise.catch((err) => {
        if (err && err.name === 'AbortError') return // 静默忽略
        throw err // 其他错误继续抛出
      })
    }
    return playPromise
  }
}

// 模块加载时立即启用全局抑制
suppressMediaAbortErrors()

const RrwebPlayer = forwardRef(function RrwebPlayer(
  { events, width = '100%', height = '100%', className = '' },
  ref
) {
  const containerRef = useRef(null)
  const outerRef = useRef(null)
  const replayerRef = useRef(null)
  const scaleRef = useRef(1)
  const [scale, setScale] = useState(1)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)
  const [viewport, setViewport] = useState({ width: 1280, height: 800 })

  // 强制 iframe 填满容器（rrweb 初始化时可能设了错误的内联高度）
  useEffect(() => {
    if (!ready || !containerRef.current) return

    const fixIframeHeight = () => {
      const iframe = containerRef.current.querySelector('iframe')
      if (iframe) {
        iframe.style.setProperty('height', '100%', 'important')
        iframe.style.setProperty('width', '100%', 'important')
      }
    }

    // 初始化后立即修复
    fixIframeHeight()

    // 监听内部 DOM 变化（rrweb 可能后续创建 iframe）
    const observer = new MutationObserver(fixIframeHeight)
    observer.observe(containerRef.current, { childList: true, subtree: true })

    return () => observer.disconnect()
  }, [ready, viewport])

  // 暴露方法给父组件（依赖 ready 确保 replayer 已初始化）
  // rrweb v2 的 pause(timeOffset) 用于跳转，pause() 用于暂停播放
  useImperativeHandle(ref, () => ({
    play: () => {
      // play() 从当前位置开始播放，不传参
      replayerRef.current?.play()
    },
    pause: () => {
      // pause() 不带参数 = 暂停当前播放
      replayerRef.current?.pause()
    },
    goto: (time) => {
      // pause(timeOffset) = 跳转到指定毫秒位置（用于拖拽定位）
      if (replayerRef.current) {
        replayerRef.current.pause(time)
      }
    },
    setSpeed: (speed) => replayerRef.current?.setConfig({ speed }),
    getTime: () => replayerRef.current?.getCurrentTime(),
    getDuration: () => duration,
    getIsPlaying: () => {
      // rrweb Replayer 内部状态：PAUSED=0, PLAYING=1
      return replayerRef.current?.timer.state === 1
    }
  }), [ready, duration])

  // 自适应缩放：根据父容器大小计算 scale，外层 div 尺寸跟随缩放后的内容
  useEffect(() => {
    if (!ready || !outerRef.current) return

    // 父容器 = outer 的上一级（ReplayViewport 里的 flex-1 div）
    const parentEl = outerRef.current.parentElement
    if (!parentEl) return

    const updateScale = () => {
      const parentW = parentEl.clientWidth
      const parentH = parentEl.clientHeight
      if (parentW === 0 || parentH === 0) return

      // 取较小值确保完整显示
      const scaleX = parentW / viewport.width
      const scaleY = parentH / viewport.height
      const newScale = Math.min(scaleX, scaleY)

      scaleRef.current = newScale
      setScale(newScale)
    }

    updateScale()
    const resizeObserver = new ResizeObserver(updateScale)
    resizeObserver.observe(parentEl)

    return () => resizeObserver.disconnect()
  }, [ready, viewport])

  // 提取录制视口尺寸
  useEffect(() => {
    if (!events || events.length === 0) return
    const metaEvent = events.find(e => e.type === 4)
    const w = metaEvent?.data?.width || 1280
    const h = metaEvent?.data?.height || 800
    setViewport({ width: w, height: h })
  }, [events])

  // 初始化 Replayer（等待 viewport 状态更新后再执行）
  useEffect(() => {
    if (!containerRef.current || !events || events.length === 0) return
    if (!viewport.width || !viewport.height) return

    // 清理旧实例
    if (replayerRef.current) {
      replayerRef.current.destroy()
      replayerRef.current = null
    }

    setError(null)
    setReady(false)

    // 等待一帧让容器尺寸（viewport.width x viewport.height）生效后再初始化
    let cancelled = false
    requestAnimationFrame(() => {
      if (cancelled || !containerRef.current) return

      try {
        // 此时容器已经被设为 viewport 尺寸，offsetWidth/Height 应该正确
        const containerWidth = containerRef.current.offsetWidth || viewport.width
        const containerHeight = containerRef.current.offsetHeight || viewport.height

        const replayer = new Replayer(events, {
          root: containerRef.current,
          width: containerWidth,
          height: containerHeight,
          speed: 1,
          liveMode: false,
          showWarning: false,
          showDebug: false,
          autoPlay: false,
          UNSAFE_replayCanvas: true,
          mouseTail: {
            duration: 300,
            lineCap: 'round',
            lineWidth: 2,
            strokeStyle: '#22E6C8'
          },
          triggerFocus: false
        })

        replayerRef.current = replayer

        // 抑制 play/pause 中断错误（rrweb 播放 DOM 媒体元素时的已知问题）
        window.addEventListener('unhandledrejection', suppressAbortError)

        // 计算总时长
        const metaData = replayer.getMetaData()
        setDuration(metaData.totalTime || 0)
        setReady(true)

        console.log('[RrwebPlayer] 初始化成功', {
          events: events.length,
          duration: metaData.totalTime,
          viewport: { width: viewport.width, height: viewport.height },
          container: { width: containerWidth, height: containerHeight }
        })
      } catch (err) {
        console.error('[RrwebPlayer] 初始化失败:', err)
        setError(err.message || '回放初始化失败')
      }
    })

    return () => {
      cancelled = true
      window.removeEventListener('unhandledrejection', suppressAbortError)
      if (replayerRef.current) {
        replayerRef.current.destroy()
        replayerRef.current = null
      }
    }
  }, [events, viewport.width, viewport.height])

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-ink-900 text-slate-400 text-xs ${className}`}
        style={{ width, height, minHeight: 200 }}>
        <div className="text-center p-4">
          <div className="text-danger text-lg mb-2">⚠</div>
          <div>回放加载失败</div>
          <div className="text-[10px] mt-1 text-slate-500">{error}</div>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={outerRef}
      className={`rrweb-player-outer ${className}`}
      style={{
        width: ready ? viewport.width * (scaleRef.current || 1) : '100%',
        height: ready ? viewport.height * (scaleRef.current || 1) : '100%',
        position: 'relative',
        overflow: 'hidden',
        background: '#ffffff',
        boxShadow: '0 2px 12px rgba(0,0,0,0.10)',
        borderRadius: 6,
      }}
    >
      {/* 内层：按录制视口比例缩放 */}
      <div
        style={{
          width: viewport.width,
          height: viewport.height,
          transform: `scale(${scaleRef.current || 1})`,
          transformOrigin: 'top left',
        }}
      >
        <div
          ref={containerRef}
          className="rrweb-player-container"
          style={{ width: '100%', height: '100%', position: 'relative' }}
        />
      </div>

      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-800/70 text-xs text-slate-400 z-10">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-cyan-400/30 border-t-cyan-400 rounded-full animate-spin mx-auto mb-2" />
            <div>正在加载回放…</div>
            <div className="text-[10px] text-slate-500 mt-1">{events?.length || 0} 个事件</div>
          </div>
        </div>
      )}
    </div>
  )
})

export default RrwebPlayer
