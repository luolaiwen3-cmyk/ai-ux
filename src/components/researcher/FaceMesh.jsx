import React from 'react'

/**
 * MediaPipe 人脸 Mesh 网格组件
 * 支持三种模式：
 * 1. snapshot: 显示真实视频截图 + Mesh 叠加
 * 2. real: 渲染 468 个真实 landmark 点（无截图时）
 * 3. simulated: 渲染简化的面部网格（降级）
 */
export default function FaceMesh({ landmarks, mode = 'simulated', snapshot = null }) {
  // 有视频截图：显示截图 + Mesh 叠加
  if (snapshot) {
    return <SnapshotFaceMesh snapshot={snapshot} landmarks={landmarks} />
  }

  // 真实模式：渲染 MediaPipe 468 点 landmark
  if (mode === 'real' && landmarks && landmarks.length > 0) {
    return <RealFaceMesh landmarks={landmarks} />
  }

  // 模拟模式：简化版面部网格
  return <SimulatedFaceMesh />
}

/**
 * 视频截图 + Mesh 叠加 —— 回放时显示真实面部画面
 */
function SnapshotFaceMesh({ snapshot, landmarks }) {
  return (
    <div className="absolute inset-0 w-full h-full">
      {/* 视频截图背景 */}
      <img
        src={snapshot}
        alt="face snapshot"
        className="absolute inset-0 w-full h-full object-cover"
      />
      {/* 面部 Mesh 叠加 */}
      {landmarks && landmarks.leftEye && (
        <svg
          viewBox="0 0 100 100"
          className="absolute inset-0 w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {/* 关键点 */}
          {Object.entries(landmarks).map(([name, lm]) => {
            if (!lm) return null
            return (
              <circle
                key={name}
                cx={lm.x * 100}
                cy={lm.y * 100}
                r="1.2"
                fill="#22E6C8"
                opacity="0.8"
              />
            )
          })}
          {/* 轮廓线连接 */}
          {landmarks.leftEye && landmarks.rightEye && landmarks.nose && (
            <>
              <line x1={landmarks.leftEye.x * 100} y1={landmarks.leftEye.y * 100}
                x2={landmarks.nose.x * 100} y2={landmarks.nose.y * 100}
                stroke="#22E6C8" strokeWidth="0.3" opacity="0.5" />
              <line x1={landmarks.rightEye.x * 100} y1={landmarks.rightEye.y * 100}
                x2={landmarks.nose.x * 100} y2={landmarks.nose.y * 100}
                stroke="#22E6C8" strokeWidth="0.3" opacity="0.5" />
              <line x1={landmarks.leftEye.x * 100} y1={landmarks.leftEye.y * 100}
                x2={landmarks.rightEye.x * 100} y2={landmarks.rightEye.y * 100}
                stroke="#22E6C8" strokeWidth="0.3" opacity="0.5" />
            </>
          )}
        </svg>
      )}
    </div>
  )
}

/**
 * 真实面部 Mesh —— 渲染 MediaPipe 468 个关键点
 */
function RealFaceMesh({ landmarks }) {
  // MediaPipe 面部轮廓连接定义（简化版，只画主要轮廓）
  const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109]
  const LEFT_EYE = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246]
  const RIGHT_EYE = [263, 249, 390, 373, 374, 380, 381, 382, 362, 398, 384, 385, 386, 387, 388, 466]
  const LEFT_BROW = [46, 53, 52, 65, 55, 63, 70, 105, 66, 107]
  const RIGHT_BROW = [276, 283, 282, 295, 285, 293, 300, 334, 296, 336]
  const LIPS_OUTER = [61, 146, 91, 181, 84, 17, 314, 405, 321, 375, 291, 409, 270, 269, 267, 0, 37, 39, 40, 185]

  // 将 landmark 坐标（0-1）映射到 SVG viewBox
  const toSVG = (lm) => ({ x: lm.x * 100, y: lm.y * 100 })

  // 生成轮廓路径
  const getPath = (indices) => {
    const points = indices.map(i => landmarks[i]).filter(Boolean)
    if (points.length < 3) return ''
    const svgPoints = points.map(toSVG)
    return `M ${svgPoints.map(p => `${p.x},${p.y}`).join(' L ')} Z`
  }

  // 关键点
  const keyPoints = {
    leftEye: landmarks[33],
    rightEye: landmarks[263],
    nose: landmarks[4],
    leftBrow: landmarks[105],
    rightBrow: landmarks[334],
    upperLip: landmarks[13],
    lowerLip: landmarks[14],
    leftCheek: landmarks[234],
    rightCheek: landmarks[454],
    chin: landmarks[152]
  }

  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="meshGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22E6C8" />
          <stop offset="100%" stopColor="#3FB7FF" />
        </linearGradient>
      </defs>

      {/* 面部轮廓 */}
      <path d={getPath(FACE_OVAL)} fill="none" stroke="url(#meshGrad)" strokeWidth="0.25" opacity="0.6" />

      {/* 眼睛 */}
      <path d={getPath(LEFT_EYE)} fill="none" stroke="#3FB7FF" strokeWidth="0.2" opacity="0.8" />
      <path d={getPath(RIGHT_EYE)} fill="none" stroke="#3FB7FF" strokeWidth="0.2" opacity="0.8" />

      {/* 眉毛 */}
      <path d={getPath(LEFT_BROW)} fill="none" stroke="#22E6C8" strokeWidth="0.2" opacity="0.7" />
      <path d={getPath(RIGHT_BROW)} fill="none" stroke="#22E6C8" strokeWidth="0.2" opacity="0.7" />

      {/* 嘴唇 */}
      <path d={getPath(LIPS_OUTER)} fill="none" stroke="#22E6C8" strokeWidth="0.2" opacity="0.7" />

      {/* 关键点 */}
      {Object.entries(keyPoints).map(([name, lm]) => {
        if (!lm) return null
        const { x, y } = toSVG(lm)
        return (
          <circle key={name} cx={x} cy={y} r="0.6" fill="#22E6C8" opacity="0.9" />
        )
      })}

      {/* 中心追踪点 */}
      <circle cx={keyPoints.nose ? toSVG(keyPoints.nose).x : 50} cy={keyPoints.nose ? toSVG(keyPoints.nose).y : 50} r="1" fill="#FF4D6A" opacity="0.9">
        <animate attributeName="r" values="0.8;1.4;0.8" dur="1.2s" repeatCount="indefinite" />
      </circle>
    </svg>
  )
}

