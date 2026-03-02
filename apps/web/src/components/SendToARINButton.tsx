/**
 * SendToARINButton - Unified ARIN button: assess + export
 *
 * Single button that:
 * 1. Runs multi-agent risk assessment (ARIN Orchestrator) → Decision Object
 * 2. Exports risk data to ARIN Platform (Unified Analysis) → appears in Data Sources
 * 3. Optionally captures a DOM screenshot and sends for Physical AI (Cosmos Reason 2) analysis
 *
 * Must be present in every service that generates report data.
 */
import { useState, type RefObject } from 'react'
import { useNavigate } from 'react-router-dom'
import { PaperAirplaneIcon, CheckIcon, ExclamationTriangleIcon, CameraIcon } from '@heroicons/react/24/outline'
import { arinApi } from '../lib/api'
import type { DecisionObject } from '../lib/api'

export interface SendToARINButtonProps {
  /* --- Assess props (internal multi-agent) --- */
  sourceModule: string
  objectType: string
  objectId: string
  inputData?: Record<string, unknown>

  /* --- Export props (external ARIN Platform) --- */
  /** Entity ID for ARIN Platform export (e.g. "portfolio_global") */
  exportEntityId?: string
  /** Entity type for export */
  exportEntityType?: 'portfolio' | 'stock' | 'crypto' | 'zone' | 'physical_asset' | 'scenario'
  /** Analysis type for export */
  exportAnalysisType?: 'global_risk_assessment' | 'asset_risk_analysis' | 'stress_test' | 'compliance_check' | 'physical_asset_summary'
  /** Data payload for export */
  exportData?: {
    risk_score?: number
    risk_level?: string
    summary?: string
    recommendations?: string[]
    indicators?: Record<string, unknown>
  }

  /* --- Physical AI (Cosmos Reason 2) props --- */
  /** Ref to DOM element to capture as screenshot for Physical AI analysis */
  captureRef?: RefObject<HTMLElement | null>
  /** Data sources for provenance (e.g. ["FEMA", "NOAA", "CMIP6"]) */
  dataSources?: string[]

  /* --- UI props --- */
  variant?: 'primary' | 'secondary'
  size?: 'sm' | 'md'
  label?: string
  disabled?: boolean
  onSuccess?: (decision: DecisionObject) => void
  /** Pill next to Agents: only button, same style as Agents widget, slightly more prominent */
  compactPill?: boolean
}

/** Build default export payload from assess context so export to external ARIN always runs. */
function defaultExportFromAssess(
  inputData?: Record<string, unknown>,
  objectType?: string,
  objectId?: string,
  sourceModule?: string
): { risk_score: number; risk_level: string; summary: string; recommendations: string[]; indicators: Record<string, unknown> } {
  const score = typeof inputData?.risk_score === 'number'
    ? inputData.risk_score
    : typeof inputData?.weighted_risk === 'number'
      ? Math.round(inputData.weighted_risk * 100)
      : typeof inputData?.severity === 'number'
        ? Math.round(inputData.severity * 100)
        : 50
  const riskLevel = score >= 70 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW'
  const summary = typeof inputData?.summary === 'string'
    ? inputData.summary
    : `Exported from ${sourceModule ?? 'app'}: ${objectType ?? 'entity'} ${objectId ?? '—'}`
  const recommendations = Array.isArray(inputData?.recommendations)
    ? (inputData.recommendations as string[])
    : ['Review in ARIN', 'Update risk limits']
  const indicators = inputData && typeof inputData === 'object'
    ? { ...inputData } as Record<string, unknown>
    : {}
  return { risk_score: score, risk_level: riskLevel, summary, recommendations, indicators }
}

