/**
 * 模拟一次完整的被试测试会话数据
 * 用于后台分析端的回放与诊断
 */

// 鼠标移动轨迹（时间 ms, x%, y%）—— 模拟真实浏览路径
export const mouseTrail = [
  { t: 0, x: 50, y: 10 },
  { t: 200, x: 48, y: 15 },
  { t: 500, x: 45, y: 22 },
  { t: 800, x: 42, y: 28 },
  { t: 1100, x: 40, y: 35 },
  { t: 1400, x: 38, y: 42 },
  { t: 1700, x: 42, y: 48 },
  { t: 2000, x: 50, y: 52 },
  { t: 2300, x: 55, y: 55 },
  { t: 2600, x: 52, y: 58 },
  { t: 2900, x: 48, y: 60 },
  { t: 3200, x: 45, y: 62 },
  // 弹窗出现，视线回到中央
  { t: 3500, x: 50, y: 50 },
  { t: 3800, x: 52, y: 48 },
  { t: 4100, x: 55, y: 46 },
  // 在两个按钮之间徘徊
  { t: 4500, x: 42, y: 62 },
  { t: 4900, x: 44, y: 63 },
  { t: 5300, x: 55, y: 62 },
  { t: 5700, x: 58, y: 63 },
  { t: 6100, x: 43, y: 62 },
  { t: 6500, x: 46, y: 63 },
  { t: 6900, x: 56, y: 62 },
  { t: 7300, x: 44, y: 63 },
  { t: 7700, x: 47, y: 62 },
  { t: 8100, x: 54, y: 63 },
  // 长时间犹豫
  { t: 9000, x: 48, y: 62 },
  { t: 10000, x: 50, y: 63 },
  { t: 11000, x: 46, y: 62 },
  { t: 12000, x: 52, y: 63 },
  { t: 13000, x: 49, y: 62 },
  { t: 14000, x: 50, y: 63 },
  // 最终点击「立即使用」
  { t: 14500, x: 56, y: 63 },
  { t: 14800, x: 57, y: 63 },
  { t: 15000, x: 58, y: 63 },
  // 点击后向下滚动确认
  { t: 15500, x: 55, y: 70 },
  { t: 16000, x: 52, y: 75 },
  { t: 17000, x: 50, y: 80 },
  { t: 18500, x: 48, y: 85 },
  { t: 20000, x: 50, y: 88 }
]

// 点击事件
export const clickEvents = [
  { t: 4500, x: 42, y: 62, target: 'coupon-btn-later', label: '点击「稍后再用」(犹豫)' },
  { t: 5300, x: 55, y: 62, target: 'coupon-btn-now', label: '点击「立即使用」(犹豫)' },
  { t: 6100, x: 43, y: 62, target: 'coupon-btn-later', label: '再次点击「稍后再用」' },
  { t: 15000, x: 58, y: 63, target: 'coupon-btn-now', label: '最终确认「立即使用」' }
]

// 时间轴关键事件标记
export const timelineEvents = [
  { t: 0, type: 'start', label: '页面加载' },
  { t: 3500, type: 'popup', label: '优惠券弹窗出现' },
  { t: 4500, type: 'click', label: '首次点击尝试' },
  { t: 8000, type: 'confusion', label: '困惑指数上升' },
  { t: 14500, type: 'peak', label: '认知压力 Peak' },
  { t: 15000, type: 'decision', label: '做出决策' },
  { t: 20000, type: 'end', label: '会话结束' }
]

// 认知压力数据（用于折线图）
export const stressData = (() => {
  const points = []
  for (let t = 0; t <= 20; t += 0.25) {
    let v
    if (t < 3.5) v = 0.1 + Math.random() * 0.04
    else if (t < 6) v = 0.15 + (t - 3.5) * 0.06 + Math.random() * 0.04
    else if (t < 10) v = 0.3 + (t - 6) * 0.05 + Math.random() * 0.03
    else if (t < 14) v = 0.5 + (t - 10) * 0.06 + Math.random() * 0.03
    else if (Math.abs(t - 14.5) < 0.5) v = 0.88 + Math.random() * 0.08
    else v = 0.55 - (t - 15) * 0.02 + Math.random() * 0.04
    points.push({
      t: Number(t.toFixed(2)),
      stress: Number(Math.max(0.05, Math.min(0.99, v)).toFixed(3))
    })
  }
  return points
})()

// 行为统计数据
export const behaviorStats = {
  totalDuration: '20.0s',
  popupAppearAt: '3.5s',
  timeToFirstClick: '1.0s',
  totalClicks: 4,
  hesitationTime: '11.5s',
  mouseDistance: '1,247px',
  backAndForth: 3,
  finalDecision: '立即使用'
}

// 会话元信息
export const sessionMeta = {
  id: 'UX-2026-0812-0037',
  participant: 'P-042 · 女 · 25-30岁',
  task: '完成购物车结算并使用优惠券',
  browser: 'Chrome 126 · 1920×1080',
  startedAt: '2026-08-12 13:21:08'
}
