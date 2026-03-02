/**
 * Agent Workflows — Agent OS workflow management UI.
 * List templates, start runs, monitor execution, view history.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowPathIcon,
  PlayIcon,
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  CpuChipIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline'
import {
  listTemplates,
  startWorkflow,
  listRuns,
  type WorkflowTemplate,
  type WorkflowRun,
} from '../services/workflowsApi'

const CC_LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
const CC_CARD = 'rounded-md bg-zinc-900 border border-zinc-800 p-5'
const BTN = 'px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm hover:bg-zinc-700 transition-colors'

const STATUS_CFG = {
  completed: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', icon: CheckCircleIcon },
  failed: { color: 'text-red-400', bg: 'bg-red-500/10', icon: XCircleIcon },
  running: { color: 'text-amber-400', bg: 'bg-amber-500/10', icon: ArrowPathIcon },
  pending: { color: 'text-zinc-400', bg: 'bg-zinc-800', icon: ClockIcon },
} as const

const AGENT_COLORS: Record<string, string> = {
  SENTINEL: 'bg-red-500/20 text-red-400 border-red-500/30',
  ANALYST: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  ADVISOR: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  ETHICIST: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  REPORTER: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
}

export default function AgentWorkflows() {
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null)
  const [runningId, setRunningId] = useState<string | null>(null)
  const qc = useQueryClient()

  const { data: templatesData } = useQuery({
    queryKey: ['workflows', 'templates'],
    queryFn: listTemplates,
  })

  const { data: runsData, isLoading: runsLoading } = useQuery({
    queryKey: ['workflows', 'runs'],
    queryFn: () => listRuns(30),
    refetchInterval: 5_000,
  })

  const runMutation = useMutation({
    mutationFn: (templateId: string) => startWorkflow(templateId),
    onMutate: (id) => setRunningId(id),
    onSettled: () => {
      setRunningId(null)
      qc.invalidateQueries({ queryKey: ['workflows', 'runs'] })
    },
  })

  const templates = Array.isArray(templatesData?.templates) ? templatesData!.templates : []
  const runs = Array.isArray(runsData?.runs) ? runsData!.runs : []

  return (
    <div className="min-h-full p-6 bg-zinc-950 text-zinc-100 pb-16">
      <div className="w-full max-w-[1400px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
            <CpuChipIcon className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-zinc-100">Agent Workflows</h1>
            <p className="text-zinc-500 text-sm mt-1">Multi-agent workflow orchestration — Agent OS</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Templates */}
          <div className="lg:col-span-1 space-y-4">
            <h2 className={CC_LABEL}>Workflow Templates ({templates.length})</h2>
            {templates.map((t) => (
              <TemplateCard
                key={t.id}
                template={t}
                expanded={expandedTemplate === t.id}
                onToggle={() => setExpandedTemplate(expandedTemplate === t.id ? null : t.id)}
                onRun={() => runMutation.mutate(t.id)}
                running={runningId === t.id}
              />
            ))}
            {templates.length === 0 && (
              <div className={CC_CARD}>
                <p className="text-zinc-500 text-sm">No workflow templates loaded.</p>
              </div>
            )}
          </div>

          {/* Runs history */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h2 className={CC_LABEL}>Recent Runs ({runs.length})</h2>
              <button
                onClick={() => qc.invalidateQueries({ queryKey: ['workflows', 'runs'] })}
                className="p-2 rounded-md hover:bg-zinc-800 transition-colors"
                title="Refresh"
              >
                <ArrowPathIcon className="w-4 h-4 text-zinc-500" />
              </button>
            </div>

            {runsLoading ? (
              <div className={CC_CARD}>
                <p className="text-zinc-500 text-sm">Loading runs...</p>
              </div>
            ) : runs.length === 0 ? (
              <div className={CC_CARD}>
                <div className="text-center py-8">
                  <Cog6ToothIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-zinc-500 text-sm">No workflow runs yet.</p>
                  <p className="text-zinc-600 text-xs mt-1">Select a template and click "Run" to start.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {runs.map((run, idx) => (
                  <RunCard key={run.run_id ?? run.id ?? idx} run={run} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TemplateCard({
  template,
  expanded,
  onToggle,
  onRun,
  running,
}: {
  template: WorkflowTemplate
  expanded: boolean
  onToggle: () => void
  onRun: () => void
  running: boolean
}) {
  return (
    <div className={CC_CARD}>
      <button onClick={onToggle} className="w-full flex items-center justify-between text-left">
        <div className="flex items-center gap-2">
          {expanded ? <ChevronDownIcon className="w-4 h-4 text-zinc-500" /> : <ChevronRightIcon className="w-4 h-4 text-zinc-500" />}
          <span className="text-zinc-100 text-sm font-medium">{template.name}</span>
        </div>
        <span className="text-zinc-600 text-xs">{template.steps?.length ?? template.steps_count ?? 0} steps</span>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <p className="text-zinc-500 text-xs mt-3 mb-3">{template.description}</p>
            {template.tags && template.tags.length > 0 && (
              <div className="flex gap-1.5 mb-3 flex-wrap">
                {template.tags.map((tag) => (
                  <span key={tag} className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-400 border border-zinc-700">{tag}</span>
                ))}
              </div>
            )}

            <div className="space-y-2 mb-4">
              {template.steps && template.steps.length > 0 ? template.steps.map((step, i) => {
                const agentClass = AGENT_COLORS[step.agent] ?? 'bg-zinc-800 text-zinc-400 border-zinc-700'
                return (
                  <div key={`${template.id}-step-${i}-${step.agent}-${step.action}`} className="flex items-center gap-2">
                    <span className="text-zinc-600 text-[10px] font-mono w-4">{i + 1}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono border ${agentClass}`}>
                      {step.agent}
                    </span>
                    <span className="text-zinc-400 text-xs">{step.action}</span>
                  </div>
                )
              }) : (
                <p className="text-zinc-600 text-xs">{template.steps_count ?? 0} steps configured{template.version ? ` · v${template.version}` : ''}</p>
              )}
            </div>

            <button
              onClick={onRun}
              disabled={running}
              className={`${BTN} flex items-center gap-2 w-full justify-center`}
            >
              {running ? (
                <>
                  <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <PlayIcon className="w-4 h-4" />
                  Run Workflow
                </>
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

function RunCard({ run }: { run: WorkflowRun }) {
  const cfg = STATUS_CFG[run.status] || STATUS_CFG.pending
  const Icon = cfg.icon
  const runId = run.run_id ?? run.id ?? '—'
  const completedArr = Array.isArray(run.steps_completed) ? run.steps_completed : []
  const failedArr = Array.isArray(run.steps_failed) ? run.steps_failed : []
  const completedCount = Array.isArray(run.steps_completed) ? run.steps_completed.length : (run.steps_completed ?? 0)
  const failedCount = Array.isArray(run.steps_failed) ? run.steps_failed.length : (run.steps_failed ?? 0)

  const formatTs = (ts: number | string | null | undefined) => {
    if (ts == null) return null
    const d = typeof ts === 'number' && ts > 1e9 ? new Date(ts * 1000) : new Date(ts)
    return d.toLocaleString()
  }

  return (
    <div className={`rounded-md border border-zinc-800 ${cfg.bg} p-4`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${cfg.color}`} />
          <span className={`font-mono text-xs ${cfg.color}`}>{run.status.toUpperCase()}</span>
        </div>
        <span className="text-zinc-600 text-[10px] font-mono">{String(runId).slice(0, 12)}</span>
      </div>

      <div className="flex items-center gap-2 mb-2">
        <span className="text-zinc-400 text-xs">Template:</span>
        <span className="text-zinc-200 text-xs font-medium">{run.template_id}</span>
      </div>

      <div className="flex items-center gap-4 text-[10px] font-mono text-zinc-500">
        <span>Started: {formatTs(run.started_at) ?? '—'}</span>
        {run.completed_at && <span>Done: {formatTs(run.completed_at)}</span>}
        {run.duration_seconds != null && <span>{run.duration_seconds.toFixed(1)}s</span>}
      </div>

      <div className="flex items-center gap-2 mt-2 text-[10px] font-mono">
        {completedCount > 0 && <span className="text-emerald-400">{completedCount} completed</span>}
        {failedCount > 0 && <span className="text-red-400">{failedCount} failed</span>}
      </div>

      {(completedArr.length > 0 || failedArr.length > 0) && (
        <div className="flex items-center gap-1 mt-1 flex-wrap">
          {completedArr.map((s) => (
            <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              {s}
            </span>
          ))}
          {failedArr.map((s) => (
            <span key={s} className="px-1.5 py-0.5 rounded text-[9px] font-mono bg-red-500/10 text-red-400 border border-red-500/20">
              {s}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
