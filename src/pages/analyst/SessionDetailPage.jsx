import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import ReplayViewport from '../../components/researcher/ReplayViewport.jsx'
import StressChart from '../../components/researcher/StressChart.jsx'
import Timeline from '../../components/researcher/Timeline.jsx'
import BehaviorCards from '../../components/researcher/BehaviorCards.jsx'
import DiagnosisPanel from '../../components/researcher/DiagnosisPanel.jsx'
import { mouseTrail, clickEvents, timelineEvents, stressData, sessionMeta } from '../../data/sessionData.js'
import { loadFromStorage, hasStoredSession } from '../../lib/rrwebRecorder.js'
import { loadFrames, hasFaceData } from '../../lib/mediaPipeTracker.js'
import { getSessionMetrics, getStressData } from '../../lib/sessionDataService.js'

/**
 * A3 单会话深度分析 —— 核心页面
 * 回放 + 多模态 + Agent 诊断
 * + rrweb 真实录制数据回放
 */
export default function SessionDetailPage() {
  const { id } = useParams()
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [playbackSpeed, setPlaybackSpeed] = useState(1)
  const [useRealData, setUseRealData] = useState(false)
  const [faceFrames, setFaceFrames] = useState([])
  const [hasFace, setHasFace] = useState(false)
  const [metrics, setMetrics] = useState(null)
  const [realStressData, setRealStressData] = useState(null)
  const duration = 20
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)
  const playerDrivingRef = useRef(false) // 标记是否由 rrweb player 驱动时间

  // 加载真实数据
  useEffect(() => {
    // 检查是否有 rrweb 录制数据
    const hasData = hasStoredSession(id) || hasStoredSession()
    setUseRealData(hasData)
    console.log('[SessionDetail] 会话ID:', id, '有数据:', hasData)

    // 加载行为指标
    const m = getSessionMetrics(id)
    if (m) {
      setMetrics(m)
    }

    // 加载面部帧数据
    const frames = loadFrames(id)
    if (frames && frames.length > 0) {
      setFaceFrames(frames)
      setHasFace(true)
      console.log('[SessionDetail] 面部帧数:', frames.length)
    }

    // 生成压力曲线（从 MediaPipe 情绪数据）
    const stress = getStressData(id)
    if (stress) {
      setRealStressData(stress)
    }
  }, [id])

  // rrweb player 驱动时间更新（播放时由 replayer 回调）
  const handlePlayerTimeUpdate = useCallback((t) => {
    playerDrivingRef.current = true
    setCurrentTime(t)
    if (t >= duration) {
      setPlaying(false)
    }
  }, [duration])

  // 本地时钟驱动（无真实数据或 mock 模式时使用）
  const animate = useCallback(
    (timestamp) => {
      if (playerDrivingRef.current) return // player 驱动时跳过本地时钟
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
      playerDrivingRef.current = false
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
          <div className="flex items-center gap-2">
            {useRealData && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                rrweb 真实录制
              </span>
            )}
            <Link
              to={`/report/${id || sessionMeta.id}`}
              className="px-3 py-1.5 rounded-lg bg-cyan-glow/15 border border-cyan-glow/25 text-[11px] font-mono text-cyan-glow hover:bg-cyan-glow/25 transition-colors"
            >
              📄 查看报告
            </Link>
          </div>
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
              playing={playing}
              onTimeUpdate={handlePlayerTimeUpdate}
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
            <BehaviorCards stats={metrics} meta={{ id, task: '电商结算页优惠券弹窗测试' }} />
            {hasFace && <FaceDataCard frames={faceFrames} currentTime={currentTime} />}
            <StressChart data={realStressData || stressData} currentTime={currentTime} duration={duration} />
            <DiagnosisPanel metrics={metrics} stressData={realStressData || stressData} hasFace={hasFace} />
          </div>
        </div>
      </div>
    </AnalystLayout>
  )
}

/**
 * 面部数据卡片 —— 显示 MediaPipe 采集的面部帧和情绪
 */
function FaceDataCard({ frames, currentTime }) {
  // 找到当前时间点最近的帧
  const currentFrame = frames.find((f, i) => {
    const nextFrame = frames[i + 1]
    const timeSec = f.t - frames[0].t
    const nextTimeSec = nextFrame ? nextFrame.t - frames[0].t : Infinity
    return currentTime >= timeSec / 1000 && currentTime < nextTimeSec / 1000
  }) || frames[frames.length - 1]

  const emotion = currentFrame?.emotion || { label: 'Neutral', value: 0 }

  // 情绪颜色
  const emotionColors = {
    Confusion: 'text-danger',
    Surprise: 'text-warn',
    Frustration: 'text-danger',
    Focus: 'text-cyan-soft',
    Neutral: 'text-slate-400'
  }

  return (
    <div className="glass rounded-xl p-4 shrink-0">
      <div className="flex items-center justify-between mb-3">
        <span className="text-[12px] font-mono text-slate-400 tracking-wide">
          FACE_DATA · MediaPipe 面部数据
        </span>
        <span className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
          {frames.length} 帧
        </span>
      </div>

      {/* 当前情绪 */}
      <div className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-lg bg-ink-800/60 border border-cyan-glow/10 flex items-center justify-center">
          <span className="text-lg">{getEmoji(emotion.label)}</span>
        </div>
        <div className="flex-1">
          <div className={`text-[14px] font-semibold ${emotionColors[emotion.label] || 'text-slate-200'}`}>
            {emotion.label}
          </div>
          <div className="text-[10px] text-slate-500 font-mono">
            置信度: {(emotion.value * 100).toFixed(0)}%
          </div>
        </div>
        {/* 情绪强度条 */}
        <div className="w-16 h-2 rounded-full bg-ink-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-cyan-glow to-cyan-soft transition-all"
            style={{ width: `${emotion.value * 100}%` }}
          />
        </div>
      </div>

      {/* 情绪时间线（简化） */}
      <div className="flex items-end gap-0.5 h-8">
        {frames.slice(0, 40).map((f, i) => {
          const val = f.emotion?.value || 0.1
          return (
            <div
              key={i}
              className="flex-1 rounded-t-sm bg-cyan-glow/40"
              style={{ height: `${val * 100}%` }}
              title={`${f.emotion?.label}: ${(val * 100).toFixed(0)}%`}
            />
          )
        })}
      </div>
      <div className="text-[9px] text-slate-500 mt-1">情绪变化趋势</div>
    </div>
  )
}

function getEmoji(emotion) {
  const map = {
    Confusion: '😕',
    Surprise: '😲',
    Frustration: '😣',
    Focus: '🧐',
    Neutral: '😐'
  }
  return map[emotion] || '😐'
}
