import React from 'react'

/**
 * 模拟 MediaPipe 人脸 Mesh 网格 —— SVG 简化版
 * 468 个关键点的简化表示：轮廓、眼睛、眉毛、嘴唇 + 散点
 */
export default function FaceMesh() {
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
