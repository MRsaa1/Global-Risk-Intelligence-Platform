/**
 * Scenario Replay / Time-Travel Page
 * Decision history, time picker, cascade animation preview
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ClockIcon,
  PlayIcon,
  FilmIcon,
  ArchiveBoxIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline'
import { getApiV1Base } from '../config/env'
import { replayApi } from '../lib/api'

interface DecisionSnapshot {
  id: string
  decision_id: string
  timestamp: string
  source_module: string
  object_type: string
  object_id: string
  risk_score: number
  verdict_snapshot?: Record<string, unknown>
}

interface CascadeFrame {
  frame_idx: number
  timestamp_offset_s: number
  nodes_active: string[]
  edges_active: { source: string; target: string }[]
  risk_level: number
  description?: string
  cause?: string
  effect?: string
  consequences?: string
}

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function todayISO() {
  const t = new Date()
  return t.toISOString().slice(0, 10)
}

export default function ReplayPage() {
  const [history, setHistory] = useState<DecisionSnapshot[]>([])
  const [stats, setStats] = useState<Record<string, unknown> | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedDecisionId, setSelectedDecisionId] = useState('')
  const [timeTravelDate, setTimeTravelDate] = useState(() => todayISO())
  const [timeTravelTime, setTimeTravelTime] = useState('12:00')
  const [timeTravelResult, setTimeTravelResult] = useState<unknown>(null)
  const [timeTravelDbResult, setTimeTravelDbResult] = useState<any>(null)
  const [timeTravelDbLoading, setTimeTravelDbLoading] = useState(false)
  const [cascadeResult, setCascadeResult] = useState<{ frames?: CascadeFrame[] } | null>(null)
  const [replayLoading, setReplayLoading] = useState(false)
  const [timeTravelLoading, setTimeTravelLoading] = useState(false)
  const [cascadeLoading, setCascadeLoading] = useState(false)
  const [mp4ExportLoading, setMp4ExportLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [hist, st] = await Promise.all([
        replayApi.getHistory({ limit: 50 }),
        replayApi.getStats(),
      ])
      setHistory(Array.isArray(hist) ? hist : [])
      setStats(st as Record<string, unknown>)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runReplay = async () => {
    if (!selectedDecisionId.trim()) return
    setReplayLoading(true)
    setError(null)
    try {
      await replayApi.replayDecision(selectedDecisionId.trim())
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Replay failed')
    } finally {
      setReplayLoading(false)
    }
  }

  const runTimeTravel = async () => {
    if (!timeTravelDate) return
    const ts = `${timeTravelDate}T${timeTravelTime}:00.000Z`
    setTimeTravelLoading(true)
    setError(null)
    setTimeTravelResult(null)
    try {
      const result = await replayApi.timeTravel(ts)
      setTimeTravelResult(result)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Time travel failed')
    } finally {
      setTimeTravelLoading(false)
    }
  }

  const runTimeTravelDb = async () => {
    if (!timeTravelDate) return
    setTimeTravelDbLoading(true)
    setError(null)
    setTimeTravelDbResult(null)
    try {
      const res = await fetch(`/api/v1/replay/time-travel-db?date=${timeTravelDate}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setTimeTravelDbResult(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'DB time-travel failed')
    } finally {
      setTimeTravelDbLoading(false)
    }
  }

  const loadCascade = async () => {
    if (!selectedDecisionId.trim()) return
    setCascadeLoading(true)
    setError(null)
    setCascadeResult(null)
    try {
      const result = await replayApi.getCascadeAnimation(selectedDecisionId.trim(), 30, 10)
      // API returns array of frames; normalize to { frames } for UI
      const frames = Array.isArray(result) ? result : (result?.frames ?? [])
      setCascadeResult({ frames: frames as CascadeFrame[] })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cascade load failed')
    } finally {
      setCascadeLoading(false)
    }
  }

  if (loading && history.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex items-center justify-center">
        <div className="animate-pulse text-zinc-500">Loading Scenario Replay...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8" lang="en">
      <div className="w-full max-w-[1920px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60">
              <ClockIcon className="w-8 h-8 text-zinc-400/80" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100 tracking-tight">
                Scenario Replay & Time-Travel
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Reconstruct decisions and view risk state at any point in time
              </p>
            </div>
          </div>
          <p className="text-zinc-400/90 text-sm max-w-3xl font-sans">
            Replay historical decisions, travel to past timestamps to see risk state,
            and preview cascade animation for stakeholder communication.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200"
          >
            {error}
          </motion.div>
        )}

        {/* Stats */}
        {stats && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8"
          >
            <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Decision Snapshots</div>
              <div className="text-2xl font-mono font-semibold tabular-nums text-zinc-100 mt-1">
                {(stats as { snapshots_count?: number }).snapshots_count ?? history.length}
              </div>
            </div>
          </motion.div>
        )}

        {/* Time Travel */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-8 p-6 rounded-md bg-zinc-900/50 border border-zinc-800/60"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <CalendarIcon className="w-4 h-4 text-zinc-500" />
            Time-Travel
          </h2>
          <div className="flex flex-wrap items-end gap-4">
            {(() => {
              const [y, m, d] = timeTravelDate ? timeTravelDate.split('-').map(Number) : []
              const now = new Date()
              const year = y ?? now.getFullYear()
              const month = m ?? now.getMonth() + 1
              const day = d ?? now.getDate()
              const [hh, mm] = timeTravelTime ? timeTravelTime.split(':').map(Number) : [12, 0]
              const daysInMonth = new Date(year, month, 0).getDate()
              const safeDay = Math.min(day, daysInMonth)
              return (
                <>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Month</label>
                    <select
                      value={month}
                      onChange={(e) => {
                        const m2 = Number(e.target.value)
                        setTimeTravelDate(`${year}-${String(m2).padStart(2, '0')}-${String(Math.min(safeDay, new Date(year, m2, 0).getDate())).padStart(2, '0')}`)
                      }}
                      className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans min-w-[140px]"
                    >
                      {MONTH_NAMES.map((name, i) => (
                        <option key={i} value={i + 1}>{name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Day</label>
                    <select
                      value={safeDay}
                      onChange={(e) => setTimeTravelDate(`${year}-${String(month).padStart(2, '0')}-${String(Number(e.target.value)).padStart(2, '0')}`)}
                      className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans min-w-[80px]"
                    >
                      {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Year</label>
                    <select
                      value={year}
                      onChange={(e) => setTimeTravelDate(`${e.target.value}-${String(month).padStart(2, '0')}-${String(safeDay).padStart(2, '0')}`)}
                      className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans min-w-[90px]"
                    >
                      {Array.from({ length: 11 }, (_, i) => 2020 + i).map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Hour (UTC)</label>
                    <select
                      value={hh}
                      onChange={(e) => setTimeTravelTime(`${String(Number(e.target.value)).padStart(2, '0')}:${String(mm).padStart(2, '0')}`)}
                      className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans min-w-[80px]"
                    >
                      {Array.from({ length: 24 }, (_, i) => i).map((h) => (
                        <option key={h} value={h}>{h}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Minute</label>
                    <select
                      value={mm}
                      onChange={(e) => setTimeTravelTime(`${String(hh).padStart(2, '0')}:${String(Number(e.target.value)).padStart(2, '0')}`)}
                      className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans min-w-[80px]"
                    >
                      {Array.from({ length: 60 }, (_, i) => i).map((m) => (
                        <option key={m} value={m}>{String(m).padStart(2, '0')}</option>
                      ))}
                    </select>
                  </div>
                </>
              )
            })()}
            <button
              onClick={runTimeTravel}
              disabled={timeTravelLoading || !timeTravelDate}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-400 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
            >
              <ClockIcon className={`w-5 h-5 ${timeTravelLoading ? 'animate-pulse' : ''}`} />
              {timeTravelLoading ? 'Traveling...' : 'In-Memory'}
            </button>
            <button
              onClick={runTimeTravelDb}
              disabled={timeTravelDbLoading || !timeTravelDate}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-amber-600/20 text-amber-400/80 border border-amber-600/40 hover:bg-amber-600/30 disabled:opacity-50"
            >
              <ArchiveBoxIcon className={`w-5 h-5 ${timeTravelDbLoading ? 'animate-pulse' : ''}`} />
              {timeTravelDbLoading ? 'Querying DB...' : 'DB Snapshot'}
            </button>
          </div>

          {/* DB Time-Travel Result */}
          {timeTravelDbResult && (
            <div className="mt-4 space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Database Snapshot for {timeTravelDbResult.target_date}</h3>
              {timeTravelDbResult.snapshot ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">At-Risk Exposure</div>
                    <div className="text-lg font-mono font-semibold tabular-nums text-zinc-100 mt-0.5">
                      {timeTravelDbResult.snapshot.at_risk_exposure != null
                        ? `€${Math.round(timeTravelDbResult.snapshot.at_risk_exposure)}M`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Weighted Risk</div>
                    <div className="text-lg font-mono font-semibold tabular-nums text-zinc-100 mt-0.5">
                      {timeTravelDbResult.snapshot.weighted_risk != null
                        ? `${(timeTravelDbResult.snapshot.weighted_risk * 100).toFixed(1)}%`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Exposure</div>
                    <div className="text-lg font-mono font-semibold tabular-nums text-zinc-100 mt-0.5">
                      {timeTravelDbResult.snapshot.total_exposure != null
                        ? `€${Math.round(timeTravelDbResult.snapshot.total_exposure)}M`
                        : '—'}
                    </div>
                  </div>
                  <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Expected Loss</div>
                    <div className="text-lg font-mono font-semibold tabular-nums text-zinc-100 mt-0.5">
                      {timeTravelDbResult.snapshot.total_expected_loss != null
                        ? `€${Math.round(timeTravelDbResult.snapshot.total_expected_loss)}M`
                        : '—'}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-zinc-500 text-sm">No snapshot found for this date.</div>
              )}

              {/* Comparison to today */}
              {timeTravelDbResult.comparison_to_today && (
                <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">vs Today</div>
                  <div className={`text-sm font-medium ${
                    timeTravelDbResult.comparison_to_today.direction === 'increased' ? 'text-red-400/80' :
                    timeTravelDbResult.comparison_to_today.direction === 'decreased' ? 'text-emerald-400/80' : 'text-zinc-300'
                  }`}>
                    At-risk exposure {timeTravelDbResult.comparison_to_today.direction}
                    {' '}by {Math.abs(timeTravelDbResult.comparison_to_today.at_risk_change_pct)}%
                    {' '}(€{Math.round(timeTravelDbResult.comparison_to_today.past_at_risk)}M → €{Math.round(timeTravelDbResult.comparison_to_today.current_at_risk)}M)
                  </div>
                </div>
              )}

              {/* Stress tests active at that date */}
              {timeTravelDbResult.stress_tests_active?.length > 0 && (
                <div className="bg-zinc-900/50 rounded-md p-3 border border-zinc-800/60">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Stress Tests at Date</div>
                  {timeTravelDbResult.stress_tests_active.map((t: any) => (
                    <div key={t.id} className="text-sm text-zinc-300 flex items-center gap-2 mb-1">
                      <span className={`w-2 h-2 rounded-full ${t.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                      {t.name} <span className="text-zinc-500 text-xs">({t.status})</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* In-Memory Time-Travel Result */}
          {timeTravelResult && (
            <div className="mt-4 p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60 text-sm font-mono text-zinc-200 overflow-x-auto">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">In-Memory Result</div>
              <pre>{JSON.stringify(timeTravelResult, null, 2)}</pre>
            </div>
          )}
        </motion.div>

        {/* Decision History + Replay */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mb-8 p-6 rounded-md bg-zinc-900/50 border border-zinc-800/60"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <ArchiveBoxIcon className="w-4 h-4 text-zinc-500" />
            Decision History
          </h2>
          <div className="flex flex-wrap gap-4 mb-4">
            <input
              type="text"
              placeholder="Decision ID (e.g. DEC-xxx)"
              value={selectedDecisionId}
              onChange={(e) => setSelectedDecisionId(e.target.value)}
              className="px-4 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 placeholder-zinc-500 font-sans w-64"
            />
            <button
              onClick={runReplay}
              disabled={replayLoading || !selectedDecisionId.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-400 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
            >
              <PlayIcon className="w-5 h-5" />
              {replayLoading ? 'Replaying...' : 'Replay'}
            </button>
            <button
              onClick={loadCascade}
              disabled={cascadeLoading || !selectedDecisionId.trim()}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-400 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
            >
              <FilmIcon className="w-5 h-5" />
              {cascadeLoading ? 'Loading...' : 'Cascade Animation'}
            </button>
          </div>

          {cascadeResult?.frames && cascadeResult.frames.length > 0 && (
            <div className="mb-6 rounded-md border border-zinc-800/60 bg-zinc-900/50 overflow-hidden">
              <div className="p-4 border-b border-zinc-800/60 bg-zinc-900/80">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Cascade analysis: cause → effect → consequences</h3>
                <p className="text-zinc-400/90 text-sm font-sans">
                  Each row is one step in time. <strong className="text-zinc-300">Cause</strong> = what failed or was already down; <strong className="text-zinc-300">Effect</strong> = what fails next; <strong className="text-zinc-300">Consequences</strong> = impact on people and systems.
                </p>
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const blob = new Blob([JSON.stringify(cascadeResult, null, 2)], { type: 'application/json' })
                      const url = URL.createObjectURL(blob)
                      const a = document.createElement('a')
                      a.href = url
                      a.download = `cascade-${selectedDecisionId}-${new Date().toISOString().slice(0, 10)}.json`
                      a.click()
                      URL.revokeObjectURL(url)
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-300"
                  >
                    Download JSON
                  </button>
                  <button
                    type="button"
                    disabled={mp4ExportLoading || !selectedDecisionId.trim()}
                    onClick={async () => {
                      if (!selectedDecisionId.trim()) return
                      setMp4ExportLoading(true)
                      try {
                        const base = getApiV1Base()
                        const res = await fetch(`${base}/replay/cascade-animation/${encodeURIComponent(selectedDecisionId.trim())}/mp4?frames=30&duration_s=10&fps=3`)
                        if (res.status === 503) {
                          const j = await res.json().catch(() => ({}))
                          alert(j.detail || 'MP4 export unavailable. Install server optional deps: imageio, imageio-ffmpeg')
                          return
                        }
                        if (!res.ok) return
                        const blob = await res.blob()
                        const url = URL.createObjectURL(blob)
                        const a = document.createElement('a')
                        a.href = url
                        a.download = `cascade-${selectedDecisionId}-${new Date().toISOString().slice(0, 10)}.mp4`
                        a.click()
                        URL.revokeObjectURL(url)
                      } finally {
                        setMp4ExportLoading(false)
                      }
                    }}
                    className="text-xs text-zinc-400 hover:text-zinc-300 disabled:opacity-50"
                  >
                    {mp4ExportLoading ? 'Exporting…' : 'Export MP4'}
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto max-h-[60vh] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-zinc-900/90 border-b border-zinc-800/60">
                    <tr>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-16">Step</th>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-20">Time (s)</th>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Cause</th>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Effect</th>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 w-24">Risk</th>
                      <th className="text-left py-3 px-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500 min-w-[280px]">Consequences</th>
                    </tr>
                  </thead>
                  <tbody className="text-zinc-300">
                    {cascadeResult.frames
                      .filter((f) => (f.cause && f.cause !== '—') || (f.effect && f.effect !== '—'))
                      .map((f) => (
                      <tr key={f.frame_idx} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                        <td className="py-3 px-4 font-mono text-zinc-400">{f.frame_idx + 1}</td>
                        <td className="py-3 px-4">{typeof f.timestamp_offset_s === 'number' ? f.timestamp_offset_s.toFixed(1) : f.timestamp_offset_s}</td>
                        <td className="py-3 px-4 text-amber-200/90">{f.cause ?? '—'}</td>
                        <td className="py-3 px-4 text-red-200/90">{f.effect ?? '—'}</td>
                        <td className="py-3 px-4">{(f.risk_level != null ? (Number(f.risk_level) * 100).toFixed(0) : '—')}%</td>
                        <td className="py-3 px-4 text-zinc-400 text-xs leading-relaxed">{f.consequences ?? '—'}</td>
                      </tr>
                    ))}
                    {cascadeResult.frames.filter((f) => (f.cause && f.cause !== '—') || (f.effect && f.effect !== '—')).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-6 px-4 text-center text-zinc-500">No cause-effect steps in this cascade.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {history.length === 0 ? (
            <p className="text-zinc-500/90 text-sm font-sans">No decision history recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-zinc-500 border-b border-zinc-700">
                    <th className="pb-3 pr-4">Time</th>
                    <th className="pb-3 pr-4">Decision ID</th>
                    <th className="pb-3 pr-4">Module</th>
                    <th className="pb-3 pr-4">Object</th>
                    <th className="pb-3 pr-4">Risk</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((h) => (
                    <tr
                      key={h.id || h.decision_id}
                      className="border-b border-zinc-800 cursor-pointer hover:bg-zinc-800"
                      onClick={() => setSelectedDecisionId(h.decision_id)}
                    >
                      <td className="py-3 pr-4 text-zinc-300">{new Date(h.timestamp).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-zinc-100 font-mono">{h.decision_id}</td>
                      <td className="py-3 pr-4 text-zinc-100">{h.source_module}</td>
                      <td className="py-3 pr-4 text-zinc-200">{h.object_type}/{h.object_id}</td>
                      <td className="py-3 pr-4 text-zinc-200">{(h.risk_score * 100).toFixed(0)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  )
}
