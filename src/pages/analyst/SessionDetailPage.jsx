import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import ReplayViewport from '../../components/researcher/ReplayViewport.jsx'
import StressChart from '../../components/researcher/StressChart.jsx'
import Timeline from '../../components/researcher/Timeline.jsx'
import BehaviorCards from '../../components/researcher/BehaviorCards.jsx'
import DiagnosisPanel from '../../components/researcher/DiagnosisPanel.jsx'
import { mouseTrail, clickEvents, timelineEvents, stressData, behaviorStats, sessionMeta } from '../../data/sessionData.js'

/**
 * A3 单会话深度分析 —— 核心页面
 * 回放 + 多模态 + Agent 诊断
 */
export default function SessionDetailPage() {
  const { id } = useParams()
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const duration = 20
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
    if (currentTime >= duration) setCurrentTime(0)
    setPlaying((p) => !p)
  }

  const handleScrub = (t) => {
    setCurrentTime(t)
    if (playing) setPlaying(false)
  }

  return (
    <AnalystLayout>
      <div className="p-4 flex flex-col gap-4 h-[calc(100vh-0px)] min-h-0">
        {/* 页头 */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <Link to="/sessions" className="text-slate-500 hover:text-cyan-glow transition-colors">
              ← 返回
            </Link>
            <div>
              <h1 className="text-[14px] font-semibold text-slate-100">
                会话 {id || sessionMeta.id}
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">
                {sessionMeta.participant} · {sessionMeta.task}
              </p>
            </div>
          </div>
          <Link
            to={`/report/${id || sessionMeta.id}`}
            className="px-3 py-1.5 rounded-lg bg-cyan-glow/15 border border-cyan-glow/25 text-[11px] font-mono text-cyan-glow hover:bg-cyan-glow/25 transition-colors"
          >
            📄 查看报告
          </Link>
        </div>

        {/* 主体：左右 6:4 */}
        <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* 左侧 60%：回放 + 时间轴 */}
          <div className="lg:col-span-7 flex flex-col gap-4 min-h-0">
            <ReplayViewport
              currentTime={currentTime}
              mouseTrail={mouseTrail}
              clickEvents={clickEvents}
              duration={duration}
              sessionId={id || sessionMeta.id}
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
          </div>

          {/* 右侧 40%：数据 + 报告 */}
          <div className="lg:col-span-5 flex flex-col gap-4 min-h-0 overflow-y-auto">
            <BehaviorCards stats={behaviorStats} meta={sessionMeta} />
            <StressChart data={stressData} currentTime={currentTime} duration={duration} />
            <DiagnosisPanel />
          </div>
        </div>
      </div>
    </AnalystLayout>
  )
}
