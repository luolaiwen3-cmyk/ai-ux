import React, { useState, useEffect } from 'react'
import ProductList from './ProductList.jsx'
import CouponPopup from './CouponPopup.jsx'
import OrderSummary from './OrderSummary.jsx'

/**
 * 真实的电商结算页 —— 被试实际操作的主界面
 * 包含：顶部导航、商品列表、订单摘要、优惠券弹窗
 */
export default function CheckoutPage({ onDecision, onSubmit }) {
  const [showPopup, setShowPopup] = useState(false)
  const [couponApplied, setCouponApplied] = useState(false)
  const [selectedItems, setSelectedItems] = useState([0, 1, 2])

  // 3.5s 后自动弹出优惠券弹窗（模拟真实场景）
  useEffect(() => {
    const timer = setTimeout(() => setShowPopup(true), 3500)
    return () => clearTimeout(timer)
  }, [])

  const handleCouponDecision = (use) => {
    setShowPopup(false)
    if (use) setCouponApplied(true)
    // 通知父组件用户已做出决策（仅记录决策，不停止录制）
    if (onDecision) onDecision(use)
  }

  const handleSubmit = () => {
    if (onSubmit) onSubmit()
  }

  const toggleItem = (idx) => {
    setSelectedItems((prev) =>
      prev.includes(idx) ? prev.filter((i) => i !== idx) : [...prev, idx]
    )
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7]">
      {/* 顶部导航 —— 模拟真实电商头部 */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="text-lg font-bold text-slate-900 tracking-tight">
              Shop<span className="text-orange-500">Demo</span>
            </div>
            <nav className="hidden md:flex items-center gap-5 text-sm text-slate-600">
              <a className="hover:text-slate-900">首页</a>
              <a className="text-slate-900 font-medium">购物车</a>
              <a className="hover:text-slate-900">我的订单</a>
              <a className="hover:text-slate-900">会员中心</a>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 text-xs">
              用
            </div>
          </div>
        </div>
      </header>

      {/* 面包屑 */}
      <div className="max-w-6xl mx-auto px-6 py-4">
        <div className="text-xs text-slate-500">
          首页 &gt; 购物车 &gt; <span className="text-slate-900">结算</span>
        </div>
      </div>

      {/* 主体内容 */}
      <main className="max-w-6xl mx-auto px-6 pb-24">
        <h1 className="text-xl font-semibold text-slate-900 mb-6">
          确认订单信息
        </h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧：商品列表 */}
          <div className="lg:col-span-2">
            <ProductList
              selectedItems={selectedItems}
              onToggle={toggleItem}
            />
          </div>

          {/* 右侧：订单摘要 */}
          <div className="lg:col-span-1">
            <OrderSummary
              selectedCount={selectedItems.length}
              couponApplied={couponApplied}
              onSubmit={handleSubmit}
            />
          </div>
        </div>
      </main>

      {/* 优惠券弹窗 */}
      {showPopup && (
        <CouponPopup onDecision={handleCouponDecision} />
      )}
    </div>
  )
}
