/**
 * Modal to submit current stress test / scenario as a Cross-Track field observation.
 * Pre-fills predicted values; user enters observed severity/loss.
 */
import { useState, useEffect } from 'react'
import { crossTrackApi, type CrossTrackObservationPayload } from '../lib/api'

const OBSERVATION_TYPES = [
  'flood_event',
  'heat_event',
  'infrastructure_failure',
  'adaptation_performance',
] as const

function eventTypeToObservationType(eventType: string): CrossTrackObservationPayload['observation_type'] {
  const t = (eventType || '').toLowerCase()
  if (t.includes('flood')) return 'flood_event'
  if (t.includes('heat')) return 'heat_event'
  if (t.includes('drought') || t.includes('infrastructure')) return 'infrastructure_failure'
  return 'flood_event'
}

export interface SubmitAsFieldObservationInitial {
  cityName: string
  eventName?: string
  eventType?: string
  totalLoss?: number
  stressTestId?: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  initial: SubmitAsFieldObservationInitial
  onSuccess?: () => void
}

export default function SubmitAsFieldObservationModal({ isOpen, onClose, initial, onSuccess }: Props) {
  const [observedSeverity, setObservedSeverity] = useState(0.5)
  const [observedLossM, setObservedLossM] = useState<number>(initial.totalLoss ?? 0)
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setObservedSeverity(0.5)
      setObservedLossM(initial.totalLoss ?? 0)
      setNotes('')
      setError(null)
    }
  }, [isOpen, initial.totalLoss])

  if (!isOpen) return null

  const predictedLossM = initial.totalLoss ?? 0
  const payload: CrossTrackObservationPayload = {
    city: initial.cityName,
    observation_type: eventTypeToObservationType(initial.eventType ?? ''),
    predicted_severity: 0.5,
    observed_severity: Math.max(0, Math.min(1, observedSeverity)),
    predicted_loss_m: predictedLossM,
    observed_loss_m: observedLossM,
    notes: notes.trim(),
    stress_test_id: initial.stressTestId,
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await crossTrackApi.recordObservation(payload)
      onSuccess?.()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to submit observation')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60" onClick={onClose}>
      <div
        className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl max-w-md w-full p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-zinc-100 mb-1">Record as field observation</h3>
        <p className="text-zinc-500 text-sm mb-4">
          Send this scenario to Cross-Track Synergy so predicted vs observed can be used for model calibration.
        </p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-zinc-500 text-xs mb-1">City (from report)</label>
            <div className="px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-300 text-sm">
              {initial.cityName}
            </div>
          </div>
          <div>
            <label className="block text-zinc-500 text-xs mb-1">Observed severity (0–1)</label>
            <input
              type="number"
              min={0}
              max={1}
              step={0.01}
              value={observedSeverity}
              onChange={(e) => setObservedSeverity(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm"
            />
          </div>
          <div>
            <label className="block text-zinc-500 text-xs mb-1">Observed loss (M)</label>
            <input
              type="number"
              min={0}
              step={0.1}
              value={observedLossM}
              onChange={(e) => setObservedLossM(parseFloat(e.target.value) || 0)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm"
            />
            <p className="text-zinc-600 text-xs mt-0.5">Predicted from report: {predictedLossM.toFixed(2)} M</p>
          </div>
          <div>
            <label className="block text-zinc-500 text-xs mb-1">Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm"
              placeholder="e.g. Post-event survey"
            />
          </div>
          {error && (
            <p className="text-amber-400/80 text-sm">{error}</p>
          )}
          <div className="flex gap-2 justify-end pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-300 text-sm hover:bg-zinc-600"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 rounded-md bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-500 disabled:opacity-50"
            >
              {submitting ? 'Sending…' : 'Submit observation'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
