/**
 * ARIN Page - Risk & Intelligence OS
 * Manual ARIN assess, view decision by ID, replay, human-in-the-loop reviews.
 * Supports ?decision=DEC-xxx URL param to auto-fetch.
 */
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { arinApi, auditApi } from '../lib/api'
import type { DecisionObject, HumanReviewItem } from '../lib/api'
import DecisionObjectCard from '../components/DecisionObjectCard'
import { ShieldCheckIcon, CheckIcon, XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline'

const SOURCE_MODULES = ['stress_test', 'cip', 'scss', 'sro', 'advisor']
const OBJECT_TYPES = ['scenario', 'asset', 'infrastructure', 'supplier', 'institution']

export default function ARINPage() {
  const [searchParams] = useSearchParams()
  const decisionFromUrl = searchParams.get('decision')

  const [assessForm, setAssessForm] = useState({
    source_module: 'stress_test',
    object_type: 'scenario',
    object_id: '',
    input_data: '{}',
  })
  const [assessLoading, setAssessLoading] = useState(false)
  const [assessError, setAssessError] = useState<string | null>(null)
  const [assessResult, setAssessResult] = useState<DecisionObject | null>(null)

  const [decisionId, setDecisionId] = useState('')
  const [fetchLoading, setFetchLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [fetchedDecision, setFetchedDecision] = useState<DecisionObject | null>(null)

  const [replayLoading, setReplayLoading] = useState(false)

  const [humanReviews, setHumanReviews] = useState<HumanReviewItem[]>([])
  const [humanReviewsLoading, setHumanReviewsLoading] = useState(false)
  const [resolveLoading, setResolveLoading] = useState<string | null>(null)

  const loadHumanReviews = useCallback(async () => {
    setHumanReviewsLoading(true)
    try {
      const list = await arinApi.listHumanReviews({ status: 'pending' })
      setHumanReviews(Array.isArray(list) ? list : [])
    } catch {
      setHumanReviews([])
    } finally {
      setHumanReviewsLoading(false)
    }
  }, [])

  useEffect(() => {
    loadHumanReviews()
  }, [loadHumanReviews])

  const resolveReview = async (decisionId: string, action: 'approve' | 'reject') => {
    setResolveLoading(decisionId)
    try {
      await arinApi.resolveHumanReview(decisionId, { action, resolved_by: 'ui' })
      await loadHumanReviews()
    } finally {
      setResolveLoading(null)
    }
  }

  useEffect(() => {
    if (decisionFromUrl?.trim()) {
      setDecisionId(decisionFromUrl.trim())
      // Trigger fetch when component mounts with decision param
      const doFetch = async () => {
        setFetchError(null)
        setFetchedDecision(null)
        setAssessResult(null)
        setFetchLoading(true)
        try {
          const result = await auditApi.getDecision(decisionFromUrl.trim())
          setFetchedDecision(result)
        } catch (e: any) {
          setFetchError(e?.response?.data?.detail || e?.message || 'Decision not found')
        } finally {
          setFetchLoading(false)
        }
      }
      doFetch()
    }
  }, [decisionFromUrl])

  const runAssess = async () => {
    setAssessError(null)
    setAssessResult(null)
    setAssessLoading(true)
    try {
      let inputData: Record<string, unknown> = {}
      try {
        inputData = assessForm.input_data.trim() ? JSON.parse(assessForm.input_data) : {}
      } catch {
        setAssessError('Invalid JSON in input_data')
        return
      }
      const result = await arinApi.assess({
        source_module: assessForm.source_module,
        object_type: assessForm.object_type,
        object_id: assessForm.object_id || 'demo',
        input_data: Object.keys(inputData).length ? inputData : undefined,
      })
      setAssessResult(result)
      if (result.verdict?.human_confirmation_required) await loadHumanReviews()
    } catch (e: any) {
      setAssessError(e?.response?.data?.detail || e?.message || 'Assess failed')
    } finally {
      setAssessLoading(false)
    }
  }

  const fetchDecision = async () => {
    if (!decisionId.trim()) return
    setFetchError(null)
    setFetchedDecision(null)
    setFetchLoading(true)
    try {
      const result = await auditApi.getDecision(decisionId.trim())
      setFetchedDecision(result)
    } catch (e: any) {
      setFetchError(e?.response?.data?.detail || e?.message || 'Decision not found')
    } finally {
      setFetchLoading(false)
    }
  }

  const replayDecision = async () => {
    if (!decisionId.trim()) return
    setFetchError(null)
    setReplayLoading(true)
    try {
      const result = await auditApi.replayDecision(decisionId.trim())
      setFetchedDecision(result as DecisionObject)
    } catch (e: any) {
      setFetchError(e?.response?.data?.detail || e?.message || 'Replay failed')
    } finally {
      setReplayLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-8">
      <div className="w-full max-w-[1920px] mx-auto">
        {/* Header block — same style as Strategic Modules */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60">
              <ShieldCheckIcon className="w-8 h-8 text-zinc-400/80" />
            </div>
            <div>
              <h1 className="text-2xl font-display font-semibold text-zinc-100 tracking-tight">
                Risk & Intelligence OS (ARIN)
              </h1>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Multi-agent risk assessment with consensus and dissent
              </p>
            </div>
          </div>
          <p className="text-zinc-400/90 text-sm max-w-3xl font-sans">
            Run assessments, view decisions by ID, or replay historical decisions. 
            ARIN coordinates SENTINEL, ANALYST, ADVISOR, ETHICIST and module agents to produce 
            machine-readable Decision Objects. Human-in-the-loop: CRITICAL / &gt;€10M / life-safety 
            escalations appear in <strong className="text-zinc-300">Pending human reviews</strong> below for approval or rejection.
          </p>
        </motion.div>

        {/* Pending human reviews — visible at top */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 rounded-md border border-amber-500/20 bg-amber-500/5 p-6"
        >
          <div className="flex items-center justify-between mb-2">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-amber-400/90">Pending human reviews</h2>
            <button
              type="button"
              onClick={loadHumanReviews}
              disabled={humanReviewsLoading}
              className="p-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-400 hover:bg-zinc-700 disabled:opacity-50"
              title="Refresh"
            >
              <ArrowPathIcon className={`w-5 h-5 ${humanReviewsLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-zinc-400/90 text-sm mb-4 font-sans">
            Escalations (CRITICAL / &gt;€10M / life-safety) require human approval or rejection.
          </p>
          {humanReviewsLoading && humanReviews.length === 0 ? (
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Loading…</div>
          ) : humanReviews.length === 0 ? (
            <div className="text-zinc-500/90 text-sm font-sans">No pending reviews. Run an assessment with high impact (e.g. input_data: {`{"financial_impact_eur": 15000000}`} or {`{"life_safety": true}`}) to see one here.</div>
          ) : (
            <ul className="space-y-3">
              {humanReviews.map((r) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center gap-3 p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60"
                >
                  <span className="font-mono text-zinc-300">{r.decision_id}</span>
                  <span className="text-zinc-500 text-sm">{r.source_module}/{r.object_type}/{r.object_id ?? '—'}</span>
                  {r.escalation_reason && (
                    <span className="px-2 py-0.5 rounded font-mono text-[10px] uppercase tracking-wider bg-amber-500/20 text-amber-400/80 border border-amber-500/20">{r.escalation_reason}</span>
                  )}
                  <span className="text-zinc-500 text-xs">{r.created_at ?? ''}</span>
                  <div className="ml-auto flex gap-2">
                    <button
                      type="button"
                      onClick={() => resolveReview(r.decision_id, 'approve')}
                      disabled={resolveLoading === r.decision_id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 hover:bg-emerald-600/50 disabled:opacity-50"
                    >
                      <CheckIcon className="w-4 h-4" />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => resolveReview(r.decision_id, 'reject')}
                      disabled={resolveLoading === r.decision_id}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-md bg-red-600/30 text-red-300 border border-red-500/50 hover:bg-red-600/50 disabled:opacity-50"
                    >
                      <XMarkIcon className="w-4 h-4" />
                      Reject
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.div>

        <div className="grid gap-8 lg:grid-cols-2">
          {/* Manual Assess */}
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Run ARIN Assessment</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Source Module</label>
                <select
                  value={assessForm.source_module}
                  onChange={(e) => setAssessForm((f) => ({ ...f, source_module: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans"
                >
                  {SOURCE_MODULES.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Object Type</label>
                <select
                  value={assessForm.object_type}
                  onChange={(e) => setAssessForm((f) => ({ ...f, object_type: e.target.value }))}
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-sans"
                >
                  {OBJECT_TYPES.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Object ID</label>
                <input
                  type="text"
                  value={assessForm.object_id}
                  onChange={(e) => setAssessForm((f) => ({ ...f, object_id: e.target.value }))}
                  placeholder="e.g. demo-asset-1"
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 placeholder-zinc-500 font-sans"
                />
              </div>
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Input Data (JSON, optional)</label>
                <textarea
                  value={assessForm.input_data}
                  onChange={(e) => setAssessForm((f) => ({ ...f, input_data: e.target.value }))}
                  rows={3}
                  placeholder='{"severity": 0.7}'
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 font-mono text-sm placeholder-zinc-500"
                />
                <p className="font-mono text-[10px] text-zinc-500 mt-1">
                  To trigger human review: <code className="text-amber-400/80">{'{"financial_impact_eur": 15000000}'}</code> or <code className="text-amber-400/80">{'{"life_safety": true, "severity": 0.9}'}</code>
                </p>
                <button
                  type="button"
                  onClick={() => setAssessForm((f) => ({ ...f, input_data: '{"financial_impact_eur": 15000000, "severity": 0.7}' }))}
                  className="mt-1 font-mono text-[10px] text-amber-400/80 hover:text-amber-300 underline"
                >
                  Fill: trigger escalation example
                </button>
              </div>
              {assessError && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400/80 text-sm font-sans">{assessError}</div>
              )}
              <button
                onClick={runAssess}
                disabled={assessLoading}
                className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 disabled:opacity-50"
              >
                {assessLoading ? 'Running…' : 'Run Assessment'}
              </button>
            </div>
          </div>

          {/* View / Replay by Decision ID */}
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/50 p-6">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">View or Replay Decision</h2>
            <div className="space-y-4">
              <div>
                <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Decision ID</label>
                <input
                  type="text"
                  value={decisionId}
                  onChange={(e) => setDecisionId(e.target.value)}
                  placeholder="e.g. DEC-2026-02-06-001"
                  className="w-full px-3 py-2 rounded-md bg-zinc-900/80 border border-zinc-800/60 text-zinc-100 placeholder-zinc-500 font-sans"
                />
              </div>
              {fetchError && (
                <div className="p-2 rounded bg-red-500/10 border border-red-500/20 text-red-400/80 text-sm font-sans">{fetchError}</div>
              )}
              <div className="flex gap-2">
                <button
                  onClick={fetchDecision}
                  disabled={fetchLoading || !decisionId.trim()}
                  className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 disabled:opacity-50"
                >
                  {fetchLoading ? 'Loading…' : 'Fetch'}
                </button>
                <button
                  onClick={replayDecision}
                  disabled={replayLoading || !decisionId.trim()}
                  className="px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 font-medium hover:bg-zinc-700 disabled:opacity-50"
                >
                  {replayLoading ? 'Replaying…' : 'Replay'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Result from assess */}
        {assessResult && (
          <div className="mt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Assessment Result</h2>
            <DecisionObjectCard decision={assessResult} />
          </div>
        )}

        {/* Result from fetch / replay */}
        {fetchedDecision && !assessResult && (
          <div className="mt-8">
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Decision</h2>
            <DecisionObjectCard decision={fetchedDecision} />
          </div>
        )}
      </div>
    </div>
  )
}
