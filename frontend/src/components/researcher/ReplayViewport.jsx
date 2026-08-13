import React, { useMemo, useRef, useEffect, useState } from 'react'
import FaceMesh from './FaceMesh.jsx'
import RrwebPlayer from './RrwebPlayer.jsx'
import { loadFromStorage } from '../../lib/rrwebRecorder.js'
import { loadFrames } from '../../lib/mediaPipeTracker.js'

/**
 * 回放视口 —— 还原被试操作过程
 * 优先使用 rrweb 真实录制数据回放，降级到 mock 轨迹
 * + MediaPipe 面部视频帧回放
 */
export default function ReplayViewport({ currentTime, mouseTrail, clickEvents, duration, sessionId }) {
  const playerRef = useRef(null)
  const [hasRealData, setHasRealData] = useState(false)
  const [realEvents, setRealEvents] = useState([])
  const [playerDuration, setPlayerDuration] = useState(duration * 1000)
  const [faceFrames, setFaceFrames] = useState([])

  // 加载面部帧数据
  useEffect(() => {
    const frames = loadFrames(sessionId)
    if (frames && frames.length > 0) {
      setFaceFrames(frames)
    }
  }, [sessionId])

  // 获取当前时间点的面部帧
  const currentFaceFrame = useMemo(() => {
    if (faceFrames.length === 0) return null
    const baseTime = faceFrames[0].t
    const targetTime = currentTime * 1000 + baseTime
    // 找到最近的帧
    let closest = faceFrames[0]
    let minDiff = Math.abs(closest.t - targetTime)
    for (const f of faceFrames) {
      const diff = Math.abs(f.t - targetTime)
      if (diff < minDiff) {
        minDiff = diff
        closest = f
      }
    }
    return closest
  }, [faceFrames, currentTime])

  // 检查是否有真实录制数据（从 localStorage 读取）
  useEffect(() => {
    const events = loadFromStorage(sessionId)
    if (events && events.length > 0) {
      // 验证数据完整性：首事件必须是 FullSnapshot (type=0)
      const firstEvent = events[0]
      if (firstEvent && firstEvent.type === 0) {
        setRealEvents(events)
        setHasRealData(true)
        console.log('[ReplayViewport] 真实数据加载成功:', events.length, '个事件')
      } else {
        console.warn('[ReplayViewport] 数据格式异常，首事件类型:', firstEvent?.type)
        // 尝试查找 FullSnapshot
        const snapshotIdx = events.findIndex(e => e.type === 0)
        if (snapshotIdx >= 0) {
          console.log('[ReplayViewport] 找到 FullSnapshot 在位置:', snapshotIdx)
          setRealEvents(events)
          setHasRealData(true)
        }
      }
    }
  }, [sessionId])

  // 同步播放位置
  useEffect(() => {
    if (hasRealData && playerRef.current) {
      playerRef.current.goto(currentTime * 1000)
    }
  }, [currentTime, hasRealData])

  // 弹窗是否可见（3.5s 出现，15s 决策后消失）
  const showPopup = currentTime >= 3.5 && currentTime < 15

  // 如果有真实数据，使用 rrweb 回放
  if (hasRealData && realEvents.length > 0) {
    return (
      <div className="glass rounded-xl p-4 flex-1 min-h-[320px] flex flex-col relative overflow-hidden">
        {/* 标题栏 */}
        <div className="flex items-center justify-between mb-3 shrink-0">
          <div className="flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-danger/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-warn/80" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
            </div>
            <span className="text-[12px] font-mono text-slate-400 ml-2">
              SESSION_REPLAY · rrweb 真实回放
            </span>
            <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
              REAL
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px] font-mono">
            <span className="text-cyan-glow">●</span>
            <span className="text-slate-400">t = {currentTime.toFixed(1)}s</span>
            <span className="text-slate-600">/ {duration}s</span>
          </div>
        </div>

        {/* rrweb 回放区 */}
        <div className="flex-1 min-h-0 rounded-lg border border-cyan-glow/10 overflow-hidden bg-white">
          <RrwebPlayer ref={playerRef} events={realEvents} />
        </div>

        {/* 摄像头悬浮框（右上角） */}
        <div className="absolute top-14 right-5 w-36 rounded-md overflow-hidden border border-cyan-glow/30 shadow-glow bg-ink-900/90 backdrop-blur z-10">
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-cyan-glow/15">
            <span className="text-[8px] font-mono text-cyan-glow tracking-wider flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-danger animate-blink" />
              REC
            </span>
            <span className="text-[7px] font-mono text-slate-500">CAM-01</span>
          </div>
          <div className="relative aspect-[4/3] bg-gradient-to-br from-ink-700 to-ink-900">
            <FaceMesh
              landmarks={currentFaceFrame?.keyPoints}
              mode={currentFaceFrame?.snapshot ? 'snapshot' : 'simulated'}
              snapshot={currentFaceFrame?.snapshot}
            />
            <div className="absolute bottom-0.5 left-0.5 right-0.5 px-1 py-0.5 rounded bg-black/60">
              <div className="text-[7px] font-mono text-cyan-glow truncate">
                面部特征提取中
              </div>
              <div className="text-[7px] font-mono text-danger truncate">
                状态：{currentFaceFrame?.emotion?.label || getEmotion(currentTime)} ({(currentFaceFrame?.emotion?.value * 100 || 0).toFixed(0)}%)
              </div>
            </div>
          </div>
        </div>

        {/* 角标 */}
        <div className="absolute top-14 left-5 px-1.5 py-0.5 rounded bg-ink-900/70 border border-cyan-glow/15 text-[8px] font-mono text-slate-400 z-10">
          REPLAY · {sessionId}
        </div>
      </div>
    )
  }

  // 降级：使用 mock 轨迹回放
  return <MockReplayViewport
    currentTime={currentTime}
    mouseTrail={mouseTrail}
    clickEvents={clickEvents}
    duration={duration}
    sessionId={sessionId}
    currentFaceFrame={currentFaceFrame}
  />
}

