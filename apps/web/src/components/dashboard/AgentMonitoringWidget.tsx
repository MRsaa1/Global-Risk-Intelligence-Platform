/**
 * Agent Monitoring Widget (NeMo Agent Toolkit)
 * Displays agent status: health scores, performance metrics, last activity.
 * Fetches GET /api/v1/agents/monitoring/dashboard
 * compact: minimal one-line strip for Command Center
 */
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CpuChipIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XCircleIcon,
  ArrowPathIcon,
  PlayIcon,
  StopIcon,
} from '@heroicons/react/24/outline'
import { useMutation, useQueryClient } from '@tanstack/react-query'

const AGENT_DASHBOARD_KEY = ['agents', 'monitoring', 'dashboard']

async function fetchAgentDashboard() {
  const res = await fetch('/api/v1/agents/monitoring/dashboard')
  if (!res.ok) throw new Error(`agent dashboard ${res.status}`)
  return res.json()
}

const getHealthStatus = (score: number): 'healthy' | 'degraded' | 'critical' => {
  if (score >= 0.8) return 'healthy'
  if (score >= 0.5) return 'degraded'
  return 'critical'
}

const getHealthColor = (status: 'healthy' | 'degraded' | 'critical') => {
  switch (status) {
    case 'healthy':
      return { color: 'text-emerald-500/70', bg: 'bg-emerald-500/60', icon: CheckCircleIcon }
    case 'degraded':
      return { color: 'text-amber-500/70', bg: 'bg-amber-500/60', icon: ExclamationTriangleIcon }
    case 'critical':
      return { color: 'text-red-500/70', bg: 'bg-red-500/60', icon: XCircleIcon }
  }
}

interface AgentMonitoringWidgetProps {
  compact?: boolean
}

async function testAllAgents() {
  const res = await fetch('/api/v1/agents/monitoring/test/all', { method: 'POST' })
  if (!res.ok) throw new Error(`test agents ${res.status}`)
  return res.json()
}

async function startAgents() {
  const res = await fetch('/api/v1/agents/monitoring/start', { method: 'POST' })
  if (!res.ok) throw new Error(`start agents ${res.status}`)
  return res.json()
}

async function stopAgents() {
  const res = await fetch('/api/v1/agents/monitoring/stop', { method: 'POST' })
  if (!res.ok) throw new Error(`stop agents ${res.status}`)
  return res.json()
}

async function getAgentsStatus() {
  const res = await fetch('/api/v1/agents/monitoring/status')
  if (!res.ok) throw new Error(`get status ${res.status}`)
  return res.json()
}

