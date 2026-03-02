/**
 * Shared regulatory disclaimer for use below recommendations, conclusions, and report blocks.
 * Uses constants from regulatoryDisclaimers.ts (Gap X1–X7).
 */
import { SHORT_DISCLAIMER } from '../constants/regulatoryDisclaimers'

export interface RegulatoryDisclaimerProps {
  /** Optional extra class for the wrapper */
  className?: string
  /** If true, render as a single compact line; otherwise small block */
  compact?: boolean
}

export default function RegulatoryDisclaimer({ className = '', compact = false }: RegulatoryDisclaimerProps) {
  if (compact) {
    return (
      <p className={`text-[10px] text-zinc-500 ${className}`.trim()}>
        {SHORT_DISCLAIMER}
      </p>
    )
  }
  return (
    <div className={`rounded border border-zinc-700/80 bg-zinc-900/60 px-3 py-2 text-[10px] text-zinc-500 ${className}`.trim()}>
      <strong className="text-zinc-400">Regulatory notice:</strong> {SHORT_DISCLAIMER}
    </div>
  )
}
