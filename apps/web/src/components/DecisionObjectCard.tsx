/**
 * DecisionObjectCard
 * Reusable UI for Risk & Intelligence OS (ARIN) Decision Object.
 * Displays consensus, verdict, dissent, suggested actions, and optionally agent assessments.
 */
import { useState } from 'react'
import type React from 'react'
import type { DecisionObject } from '../lib/api'
import { humanizeAction } from '../lib/formatText'

interface DecisionObjectCardProps {
  decision: DecisionObject
  compact?: boolean
  showAgents?: boolean
  /** Optional class for the container */
  className?: string
}

function getRiskLevelColor(level: string): string {
  const u = (level || '').toUpperCase()
  if (u === 'HIGH' || u === 'CRITICAL') return 'text-red-400/80 bg-red-500/20'
  if (u === 'MEDIUM') return 'text-amber-400/80 bg-amber-500/20'
  return 'text-emerald-400/80 bg-emerald-500/20'
}

function getRecommendationColor(rec: string): string {
  const u = (rec || '').toUpperCase()
  if (u === 'REDUCE' || u === 'ESCALATE') return 'text-red-400/80'
  if (u === 'INCREASE') return 'text-amber-400/80'
  return 'text-zinc-200'
}

/** Format large scientific numbers in reasoning (e.g. ethicist "future lives" 1e+15) for readability */
function formatReasoningText(text: string): React.ReactNode {
  const sci = /~?(\d*\.?\d+)e\+?(-?\d+)/gi
  const parts: React.ReactNode[] = []
  let lastIndex = 0
  let m: RegExpExecArray | null
  const re = new RegExp(sci.source, sci.flags)
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIndex) parts.push(text.slice(lastIndex, m.index))
    const exp = parseInt(m[2], 10)
    parts.push(
      <span key={m.index} title="Longtermist scaling factor" className="font-mono text-zinc-300">
        order of magnitude 10^{exp}
      </span>
    )
    lastIndex = re.lastIndex
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>
}

export default function DecisionObjectCard({
  decision,
  compact = false,
  showAgents = false,
  className = '',
}: DecisionObjectCardProps) {
  const [agentsExpanded, setAgentsExpanded] = useState(false)
  const { consensus, verdict, dissent, agent_assessments } = decision

  return (
    <div
      className={`rounded-md border border-zinc-700 bg-zinc-800/50 p-4 ${className}`}
    >
      <h3 className="text-zinc-300 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
        Risk & Intelligence OS — Decision Object
        {decision.decision_id && (
          <span className="text-zinc-500 text-xs font-mono font-normal normal-case">
            {decision.decision_id}
          </span>
        )}
      </h3>

      {/* Consensus */}
      <div className="mb-3">
        <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
          Consensus
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2 py-0.5 rounded text-xs font-medium ${getRiskLevelColor(
              consensus.risk_level
            )}`}
          >
            {consensus.risk_level}
          </span>
          <span className="text-zinc-200 text-sm">
            Score: {(consensus.final_score * 100).toFixed(0)}%
          </span>
          <span className="text-zinc-500 text-xs">
            Confidence: {(consensus.confidence * 100).toFixed(0)}%
          </span>
          <span className="text-zinc-500 text-xs">
            {consensus.agent_count} agent{consensus.agent_count !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Verdict */}
      <div className="mb-3">
        <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
          Verdict
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`text-sm font-medium ${getRecommendationColor(
              verdict.recommendation
            )}`}
          >
            {verdict.recommendation}
          </span>
          {verdict.time_horizon_days && (
            <span className="text-zinc-500 text-xs">
              Horizon: {verdict.time_horizon_days} days
            </span>
          )}
          {verdict.human_confirmation_required && (
            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-300/80 rounded text-[10px]">
              Human review required
              {verdict.escalation_reason ? ` (${verdict.escalation_reason})` : ''}
            </span>
          )}
        </div>
      </div>

      {/* Dissent (if present) */}
      {dissent && (dissent.dissenting_agents?.length > 0 || dissent.explanation) && (
        <div className="mb-3 p-2 rounded-md bg-zinc-800 border border-zinc-700">
          <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1">
            Dissent
          </div>
          <div className="text-zinc-200 text-xs">
            {dissent.explanation || 'Agents disagree on risk level.'}
          </div>
          <div className="text-zinc-500 text-[10px] mt-1">
            Dissenting: {dissent.dissenting_agents.join(', ')}
          </div>
        </div>
      )}

      {/* Suggested actions */}
      {verdict.suggested_actions?.length > 0 && !compact && (
        <div className="mb-3">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">
            Suggested Actions
          </div>
          <ul className="list-disc list-inside text-zinc-200 text-sm space-y-0.5">
            {verdict.suggested_actions.map((a, i) => (
              <li key={i}>{humanizeAction(a)}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Agent assessments (expandable) */}
      {agent_assessments && agent_assessments.length > 0 && (
        <div className="mt-3 pt-3 border-t border-zinc-700">
          <button
            type="button"
            onClick={() => setAgentsExpanded(!agentsExpanded)}
            className="text-zinc-500 text-[10px] uppercase tracking-wider hover:text-zinc-300 mb-2"
          >
            {agentsExpanded ? 'Hide' : 'Show'} Agent Assessments ({agent_assessments.length})
          </button>
          {(showAgents || agentsExpanded) && (
            <div className="space-y-2">
              {agent_assessments.map((a, i) => (
                <div key={i} className="p-2 rounded bg-zinc-800 text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-300 font-medium">
                      {a.agent_id}
                    </span>
                    <span className="text-zinc-300">
                      Score: {(a.score * 100).toFixed(0)}% · Conf: {(a.confidence * 100).toFixed(0)}%
                    </span>
                  </div>
                  {a.reasoning && (
                    <div className="text-zinc-400 mt-1" title={a.reasoning.includes('e+') || a.reasoning.includes('e-') ? 'Longtermist scaling factor' : undefined}>
                      {formatReasoningText(a.reasoning)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
