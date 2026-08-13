import React from 'react'

/**
 * 错误边界 —— 捕获子组件错误，防止整个页面崩溃
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 m-4 rounded-lg bg-danger/10 border border-danger/30 text-danger">
          <div className="text-sm font-semibold mb-1">⚠ 组件渲染错误</div>
          <div className="text-xs font-mono opacity-80 mb-2">{this.state.error?.message || '未知错误'}</div>
          <details className="text-[10px] font-mono opacity-70 mb-2">
            <summary className="cursor-pointer">堆栈信息</summary>
            <pre className="mt-1 whitespace-pre-wrap break-all">{this.state.error?.stack}</pre>
          </details>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-3 py-1 rounded bg-danger/20 text-xs hover:bg-danger/30"
          >
            重试
          </button>
        </div>
      )
    }

    return this.props.children
  }
}
