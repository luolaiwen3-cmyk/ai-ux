import React from 'react'

export default function OrderSummary({ selectedCount, couponApplied }) {
  const subtotal = 12497
  const discount = couponApplied ? 50 : 0
  const shipping = 0
  const total = subtotal - discount + shipping

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden sticky top-20">
      <div className="px-5 py-3 border-b border-slate-100">
        <span className="text-sm font-medium text-slate-900">订单摘要</span>
      </div>

      <div className="px-5 py-4 space-y-3">
        <div className="flex justify-between text-sm text-slate-600">
          <span>商品金额 ({selectedCount}件)</span>
          <span className="font-mono">¥{subtotal.toLocaleString()}</span>
        </div>

        <div className="flex justify-between text-sm text-slate-600">
          <span>运费</span>
          <span className="text-emerald-600 font-medium">免运费</span>
        </div>

        {couponApplied && (
          <div className="flex justify-between text-sm text-orange-600">
            <span className="flex items-center gap-1">
              <span className="px-1.5 py-0.5 rounded bg-orange-100 text-[10px] font-medium">优惠券</span>
              专属满减券
            </span>
            <span className="font-mono">-¥{discount}</span>
          </div>
        )}

        {!couponApplied && (
          <div className="flex justify-between text-sm text-slate-400">
            <span>优惠券</span>
            <span>未使用</span>
          </div>
        )}

        <div className="border-t border-slate-100 pt-3 flex justify-between items-baseline">
          <span className="text-sm text-slate-700 font-medium">应付总额</span>
          <span className="text-2xl font-bold text-orange-600 font-mono">
            ¥{total.toLocaleString()}
          </span>
        </div>
      </div>

      <div className="px-5 pb-5">
        <button className="w-full py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors shadow-sm">
          提交订单
        </button>
        <p className="text-[10px] text-slate-400 text-center mt-2">
          点击提交订单即表示同意《用户协议》
        </p>
      </div>
    </div>
  )
}
