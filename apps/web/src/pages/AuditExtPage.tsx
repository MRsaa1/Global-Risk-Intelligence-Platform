/**
 * Audit / Regulatory Export — redirect to Municipal Dashboard regulatory tab.
 * All Regulatory Export UI (Disclosure, OSFI B-15 Readiness, GHG Inventory) lives in Municipal Dashboard.
 */
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowPathIcon } from '@heroicons/react/24/outline'

export default function AuditExtPage() {
  const navigate = useNavigate()

  useEffect(() => {
    navigate('/municipal?tab=regulatory', { replace: true })
  }, [navigate])

  return (
    <div className="min-h-[40vh] bg-zinc-950 flex flex-col items-center justify-center gap-3 text-zinc-400">
      <ArrowPathIcon className="w-8 h-8 animate-spin" />
      <p className="text-sm">Redirecting to Municipal Dashboard — Regulatory…</p>
    </div>
  )
}
