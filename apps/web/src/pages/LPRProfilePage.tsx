/**
 * LPR profile detail — single entity with appearances and flags.
 */
import { useState, useEffect } from 'react'
import { Link, useParams } from 'react-router-dom'
import { UserCircleIcon } from '@heroicons/react/24/outline'
import { getApiBase } from '../config/env'

const getLprApi = () => {
  const base = getApiBase()
  return base ? `${base}/api/v1/lpr` : '/api/v1/lpr'
}

export default function LPRProfilePage() {
  const { entity_id } = useParams<{ entity_id: string }>()
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!entity_id) return
    const api = getLprApi()
    fetch(`${api}/profile/${entity_id}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setProfile)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [entity_id])

  if (loading || !entity_id) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
        <p className="text-zinc-500">Loading profile…</p>
      </div>
    )
  }

  const entity = profile?.entity as Record<string, string> | undefined
  const appearances = (profile?.appearances as Record<string, unknown>[]) || []
  const flags = (profile?.flags as Record<string, boolean>) || {}

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6">
      <div className="max-w-4xl mx-auto">
        <Link to="/lpr" className="text-zinc-400 hover:text-zinc-200 text-sm mb-4 inline-block">
          ← LPR Dashboard
        </Link>
        {error && (
          <div className="rounded-lg bg-red-900/20 border border-red-800 text-red-300 p-4 mb-6">
            {error}
          </div>
        )}
        {!profile ? (
          <p className="text-zinc-500">Profile not found.</p>
        ) : (
          <>
            <div className="flex items-center gap-3 mb-6">
              <UserCircleIcon className="w-10 h-10 text-zinc-500" />
              <div>
                <h1 className="text-xl font-semibold text-zinc-100">{entity?.name ?? '—'}</h1>
                <p className="text-zinc-500 text-sm">
                  {entity?.role} {entity?.region ? ` · ${entity.region}` : ''}
                </p>
                {(flags.contradiction_detected || flags.course_change_detected) && (
                  <p className="text-amber-400 text-sm mt-1">
                    {flags.contradiction_detected && 'Contradiction detected '}
                    {flags.course_change_detected && 'Course change detected'}
                  </p>
                )}
              </div>
            </div>
            <section className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-3">
                Appearances ({appearances.length})
              </h2>
              <ul className="space-y-2">
                {appearances.map((a: Record<string, unknown>) => (
                  <li key={String(a.id)} className="text-sm border-b border-zinc-800 pb-2 last:border-0">
                    <div className="text-zinc-200">{String(a.title || '—')}</div>
                    <div className="text-zinc-500 text-xs">{a.occurred_at ? String(a.occurred_at) : ''}</div>
                    {a.metrics && (
                      <div className="text-zinc-500 text-xs mt-1">
                        Stress: {((a.metrics as Record<string, number>).stress_score != null)
                          ? `${((a.metrics as Record<string, number>).stress_score! * 100).toFixed(0)}%`
                          : '—'}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
