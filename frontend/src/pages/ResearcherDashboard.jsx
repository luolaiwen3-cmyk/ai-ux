import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import ReplayViewport from '../components/researcher/ReplayViewport.jsx'
import StressChart from '../components/researcher/StressChart.jsx'
import Timeline from '../components/researcher/Timeline.jsx'
import BehaviorCards from '../components/researcher/BehaviorCards.jsx'
import DiagnosisPanel from '../components/researcher/DiagnosisPanel.jsx'
import { mouseTrail, clickEvents, timelineEvents, stressData, behaviorStats, sessionMeta } from '../data/sessionData.js'

/**
 * 后台分析工作台 —— 给开发者/研究员看的数据看板
 * 回放被试操作 + 多模态数据 + Agent 诊断
 */
export default function ResearcherDashboard() {
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0) // 秒
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const duration = 20 // 总时长 20s
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  const animate = useCallback(
    (timestamp) => {
      if (lastTimeRef.current === null) lastTimeRef.current = timestamp
      const delta = (timestamp - lastTimeRef.current) / 1000
      lastTimeRef.current = timestamp

      setCurrentTime((prev) => {
        const next = prev + delta * playbackSpeed
        if (next >= duration) {
          setPlaying(false)
          return duration
        }
        return next
      })

      rafRef.current = requestAnimationFrame(animate)
    },
    [playbackSpeed, duration]
  )

  useEffect(() => {
    if (playing) {
      lastTimeRef.current = null
      rafRef.current = requestAnimationFrame(animate)
    } else if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
    }
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [playing, animate])

  const handlePlayPause = () => {
    if (currentTime >= duration) {
      setCurrentTime(0)
    }
    setPlaying((p) => !p)
  }

  const handleScrub = (t) => {
    setCurrentTime(t)
    if (playing) setPlaying(false)
  }

  return (
    <div className="analyst-theme relative z-10 flex flex-col h-screen bg-white text-slate-900">
      {/* 顶部导航 */}
      <header className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="relative w-9 h-9 rounded-lg bg-slate-900 flex items-center justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14l6 3-6 3z" fill="#FFFFFF" />
            </svg>
          </div>
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-wide">
              <span className="text-slate-950">InsightUX</span>
              <span className="text-slate-400 font-normal ml-2">后台分析工作台</span>
            </div>
            <div className="text-[11px] text-slate-500 font-mono tracking-wider">
              会话 {sessionMeta.id} · {sessionMeta.participant}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="px-3 py-1.5 rounded-md bg-white border border-slate-300 text-[11px] font-mono text-slate-900 hover:bg-slate-50 transition-colors"
          >
            ← 返回被试画面
          </Link>
        </div>
      </header>

      {/* 主体内容 */}
      <main className="flex-1 min-h-0 grid grid-cols-12 gap-4 px-5 py-4">
        {/* 左侧 60%：回放 + 时间轴 */}
        <section className="col-span-12 lg:col-span-7 flex flex-col gap-4 min-h-0">
          <ReplayViewport
            currentTime={currentTime}
            mouseTrail={mouseTrail}
            clickEvents={clickEvents}
            duration={duration}
            sessionId={sessionMeta.id}
          />
          <Timeline
            currentTime={currentTime}
            duration={duration}
            events={timelineEvents}
            onScrub={handleScrub}
            playing={playing}
            onPlayPause={handlePlayPause}
            speed={playbackSpeed}
            onSpeedChange={setPlaybackSpeed}
          />
        </section>

        {/* 右侧 40%：数据 + 报告 */}
        <section className="col-span-12 lg:col-span-5 flex flex-col gap-4 min-h-0 overflow-y-auto">
          <BehaviorCards stats={behaviorStats} meta={sessionMeta} />
          <StressChart data={stressData} currentTime={currentTime} duration={duration} />
          <DiagnosisPanel />
        </section>
      </main>
    </div>
  )
}
