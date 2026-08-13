import React, { useEffect, useState } from 'react'
import { adminApi } from '../../api/client.js'
import { getSessionIndex, loadFromStorage } from '../../lib/rrwebRecorder.js'
import { loadFrames } from '../../lib/mediaPipeTracker.js'

export default function LegacyImport({ onImported }) {
  const [legacy, setLegacy] = useState([])
  const [state, setState] = useState('idle')
  const [error, setError] = useState('')

  useEffect(() => { setLegacy(getSessionIndex()) }, [])
  if (!legacy.length) return null

  const migrate = async () => {
    setState('importing')
    setError('')
    try {
      for (const item of legacy) {
        await adminApi.importLegacy({ legacy_id: item.id, duration_ms: item.duration || 0, rrweb_events: loadFromStorage(item.id), face_frames: loadFrames(item.id) })
      }
      setState('done')
      onImported?.()
      if (window.confirm('旧数据已导入后端。是否清理浏览器中的旧副本？')) {
        for (const item of legacy) {
          localStorage.removeItem(`rrweb-events-${item.id}`)
          localStorage.removeItem(`mediapipe-frames-${item.id}`)
        }
        localStorage.removeItem('rrweb-session-index')
        localStorage.removeItem('mediapipe-session-index')
        setLegacy([])
      }
    } catch (err) {
      setError(err.message)
      setState('error')
    }
  }

  return <div className="mb-5 rounded-xl border border-blue-200 bg-blue-50 p-4 flex items-center justify-between gap-4"><div><div className="text-sm font-medium text-blue-900">发现 {legacy.length} 个旧版浏览器会话</div><div className="text-xs text-blue-700 mt-1">可一次性导入 SQLite；成功后再由你确认是否清理浏览器副本。</div>{error && <div className="text-xs text-red-600 mt-1">{error}</div>}</div><button onClick={migrate} disabled={state === 'importing'} className="shrink-0 px-3 py-2 rounded-lg bg-blue-700 text-white text-xs disabled:opacity-50">{state === 'importing' ? '导入中…' : state === 'done' ? '已导入' : '导入旧数据'}</button></div>
}
