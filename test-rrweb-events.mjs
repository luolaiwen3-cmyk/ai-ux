/**
 * 测试 rrweb 在静态页面（无用户操作）下的事件频率
 * 找出事件爆炸的根因
 */
import { JSDOM } from 'jsdom'

const dom = new JSDOM(`<!DOCTYPE html>
<html>
<head>
  <style>
    @keyframes ping { 75%, 100% { transform: scale(2); opacity: 0; } }
    @keyframes blink { 50% { opacity: 0.25; } }
    .animate-ping { animation: ping 1.8s cubic-bezier(0,0,0.6,1) infinite; }
    .animate-blink { animation: blink 1.2s ease-in-out infinite; }
  </style>
</head>
<body>
  <div id="app">
    <div class="status">
      <span class="animate-ping"></span>
      <span class="animate-blink"></span>
      <span>测试记录中</span>
    </div>
    <div class="content">
      <div class="product">商品 1</div>
      <div class="product">商品 2</div>
    </div>
  </div>
</body>
</html>`, { url: 'http://localhost', pretendToBeVisual: true })

// 设置全局 DOM
Object.assign(global, {
  window: dom.window,
  document: dom.window.document,
  HTMLElement: dom.window.HTMLElement,
  HTMLFormElement: dom.window.HTMLFormElement,
  HTMLInputElement: dom.window.HTMLInputElement,
  HTMLDivElement: dom.window.HTMLDivElement,
  HTMLButtonElement: dom.window.HTMLButtonElement,
  HTMLAnchorElement: dom.window.HTMLAnchorElement,
  HTMLImageElement: dom.window.HTMLImageElement,
  HTMLSpanElement: dom.window.HTMLSpanElement,
  Node: dom.window.Node,
  Element: dom.window.Element,
  Text: dom.window.Text,
  Comment: dom.window.Comment,
  MutationObserver: dom.window.MutationObserver,
  Event: dom.window.Event,
  CustomEvent: dom.window.CustomEvent,
  requestAnimationFrame: (cb) => setTimeout(cb, 16),
  cancelAnimationFrame: (id) => clearTimeout(id),
  getComputedStyle: dom.window.getComputedStyle.bind(dom.window),
  NodeFilter: dom.window.NodeFilter,
  TreeWalker: dom.window.TreeWalker,
  URL: dom.window.URL,
  location: dom.window.location,
  localStorage: dom.window.localStorage,
  sessionStorage: dom.window.sessionStorage
})

const { record } = await import('rrweb')

console.log('='.repeat(60))
console.log('  rrweb 事件频率测试（无用户操作）')
console.log('='.repeat(60))

// 测试 1: 默认配置
console.log('\n📋 测试 1: 默认 sampling 配置')
console.log('-'.repeat(40))

let events1 = []
const stop1 = record({
  emit(event) { events1.push(event) },
  maskAllInputs: true
})

await new Promise(r => setTimeout(r, 3000))
stop1()

const stats1 = {}
events1.forEach(e => {
  const name = ['FullSnapshot','IncrementalSnapshot','Mutation','Mouse','Scroll','Input','ViewportResize'][e.type] || `Type${e.type}`
  stats1[name] = (stats1[name] || 0) + 1
})

console.log(`3秒内事件数: ${events1.length}`)
Object.entries(stats1).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v/3).toFixed(1)}/s)`)
})

// 测试 2: 加 mousemove 降采样
console.log('\n📋 测试 2: mousemove 200ms 降采样')
console.log('-'.repeat(40))

let events2 = []
const stop2 = record({
  emit(event) { events2.push(event) },
  maskAllInputs: true,
  sampling: { mousemove: 200, scroll: 150 }
})

await new Promise(r => setTimeout(r, 3000))
stop2()

const stats2 = {}
events2.forEach(e => {
  const name = ['FullSnapshot','IncrementalSnapshot','Mutation','Mouse','Scroll','Input','ViewportResize'][e.type] || `Type${e.type}`
  stats2[name] = (stats2[name] || 0) + 1
})

console.log(`3秒内事件数: ${events2.length}`)
Object.entries(stats2).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v/3).toFixed(1)}/s)`)
})

// 测试 3: 完全忽略 style 变化（通过 blockClass）
console.log('\n📋 测试 3: blockClass 忽略动画元素')
console.log('-'.repeat(40))

let events3 = []
const stop3 = record({
  emit(event) { events3.push(event) },
  maskAllInputs: true,
  sampling: { mousemove: 200, scroll: 150 },
  blockSelector: '.animate-ping, .animate-blink, [class*="animate-"]',
  ignoreCSSAttributes: new Set(['animation', 'transform', 'opacity'])
})

await new Promise(r => setTimeout(r, 3000))
stop3()

const stats3 = {}
events3.forEach(e => {
  const name = ['FullSnapshot','IncrementalSnapshot','Mutation','Mouse','Scroll','Input','ViewportResize'][e.type] || `Type${e.type}`
  stats3[name] = (stats3[name] || 0) + 1
})

console.log(`3秒内事件数: ${events3.length}`)
Object.entries(stats3).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v/3).toFixed(1)}/s)`)
})

// 测试 4: 只录制交互（最严格）
console.log('\n📋 测试 4: 只录制交互（mousemove false）')
console.log('-'.repeat(40))

let events4 = []
const stop4 = record({
  emit(event) { events4.push(event) },
  maskAllInputs: true,
  sampling: {
    mousemove: false,  // 不录 mousemove
    mouseInteraction: true,  // 只录点击等交互
    scroll: 500,
    input: 'last'
  },
  blockSelector: '.animate-ping, .animate-blink, [class*="animate-"]'
})

await new Promise(r => setTimeout(r, 3000))
stop4()

const stats4 = {}
events4.forEach(e => {
  const name = ['FullSnapshot','IncrementalSnapshot','Mutation','Mouse','Scroll','Input','ViewportResize'][e.type] || `Type${e.type}`
  stats4[name] = (stats4[name] || 0) + 1
})

console.log(`3秒内事件数: ${events4.length}`)
Object.entries(stats4).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => {
  console.log(`  ${k}: ${v} (${(v/3).toFixed(1)}/s)`)
})

// 总结
console.log('\n' + '='.repeat(60))
console.log('  结论')
console.log('='.repeat(60))
console.log(`
配置对比（3秒内事件数）:
  默认配置:              ${events1.length} 个
  mousemove 200ms:       ${events2.length}个
  + blockClass 忽略动画: ${events3.length}个
  + mousemove false:     ${events4.length}个

建议:
  1. CSS 动画（animate-ping, animate-blink）是事件爆炸的主因
  2. 使用 blockSelector 忽略动画元素
  3. 或设置 sampling.mousemove = false 只录交互
  4. 生产环境建议: blockSelector + mousemove 200ms + scroll 150ms
`)