export default function SendToARINButton({
  sourceModule,
  objectType,
  objectId,
  inputData,
  exportEntityId,
  exportEntityType = 'portfolio',
  exportAnalysisType = 'global_risk_assessment',
  exportData,
  captureRef,
  dataSources,
  variant = 'secondary',
  size = 'md',
  label = 'Send to ARIN',
  disabled = false,
  onSuccess,
  compactPill = false,
}: SendToARINButtonProps) {
  const navigate = useNavigate()
  const [phase, setPhase] = useState<'idle' | 'assessing' | 'exporting' | 'done'>('idle')
  const [error, setError] = useState<string | null>(null)
  const [decisionId, setDecisionId] = useState<string | null>(null)
  const [includePhysicalAI, setIncludePhysicalAI] = useState(false)
  const [exportResult, setExportResult] = useState<{ exported: boolean; reason?: string; message?: string } | null>(null)

  const loading = phase === 'assessing' || phase === 'exporting'
  const success = phase === 'done'

  // Auto-derive export target so external ARIN always receives data after assess
  const effectiveEntityId = exportEntityId ?? (objectType === 'portfolio' ? 'portfolio_global' : objectId)
  const effectiveExportData = exportData ?? defaultExportFromAssess(inputData, objectType, objectId, sourceModule)

  /** Capture DOM element as base64 PNG using html2canvas */
  const captureScreenshot = async (): Promise<string | null> => {
    if (!captureRef?.current) return null
    try {
      const html2canvas = (await import('html2canvas')).default
      const canvas = await html2canvas(captureRef.current, {
        backgroundColor: '#18181b',
        scale: 1,
        logging: false,
      })
      // Return base64 without the data:image/png;base64, prefix
      const dataUrl = canvas.toDataURL('image/png')
      return dataUrl.split(',')[1] || null
    } catch (e) {
      console.warn('Screenshot capture failed:', e)
      return null
    }
  }

  const handleClick = async () => {
    setPhase('assessing')
    setError(null)
    setDecisionId(null)
    setExportResult(null)
    try {
      // Step 1: Multi-agent assessment
      const decision = await arinApi.assess({
        source_module: sourceModule,
        object_type: objectType,
        object_id: objectId,
        input_data: inputData,
      })
      setDecisionId(decision.decision_id)
      onSuccess?.(decision)

      // Step 2: Export to ARIN Platform (always after successful assess; payload from props or auto-derived)
      if (effectiveEntityId && effectiveExportData) {
        setPhase('exporting')
        try {
          if (includePhysicalAI && captureRef) {
            const imageBase64 = await captureScreenshot()
            const res = await arinApi.exportPhysicalAsset({
              entity_id: effectiveEntityId,
              entity_type: exportEntityType,
              context: {
                ...effectiveExportData,
                source_module: sourceModule,
                object_type: objectType,
                object_id: objectId,
              },
              image_base64: imageBase64 ?? undefined,
              data_sources: dataSources,
            })
            setExportResult({ exported: Boolean(res.exported), reason: res.reason, message: res.message })
          } else {
            const res = await arinApi.exportToPlatform({
              entity_id: effectiveEntityId,
              entity_type: exportEntityType,
              analysis_type: exportAnalysisType,
              data: effectiveExportData,
            })
            setExportResult({ exported: Boolean(res.exported), reason: res.reason, message: res.message })
          }
        } catch (e) {
          setExportResult({ exported: false, reason: 'request_failed', message: e instanceof Error ? e.message : 'Export request failed' })
        }
      }

      setPhase('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to send to ARIN')
      setPhase('idle')
    }
  }

  const baseClass =
    'inline-flex items-center gap-2 rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
  const variantClass =
    variant === 'primary'
      ? 'bg-zinc-600 text-white hover:bg-zinc-500'
      : 'bg-zinc-800 text-zinc-200 border border-zinc-600 hover:bg-zinc-700 hover:border-zinc-500'
  const sizeClass = size === 'sm' ? 'px-3 py-1.5 text-xs' : 'px-4 py-2 text-sm'

  const statusText =
    phase === 'assessing' ? 'Assessing…' :
    phase === 'exporting' ? (includePhysicalAI ? 'Capturing & Exporting…' : 'Exporting…') :
    phase === 'done' ? 'Sent to ARIN' : label

  const pillButtonClass = compactPill
    ? 'inline-flex items-center gap-1.5 rounded-md text-[10px] font-medium uppercase tracking-wider text-zinc-300 hover:text-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed'
    : ''

  const buttonEl = (
    <button
      type="button"
      onClick={handleClick}
      disabled={disabled || loading}
      className={compactPill ? pillButtonClass : `${baseClass} ${variantClass} ${sizeClass}`}
      title="Assess via ARIN multi-agent system & export to ARIN Platform"
    >
      {loading ? (
        <>
          <span className="animate-spin h-3 w-3 border-2 border-current border-t-transparent rounded-full flex-shrink-0" />
          <span className={compactPill ? 'uppercase' : ''}>{statusText}</span>
        </>
      ) : success ? (
        <>
          <CheckIcon className={compactPill ? 'w-3 h-3 text-emerald-400' : 'w-4 h-4 text-green-400'} />
          <span className={compactPill ? 'uppercase' : ''}>{statusText}</span>
        </>
      ) : (
        <>
          <PaperAirplaneIcon className={compactPill ? 'w-3 h-3 text-emerald-400' : 'w-4 h-4'} />
          <span className={compactPill ? 'uppercase' : ''}>{statusText}</span>
        </>
      )}
    </button>
  )

  // Compact pill: same size/style as Overseer · Agents (one pill with optional checkbox + button)
  if (compactPill) {
    const overseerPillClass = 'group flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-black/25 border border-zinc-800'
    if (captureRef) {
      return (
        <div className={overseerPillClass}>
          <label className="flex items-center gap-1.5 text-[10px] text-zinc-500 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={includePhysicalAI}
              onChange={(e) => setIncludePhysicalAI(e.target.checked)}
              disabled={loading}
              className="rounded border-zinc-600 bg-zinc-800 text-emerald-500 focus:ring-emerald-500/30 h-3 w-3"
            />
            <CameraIcon className="h-3 w-3 text-zinc-500" />
            <span className="uppercase tracking-wider">Include current view for Physical AI</span>
          </label>
          <span className="text-zinc-700">·</span>
          {buttonEl}
        </div>
      )
    }
    return (
      <div className={overseerPillClass}>
        {buttonEl}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col items-start gap-1">
      {/* Physical AI checkbox — only shown when captureRef is provided */}
      {captureRef && (
        <label className="flex items-center gap-1.5 text-xs text-zinc-400 cursor-pointer select-none mb-0.5">
          <input
            type="checkbox"
            checked={includePhysicalAI}
            onChange={(e) => setIncludePhysicalAI(e.target.checked)}
            disabled={loading}
            className="rounded border-zinc-600 bg-zinc-800 text-cyan-500 focus:ring-cyan-500/30 h-3.5 w-3.5"
          />
          <CameraIcon className="h-3.5 w-3.5" />
          Include current view for Physical AI
        </label>
      )}

      {buttonEl}
      {error && (
        <span className="flex items-center gap-1 text-xs text-red-400">
          <ExclamationTriangleIcon className="w-3.5 h-3.5" />
          {error}
        </span>
      )}
      {success && decisionId && (
        <button
          type="button"
          onClick={() => navigate(`/arin?decision=${decisionId}`)}
          className="text-xs text-zinc-400 hover:text-zinc-300 hover:underline"
        >
          View Decision {decisionId.slice(0, 20)}…
        </button>
      )}
      {success && exportResult && (
        <div className={`text-xs mt-0.5 ${exportResult.exported ? 'text-emerald-400' : 'text-zinc-500'}`} title={exportResult.message}>
          {exportResult.exported
            ? 'Exported to ARIN Platform'
            : (exportResult.reason?.toLowerCase().includes('not configured') || exportResult.message?.toLowerCase().includes('not configured'))
              ? 'ARIN export not configured (optional). Set ARIN_BASE_URL in API .env to enable.'
              : `External ARIN: ${exportResult.reason ?? 'not sent'} — ${exportResult.message ?? 'Set ARIN_BASE_URL / ARIN_EXPORT_URL in API .env'}`}
        </div>
      )}
    </div>
  )
}
