/**
 * Shows a sticky banner when the API is unreachable (e.g. backend not running).
 * Helps avoid "nothing loads" with no explanation.
 */
import { useEffect, useState } from 'react'

const HEALTH_URL = '/api/v1/health'
const CHECK_INTERVAL_MS = 15_000

export default function ApiUnavailableBanner() {
  const [unavailable, setUnavailable] = useState<boolean | null>(null)

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const res = await fetch(HEALTH_URL, { method: 'GET' })
        if (!cancelled) setUnavailable(!res.ok)
      } catch {
        if (!cancelled) setUnavailable(true)
      }
    }

    check()
    const t = setInterval(check, CHECK_INTERVAL_MS)
    return () => {
      cancelled = true
      clearInterval(t)
    }
  }, [])

  if (unavailable !== true) return null

  return (
    <div
      className="sticky top-0 z-[200] flex items-center justify-center gap-4 px-4 py-2 bg-amber-500/95 text-zinc-900 text-sm font-medium"
      role="alert"
    >
      <span>API не запущен — данные не загружаются.</span>
      <span className="font-mono text-xs bg-zinc-900/20 px-2 py-0.5 rounded">
        cd apps/api && source .venv/bin/activate && uvicorn src.main:app --host 0.0.0.0 --port 9002
      </span>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="underline hover:no-underline"
      >
        Обновить после запуска
      </button>
    </div>
  )
}
