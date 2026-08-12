import React from 'react'

/**
 * 优惠券弹窗 —— 核心测试场景
 * 双按钮文案歧义是诊断焦点
 */
export default function CouponPopup({ onDecision }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* 遮罩 */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={() => onDecision(false)}
      />

      {/* 弹窗主体 */}
      <div className="relative w-[340px] rounded-2xl bg-white shadow-2xl overflow-hidden animate-[popIn_.3s_ease-out]">
        {/* 顶部渐变区 */}
        <div className="relative h-28 bg-gradient-to-br from-amber-400 via-orange-400 to-rose-500 flex items-center justify-center">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_30%_20%,white,transparent)]" />
          <div className="text-center text-white relative">
            <div className="text-[11px] tracking-[0.3em] opacity-90 font-medium">EXCLUSIVE</div>
            <div className="text-4xl font-extrabold leading-none mt-1">¥ 50</div>
            <div className="text-[11px] opacity-90 mt-1">满 199 元可用 · 仅限今日</div>
          </div>
          {/* 两侧半圆镂空 */}
          <div className="absolute -left-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F5F5F7]" />
          <div className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-[#F5F5F7]" />
        </div>

        {/* 内容区 */}
        <div className="px-6 py-5 text-center">
          <div className="text-[15px] font-semibold text-slate-800">
            恭喜获得专属优惠券！
          </div>
          <div className="text-[12px] text-slate-500 mt-1.5 leading-relaxed">
            本券仅限当前订单使用，过期将自动失效<br />
            您确定要在本单使用吗？
          </div>

          {/* 双按钮 —— 文案歧义：两个选项权重接近，用户难以决策 */}
          <div className="mt-5 grid grid-cols-2 gap-3">
            <button
              onClick={() => onDecision(false)}
              className="py-2.5 rounded-xl bg-slate-100 text-slate-600 text-[13px] font-medium hover:bg-slate-200 active:scale-[0.98] transition-all"
            >
              稍后再用
            </button>
            <button
              onClick={() => onDecision(true)}
              className="py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 text-white text-[13px] font-semibold shadow-sm hover:shadow active:scale-[0.98] transition-all"
            >
              立即使用
            </button>
          </div>

          <div className="mt-3 text-[10px] text-slate-400">
            今日已有 2,847 人使用此优惠券
          </div>
        </div>
      </div>
    </div>
  )
}
