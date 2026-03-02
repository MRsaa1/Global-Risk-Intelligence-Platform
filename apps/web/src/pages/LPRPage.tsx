/**
 * LPR (Leader/Persona Risk) dashboard — psychological profile and trends.
 * Integrates with Command Center; data from /api/v1/lpr (profiles, trends, appearances).
 */
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { UserCircleIcon, ChartBarIcon } from '@heroicons/react/24/outline'
import { getApiBase } from '../config/env'

const getLprApi = () => {
  const base = getApiBase()
  return base ? `${base}/api/v1/lpr` : '/api/v1/lpr'
}

interface LprEntity {
  id: string
  name: string
  entity_type: string
  role?: string
  region?: string
}

interface TrendItem {
  appearance_id: string
  entity_id: string
  entity_name: string
  title?: string
  occurred_at?: string
  stress_score?: number
  contradiction_flag: boolean
  course_change_flag: boolean
}

export default function LPRPage() {
  const [entities, setEntities] = useState<LprEntity[]>([])
  const [trends, setTrends] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const api = getLprApi()
    Promise.all([
      fetch(`${api}/entities`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${api}/trends?limit=20`).then((r) => (r.ok ? r.json() : { trends: [] })),
    ])
      .then(([ent, tr]) => {
        setEntities(Array.isArray(ent) ? ent : [])
        setTrends(tr?.trends ?? [])
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <p className="text-zinc-500">Loading LPR data…</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-zinc-100 flex items-center gap-2">
              <UserCircleIcon className="w-6 h-6 text-zinc-400" />
              LPR — Leader / Persona Risk
            </h1>
            <p className="text-zinc-500 text-sm mt-1">
              Psychological profile and rhetoric trends (Riva / Maxine / Vertex pipeline)
            </p>
          </div>
          <Link
            to="/command"
            className="text-zinc-400 hover:text-zinc-200 text-sm"
          >
            ← Command Center
          </Link>
        </div>

        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800 text-red-300 p-4 mb-6">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
              Entities
            </h2>
            {entities.length === 0 ? (
              <p className="text-zinc-500 text-sm">No LPR entities. Use API POST /lpr/entities to add.</p>
            ) : (
              <ul className="space-y-2">
                {entities.map((e) => (
                  <li key={e.id} className="flex items-center justify-between text-sm">
                    <Link to={`/lpr/profile/${e.id}`} className="text-zinc-200 hover:text-white">
                      {e.name}
                    </Link>
                    <span className="text-zinc-500">{e.region || e.entity_type}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
            <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <ChartBarIcon className="w-4 h-4" />
              Trends
            </h2>
            {trends.length === 0 ? (
              <p className="text-zinc-500 text-sm">No appearances. Use API POST /lpr/appearances to add.</p>
            ) : (
              <ul className="space-y-2 max-h-64 overflow-y-auto">
                {trends.map((t) => (
                  <li key={t.appearance_id} className="text-sm border-b border-zinc-800 pb-2 last:border-0">
                    <div className="flex justify-between">
                      <span className="text-zinc-200">{t.entity_name}</span>
                      {(t.contradiction_flag || t.course_change_flag) && (
                        <span className="text-amber-400 text-xs">
                          {t.contradiction_flag && 'Contradiction '}
                          {t.course_change_flag && 'Course change'}
                        </span>
                      )}
                    </div>
                    <div className="text-zinc-500 text-xs">{t.title || t.occurred_at || '—'}</div>
                    {t.stress_score != null && (
                      <div className="text-zinc-500 text-xs">Stress: {(t.stress_score * 100).toFixed(0)}%</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  )
}