export default function AgentMonitoringWidget({ compact = false }: AgentMonitoringWidgetProps) {
  const [detailsOpen, setDetailsOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: AGENT_DASHBOARD_KEY,
    queryFn: fetchAgentDashboard,
    refetchInterval: 30_000, // Refresh every 30 seconds
    staleTime: 15_000,
  })

  // Get agents status (running/stopped)
  const { data: statusData, refetch: refetchStatus } = useQuery({
    queryKey: ['agents', 'status'],
    queryFn: getAgentsStatus,
    refetchInterval: 10_000, // Check every 10 seconds
  })

  const isRunning = statusData?.monitoring || false

  const testMutation = useMutation({
    mutationFn: testAllAgents,
    onSuccess: () => {
      // Refresh dashboard after test
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: AGENT_DASHBOARD_KEY })
      }, 1000)
    },
  })

  const startMutation = useMutation({
    mutationFn: startAgents,
    onSuccess: () => {
      refetchStatus()
      // Refresh dashboard after starting
      setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: AGENT_DASHBOARD_KEY })
      }, 2000)
    },
  })

  const stopMutation = useMutation({
    mutationFn: stopAgents,
    onSuccess: () => {
      refetchStatus()
    },
  })

  const profiles = data?.profiles || {}
  const agents = ['SENTINEL', 'ANALYST', 'ADVISOR', 'REPORTER', 'ETHICIST'] as const

  // Calculate overall health (average of all agents)
  const overallHealth = agents.reduce((sum, name) => {
    const profile = profiles[name]
    return sum + (profile?.health_score || 0)
  }, 0) / agents.length

  const overallStatus = getHealthStatus(overallHealth)
  const overallCfg = getHealthColor(overallStatus)

  // Compact: one-line corporate strip for Command Center
  if (compact) {
    const healthyCount = agents.filter(name => {
      const profile = profiles[name]
      return profile && getHealthStatus(profile.health_score) === 'healthy'
    }).length

    return (
      <div className="group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-zinc-900/50 border border-zinc-800/60">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${overallCfg.bg} ${overallStatus !== 'healthy' ? 'animate-pulse' : ''}`} />
        <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Agents</span>
        <span className="text-zinc-700">·</span>
        {isLoading && <span className="text-zinc-700 text-[10px]">—</span>}
        {error && <span className="text-zinc-600 text-[10px]">Error</span>}
        {!isLoading && !error && (
          <>
            <span className={`text-[10px] ${overallCfg.color}`}>
              {healthyCount}/{agents.length}
            </span>
            {overallStatus !== 'healthy' && (
              <>
                <span className="text-zinc-700">·</span>
                <span className={`text-[10px] ${overallCfg.color}`}>
                  {overallStatus === 'degraded' ? 'Degraded' : 'Critical'}
                </span>
              </>
            )}
          </>
        )}
      </div>
    )
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md p-6 border border-zinc-800/60 bg-zinc-900/50"
    >
      <div className="flex items-start justify-between gap-4 mb-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-2">
            <CpuChipIcon className="w-5 h-5 text-zinc-500" />
            <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">AI Agents (NeMo)</h2>
            <div className={`flex items-center gap-1.5 ${overallCfg.color}`}>
              <div className={`w-2 h-2 rounded-full ${overallCfg.bg} ${overallStatus !== 'healthy' ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                {overallStatus === 'healthy' ? 'All Healthy' : 
                 overallStatus === 'degraded' ? 'Degraded' : 'Critical'}
              </span>
            </div>
            <div className={`flex items-center gap-1.5 ml-2 ${isRunning ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
              <div className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-500' : 'bg-amber-500'} ${isRunning ? 'animate-pulse' : ''}`} />
              <span className="text-[10px] font-mono uppercase tracking-wider">
                {isRunning ? 'Running' : 'Stopped'}
              </span>
            </div>
          </div>

          {isLoading && (
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Loading agent status…</p>
          )}
          {error && (
            <p className="text-sm text-amber-400/80 font-sans">
              Unable to load. <button type="button" onClick={() => refetch()} className="underline">Retry</button>
            </p>
          )}
        </div>
      </div>

          {!isLoading && !error && (
        <div className="space-y-3">
          {/* Start/Stop Agents Button */}
          <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                  {isRunning ? 'Agents are running' : 'Agents are stopped'}
                </p>
                <p className="text-[10px] text-zinc-500/90 font-sans">
                  {isRunning 
                    ? 'SENTINEL is monitoring in the background. Alerts will be generated automatically.'
                    : 'Start agents to begin 24/7 monitoring and alert generation.'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {isRunning ? (
                  <button
                    onClick={() => stopMutation.mutate()}
                    disabled={stopMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/20 hover:bg-red-500/30 text-red-300 text-xs transition-colors disabled:opacity-50"
                  >
                    <StopIcon className="w-4 h-4" />
                    {stopMutation.isPending ? 'Stopping...' : 'Stop Agents'}
                  </button>
                ) : (
                  <button
                    onClick={() => startMutation.mutate()}
                    disabled={startMutation.isPending}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-xs transition-colors disabled:opacity-50"
                  >
                    <PlayIcon className="w-4 h-4" />
                    {startMutation.isPending ? 'Starting...' : 'Start Agents'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Test Agents - always show so user can run and see real metrics */}
          <div className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                  {Object.values(profiles).every(p => p.total_calls === 0)
                    ? 'No agent activity yet'
                    : 'Run agents again to add more metrics'}
                </p>
                <p className="text-[10px] text-zinc-500/90 font-sans">
                  Test Agents runs SENTINEL, ANALYST, ADVISOR, REPORTER, ETHICIST once and records latency/success. Start Agents runs SENTINEL monitoring in the background.
                </p>
              </div>
              <button
                onClick={() => testMutation.mutate()}
                disabled={testMutation.isPending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 text-xs transition-colors disabled:opacity-50"
              >
                <ArrowPathIcon className={`w-4 h-4 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                {testMutation.isPending ? 'Testing...' : 'Test Agents'}
              </button>
            </div>
          </div>

          {agents.map((agentName) => {
            const profile = profiles[agentName]
            if (!profile) return null

            const status = getHealthStatus(profile.health_score)
            const cfg = getHealthColor(status)
            const Icon = cfg.icon

            return (
              <div
                key={agentName}
                className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${cfg.color}`} />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{agentName}</span>
                  </div>
                  <div className="flex items-center gap-3 font-mono text-[10px] tabular-nums">
                    <span className="text-zinc-500">
                      Health: <span className={cfg.color}>{Math.round(profile.health_score * 100)}%</span>
                    </span>
                    {profile.last_call_at && (
                      <span className="text-zinc-500">
                        {new Date(profile.last_call_at).toLocaleTimeString()}
                      </span>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 font-mono text-[10px] text-zinc-400 tabular-nums">
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider">Calls:</span> {profile.total_calls}
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider">Latency:</span> {Math.round(profile.avg_latency_ms)}ms
                  </div>
                  <div>
                    <span className="text-zinc-500 uppercase tracking-wider">Success:</span>{' '}
                    <span className={profile.success_rate >= 0.95 ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                      {Math.round(profile.success_rate * 100)}%
                    </span>
                  </div>
                </div>

                {profile.total_errors > 0 && (
                  <div className="mt-2 text-[10px] text-amber-400/80">
                    ⚠ {profile.total_errors} error{profile.total_errors !== 1 ? 's' : ''}
                  </div>
                )}
              </div>
            )
          })}

          <button
            type="button"
            onClick={() => setDetailsOpen((o) => !o)}
            className="mt-2 flex items-center gap-1 font-mono text-[10px] uppercase tracking-widest text-zinc-500 hover:text-zinc-400"
          >
            {detailsOpen ? <ChevronUpIcon className="w-4 h-4" /> : <ChevronDownIcon className="w-4 h-4" />}
            {detailsOpen ? 'Hide' : 'Show'} detailed metrics
          </button>

          <AnimatePresence>
            {detailsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-2 space-y-2 overflow-hidden"
              >
                {agents.map((agentName) => {
                  const profile = profiles[agentName]
                  if (!profile) return null

                  return (
                    <div
                      key={agentName}
                      className="p-3 rounded-md bg-zinc-900/80 border border-zinc-800/60"
                    >
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">{agentName} Metrics</div>
                      <div className="grid grid-cols-2 gap-2 font-mono text-[10px] text-zinc-400 tabular-nums">
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">P50 Latency:</span> {Math.round(profile.p50_latency_ms)}ms
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">P95 Latency:</span> {Math.round(profile.p95_latency_ms)}ms
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">P99 Latency:</span> {Math.round(profile.p99_latency_ms)}ms
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">Total Tokens:</span> {profile.total_tokens.toLocaleString()}
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">Total Cost:</span> ${profile.total_cost_usd.toFixed(4)}
                        </div>
                        <div>
                          <span className="text-zinc-500 uppercase tracking-wider">Errors:</span> {profile.total_errors}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  )
}
