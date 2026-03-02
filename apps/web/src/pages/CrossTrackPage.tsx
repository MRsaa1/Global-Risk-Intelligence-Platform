/**
 * Cross-Track Synergy Dashboard
 * Observations list, calibration results, recalibration triggers
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  ArrowPathIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  CubeTransparentIcon,
  PlusCircleIcon,
} from '@heroicons/react/24/outline'
import { crossTrackApi, type CrossTrackObservationPayload } from '../lib/api'

const OBSERVATION_TYPES = [
  'flood_event',
  'heat_event',
  'infrastructure_failure',
  'adaptation_performance',
] as const

interface Dashboard {
  total_observations: number
  by_type: Record<string, number>
  by_city: Record<string, number>
  calibrations_run: number
  recalibration_triggers: number
  adaptation_analytics: Record<string, unknown>
  latest_calibration: {
    model_name: string
    observations_used: number
    mean_absolute_error: number
    bias: number
    r_squared: number
    recalibration_factor: number
    recommendation: string
  } | null
}

interface Observation {
  id: string
  timestamp: string
  city: string
  h3_cell?: string
  observation_type: string
  predicted_severity: number
  observed_severity: number
  predicted_loss_m: number
  observed_loss_m: number
  notes?: string
}

const defaultForm: CrossTrackObservationPayload = {
  city: '',
  observation_type: 'flood_event',
  predicted_severity: 0.5,
  observed_severity: 0.5,
  predicted_loss_m: 0,
  observed_loss_m: 0,
  notes: '',
}

export default function CrossTrackPage() {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null)
  const [observations, setObservations] = useState<Observation[]>([])
  const [triggers, setTriggers] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [calibrating, setCalibrating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordForm, setRecordForm] = useState<CrossTrackObservationPayload>({ ...defaultForm })
  const [submitting, setSubmitting] = useState(false)

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const [dash, obs, trig] = await Promise.all([
        crossTrackApi.getDashboard(),
        crossTrackApi.getObservations({ limit: 50 }),
        crossTrackApi.getRecalibrationTriggers(),
      ])
      setDashboard(dash)
      setObservations(Array.isArray(obs) ? obs : [])
      setTriggers(Array.isArray(trig) ? trig : [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const runCalibration = async () => {
    setCalibrating(true)
    setError(null)
    try {
      await crossTrackApi.runCalibration()
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Calibration failed')
    } finally {
      setCalibrating(false)
    }
  }

  const submitObservation = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!recordForm.city.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      await crossTrackApi.recordObservation({
        ...recordForm,
        predicted_severity: Math.max(0, Math.min(1, recordForm.predicted_severity)),
        observed_severity: Math.max(0, Math.min(1, recordForm.observed_severity)),
        predicted_loss_m: recordForm.predicted_loss_m ?? 0,
        observed_loss_m: recordForm.observed_loss_m ?? 0,
      })
      setRecordForm({ ...defaultForm })
      setShowRecordForm(false)
      await load()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to record observation')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading && !dashboard) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8 flex items-center justify-center">
        <div className="animate-pulse font-mono text-[10px] uppercase tracking-widest text-zinc-500">Loading Cross-Track Synergy...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="w-full max-w-[1920px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-zinc-900/50 rounded-md border border-zinc-800/60">
              <CubeTransparentIcon className="w-8 h-8 text-zinc-300" />
            </div>
            <div>
              <h1 className="text-3xl font-display font-semibold text-zinc-100 tracking-tight">
                Cross-Track Synergy
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Connect Track B observations with Track A global risk models
              </p>
            </div>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 max-w-3xl">
            Field observations from municipal deployments feed into model calibration.
            Compare predicted vs observed severity, run calibration, and view recalibration triggers.
          </p>
        </motion.div>

        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mb-6 p-4 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-200 flex items-center gap-3"
          >
            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
            <span>{error}</span>
          </motion.div>
        )}

        {/* Record observation form */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mb-8"
        >
          <button
            type="button"
            onClick={() => setShowRecordForm((v) => !v)}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 font-sans"
          >
            <PlusCircleIcon className="w-5 h-5" />
            {showRecordForm ? 'Hide form' : 'Record observation'}
          </button>
          {showRecordForm && (
            <form onSubmit={submitObservation} className="mt-4 p-6 rounded-md bg-zinc-900/50 border border-zinc-800/60 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">City</label>
                <input
                  type="text"
                  value={recordForm.city}
                  onChange={(e) => setRecordForm((f) => ({ ...f, city: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans placeholder-zinc-500"
                  placeholder="e.g. Athens"
                  required
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Observation type</label>
                <select
                  value={recordForm.observation_type}
                  onChange={(e) => setRecordForm((f) => ({ ...f, observation_type: e.target.value as CrossTrackObservationPayload['observation_type'] }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans"
                >
                  {OBSERVATION_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Predicted severity (0–1)</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={recordForm.predicted_severity}
                  onChange={(e) => setRecordForm((f) => ({ ...f, predicted_severity: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Observed severity (0–1)</label>
                <input
                  type="number"
                  min={0}
                  max={1}
                  step={0.01}
                  value={recordForm.observed_severity}
                  onChange={(e) => setRecordForm((f) => ({ ...f, observed_severity: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Predicted loss (M)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={recordForm.predicted_loss_m ?? ''}
                  onChange={(e) => setRecordForm((f) => ({ ...f, predicted_loss_m: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Observed loss (M)</label>
                <input
                  type="number"
                  min={0}
                  step={0.1}
                  value={recordForm.observed_loss_m ?? ''}
                  onChange={(e) => setRecordForm((f) => ({ ...f, observed_loss_m: parseFloat(e.target.value) || 0 }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-mono tabular-nums"
                />
              </div>
              <div className="md:col-span-2">
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Notes</label>
                <input
                  type="text"
                  value={recordForm.notes ?? ''}
                  onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 text-sm font-sans placeholder-zinc-500"
                  placeholder="Optional"
                />
              </div>
              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={submitting || !recordForm.city.trim()}
                  className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-medium hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Saving…' : 'Save observation'}
                </button>
              </div>
            </form>
          )}
        </motion.div>

        {/* Stats + Calibration */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total Observations</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100 mt-1">
              {dashboard?.total_observations ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Calibrations Run</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-zinc-100 mt-1">
              {dashboard?.calibrations_run ?? 0}
            </div>
          </div>
          <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Recalibration Triggers</div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-400/80 mt-1">
              {dashboard?.recalibration_triggers ?? triggers.length}
            </div>
          </div>
          <div className="p-4 rounded-md bg-zinc-900/50 border border-zinc-800/60 flex items-center">
            <button
              onClick={runCalibration}
              disabled={calibrating}
              className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-200 hover:bg-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowPathIcon className={`w-5 h-5 ${calibrating ? 'animate-spin' : ''}`} />
              {calibrating ? 'Calibrating...' : 'Run Calibration'}
            </button>
          </div>
        </motion.div>

        {/* Latest Calibration */}
        {dashboard?.latest_calibration && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-8 p-6 rounded-md bg-zinc-900/50 border border-zinc-800/60"
          >
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
              <ChartBarIcon className="w-5 h-5" />
              Latest Calibration
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Model</span>
                <div className="text-zinc-100 mt-0.5">{dashboard.latest_calibration.model_name}</div>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Observations Used</span>
                <div className="text-zinc-100 font-mono tabular-nums mt-0.5">{dashboard.latest_calibration.observations_used}</div>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">MAE</span>
                <div className="text-zinc-100 font-mono tabular-nums mt-0.5">{dashboard.latest_calibration.mean_absolute_error?.toFixed(4)}</div>
              </div>
              <div>
                <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">R²</span>
                <div className="text-zinc-100 font-mono tabular-nums mt-0.5">{dashboard.latest_calibration.r_squared?.toFixed(4)}</div>
              </div>
            </div>
            <p className="mt-4 text-zinc-400 text-sm">{dashboard.latest_calibration.recommendation}</p>
          </motion.div>
        )}

        {/* Recalibration Triggers */}
        {triggers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="mb-8 p-6 rounded-md bg-amber-500/5 border border-amber-500/20"
          >
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-400/90 mb-4 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-5 h-5" />
              Recalibration Triggers (&gt;30% Error)
            </h2>
            <div className="space-y-2">
              {triggers.map((t: unknown, i: number) => (
                <div key={i} className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-sm text-zinc-200">
                  {JSON.stringify(t)}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* Observations List */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="p-6 rounded-md bg-zinc-900/50 border border-zinc-800/60"
        >
          <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
            <MapPinIcon className="w-5 h-5" />
            Field Observations
          </h2>
          {observations.length === 0 ? (
            <p className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">No observations recorded yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b border-zinc-800/60">
                    <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Time</th>
                    <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">City</th>
                    <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Type</th>
                    <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Pred / Obs Severity</th>
                    <th className="pb-3 pr-4 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Pred / Obs Loss (M)</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map((o) => (
                    <tr key={o.id} className="border-b border-zinc-800/60">
                      <td className="py-3 pr-4 text-zinc-300">{new Date(o.timestamp).toLocaleString()}</td>
                      <td className="py-3 pr-4 text-zinc-100">{o.city || '—'}</td>
                      <td className="py-3 pr-4 text-zinc-100">{o.observation_type}</td>
                      <td className="py-3 pr-4 text-zinc-200">
                        {(o.predicted_severity * 100).toFixed(0)}% / {(o.observed_severity * 100).toFixed(0)}%
                      </td>
                      <td className="py-3 pr-4 text-zinc-200">
                        {o.predicted_loss_m?.toFixed(2) ?? '—'} / {o.observed_loss_m?.toFixed(2) ?? '—'}
                      </td>
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
