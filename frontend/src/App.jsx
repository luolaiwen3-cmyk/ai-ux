import React, { Suspense, lazy } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// 页面按路由加载，避免测试端、分析端和回放依赖一次性进入首屏包。
const EntryPage = lazy(() => import('./pages/participant/EntryPage.jsx'))
const CalibratePage = lazy(() => import('./pages/participant/CalibratePage.jsx'))
const TaskPage = lazy(() => import('./pages/participant/TaskPage.jsx'))
const ThanksPage = lazy(() => import('./pages/participant/ThanksPage.jsx'))
const DashboardPage = lazy(() => import('./pages/analyst/DashboardPage.jsx'))
const TaskManagePage = lazy(() => import('./pages/analyst/TaskManagePage.jsx'))
const SessionListPage = lazy(() => import('./pages/analyst/SessionListPage.jsx'))
const SessionDetailPage = lazy(() => import('./pages/analyst/SessionDetailPage.jsx'))
const ReportPage = lazy(() => import('./pages/analyst/ReportPage.jsx'))

function PageFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center text-xs font-mono text-slate-500">
      页面加载中…
    </div>
  )
}

export default function App() {
  return (
    <div className="min-h-screen w-full bg-radial text-slate-200">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <Suspense fallback={<PageFallback />}>
        <Routes>
          {/* 测试人员端（匿名访问） */}
          <Route path="/join/:token" element={<EntryPage />} />
          <Route path="/calibrate" element={<CalibratePage />} />
          <Route path="/task/:sessionId" element={<TaskPage />} />
          <Route path="/thanks" element={<ThanksPage />} />

          {/* 分析人员端（需登录，此处简化） */}
          <Route path="/" element={<DashboardPage />} />
          <Route path="/tasks" element={<TaskManagePage />} />
          <Route path="/sessions" element={<SessionListPage />} />
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/report/:id" element={<ReportPage />} />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </div>
  )
}
