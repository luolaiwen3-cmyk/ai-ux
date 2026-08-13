import React, { useMemo } from 'react'
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceDot,
  ReferenceLine,
  Area
} from 'recharts'

/**
 * 认知压力折线图 —— 带当前时间指示器
 */
export default function StressChart({ data, currentTime, duration }) {
  const peak = useMemo(() => (data || []).reduce((highest, point) => point.stress > highest.stress ? point : highest, { t: 0, stress: 0 }), [data])
  const ticks = useMemo(() => {
    const step = Math.max(1, duration / 4)
    return [0, step, step * 2, step * 3, duration].map((value) => Number(value.toFixed(1)))
  }, [duration])

  return (
    <div className="glass rounded-xl p-4 shrink-0">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[12px] font-mono text-slate-400 tracking-wide">
          COGNITIVE_STRESS · 认知压力曲线
        </span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-cyan-glow rounded" /> 压力值
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-0.5 bg-danger rounded" /> Peak
          </span>
        </div>
      </div>

      <div className="h-[160px]">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="stressFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#22E6C8" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#22E6C8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" />
            <XAxis
              dataKey="t"
              type="number"
              domain={[0, duration]}
              ticks={ticks}
              tick={{ fill: '#374151', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              tickFormatter={(v) => `${v}s`}
              stroke="#d1d5db"
            />
            <YAxis
              domain={[0, 1]}
              ticks={[0, 0.25, 0.5, 0.75, 1]}
              tick={{ fill: '#374151', fontSize: 9, fontFamily: 'JetBrains Mono' }}
              stroke="#d1d5db"
              tickFormatter={(v) => v.toFixed(2)}
            />
            <Tooltip
              contentStyle={{
                background: '#ffffff',
                border: '1px solid #d1d5db',
                borderRadius: 8,
                fontSize: 11,
                fontFamily: 'JetBrains Mono',
                color: '#111827'
              }}
              labelFormatter={(v) => `t = ${Number(v).toFixed(2)}s`}
              formatter={(v) => [Number(v).toFixed(3), '压力值']}
            />
            {/* 警戒线 */}
            <ReferenceLine y={0.8} stroke="#FF4D6A" strokeDasharray="4 4" strokeOpacity={0.5} />
            {/* 当前时间竖线 */}
            <ReferenceLine
              x={currentTime}
              stroke="#3FB7FF"
              strokeDasharray="2 2"
              strokeOpacity={0.6}
            />
            {peak.stress > 0 && <ReferenceDot x={peak.t} y={peak.stress} r={5} fill="#FF4D6A" fillOpacity="0.9" stroke="#fff" strokeWidth={1} />}
            {peak.stress > 0 && <ReferenceDot x={peak.t} y={peak.stress} r={11} fill="#FF4D6A" fillOpacity="0.15" stroke="none" />}
            <Area type="monotone" dataKey="stress" stroke="none" fill="url(#stressFill)" />
            <Line
              type="monotone"
              dataKey="stress"
              stroke="#22E6C8"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 3, fill: '#22E6C8', stroke: '#070A0F', strokeWidth: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
