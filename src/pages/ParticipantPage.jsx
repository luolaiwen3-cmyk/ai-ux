import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import CheckoutPage from '../components/participant/CheckoutPage.jsx'

/**
 * 被试端页面 —— 真实比例的电商结算页
 * 用户在此自然操作，摄像头隐藏，仅极小记录提示
 */
export default function ParticipantPage() {
  return (
    <div className="relative z-10 min-h-screen bg-[#F5F5F7]">
      {/* 极小的记录提示 —— 不打扰用户 */}
      <div className="fixed top-3 right-3 z-50 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/70 backdrop-blur-sm border border-slate-200 shadow-sm">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
        </span>
        <span className="text-[10px] text-slate-500 font-medium">测试记录中</span>
      </div>

      {/* 被试看到的真实结算页 */}
      <CheckoutPage />

      {/* 隐藏的开发者入口 —— 模拟结束后可跳转后台 */}
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50">
        <Link
          to="/dashboard"
          className="px-4 py-2 rounded-lg bg-slate-900/80 backdrop-blur text-white text-xs font-medium shadow-lg hover:bg-slate-800 transition-colors border border-white/10"
        >
          🔬 进入后台分析工作台 →
        </Link>
      </div>
    </div>
  )
}
