import React, { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { api } from '../../lib/apiClient.js'
import { ReportDocument } from '../analyst/ReportPage.jsx'

export default function SharedReportPage() {
  const { token } = useParams()
  const [session, setSession] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    api.reports.getShared(token)
      .then((report) => { if (active) setSession(report) })
      .catch((requestError) => { if (active) setError(requestError.message) })
    return () => { active = false }
  }, [token])

  return <div className="relative z-10 min-h-screen"><ReportDocument session={session} error={error} publicView actions={session ? <button onClick={() => window.print()} className="report-primary-action">打印 / 导出 PDF</button> : null} /></div>
}
