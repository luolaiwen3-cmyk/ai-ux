import React, { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Replayer } from 'rrweb'
import 'rrweb/dist/style.css'

/**
 * rrweb 回放组件
 * 基于 rrweb Replayer 实现真实 DOM 回放
 */
const RrwebPlayer = forwardRef(function RrwebPlayer(
  { events, width = '100%', height = '100%', className = '' },
  ref
) {
  const containerRef = useRef(null)
  const replayerRef = useRef(null)
  const [duration, setDuration] = useState(0)
  const [ready, setReady] = useState(false)
  const [error, setError] = useState(null)

  // 暴露方法给父组件
  useImperativeHandle(ref, () => ({
    play: () => replayerRef.current?.play(),
    pause: () => replayerRef.current?.pause(),
    goto: (time) => replayerRef.current?.goto(time),
    setSpeed: (speed) => replayerRef.current?.setConfig({ speed }),
    getTime: () => replayerRef.current?.getCurrentTime(),
    getDuration: () => duration
  }))

  // 初始化 Replayer
  useEffect(() => {
    if (!containerRef.current || !events || events.length === 0) return

    // 清理旧实例
    if (replayerRef.current) {
      replayerRef.current.destroy()
      replayerRef.current = null
    }

    setError(null)
    setReady(false)

    try {
      // 确保容器有尺寸
      const containerWidth = containerRef.current.offsetWidth || 800
      const containerHeight = containerRef.current.offsetHeight || 400

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

      // 计算总时长
      const metaData = replayer.getMetaData()
      setDuration(metaData.totalTime || 0)
      setReady(true)

      console.log('[RrwebPlayer] 初始化成功', {
        events: events.length,
        duration: metaData.totalTime,
        width: containerWidth,
        height: containerHeight
      })

      return () => {
        replayer.destroy()
        replayerRef.current = null
      }
    } catch (err) {
      console.error('[RrwebPlayer] 初始化失败:', err)
      setError(err.message || '回放初始化失败')
    }
  }, [events])

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
      ref={containerRef}
      className={`rrweb-player-container ${className}`}
      style={{ width, height, position: 'relative', overflow: 'hidden', minHeight: 200 }}
    >
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-ink-900/80 text-xs text-slate-400">
          <div className="text-center">
            <div className="w-6 h-6 border-2 border-cyan-glow/30 border-t-cyan-glow rounded-full animate-spin mx-auto mb-2" />
            <div>正在加载回放…</div>
            <div className="text-[10px] text-slate-500 mt-1">{events?.length || 0} 个事件</div>
          </div>
        </div>
      )}
    </div>
  )
})

export default RrwebPlayer
