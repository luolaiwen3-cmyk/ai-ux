import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'
import ReplayViewport from '../../components/researcher/ReplayViewport.jsx'
import StressChart from '../../components/researcher/StressChart.jsx'
import Timeline from '../../components/researcher/Timeline.jsx'
import BehaviorCards from '../../components/researcher/BehaviorCards.jsx'
import DiagnosisPanel from '../../components/researcher/DiagnosisPanel.jsx'
import { mouseTrail, clickEvents, timelineEvents, stressData, behaviorStats, sessionMeta } from '../../data/sessionData.js'
import { sessionsApi } from '../../api/client.js'

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
  const [session, setSession] = useState(null)
  const [rrwebEvents, setRrwebEvents] = useState([])
  const [faceFrames, setFaceFrames] = useState([])
  const [loadState, setLoadState] = useState('loading')
  const [loadError, setLoadError] = useState('')
  const duration = Math.max(1, (session?.duration_ms || 20000) / 1000)
  const rafRef = useRef(null)
  const lastTimeRef = useRef(null)

  useEffect(() => {
    setLoadState('loading')
    Promise.all([sessionsApi.detail(id), sessionsApi.rrweb(id), sessionsApi.faceFrames(id)])
      .then(([detail, events, frames]) => {
        setSession(detail)
        setRrwebEvents(events)
        setFaceFrames(frames)
        setLoadState('ready')
      })
      .catch((error) => {
        setLoadError(error.message)
        setLoadState('error')
      })
  }, [id])

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

  if (loadState === 'loading') return <AnalystLayout><div className="p-10 text-sm text-slate-500">正在加载会话数据…</div></AnalystLayout>
  if (loadState === 'error') return <AnalystLayout><div className="p-10"><div className="text-sm text-red-600">{loadError}</div><Link to="/sessions" className="text-sm underline mt-3 inline-block">返回会话列表</Link></div></AnalystLayout>

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
                会话 {id}
              </h1>
              <p className="text-[10px] text-slate-500 font-mono">
                {session.participant_id} · {session.task_name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {rrwebEvents.length > 0 && (
              <span className="px-2 py-0.5 rounded text-[9px] font-mono bg-emerald-500/15 text-emerald-400 border border-emerald-500/20">
                rrweb 真实录制
              </span>
            )}
            <Link
              to={`/report/${id}`}
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
              sessionId={id}
              events={rrwebEvents}
              faceFrames={faceFrames}
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
            <BehaviorCards stats={{ ...behaviorStats, totalDuration: `${duration.toFixed(1)}s`, totalClicks: session.event_count }} meta={{ ...sessionMeta, participant: session.participant_id, task: session.task_name }} />
            {faceFrames.length > 0 && <FaceDataCard frames={faceFrames} currentTime={currentTime} />}
            <StressChart data={stressData} currentTime={currentTime} duration={duration} />
            <DiagnosisPanel sessionId={id} initialHasReport={session.has_report} />
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
