import React from 'react'

const products = [
  {
    id: 0,
    name: 'Sony WH-1000XM5 头戴式降噪耳机',
    desc: '银色 · 30小时续航 · 主动降噪',
    price: 2499,
    originalPrice: 2899,
    image: '🎧'
  },
  {
    id: 1,
    name: 'Keychron Q1 Pro 机械键盘',
    desc: '碳黑色 · 佳达隆红轴 · 蓝牙双模',
    price: 1198,
    originalPrice: 1398,
    image: '⌨️'
  },
  {
    id: 2,
    name: 'Herman Miller Aeron 人体工学椅',
    desc: '石墨灰 · Size B · 全网面',
    price: 8800,
    originalPrice: 12800,
    image: '🪑'
  }
]

export default function ProductList({ selectedItems, onToggle }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-5 py-3 border-b border-slate-100 flex items-center justify-between">
        <span className="text-sm font-medium text-slate-900">商品清单</span>
        <span className="text-xs text-slate-500">已选 {selectedItems.length} 件</span>
      </div>

      <div className="divide-y divide-slate-100">
        {products.map((p) => {
          const selected = selectedItems.includes(p.id)
          return (
            <div
              key={p.id}
              className={`flex items-center gap-4 px-5 py-4 transition-colors ${
                selected ? 'bg-white' : 'bg-slate-50/50'
              }`}
            >
              {/* 勾选框 */}
              <button
                onClick={() => onToggle(p.id)}
                className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected
                    ? 'bg-orange-500 border-orange-500 text-white'
                    : 'border-slate-300 hover:border-orange-400'
                }`}
              >
                {selected && (
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </button>

              {/* 商品图 */}
              <div className="w-14 h-14 rounded-lg bg-slate-100 flex items-center justify-center text-2xl shrink-0">
                {p.image}
              </div>

              {/* 商品信息 */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-900 truncate">{p.name}</div>
                <div className="text-xs text-slate-500 mt-0.5">{p.desc}</div>
              </div>

              {/* 价格 */}
              <div className="text-right shrink-0">
                <div className="text-sm font-semibold text-slate-900">¥{p.price.toLocaleString()}</div>
                <div className="text-xs text-slate-400 line-through">¥{p.originalPrice.toLocaleString()}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
