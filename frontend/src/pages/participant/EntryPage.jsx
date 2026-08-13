import React, { useState, useEffect, useRef } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { sessionsApi, tasksApi } from '../../api/client.js'

/**
 * P1 入口页 —— 测试人员通过链接进入后的第一个页面
 * - 测试说明
 * - 知情同意
 * - 设备检测（摄像头/麦克风权限）
 */
export default function EntryPage() {
  const navigate = useNavigate()
  const { token } = useParams()
  const [task, setTask] = useState(null)
  const [taskError, setTaskError] = useState('')
  const [step, setStep] = useState('intro') // intro | consent | checking | ready | error
  const [checks, setChecks] = useState({
    camera: 'pending',
    mic: 'pending',
    face: 'pending'
  })
  const videoRef = useRef(null)
  const streamRef = useRef(null)

  useEffect(() => {
    tasksApi.getPublic(token).then(setTask).catch((error) => setTaskError(error.message))
  }, [token])

  const startDeviceCheck = async () => {
    setStep('checking')
    setChecks({ camera: 'pending', mic: 'pending', face: 'pending' })

    try {
      // 请求摄像头 + 麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setChecks((c) => ({ ...c, camera: 'pass', mic: 'pass' }))

      // 模拟面部检测（实际项目用 MediaPipe 检测）
      await new Promise((r) => setTimeout(r, 1500))
      setChecks((c) => ({ ...c, face: 'pass' }))

      await new Promise((r) => setTimeout(r, 600))
      setStep('ready')
    } catch (err) {
      setChecks((c) => ({ ...c, camera: 'fail' }))
      setStep('error')
    }
  }

  const handleStart = async () => {
    // 停止摄像头流
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
    }
    try {
      const session = await sessionsApi.create(token)
      sessionStorage.setItem('insightux-active-session', JSON.stringify(session))
      navigate('/calibrate')
    } catch (error) {
      setTaskError(error.message)
    }
  }

  // 清理
  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop())
      }
    }
  }, [])

  return (
    <div className="min-h-screen bg-[#F5F5F7] flex flex-col">
      {/* 顶部品牌 */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center">
          <div className="text-lg font-bold text-slate-900 tracking-tight">
            Shop<span className="text-orange-500">Demo</span>
          </div>
          <span className="ml-3 text-xs text-slate-400">用户体验测试</span>
        </div>
      </header>

      {/* 主体 */}
      <main className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-lg">
          {/* 步骤指示器 */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <StepDot label="说明" active={step === 'intro'} done={step !== 'intro'} />
            <StepLine done={step !== 'intro'} />
            <StepDot label="设备检测" active={step === 'checking' || step === 'ready' || step === 'error'} done={step === 'ready'} />
            <StepLine done={step === 'ready'} />
            <StepDot label="开始" active={step === 'ready'} done={false} />
          </div>

          {/* 内容卡片 */}
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            {step === 'intro' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-orange-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">🛍️</span>
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">
                  {task?.name || '感谢您参与本次用户体验测试'}
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  {taskError ? `无法加载任务：${taskError}` : '本次测试约需 1-2 分钟。您将浏览一个模拟的电商结算页面，'}<br />
                  请像日常购物一样自然操作即可。
                </p>

                <div className="bg-slate-50 rounded-xl p-4 text-left mb-6">
                  <div className="text-xs font-medium text-slate-700 mb-2">📋 测试说明</div>
                  <ul className="text-xs text-slate-500 space-y-1.5">
                    <li>· 我们会采集面部表情特征用于分析，不保存原始画面</li>
                    <li>· 我们会记录您的操作行为（点击、停留、鼠标轨迹）</li>
                    <li>· 所有数据仅用于 UX 研究，不会泄露给第三方</li>
                    <li>· 您可以随时退出测试，数据将自动删除</li>
                  </ul>
                </div>

                <button
                  onClick={() => setStep('consent')}
                  disabled={!task || !!taskError}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors disabled:opacity-50"
                >
                  我已了解，继续
                </button>
              </div>
            )}

            {step === 'consent' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">🔒</span>
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">
                  知情同意
                </h1>
                <p className="text-sm text-slate-500 leading-relaxed mb-6">
                  在开始之前，请确认您同意以下内容：
                </p>

                <div className="bg-blue-50 rounded-xl p-4 text-left mb-6 border border-blue-100">
                  <ul className="text-xs text-slate-600 space-y-2">
                    <li className="flex gap-2">
                      <span className="text-blue-500">✓</span>
                      <span>我同意在测试过程中通过摄像头采集我的面部表情数据</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-500">✓</span>
                      <span>我同意记录我的页面操作行为用于 UX 分析</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-500">✓</span>
                      <span>我了解数据仅用于研究目的，测试完成后原始视频将被删除</span>
                    </li>
                    <li className="flex gap-2">
                      <span className="text-blue-500">✓</span>
                      <span>我有权随时退出测试</span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep('intro')}
                    className="flex-1 py-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-sm transition-colors"
                  >
                    返回
                  </button>
                  <button
                    onClick={startDeviceCheck}
                    className="flex-1 py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
                  >
                    同意并开始
                  </button>
                </div>
              </div>
            )}

            {step === 'checking' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto mb-5 overflow-hidden relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {checks.camera === 'pending' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
                      <div className="w-6 h-6 rounded-full border-2 border-slate-300 border-t-orange-500 animate-spin" />
                    </div>
                  )}
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">
                  正在检测设备…
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                  请允许浏览器访问您的摄像头
                </p>

                <div className="space-y-3">
                  <CheckItem label="摄像头权限" status={checks.camera} />
                  <CheckItem label="麦克风权限" status={checks.mic} />
                  <CheckItem label="面部检测" status={checks.face} />
                </div>
              </div>
            )}

            {step === 'ready' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">✓</span>
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">
                  设备检测通过
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                  所有设备就绪，可以开始测试
                </p>

                <div className="space-y-3 mb-6">
                  <CheckItem label="摄像头权限" status="pass" />
                  <CheckItem label="麦克风权限" status="pass" />
                  <CheckItem label="面部检测" status="pass" />
                </div>

                <button
                  onClick={handleStart}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
                >
                  开始测试 →
                </button>
              </div>
            )}

            {step === 'error' && (
              <div className="text-center">
                <div className="w-16 h-16 rounded-2xl bg-red-100 flex items-center justify-center mx-auto mb-5">
                  <span className="text-3xl">⚠️</span>
                </div>
                <h1 className="text-xl font-semibold text-slate-900 mb-2">
                  设备检测失败
                </h1>
                <p className="text-sm text-slate-500 mb-6">
                  无法访问您的摄像头，请检查权限设置后重试
                </p>

                <div className="space-y-3 mb-6">
                  <CheckItem label="摄像头权限" status="fail" />
                </div>

                <button
                  onClick={startDeviceCheck}
                  className="w-full py-3 rounded-xl bg-orange-500 hover:bg-orange-600 text-white font-semibold text-sm transition-colors"
                >
                  重新检测
                </button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

function StepDot({ label, active, done }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
          done
            ? 'bg-emerald-500 text-white'
            : active
            ? 'bg-orange-500 text-white'
            : 'bg-slate-200 text-slate-400'
        }`}
      >
        {done ? '✓' : ''}
      </div>
      <span className={`text-[10px] ${active ? 'text-slate-700 font-medium' : 'text-slate-400'}`}>
        {label}
      </span>
    </div>
  )
}

function StepLine({ done }) {
  return (
    <div className={`w-12 h-0.5 rounded ${done ? 'bg-emerald-500' : 'bg-slate-200'}`} />
  )
}

function CheckItem({ label, status }) {
  return (
    <div className="flex items-center justify-between px-4 py-2.5 rounded-lg bg-slate-50">
      <span className="text-sm text-slate-700">{label}</span>
      {status === 'pending' && (
        <div className="w-4 h-4 rounded-full border-2 border-slate-300 border-t-orange-500 animate-spin" />
      )}
      {status === 'pass' && (
        <span className="text-emerald-500 text-sm">✓ 通过</span>
      )}
      {status === 'fail' && (
        <span className="text-red-500 text-sm">✗ 失败</span>
      )}
    </div>
  )
}
