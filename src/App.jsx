import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'

// 测试人员端
import EntryPage from './pages/participant/EntryPage.jsx'
import CalibratePage from './pages/participant/CalibratePage.jsx'
import TaskPage from './pages/participant/TaskPage.jsx'

// 分析人员端
import DashboardPage from './pages/analyst/DashboardPage.jsx'
import TaskManagePage from './pages/analyst/TaskManagePage.jsx'
import SessionListPage from './pages/analyst/SessionListPage.jsx'
import SessionDetailPage from './pages/analyst/SessionDetailPage.jsx'
import ReportPage from './pages/analyst/ReportPage.jsx'

export default function App() {
  return (
    <div className="min-h-screen w-full bg-radial text-slate-200">
      <div className="absolute inset-0 bg-grid opacity-30 pointer-events-none" />
      <Routes>
        {/* 测试人员端（匿名访问） */}
        <Route path="/join/:token" element={<EntryPage />} />
        <Route path="/calibrate" element={<CalibratePage />} />
        <Route path="/task/:sessionId" element={<TaskPage />} />

        {/* 分析人员端（需登录，此处简化） */}
        <Route path="/" element={<DashboardPage />} />
        <Route path="/tasks" element={<TaskManagePage />} />
        <Route path="/sessions" element={<SessionListPage />} />
        <Route path="/sessions/:id" element={<SessionDetailPage />} />
        <Route path="/report/:id" element={<ReportPage />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
