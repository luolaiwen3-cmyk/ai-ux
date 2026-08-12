import React, { useRef } from 'react'

/**
 * 回放时间轴 —— 可拖拽 scrub，带关键事件标记
 */
export default function Timeline({
  currentTime,
  duration,
  events,
  onScrub,
  playing,
  onPlayPause,
  speed,
  onSpeedChange
}) {
  const trackRef = useRef(null)

  const handleClick = (e) => {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const ratio = (e.clientX - rect.left) / rect.width
    onScrub(Math.max(0, Math.min(duration, ratio * duration)))
  }

  const progress = (currentTime / duration) * 100

  return (
    <div className="glass rounded-xl p-3 flex items-center gap-3 shrink-0">
      {/* 播放/暂停 */}
      <button
        onClick={onPlayPause}
        className="w-8 h-8 rounded-lg bg-cyan-glow/15 border border-cyan-glow/25 flex items-center justify-center text-cyan-glow hover:bg-cyan-glow/25 transition-colors shrink-0"
      >
        {playing ? (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <path d="M7 5l12 7-12 7V5z" />
          </svg>
        )}
      </button>

      {/* 时间显示 */}
      <div className="text-[11px] font-mono text-slate-400 w-20 shrink-0">
        <span className="text-cyan-glow">{currentTime.toFixed(1)}s</span>
        <span className="text-slate-600"> / {duration}s</span>
      </div>

      {/* 时间轴轨道 */}
      <div
        ref={trackRef}
        className="flex-1 h-10 relative cursor-pointer group"
        onClick={handleClick}
      >
        {/* 背景轨道 */}
        <div className="absolute top-1/2 -translate-y-1/2 left-0 right-0 h-1 rounded-full bg-ink-600/60" />

        {/* 进度 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 left-0 h-1 rounded-full bg-gradient-to-r from-cyan-glow to-cyan-soft transition-[width] duration-75"
          style={{ width: `${progress}%` }}
        />

        {/* 关键事件标记 */}
        {events.map((ev, i) => {
          const left = (ev.t / 1000 / duration) * 100
          const colorMap = {
            start: '#64748b',
            popup: '#3FB7FF',
            click: '#FFB547',
            confusion: '#FF4D6A',
            peak: '#FF4D6A',
            decision: '#22E6C8',
            end: '#64748b'
          }
          return (
            <div
              key={i}
              className="absolute top-1/2 -translate-y-1/2 group/mark"
              style={{ left: `${left}%` }}
            >
              <div
                className="w-2 h-2 rounded-full border-2 border-ink-900 -translate-x-1/2 hover:scale-125 transition-transform"
                style={{ backgroundColor: colorMap[ev.type] }}
              />
              {/* hover 标签 */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 rounded bg-ink-900 border border-cyan-glow/20 text-[9px] font-mono text-slate-300 whitespace-nowrap opacity-0 group-hover/mark:opacity-100 transition-opacity pointer-events-none">
                {ev.label}
                <div className="text-[8px] text-slate-500">{(ev.t / 1000).toFixed(1)}s</div>
              </div>
            </div>
          )
        })}

        {/* 当前播放头 */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-cyan-glow border-2 border-ink-900 shadow-glow -translate-x-1/2 transition-[left] duration-75"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* 倍速 */}
      <div className="flex items-center gap-1 shrink-0">
        {[0.5, 1, 2].map((s) => (
          <button
            key={s}
            onClick={() => onSpeedChange(s)}
            className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition-colors ${
              speed === s
                ? 'bg-cyan-glow/20 text-cyan-glow border border-cyan-glow/30'
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {s}x
          </button>
        ))}
      </div>
    </div>
  )
}