/**
 * 模拟面部 Mesh —— 无真实数据时的降级方案
 */
function SimulatedFaceMesh() {
  return (
    <svg
      viewBox="0 0 100 100"
      className="absolute inset-0 w-full h-full"
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="meshGrad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#22E6C8" />
          <stop offset="100%" stopColor="#3FB7FF" />
        </linearGradient>
      </defs>

      {/* 面部轮廓 */}
      <ellipse cx="50" cy="52" rx="26" ry="32" fill="none" stroke="url(#meshGrad)" strokeWidth="0.3" opacity="0.7" />
      <line x1="50" y1="22" x2="50" y2="82" stroke="#22E6C8" strokeWidth="0.15" opacity="0.35" />
      <line x1="22" y1="52" x2="78" y2="52" stroke="#22E6C8" strokeWidth="0.15" opacity="0.35" />

      {/* 左眼 */}
      <ellipse cx="39" cy="45" rx="6" ry="3" fill="none" stroke="#3FB7FF" strokeWidth="0.25" />
      <circle cx="39" cy="45" r="1.1" fill="#22E6C8" opacity="0.85" />
      {/* 右眼 */}
      <ellipse cx="61" cy="45" rx="6" ry="3" fill="none" stroke="#3FB7FF" strokeWidth="0.25" />
      <circle cx="61" cy="45" r="1.1" fill="#22E6C8" opacity="0.85" />

      {/* 眉毛 */}
      <path d="M32 39 Q39 36 46 39" fill="none" stroke="#22E6C8" strokeWidth="0.3" opacity="0.7" />
      <path d="M54 39 Q61 36 68 39" fill="none" stroke="#22E6C8" strokeWidth="0.3" opacity="0.7" />

      {/* 鼻子 */}
      <path d="M50 47 L50 58 M45 60 Q50 63 55 60" fill="none" stroke="#3FB7FF" strokeWidth="0.25" opacity="0.6" />

      {/* 嘴唇 */}
      <path d="M40 68 Q50 65 60 68" fill="none" stroke="#22E6C8" strokeWidth="0.3" opacity="0.7" />
      <path d="M42 72 Q50 76 58 72" fill="none" stroke="#22E6C8" strokeWidth="0.3" opacity="0.7" />

      {/* 散点模拟 mesh 节点 */}
      {Array.from({ length: 32 }).map((_, i) => {
        const angle = (i / 32) * Math.PI * 2
        const rx = 24 + Math.random() * 2
        const ry = 30 + Math.random() * 2
        const x = 50 + Math.cos(angle) * rx
        const y = 52 + Math.sin(angle) * ry
        return <circle key={i} cx={x} cy={y} r="0.35" fill="#22E6C8" opacity="0.5" />
      })}

      {/* 中心追踪点 */}
      <circle cx="50" cy="52" r="1.2" fill="#FF4D6A" opacity="0.85">
        <animate attributeName="r" values="1;1.6;1" dur="1.2s" repeatCount="indefinite" />
      </circle>

      {/* 扫描线 */}
      <line x1="20" y1="0" x2="20" y2="100" stroke="#22E6C8" strokeWidth="0.3" opacity="0.5">
        <animate attributeName="x1" values="20;80;20" dur="2.4s" repeatCount="indefinite" />
        <animate attributeName="x2" values="20;80;20" dur="2.4s" repeatCount="indefinite" />
      </line>
    </svg>
  )
}
