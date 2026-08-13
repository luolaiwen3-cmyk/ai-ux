import React, { useEffect, useMemo, useRef } from 'react'
import FaceMesh from './FaceMesh.jsx'
import RrwebPlayer from './RrwebPlayer.jsx'
import { loadFromStorage } from '../../lib/rrwebRecorder.js'
import { loadFrames } from '../../lib/mediaPipeTracker.js'

/** 只回放当前会话的真实 rrweb 与 MediaPipe 数据。 */
export default function ReplayViewport({
  currentTime,
  duration,
  sessionId,
  playing,
  playbackSpeed = 1,
  onTimeUpdate,
  recordedEvents,
  recordedFaceFrames
}) {
  const playerRef = useRef(null)
  const lastGotoRef = useRef(-1)
  const events = useMemo(
    () => recordedEvents || loadFromStorage(sessionId) || [],
    [recordedEvents, sessionId]
  )
  const faceFrames = useMemo(
    () => recordedFaceFrames || loadFrames(sessionId) || [],
    [recordedFaceFrames, sessionId]
  )

  const currentFaceFrame = useMemo(() => {
    if (!faceFrames.length) return null
    const target = Number(faceFrames[0].t) + currentTime * 1000
    return faceFrames.reduce((closest, frame) =>
      Math.abs(Number(frame.t) - target) < Math.abs(Number(closest.t) - target) ? frame : closest
    , faceFrames[0])
  }, [faceFrames, currentTime])

  useEffect(() => {
    if (!playerRef.current || playerRef.current.getDuration() <= 0) return
    if (playing) playerRef.current.play()
    else playerRef.current.pause()
  }, [playing])

  useEffect(() => {
    playerRef.current?.setSpeed(playbackSpeed)
  }, [playbackSpeed])

  useEffect(() => {
    if (!playing || !playerRef.current) return undefined
    const timer = window.setInterval(() => {
      const milliseconds = playerRef.current?.getTime()
      if (Number.isFinite(milliseconds)) onTimeUpdate?.(milliseconds / 1000)
    }, 100)
    return () => window.clearInterval(timer)
  }, [playing, onTimeUpdate])

  useEffect(() => {
    if (playing || !playerRef.current || playerRef.current.getDuration() <= 0) return
    const target = Math.max(0, Math.min(duration * 1000, currentTime * 1000))
    if (Math.abs(target - lastGotoRef.current) > 50) {
      lastGotoRef.current = target
      playerRef.current.goto(target)
    }
  }, [currentTime, duration, playing])

  if (!events.length) {
    return (
      <div className="glass rounded-xl p-4 flex-1 min-h-[320px] flex items-center justify-center">
        <div className="text-center">
          <div className="text-sm font-medium text-slate-400">暂无可回放的行为数据</div>
          <p className="text-[11px] text-slate-500 mt-1">退出或采集失败的会话不会使用示例轨迹替代</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass rounded-xl p-4 flex-1 min-h-[320px] flex flex-col relative overflow-hidden">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-danger/80" /><span className="w-2.5 h-2.5 rounded-full bg-warn/80" /><span className="w-2.5 h-2.5 rounded-full bg-emerald-400/80" /></div>
          <span className="text-[12px] font-mono text-slate-400 ml-2">SESSION_REPLAY · rrweb 真实回放</span>
          <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">REAL</span>
        </div>
        <div className="text-[11px] font-mono"><span className="text-cyan-glow">{currentTime.toFixed(1)}s</span><span className="text-slate-500"> / {duration.toFixed(1)}s</span></div>
      </div>

      <div className="flex-1 min-h-0 rounded-lg border border-cyan-glow/10 overflow-hidden bg-slate-800/50 flex items-center justify-center">
        <RrwebPlayer ref={playerRef} events={events} />
      </div>

      {currentFaceFrame && (
        <div className="absolute top-14 right-5 w-36 rounded-md overflow-hidden border border-cyan-glow/30 shadow-glow bg-ink-900/90 backdrop-blur z-10">
          <div className="flex items-center justify-between px-1.5 py-0.5 border-b border-cyan-glow/15"><span className="text-[8px] font-mono text-cyan-glow">FACE FRAME</span><span className="text-[7px] font-mono text-slate-500">CAM-01</span></div>
          <div className="relative aspect-[4/3] bg-slate-900">
            <FaceMesh landmarks={currentFaceFrame.keyPoints} snapshot={currentFaceFrame.snapshot} />
            <div className="absolute bottom-0.5 left-0.5 right-0.5 px-1 py-0.5 rounded bg-black/60 text-[7px] font-mono text-cyan-glow truncate">{currentFaceFrame.emotion?.label || 'Unknown'} · {((currentFaceFrame.emotion?.value || 0) * 100).toFixed(0)}%</div>
          </div>
        </div>
      )}

      <div className="absolute top-14 left-5 px-1.5 py-0.5 rounded bg-ink-900/70 border border-cyan-glow/15 text-[8px] font-mono text-slate-400 z-10">REPLAY · {sessionId}</div>
    </div>
  )
}