/**
 * Mock 回放（降级方案，无真实数据时使用）
 */
function MockReplayViewport({ currentTime, mouseTrail, clickEvents, duration, sessionId, currentFaceFrame }) {
  const visibleTrail = useMemo(
    () => mouseTrail.filter((p) => p.t <= currentTime * 1000),
    [mouseTrail, currentTime]
  )

  const currentPos = useMemo(() => {
    const t = currentTime * 1000
    let last = mouseTrail[0]
    for (const p of mouseTrail) {
      if (p.t <= t) last = p
      else break
    }
    return last
  }, [mouseTrail, currentTime])

  const visibleClicks = useMemo(
    () => clickEvents.filter((c) => c.t <= currentTime * 1000),
    [clickEvents, currentTime]
  )

  const showPopup = currentTime >= 3.5 && currentTime < 15

  const pathD = useMemo(() => {
    if (visibleTrail.length < 2) return ''
    return visibleTrail
      .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
      .join(' ')
  }, [visibleTrail])

  return (
    <div className="glass rounded-xl p-4 flex-1 min-h-[320px] flex flex-col relative overflow-hidden">
      {/* 标题栏 */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-danger/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-warn/80" />
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" />
          </div>
          <span className="text-[12px] font-mono text-slate-400 ml-2">
            SESSION_REPLAY · 会话回放
          </span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-slate-500/15 text-slate-400 border border-slate-500/20">
            MOCK
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px] font-mono">
          <span className="text-cyan-glow">●</span>
          <span className="text-slate-400">t = {currentTime.toFixed(1)}s</span>
          <span className="text-slate-600">/ {duration}s</span>
        </div>
      </div>

      {/* 回放画面 */}
      <div className="flex-1 min-h-0 rounded-lg bg-[#F5F5F7] border border-cyan-glow/10 relative overflow-hidden">
        {/* 模拟被试看到的结算页 */}
        <div className="absolute inset-0 p-4">
          <div className="h-8 bg-white rounded border border-slate-200 flex items-center px-3 gap-4 mb-3">
            <span className="text-[10px] font-bold text-slate-800">Shop<span className="text-orange-500">Demo</span></span>
            <span className="text-[9px] text-slate-500">首页</span>
            <span className="text-[9px] text-slate-800 font-medium">购物车</span>
            <span className="text-[9px] text-slate-500">我的订单</span>
          </div>
          <div className="space-y-2">
            <ProductRow emoji="🎧" name="Sony WH-1000XM5" price="¥2,499" />
            <ProductRow emoji="⌨️" name="Keychron Q1 Pro" price="¥1,198" />
            <ProductRow emoji="🪑" name="Herman Miller Aeron" price="¥8,800" />
          </div>
          <div className="absolute bottom-4 right-4 w-32 bg-white rounded border border-slate-200 p-2">
            <div className="text-[8px] text-slate-500 mb-1">应付总额</div>
            <div className="text-[11px] font-bold text-orange-600">¥12,447</div>
            <div className="mt-1.5 h-4 bg-orange-500 rounded text-[7px] text-white flex items-center justify-center">
              提交订单
            </div>
          </div>
        </div>

        {/* 优惠券弹窗 */}
        {showPopup && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/30" />
            <div className="relative w-[200px] rounded-xl bg-white shadow-xl overflow-hidden border border-slate-200">
              <div className="h-16 bg-gradient-to-r from-amber-400 to-orange-500 flex items-center justify-center">
                <div className="text-white text-center">
                  <div className="text-[7px] tracking-widest">EXCLUSIVE</div>
                  <div className="text-lg font-extrabold">¥ 50</div>
                </div>
              </div>
              <div className="p-3 text-center">
                <div className="text-[9px] font-medium text-slate-800">恭喜获得专属优惠券！</div>
                <div className="grid grid-cols-2 gap-1.5 mt-2">
                  <div className="py-1 rounded bg-slate-100 text-[8px] text-slate-600">稍后再用</div>
                  <div className="py-1 rounded bg-orange-500 text-[8px] text-white font-medium">立即使用</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 鼠标轨迹 SVG */}
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <defs>
            <linearGradient id="trailGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#22E6C8" stopOpacity="0.1" />
              <stop offset="100%" stopColor="#22E6C8" stopOpacity="0.9" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {pathD && (
            <path d={pathD} fill="none" stroke="url(#trailGrad)" strokeWidth="0.6" strokeLinecap="round" strokeLinejoin="round" filter="url(#glow)" />
          )}

          {visibleClicks.map((c, i) => {
            const age = currentTime - c.t / 1000
            const opacity = Math.max(0, 1 - age / 3)
            return (
              <g key={i} opacity={opacity}>
                <circle cx={c.x} cy={c.y} r="2" fill="none" stroke="#FF4D6A" strokeWidth="0.3" />
                <circle cx={c.x} cy={c.y} r={2 + age * 2} fill="none" stroke="#FF4D6A" strokeWidth="0.2" opacity="0.6" />
                <circle cx={c.x} cy={c.y} r={2 + age * 4} fill="none" stroke="#FF4D6A" strokeWidth="0.15" opacity="0.3" />
              </g>
            )
          })}

          {currentPos && (
            <g>
              <circle cx={currentPos.x} cy={currentPos.y} r="1.8" fill="#22E6C8" fillOpacity="0.3">
                <animate attributeName="r" values="1.5;2.5;1.5" dur="1s" repeatCount="indefinite" />
              </circle>
              <circle cx={currentPos.x} cy={currentPos.y} r="0.8" fill="#22E6C8" />
            </g>
          )}
        </svg>

        {/* 摄像头悬浮框 */}
        <div className="absolute top-2 right-2 w-36 rounded-md overflow-hidden border border-cyan-glow/30 shadow-glow bg-ink-900/90 backdrop-blur">
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-cyan-glow/15">
            <span className="text-[8px] font-mono text-cyan-glow tracking-wider flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-danger animate-blink" />
              REC
            </span>
            <span className="text-[7px] font-mono text-slate-500">CAM-01</span>
          </div>
          <div className="relative aspect-[4/3] bg-gradient-to-br from-ink-700 to-ink-900">
            <FaceMesh
              landmarks={currentFaceFrame?.keyPoints}
              mode={currentFaceFrame?.snapshot ? 'snapshot' : 'simulated'}
              snapshot={currentFaceFrame?.snapshot}
            />
            <div className="absolute bottom-0.5 left-0.5 right-0.5 px-1 py-0.5 rounded bg-black/60">
              <div className="text-[7px] font-mono text-cyan-glow truncate">面部特征提取中</div>
              <div className="text-[7px] font-mono text-danger truncate">
                状态：{currentFaceFrame?.emotion?.label || getEmotion(currentTime)} ({(currentFaceFrame?.emotion?.value * 100 || 0).toFixed(0)}%)
              </div>
            </div>
          </div>
        </div>

        {/* 角标 */}
        <div className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-ink-900/70 border border-cyan-glow/15 text-[8px] font-mono text-slate-400">
          REPLAY · {sessionId}
        </div>
      </div>
    </div>
  )
}

function ProductRow({ emoji, name, price }) {
  return (
    <div className="flex items-center gap-2 bg-white rounded border border-slate-200 px-2 py-1.5">
      <div className="w-4 h-4 rounded bg-slate-100 flex items-center justify-center text-[8px]">{emoji}</div>
      <div className="flex-1 text-[8px] text-slate-700 truncate">{name}</div>
      <div className="text-[8px] font-mono text-slate-600">{price}</div>
    </div>
  )
}

function getEmotion(t) {
  if (t < 3.5) return 'Neutral (0.12)'
  if (t < 6) return 'Curious (0.35)'
  if (t < 10) return 'Confusion (0.62)'
  if (t < 14.5) return 'Confusion (0.82)'
  if (t < 15) return 'Frustrated (0.91)'
  return 'Relieved (0.28)'
}
