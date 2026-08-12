import React, { useState } from 'react'
import AnalystLayout from '../../components/shared/AnalystLayout.jsx'

/**
 * A1 任务管理 —— 创建测试任务、生成测试链接
 */
export default function TaskManagePage() {
  const [tasks, setTasks] = useState([
    {
      id: 'TSK-001',
      name: '电商结算页优惠券弹窗测试',
      scenario: 'checkout-coupon',
      link: 'https://demo.insightux.io/join/abc123',
      sessions: 12,
      createdAt: '2026-08-10',
      status: 'active'
    },
    {
      id: 'TSK-002',
      name: '注册流程简化测试',
      scenario: 'signup-flow',
      link: 'https://demo.insightux.io/join/def456',
      sessions: 8,
      createdAt: '2026-08-11',
      status: 'active'
    },
    {
      id: 'TSK-003',
      name: 'SaaS 仪表盘导航测试',
      scenario: 'saas-dashboard',
      link: 'https://demo.insightux.io/join/ghi789',
      sessions: 0,
      createdAt: '2026-08-12',
      status: 'draft'
    }
  ])

  const [showCreate, setShowCreate] = useState(false)
  const [newTask, setNewTask] = useState({ name: '', scenario: 'checkout-coupon' })

  const handleCreate = () => {
    if (!newTask.name.trim()) return
    const id = `TSK-${String(tasks.length + 1).padStart(3, '0')}`
    setTasks([
      {
        id,
        name: newTask.name,
        scenario: newTask.scenario,
        link: `https://demo.insightux.io/join/${Math.random().toString(36).slice(2, 8)}`,
        sessions: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        status: 'active'
      },
      ...tasks
    ])
    setNewTask({ name: '', scenario: 'checkout-coupon' })
    setShowCreate(false)
  }

  const copyLink = (link) => {
    navigator.clipboard?.writeText(link)
  }

  const scenarioLabels = {
    'checkout-coupon': '电商结算页 + 优惠券弹窗',
    'signup-flow': '注册流程',
    'saas-dashboard': 'SaaS 仪表盘导航'
  }

  return (
    <AnalystLayout>
      <div className="p-6">
        {/* 页头 */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-semibold text-slate-100">任务管理</h1>
            <p className="text-xs text-slate-500 mt-0.5">创建测试任务并生成测试链接发给被试</p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-lg bg-gradient-to-r from-cyan-glow/90 to-cyan-soft/90 text-ink-900 text-xs font-semibold hover:shadow-glow transition-all"
          >
            + 新建任务
          </button>
        </div>

        {/* 创建表单 */}
        {showCreate && (
          <div className="glass rounded-xl p-5 mb-6 animate-[fadeIn_.3s_ease-out]">
            <div className="text-[12px] font-mono text-slate-400 tracking-wide mb-4">
              NEW_TASK · 创建新任务
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 mb-1.5 block">任务名称</label>
                <input
                  type="text"
                  value={newTask.name}
                  onChange={(e) => setNewTask({ ...newTask, name: e.target.value })}
                  placeholder="如：首页改版测试"
                  className="w-full px-3 py-2 rounded-lg bg-ink-800/60 border border-cyan-glow/15 text-sm text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-glow/40"
                />
              </div>
              <div>
                <label className="text-[11px] text-slate-400 mb-1.5 block">测试场景</label>
                <select
                  value={newTask.scenario}
                  onChange={(e) => setNewTask({ ...newTask, scenario: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg bg-ink-800/60 border border-cyan-glow/15 text-sm text-slate-200 focus:outline-none focus:border-cyan-glow/40"
                >
                  <option value="checkout-coupon">电商结算页 + 优惠券弹窗</option>
                  <option value="signup-flow">注册流程</option>
                  <option value="saas-dashboard">SaaS 仪表盘导航</option>
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={handleCreate}
                  className="flex-1 py-2 rounded-lg bg-cyan-glow/15 border border-cyan-glow/25 text-cyan-glow text-xs font-medium hover:bg-cyan-glow/25 transition-colors"
                >
                  创建并生成链接
                </button>
                <button
                  onClick={() => setShowCreate(false)}
                  className="px-3 py-2 rounded-lg bg-ink-700/60 border border-cyan-glow/10 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 任务列表 */}
        <div className="space-y-3">
          {tasks.map((task) => (
            <div key={task.id} className="glass rounded-xl p-4 hover:border-cyan-glow/25 transition-colors">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-slate-500">{task.id}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] font-mono ${
                        task.status === 'active'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                          : 'bg-slate-500/15 text-slate-400 border border-slate-500/20'
                      }`}
                    >
                      {task.status === 'active' ? '进行中' : '草稿'}
                    </span>
                  </div>
                  <div className="text-[14px] font-medium text-slate-100">{task.name}</div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    场景：{scenarioLabels[task.scenario]} · 创建于 {task.createdAt}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right">
                    <div className="text-[14px] font-semibold font-mono text-cyan-glow">{task.sessions}</div>
                    <div className="text-[9px] text-slate-500">会话数</div>
                  </div>
                </div>
              </div>

              {/* 测试链接 */}
              <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-ink-900/60 border border-cyan-glow/10">
                <span className="text-[10px] text-slate-500 shrink-0">测试链接：</span>
                <code className="text-[11px] font-mono text-cyan-soft truncate flex-1">{task.link}</code>
                <button
                  onClick={() => copyLink(task.link)}
                  className="px-2 py-1 rounded text-[10px] font-mono text-slate-400 hover:text-cyan-glow hover:bg-cyan-glow/10 transition-colors shrink-0"
                >
                  复制
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AnalystLayout>
  )
}
