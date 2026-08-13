import React from 'react'

/** 渲染真实低清缩略图与采集到的关键面部点；没有数据时保持空状态。 */
export default function FaceMesh({ landmarks, snapshot = null }) {
  return (
    <div className="absolute inset-0 w-full h-full bg-slate-900">
      {snapshot && <img src={snapshot} alt="被试面部低清采集帧" className="absolute inset-0 w-full h-full object-cover" />}
      {landmarks && Object.keys(landmarks).length > 0 ? (
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          {Object.entries(landmarks).map(([name, point]) => point && (
            <circle key={name} cx={point.x * 100} cy={point.y * 100} r="1.1" fill="#22E6C8" opacity="0.9" />
          ))}
          {landmarks.leftEye && landmarks.rightEye && landmarks.nose && (
            <path
              d={`M ${landmarks.leftEye.x * 100} ${landmarks.leftEye.y * 100} L ${landmarks.nose.x * 100} ${landmarks.nose.y * 100} L ${landmarks.rightEye.x * 100} ${landmarks.rightEye.y * 100}`}
              fill="none"
              stroke="#22E6C8"
              strokeWidth="0.4"
              opacity="0.65"
            />
          )}
        </svg>
      ) : !snapshot ? (
        <div className="absolute inset-0 flex items-center justify-center text-[8px] font-mono text-slate-500">NO FACE FRAME</div>
      ) : null}
    </div>
  )
}
