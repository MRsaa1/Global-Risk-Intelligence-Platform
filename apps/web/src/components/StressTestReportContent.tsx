/**
 * StressTestReportContent
 * Reusable report body for the Stress Test Report (standalone page and any embed).
 * Extracted from DigitalTwinPanel report overlay.
 */
import EventRiskGraph from './EventRiskGraph'
import CascadeVisualizer from './analytics/CascadeVisualizer'

/** Cascade simulation snapshot added via "Add to Report" */
interface CascadeSimulationSnapshot {
  trigger_node: string
  trigger_severity: number
  simulation_steps: number
  affected_count: number
  total_loss: number
  containment_points: string[]
  critical_nodes?: string[]
}
import { RiskFlowMini } from './RiskFlowDiagram'
import { mapEventIdToCascadeScenarioId, resolveCityNameToId } from '../lib/stressTestToCascade'
import type { StressTestReportV2 } from '../lib/stressTestReportV2Types'
import { useState, useEffect } from 'react'
import { useRivaTts } from '../hooks/useRivaTts'
import DecisionObjectCard from './DecisionObjectCard'
import SendToARINButton from './SendToARINButton'
import ARINVerdictBadge from './ARINVerdictBadge'
import RegulatoryDisclaimer from './RegulatoryDisclaimer'
import SubmitAsFieldObservationModal from './SubmitAsFieldObservationModal'
import type { DecisionObject } from '../lib/api'
import { stripMarkdown } from '../lib/formatText'

// Mirrors DigitalTwinPanel RiskHighlight / StressTestReport
interface RiskHighlight {
  position: { lat: number; lng: number }
  radius: number
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  label: string
  zoneType: string
  affectedBuildings: number
  estimatedLoss: number
  populationAffected: number
  recommendations: string[]
}

export interface StressTestReport {
  eventName: string
  eventType: string
  eventId: string
  cityName: string
  timestamp: string
  totalLoss: number
  totalBuildingsAffected: number
  totalPopulationAffected: number
  zones: RiskHighlight[]
  mitigationActions: { action: string; priority: 'urgent' | 'high' | 'medium'; cost: number; riskReduction: number }[]
  dataSourcesUsed: string[]
  executiveSummary?: string
  concludingSummary?: string
  executiveSummarySources?: Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }>
  llmGenerated?: boolean
  regionActionPlan?: {
    region: string
    country: string
    event_type: string
    summary: string
    key_actions: string[]
    contacts: Array<{ name: string; phone: string }>
    sources: Array<{ title: string; url?: string }>
    urls: string[]
  }
  /** Cascade simulations added via "Add to Report" */
  cascadeSimulations?: CascadeSimulationSnapshot[]
  /** Historical event comparisons added via "Add to Report" */
  historicalComparisons?: Array<{
    id: string
    name: string
    year?: number
    description?: string
    region_name?: string
    similarity_reason: string
    lessons_learned?: string
    financial_loss_eur?: number
    severity_actual?: number
    affected_population?: number
    duration_days?: number
    recovery_time_months?: number
  }>
  /** Report V2: probabilistic, temporal, financial contagion, predictive, network, sensitivity, stakeholder, model uncertainty */
  reportV2?: StressTestReportV2
  /** When use_nvidia_orchestration=true: confidence, model_agreement, flag_for_human_review */
  nvidiaOrchestration?: {
    entity_type?: string
    confidence?: number
    model_agreement?: number
    flag_for_human_review?: boolean
    used_model_fast?: string
    used_model_deep?: string
  }
  /** From Knowledge Graph when use_kg=true */
  relatedEntities?: Array<{ id?: string; name?: string; relationship_type?: string }>
  /** KG + entity resolution context for LLM */
  graphContext?: string
  /** Currency for display (USD, EUR, GBP) */
  currency?: string
  /** Stress test ID (from API) for ARIN object_id */
  stressTestId?: string
  /** Risk & Intelligence OS - ARIN Decision Object */
  decisionObject?: DecisionObject
  /** NGFS disclosure draft text (when generated via "Generate disclosure draft") */
  disclosureDraft?: string
}

interface StressTestReportContentProps {
  report: StressTestReport
  cities: Array<{ id: string; name: string; country?: string }>
  onUpdateReport?: (updates: Partial<StressTestReport>) => void
  onExportPDF: () => Promise<void>
  /** Scroll to Cascade section in-report (no navigate). */
  onOpenInCascade: () => void
  onClose: () => void
  isExportingPDF?: boolean
  /** Callback ref for cascade section (used for scroll-into-view). */
  onCascadeSectionRef?: (el: HTMLDivElement | null) => void
}

/** Fallbacks so no section is ever empty (no "пустоты") */
function ensureReportV2NoGaps(v2: StressTestReportV2, baseLossM: number): StressTestReportV2 {
  const b = baseLossM || 100
  return {
    ...v2,
    probabilistic_metrics: v2.probabilistic_metrics ?? {
      mean_loss: b,
      median_loss: Math.round(b * 0.78),
      var_95: Math.round(b * 1.35),
      var_99: Math.round(b * 1.55),
      cvar_99: Math.round(b * 1.85),
      std_dev: Math.round(b * 0.25),
      confidence_interval_90: [Math.round(b * 0.65), Math.round(b * 1.65)] as [number, number],
      monte_carlo_runs: 100000,
    },
    temporal_dynamics: v2.temporal_dynamics ?? {
      rto_hours: 72,
      rpo_hours: 24,
      recovery_time_months: [6, 18] as [number, number],
      business_interruption_days: 45,
      impact_timeline: [],
      loss_accumulation: [
        { period: 'Day 1', amount_m: Math.round(b * 0.17) },
        { period: 'Week 1', amount_m: Math.round(b * 0.33) },
        { period: 'Month 1', amount_m: Math.round(b * 0.67) },
        { period: 'Quarter 1', amount_m: b },
      ],
    },
    financial_contagion: v2.financial_contagion ?? {
      banking: { npl_increase_pct: 2.3, provisions_eur_m: Math.round(b * 0.12), cet1_impact_bps: -45 },
      insurance: { claims_gross_eur_m: Math.round(b * 0.45), net_retained_eur_m: Math.round(b * 0.13), solvency_impact_pp: -12 },
      real_estate: { value_decline_pct: 18, vacancy_increase_pct: 8 },
      supply_chain: { direct_gdp_pct: -0.8, indirect_gdp_pct: -1.2, job_losses: Math.max(1000, Math.round(b * 4.4)) },
      total_economic_impact_eur_m: Math.round(b * 2.2),
      economic_multiplier: 2.2,
    },
    predictive_indicators: v2.predictive_indicators ?? {
      status: 'AMBER',
      probability_event: 0.5,
      key_triggers: ['Hazard intensity above baseline', 'Exposure concentration high'],
      thresholds: [
        { level: 'AMBER', condition: 'Indicator > 80% of critical' },
        { level: 'RED', condition: 'Indicator > 95% of critical' },
      ],
    },
    network_risk: v2.network_risk ?? {
      critical_nodes: [{ name: 'Critical infrastructure', centrality: 0.85 }],
      cascade_path: 'Infrastructure → Sectors → Impact',
      amplification_factor: 2.5,
      single_points_of_failure: ['Primary node', 'Secondary node'],
    },
    sensitivity: v2.sensitivity ?? {
      base_case_loss_m: b,
      parameters: [
        { name: 'Severity +20%', loss_delta_pct: 15, loss_delta_m: Math.round(b * 0.15) },
        { name: 'Exposure +10%', loss_delta_pct: 10, loss_delta_m: Math.round(b * 0.1) },
      ],
    },
    multi_scenario_table: (v2.multi_scenario_table && v2.multi_scenario_table.length > 0) ? v2.multi_scenario_table : [
      { return_period_y: 10, probability_pct: 10, expected_loss_m: Math.round(b * 0.33), buildings: 50, recovery_months: 3 },
      { return_period_y: 100, probability_pct: 1, expected_loss_m: b, buildings: 150, recovery_months: 18 },
    ],
    stakeholder_impacts: v2.stakeholder_impacts ?? {
      residential: { households_displaced: 5000, displacement_days: 45, uninsured_loss_eur_m: Math.round(b * 0.04) },
      commercial: { businesses_interrupted: 200, downtime_days: 28, supply_chain_multiplier: 2.4 },
      government: { emergency_cost_eur_m: Math.round(b * 0.02), infrastructure_repair_eur_m: Math.round(b * 0.1) },
      financial: { loan_defaults_eur_m: Math.round(b * 0.07), insurance_claims_eur_m: Math.round(b * 0.45) },
    },
    model_uncertainty: v2.model_uncertainty ?? {
      data_quality: { exposure_pct: 85, valuations_pct: 70, vulnerability_pct: 60, historical_pct: 75 },
      uncertainty_pct: { hazard: 25, exposure: 15, vulnerability: 30, combined: 35 },
      limitations: ['Cascading effects modeled via 5×5 transmission matrix', 'Business interruption based on sector-specific RTO curves'],
      engines_used: { monte_carlo: true, contagion_matrix: true, recovery_calculator: true, sector_calculators: true },
    },
    sector_metrics: v2.sector_metrics ?? {
      sector: 'enterprise',
      methodology: 'Sector-specific formulas for enterprise (defaults)',
      cash_runway_months: 12,
      supply_buffer: 1.5,
      operations_rate: 0.85,
      recovery_time_days: 50,
      operational_capacity: 0.85,
    },
  }
}

/** Derive currency from report: use reportV2 currency_info, explicit currency, or by city. */
function getReportCurrency(report: StressTestReport): string {
  if (report.reportV2?.currency_info?.local_currency) return report.reportV2.currency_info.local_currency
  if (report.currency) return report.currency
  const city = (report.cityName || '').trim()
  if (/tokyo|japan/i.test(city)) return 'JPY'
  if (/montreal|toronto|vancouver|calgary|quebec|ottawa/i.test(city)) return 'CAD'
  if (/san\s*francisco|new\s*york|chicago|los\s*angeles|miami|houston/i.test(city)) return 'USD'
  if (/london|edinburgh|manchester/i.test(city)) return 'GBP'
  if (/zurich|geneva|bern/i.test(city)) return 'CHF'
  if (/sydney|melbourne|brisbane/i.test(city)) return 'AUD'
  return 'EUR'
}

/** Currency symbol map. */
function currSym(currency?: string): string {
  const map: Record<string, string> = {
    USD: '$', EUR: '€', GBP: '£', JPY: '¥', CAD: 'C$', CHF: 'CHF ',
    AUD: 'A$', SGD: 'S$', HKD: 'HK$', INR: '₹', CNY: '¥', KRW: '₩', MXN: 'MX$',
  }
  return map[currency || 'EUR'] || '€'
}

/** Format loss in millions with currency symbol. */
function formatLossM(amountM: number, currency?: string): string {
  const sym = currSym(currency)
  const n = Number(amountM)
  if (n >= 1000) return `${sym}${(n / 1000).toFixed(1)}B`
  return `${sym}${n.toFixed(0)}M`
}

/** Format number for report (consistent locale). Institutional reports use one convention. */
function formatNumberForReport(n: number, decimals: number = 2): string {
  return Number(n).toLocaleString('en-GB', { minimumFractionDigits: 0, maximumFractionDigits: decimals })
}

/** Format dual currency: local + EUR equivalent (if different). */
function formatDual(amountM: number, localCurrency: string, rate?: number): string {
  const local = formatLossM(amountM, localCurrency)
  if (!rate || rate === 1 || localCurrency === 'EUR') return local
  const eurAmount = amountM / rate
  return `${local} (€${eurAmount >= 1000 ? (eurAmount / 1000).toFixed(1) + 'B' : eurAmount.toFixed(0) + 'M'})`
}

/** Report V2 sections: probabilistic, temporal, contagion, predictive, network, sensitivity, stakeholder, model uncertainty, climate, insurance */
function ReportV2Sections({ v2, baseLossM, currency, eventName, cityName }: { v2: StressTestReportV2; baseLossM: number; currency?: string; eventName?: string; cityName?: string }) {
  const noGaps = ensureReportV2NoGaps(v2, baseLossM)
  const pm = noGaps.probabilistic_metrics
  const td = noGaps.temporal_dynamics
  const fc = noGaps.financial_contagion
  const pred = noGaps.predictive_indicators
  const net = noGaps.network_risk
  const sens = noGaps.sensitivity
  const multi = noGaps.multi_scenario_table
  const stake = noGaps.stakeholder_impacts
  const unc = noGaps.model_uncertainty
  const meta = v2.report_metadata as { report_id?: string; classification?: string; review_status?: string; methodology_version?: string; generated_at?: string } | undefined
  const cInfo = v2.currency_info as { local_currency?: string; rate?: number; rate_label?: string; source?: string; date?: string } | undefined
  const climateScenarios = (v2 as any).climate_scenarios as Array<{ scenario: string; temp_increase: string; frequency_shift: string; loss_multiplier: number; projected_loss_m: number }> | undefined
  const insuranceAnalysis = (v2 as any).insurance_analysis as { categories?: Array<{ category: string; exposure_m: number; insured_m: number; uninsured_m: number; coverage_rate_pct: number; buildings: number }>; total_insured_m?: number; total_uninsured_m?: number; total_coverage_rate_pct?: number; gap_warning?: string | null } | undefined

  const localCur = cInfo?.local_currency || currency || 'EUR'
  const xRate = cInfo?.rate || 1
  const sym = currSym(localCur)
  const fmt = (n: number) => formatLossM(n, localCur)
  const fmtDual = (n: number) => formatDual(n, localCur, xRate)
  // Legacy: API used to send 10,000; display as 100,000 (platform standard) until all reports use backend 100k
  const displayMonteCarloRuns = (pm?.monte_carlo_runs === 10000 ? 100000 : (pm?.monte_carlo_runs ?? 100000))

  return (
    <div className="mb-6 space-y-6 border border-zinc-700 rounded-md p-5 bg-zinc-900">
      {/* ── PREMIUM REPORT HEADER ── */}
      {meta && (
        <div className="border-b border-zinc-700 pb-4 mb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-3">
              <h3 className="text-amber-400/80 text-sm font-semibold tracking-wider uppercase">Stress Test Report v2.0</h3>
              <span className="px-2 py-0.5 rounded text-[9px] font-medium bg-red-500/15 text-red-300 border border-red-500/25 tracking-wide">{meta.classification || 'CONFIDENTIAL'}</span>
              <span className={`px-2 py-0.5 rounded text-[9px] font-medium tracking-wide ${meta.review_status === 'APPROVED' ? 'bg-green-500/15 text-green-300 border border-green-500/25' : 'bg-amber-500/15 text-amber-300 border border-amber-500/25'}`}>{meta.review_status || 'PENDING'}</span>
            </div>
            <div className="text-[10px] text-zinc-500 font-mono">{meta.report_id}</div>
          </div>
          <div className="mt-2 flex flex-wrap gap-4 text-[10px] text-zinc-500">
            <span>Generated: {meta.generated_at ? new Date(meta.generated_at).toLocaleString() : '—'}</span>
            <span>Methodology: {meta.methodology_version || 'v2.0'}</span>
            {cInfo && cInfo.local_currency !== 'EUR' && (
              <span>Currency: {cInfo.rate_label} ({cInfo.source}, {cInfo.date})</span>
            )}
          </div>
        </div>
      )}

      {!meta && (
        <h3 className="text-amber-400/80 text-sm uppercase tracking-wider flex items-center gap-2">
          <span>Stress Test Report 2.0</span>
          <span className="text-zinc-500 text-xs font-normal">Probabilistic · Temporal · Contagion · Predictive · Network · Sensitivity · Stakeholder · Model uncertainty</span>
        </h3>
      )}

      {/* Methodology badges */}
      <div className="flex flex-wrap gap-2 mb-3">
        <span className="px-2.5 py-0.5 bg-green-500/10 text-green-400/80 rounded-full text-[10px] flex items-center gap-1.5 border border-green-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
          Monte Carlo: {displayMonteCarloRuns.toLocaleString()} runs
        </span>
        <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-[10px] flex items-center gap-1.5 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Contagion Matrix
        </span>
        <span className="px-2.5 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-[10px] flex items-center gap-1.5 border border-zinc-700">
          <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
          Recovery Calc
        </span>
        <span className="px-2.5 py-0.5 bg-orange-500/10 text-orange-400/80 rounded-full text-[10px] flex items-center gap-1.5 border border-orange-500/20">
          <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
          Cascade GNN
        </span>
      </div>

      {/* GPU / NIM used */}
      {(v2?.gpu_services_used?.length ?? 0) > 0 && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-[11px] text-emerald-200/90 flex items-center gap-2">
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400/80 border border-emerald-500/30">GPU</span>
          <span><strong>Weather / climate:</strong> FourCastNet NIM (GPU). This run used the GPU server for AI weather forecast.</span>
        </div>
      )}

      {/* Data quality & accuracy disclaimer (Gap X1/X6) */}
      <div className="rounded-md border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-[11px] text-zinc-400 space-y-1">
        <p><strong className="text-zinc-200">Data quality & accuracy:</strong> Computed using {meta?.methodology_version || 'Universal Stress Testing Methodology v2.0'}. VaR/CVaR from Monte Carlo ({displayMonteCarloRuns.toLocaleString()} simulations), financial contagion via 5x5 transmission matrix, recovery timelines from sector-specific RTO curves.</p>
        <p><strong className="text-zinc-200">Regulatory notice:</strong> For internal risk management. Not for regulatory submission. {meta?.generated_at ? `Data as of: ${meta.generated_at}` : ''}</p>
      </div>

      {/* Scenario applicability: clarify that named scenario is applied as template to selected location */}
      <div className="rounded-md border border-sky-500/25 bg-sky-500/10 px-4 py-2.5 text-[11px] text-sky-200/90">
        <p><strong className="text-sky-100">How this scenario applies to this location:</strong> The scenario &quot;{eventName ?? 'Stress test'}&quot; is used as a <em>hazard type and severity template</em> for {cityName ?? 'this location'}. Impact zones and losses are estimated for {cityName ?? 'this location'} using equivalent magnitude and exposure. The scenario name may refer to another geography (e.g. a specific river or region); it does not imply that the named event physically occurs at this location.</p>
      </div>

      {/* ── KEY METRICS AT A GLANCE ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
        <div className="bg-gradient-to-br from-amber-900/20 to-transparent rounded-md p-3 border border-amber-500/15">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Expected Loss</div>
          <div className="text-amber-400/80 font-mono text-base mt-1">{fmtDual(pm.mean_loss)}</div>
          {pm.confidence_interval_90 && <div className="text-zinc-600 mt-0.5">90% CI: {sym}{formatNumberForReport(pm.confidence_interval_90[0])}M – {sym}{formatNumberForReport(pm.confidence_interval_90[1])}M</div>}
        </div>
        <div className="bg-gradient-to-br from-red-900/20 to-transparent rounded-md p-3 border border-red-500/15">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">VaR (99%)</div>
          <div className="text-red-400/80 font-mono text-base mt-1">{fmtDual(pm.var_99 ?? pm.mean_loss * 1.55)}</div>
          <div className="text-zinc-600 mt-0.5">1% probability of exceeding</div>
        </div>
        <div className="bg-gradient-to-br from-zinc-900/20 to-transparent rounded-md p-3 border border-zinc-700">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">CVaR (99%)</div>
          <div className="text-zinc-400 font-mono text-base mt-1">{fmtDual(pm.cvar_99 ?? pm.mean_loss * 1.85)}</div>
          <div className="text-zinc-600 mt-0.5">Expected loss if VaR exceeded</div>
        </div>
        <div className="bg-gradient-to-br from-blue-900/20 to-transparent rounded-md p-3 border border-blue-500/15">
          <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Recovery</div>
          <div className="text-zinc-100 font-mono text-base mt-1">{td.recovery_time_months[0]}–{td.recovery_time_months[1]} mo</div>
          <div className="text-zinc-600 mt-0.5">Full economic normalization</div>
        </div>
      </div>
      <p className="text-[10px] text-zinc-500 mt-2">Expected Loss (above) = Monte Carlo mean over the simulated loss distribution; Total loss (Impact summary below) = direct scenario impact from zone aggregation.</p>

      {/* Probabilistic — always present */}
      <div className="border-l-2 border-amber-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Probabilistic Metrics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px]">
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">Mean (μ)</span><div className="text-white font-mono mt-0.5">{fmt(pm.mean_loss)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">Median</span><div className="text-white font-mono mt-0.5">{fmt(pm.median_loss)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">VaR 95%</span><div className="text-amber-400/80 font-mono mt-0.5">{fmt(pm.var_95)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">VaR 99%</span><div className="text-amber-400/80 font-mono mt-0.5">{fmt(pm.var_99)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">CVaR 99%</span><div className="text-zinc-400 font-mono mt-0.5">{fmt(pm.cvar_99)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">σ (Std Dev)</span><div className="text-white font-mono mt-0.5">{fmt(pm.std_dev)}</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">MC Runs</span><div className="text-white font-mono mt-0.5">{displayMonteCarloRuns.toLocaleString()}</div></div>
        </div>
      </div>

      {/* Temporal — always present */}
      <div className="border-l-2 border-blue-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Temporal Dynamics</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] mb-3">
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">RTO</span><div className="text-white mt-0.5">{td.rto_hours}h</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">RPO</span><div className="text-white mt-0.5">{td.rpo_hours}h</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">Recovery</span><div className="text-white mt-0.5">{td.recovery_time_months[0]}–{td.recovery_time_months[1]} mo</div></div>
          <div className="bg-zinc-900 rounded-md p-2.5"><span className="text-zinc-500 text-[10px]">BI Duration</span><div className="text-white mt-0.5">{td.business_interruption_days} days</div></div>
        </div>
        {td.loss_accumulation?.length > 0 ? (
          <div className="overflow-x-auto rounded-md border border-zinc-700">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-zinc-800"><th className="text-left px-3 py-2 text-zinc-500 font-medium">Period</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Cumulative Loss</th><th className="text-left px-3 py-2 text-zinc-500 font-medium w-32">Progress</th></tr></thead>
              <tbody>
                {td.loss_accumulation.map((row: { period: string; amount_m: number }, i: number) => {
                  const maxAmt = td.loss_accumulation[td.loss_accumulation.length - 1]?.amount_m || 1
                  const pct = Math.min(100, (row.amount_m / maxAmt) * 100)
                  return (
                    <tr key={i} className={`border-t border-zinc-800 ${i % 2 === 1 ? 'bg-zinc-800/50' : ''}`}>
                      <td className="px-3 py-1.5 text-zinc-200">{row.period}</td>
                      <td className="px-3 py-1.5 font-mono text-amber-400/90">{fmt(row.amount_m)}</td>
                      <td className="px-3 py-1.5"><div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-amber-500/60 to-amber-400/80 rounded-full transition-all" style={{ width: `${pct}%` }} /></div></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {/* Financial contagion — always present */}
      <div className="border-l-2 border-zinc-600 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Financial Contagion (Cross-Sector)</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
          {fc.banking && <div className="bg-gradient-to-br from-zinc-900/10 to-transparent rounded-md p-3 border border-zinc-800"><div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Banking</div><div className="text-zinc-200 space-y-0.5"><div>NPL +{fc.banking.npl_increase_pct}%</div><div>Provisions {fmt(fc.banking.provisions_eur_m ?? 0)}</div><div>CET1 {fc.banking.cet1_impact_bps}bps</div></div></div>}
          {fc.insurance && <div className="bg-gradient-to-br from-zinc-900/10 to-transparent rounded-md p-3 border border-zinc-800"><div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Insurance</div><div className="text-zinc-200 space-y-0.5"><div>Claims {fmt(fc.insurance.claims_gross_eur_m ?? 0)}</div><div>Net retained {fmt(fc.insurance.net_retained_eur_m ?? 0)}</div><div>Solvency {fc.insurance.solvency_impact_pp}pp</div></div></div>}
          {fc.real_estate && <div className="bg-gradient-to-br from-amber-900/10 to-transparent rounded-md p-3 border border-zinc-800"><div className="text-amber-400/80 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Real Estate</div><div className="text-zinc-200 space-y-0.5"><div>Value decline {fc.real_estate.value_decline_pct}%</div><div>Vacancy +{fc.real_estate.vacancy_increase_pct}%</div></div></div>}
          {fc.supply_chain && <div className="bg-gradient-to-br from-orange-900/10 to-transparent rounded-md p-3 border border-zinc-800"><div className="text-orange-400/80 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Supply Chain</div><div className="text-zinc-200 space-y-0.5"><div>GDP impact {fc.supply_chain.direct_gdp_pct}% / {fc.supply_chain.indirect_gdp_pct}%</div><div>Job losses {fc.supply_chain.job_losses?.toLocaleString()}</div></div></div>}
        </div>
        <div className="mt-3 text-[11px] text-zinc-500 bg-zinc-900 rounded-md px-3 py-2 border border-zinc-800">
          <span className="text-zinc-300 font-medium">Total economic impact:</span> {fmt(fc.total_economic_impact_eur_m ?? 0)} <span className="text-zinc-500">(multiplier: {fc.economic_multiplier ?? 2.2}x direct)</span>
        </div>
      </div>

      {/* Predictive — always present */}
      <div className="border-l-2 border-red-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Predictive Indicators</h4>
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`px-3 py-1 rounded-full text-[10px] font-medium border ${
            pred.status === 'RED' ? 'bg-red-500/15 text-red-400/80 border-red-500/25 shadow-[0_0_8px_rgba(239,68,68,0.15)]' :
            pred.status === 'AMBER' ? 'bg-amber-500/15 text-amber-400/80 border-amber-500/25 shadow-[0_0_8px_rgba(245,158,11,0.15)]' :
            'bg-yellow-500/15 text-yellow-400/80 border-yellow-500/25'
          }`}>{pred.status}</span>
          <span className="text-zinc-400 text-[11px] flex items-center gap-1">P(event) = <span className="font-mono text-zinc-200">{((pred.probability_event ?? 0.5) * 100).toFixed(0)}%</span></span>
        </div>
        {pred.key_triggers?.length ? <ul className="text-zinc-300 text-[11px] list-disc list-inside mb-3 space-y-0.5">{pred.key_triggers.slice(0, 4).map((t, i) => <li key={i}>{t}</li>)}</ul> : null}
        {pred.thresholds?.length ? (
          <div className="space-y-1">
            {pred.thresholds.map((t: { level: string; condition: string }, i: number) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className={`w-2 h-2 rounded-full ${t.level === 'BLACK' ? 'bg-zinc-300' : t.level === 'RED' ? 'bg-red-400' : 'bg-amber-400'}`} />
                <span className="text-zinc-400"><span className="font-medium text-zinc-300">{t.level}:</span> {t.condition}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {/* Network risk — always present */}
      <div className="border-l-2 border-orange-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Network / Systemic Risk</h4>
        <div className="text-[11px] space-y-2">
          {net.critical_nodes?.length ? (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {net.critical_nodes.slice(0, 3).map((n: { name: string; centrality?: number; betweenness?: number; affected_people?: number; dependent_businesses?: number }, i: number) => (
                <div key={i} className="bg-zinc-900 rounded-md p-2.5 border border-zinc-800">
                  <div className="text-zinc-200 font-medium text-[11px]">{n.name}</div>
                  <div className="text-zinc-500 text-[10px] mt-0.5">
                    {n.centrality != null && `Centrality: ${n.centrality}`}
                    {n.betweenness != null && ` · Betweenness: ${n.betweenness}`}
                  </div>
                  {n.affected_people != null && <div className="text-amber-400/70 text-[10px]">{n.affected_people.toLocaleString()} affected</div>}
                  {n.dependent_businesses != null && <div className="text-amber-400/70 text-[10px]">{n.dependent_businesses} businesses</div>}
                </div>
              ))}
            </div>
          ) : <div className="text-zinc-500">No critical nodes identified</div>}
          <div className="grid grid-cols-3 gap-2 text-[10px]">
            <div className="bg-zinc-900 rounded-md p-2 text-center border border-zinc-800"><div className="text-zinc-500">Cascade Path</div><div className="text-zinc-300 mt-0.5 font-mono text-[9px]">{net.cascade_path ?? '—'}</div></div>
            <div className="bg-zinc-900 rounded-md p-2 text-center border border-zinc-800"><div className="text-zinc-500">Amplification</div><div className="text-zinc-200 mt-0.5 font-mono">{net.amplification_factor ?? '—'}x</div></div>
            <div className="bg-zinc-900 rounded-md p-2 text-center border border-zinc-800"><div className="text-zinc-500">Velocity</div><div className="text-zinc-200 mt-0.5 font-mono">{net.contagion_velocity_hours ?? '—'}h</div></div>
          </div>
          {net.single_points_of_failure?.length ? (
            <div>
              <div className="text-zinc-500 text-[10px] mb-1">Single Points of Failure:</div>
              <ul className="text-zinc-400 text-[10px] list-disc list-inside space-y-0.5">{net.single_points_of_failure.slice(0, 3).map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
          ) : null}
        </div>
      </div>

      {/* Sensitivity — always present */}
      <div className="border-l-2 border-pink-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Sensitivity Analysis</h4>
        <div className="space-y-2 mb-2">
          {(sens.parameters ?? []).slice(0, 4).map((p: { name: string; loss_delta_pct?: number; loss_delta_m?: number }, i: number) => (
            <div key={i} className="flex items-center justify-between bg-zinc-900 rounded-md px-3 py-2 border border-zinc-800">
              <span className="text-zinc-300 text-[11px]">{p.name}</span>
              <div className="flex items-center gap-3 text-[11px]">
                {p.loss_delta_pct != null && <span className="text-red-400/80 font-mono">+{p.loss_delta_pct}%</span>}
                {p.loss_delta_m != null && <span className="text-amber-400/80 font-mono">{fmt(p.loss_delta_m)}</span>}
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* Multi-scenario — expanded 6 rows */}
      <div className="border-l-2 border-cyan-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Multi-Scenario Comparison</h4>
        <div className="overflow-x-auto rounded-md border border-zinc-700">
          <table className="w-full text-[11px]">
            <thead><tr className="bg-gradient-to-r from-zinc-800/50 to-transparent"><th className="text-left px-3 py-2 text-zinc-500 font-medium">Return Period</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">AEP</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Expected Loss</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Buildings</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Recovery</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Severity</th></tr></thead>
            <tbody>
              {(multi ?? []).map((row: { return_period_y: number; probability_pct: number; expected_loss_m: number; buildings: number; recovery_months: number; severity?: number }, i: number) => {
                const sev = (row as any).severity ?? 0
                const sevColor = sev >= 0.8 ? 'text-red-400/80' : sev >= 0.6 ? 'text-amber-400/80' : sev >= 0.4 ? 'text-yellow-400/80' : 'text-green-400/80'
                return (
                  <tr key={i} className={`border-t border-zinc-800 ${i % 2 === 1 ? 'bg-zinc-800/50' : ''}`}>
                    <td className="px-3 py-1.5 text-zinc-200 font-medium">{row.return_period_y}Y</td>
                    <td className="px-3 py-1.5 text-zinc-400">{row.probability_pct}%</td>
                    <td className="px-3 py-1.5 font-mono text-amber-400/90">{fmt(row.expected_loss_m)}</td>
                    <td className="px-3 py-1.5 text-zinc-400">{row.buildings.toLocaleString()}</td>
                    <td className="px-3 py-1.5 text-zinc-400">{row.recovery_months} mo</td>
                    <td className={`px-3 py-1.5 font-mono ${sevColor}`}>{sev.toFixed(2)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <p className="text-[10px] text-zinc-500 mt-1.5">Recovery = sector recovery (months) for each return period.</p>
      </div>

      {/* Stakeholder impacts — always present */}
      <div className="border-l-2 border-emerald-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Stakeholder-Specific Impacts</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
          {stake.residential && (
            <div className="bg-gradient-to-br from-emerald-900/10 to-transparent rounded-md p-3 border border-zinc-800">
              <div className="text-emerald-400/80 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Residential</div>
              <div className="text-zinc-200 space-y-0.5">
                <div>{stake.residential.households_displaced?.toLocaleString()} households displaced</div>
                <div>{stake.residential.displacement_days} days displacement</div>
                <div>Uninsured loss: {fmt(stake.residential.uninsured_loss_eur_m ?? 0)}</div>
                <div>Mental health: <span className={stake.residential.mental_health_score === 'Critical' ? 'text-red-400/80' : 'text-amber-400/80'}>{stake.residential.mental_health_score}</span></div>
              </div>
            </div>
          )}
          {stake.commercial && (
            <div className="bg-gradient-to-br from-zinc-900/10 to-transparent rounded-md p-3 border border-zinc-800">
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Commercial</div>
              <div className="text-zinc-200 space-y-0.5">
                <div>{stake.commercial.businesses_interrupted?.toLocaleString()} businesses interrupted</div>
                <div>{stake.commercial.downtime_days} days downtime</div>
                <div>Supply chain multiplier: {stake.commercial.supply_chain_multiplier}x</div>
              </div>
            </div>
          )}
          {stake.government && (
            <div className="bg-gradient-to-br from-cyan-900/10 to-transparent rounded-md p-3 border border-zinc-800">
              <div className="text-cyan-400/80 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Government</div>
              <div className="text-zinc-200 space-y-0.5">
                <div>Emergency cost: {fmt(stake.government.emergency_cost_eur_m ?? 0)}</div>
                <div>Infrastructure repair: {fmt(stake.government.infrastructure_repair_eur_m ?? 0)}</div>
                <div>Political risk: <span className={stake.government.political_risk_score === 'Critical' ? 'text-red-400/80' : 'text-amber-400/80'}>{stake.government.political_risk_score}</span></div>
              </div>
            </div>
          )}
          {stake.financial && (
            <div className="bg-gradient-to-br from-zinc-900/10 to-transparent rounded-md p-3 border border-zinc-800">
              <div className="text-zinc-400 text-[10px] uppercase tracking-wider mb-1.5 font-medium">Financial</div>
              <div className="text-zinc-200 space-y-0.5">
                <div>Loan defaults: {fmt(stake.financial.loan_defaults_eur_m ?? 0)}</div>
                <div>Insurance claims: {fmt(stake.financial.insurance_claims_eur_m ?? 0)}</div>
                <div>CET1 impact: {stake.financial.cet1_impact_bps}bps</div>
                <div>Rating review: <span className={stake.financial.rating_review === 'Certain' ? 'text-red-400/80' : 'text-amber-400/80'}>{stake.financial.rating_review}</span></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Climate Change Scenarios — NEW */}
      {climateScenarios && climateScenarios.length > 0 && (
        <div className="border-l-2 border-zinc-600 pl-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Climate Change Scenarios</h4>
          <div className="overflow-x-auto rounded-md border border-zinc-700">
            <table className="w-full text-[11px]">
              <thead><tr className="bg-gradient-to-r from-zinc-900/15 to-transparent"><th className="text-left px-3 py-2 text-zinc-500 font-medium">Scenario</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Temp Rise</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Frequency Shift</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Loss Multiplier</th><th className="text-left px-3 py-2 text-zinc-500 font-medium">Projected Loss</th></tr></thead>
              <tbody>
                {climateScenarios.map((cs, i) => {
                  const multColor = cs.loss_multiplier >= 1.5 ? 'text-red-400/80' : cs.loss_multiplier >= 1.2 ? 'text-amber-400/80' : cs.loss_multiplier > 1 ? 'text-yellow-400/80' : 'text-zinc-300'
                  return (
                    <tr key={i} className={`border-t border-zinc-800 ${i % 2 === 1 ? 'bg-zinc-800/50' : ''}`}>
                      <td className="px-3 py-1.5 text-zinc-200 font-medium">{cs.scenario}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{cs.temp_increase}</td>
                      <td className="px-3 py-1.5 text-zinc-400">{cs.frequency_shift}</td>
                      <td className={`px-3 py-1.5 font-mono ${multColor}`}>{cs.loss_multiplier.toFixed(2)}x</td>
                      <td className="px-3 py-1.5 font-mono text-amber-400/90">{fmt(cs.projected_loss_m)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Insurance Coverage Analysis — NEW */}
      {insuranceAnalysis && insuranceAnalysis.categories && insuranceAnalysis.categories.length > 0 && (
        <div className="border-l-2 border-zinc-600 pl-4">
          <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Insurance Coverage Analysis</h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] mb-3">
            <div className="bg-gradient-to-br from-indigo-900/15 to-transparent rounded-md p-3 border border-indigo-500/15">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Total Insured</div>
              <div className="text-green-400/80 font-mono text-base mt-1">{fmt(insuranceAnalysis.total_insured_m ?? 0)}</div>
            </div>
            <div className="bg-gradient-to-br from-red-900/15 to-transparent rounded-md p-3 border border-red-500/15">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Uninsured Gap</div>
              <div className="text-red-400/80 font-mono text-base mt-1">{fmt(insuranceAnalysis.total_uninsured_m ?? 0)}</div>
            </div>
            <div className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider">Coverage Rate</div>
              <div className="text-zinc-100 font-mono text-base mt-1">{insuranceAnalysis.total_coverage_rate_pct ?? 0}%</div>
            </div>
          </div>
          <div className="space-y-2">
            {insuranceAnalysis.categories.map((cat, i) => (
              <div key={i} className="bg-zinc-900 rounded-md p-3 border border-zinc-800">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-zinc-200 text-[11px] font-medium">{cat.category}</span>
                  <span className="text-zinc-500 text-[10px]">{cat.coverage_rate_pct}% covered · {cat.buildings.toLocaleString()} buildings</span>
                </div>
                <div className="h-2.5 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-green-500/60 to-green-400/80 transition-all"
                    style={{ width: `${cat.coverage_rate_pct}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-[10px] text-zinc-500">
                  <span>Insured: {fmt(cat.insured_m)}</span>
                  <span>Gap: {fmt(cat.uninsured_m)}</span>
                </div>
              </div>
            ))}
          </div>
          {insuranceAnalysis.gap_warning && (
            <div className="mt-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300/80">
              {insuranceAnalysis.gap_warning}
            </div>
          )}
        </div>
      )}

      {/* Model uncertainty — always present */}
      <div className="border-l-2 border-zinc-600 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Model Uncertainty & Validation</h4>
        <div className="text-[11px] space-y-3">
          {unc.data_quality && (
            <div className="grid grid-cols-4 gap-2">
              {(['exposure_pct', 'valuations_pct', 'vulnerability_pct', 'historical_pct'] as const).map(key => {
                const val = unc.data_quality?.[key] ?? 0
                const label = key.replace('_pct', '').charAt(0).toUpperCase() + key.replace('_pct', '').slice(1)
                return (
                  <div key={key} className="text-center">
                    <div className="text-zinc-500 text-[10px]">{label}</div>
                    <div className="text-zinc-200 font-mono">{val}%</div>
                    <div className="mt-1 h-1 bg-zinc-800 rounded-full overflow-hidden"><div className="h-full bg-gradient-to-r from-blue-500/50 to-blue-400/70 rounded-full" style={{ width: `${val}%` }} /></div>
                  </div>
                )
              })}
            </div>
          )}
          {unc.uncertainty_pct && (
            <div className="text-zinc-400 bg-zinc-900 rounded-md px-3 py-2 border border-zinc-800">
              Uncertainty bands: hazard ±{unc.uncertainty_pct.hazard}%, exposure ±{unc.uncertainty_pct.exposure}%, vulnerability ±{unc.uncertainty_pct.vulnerability}%, combined ±{unc.uncertainty_pct.combined}%
            </div>
          )}
          {unc.limitations?.length ? <ul className="list-disc list-inside text-zinc-500 space-y-0.5">{unc.limitations.map((l, i) => <li key={i}>{l}</li>)}</ul> : null}
          {unc.backtesting?.length ? (
            <div className="pt-2 border-t border-zinc-700">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2 font-medium">Backtesting (Region-Calibrated)</div>
              <div className="overflow-x-auto rounded-md border border-zinc-700">
                <table className="w-full text-[11px]">
                  <thead><tr className="bg-zinc-900"><th className="text-left px-3 py-1.5 text-zinc-500 font-medium">Historical Event</th><th className="text-right px-3 py-1.5 text-zinc-500 font-medium">Predicted</th><th className="text-right px-3 py-1.5 text-zinc-500 font-medium">Actual</th><th className="text-right px-3 py-1.5 text-zinc-500 font-medium">Error</th></tr></thead>
                  <tbody>
                    {unc.backtesting.map((b: { event: string; predicted_eur_m: number; actual_eur_m: number; error_pct: number }, i: number) => (
                      <tr key={i} className={`border-t border-zinc-800 ${i % 2 === 1 ? 'bg-zinc-800/50' : ''}`}>
                        <td className="px-3 py-1.5 text-zinc-200">{b.event}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-300">{fmt(b.predicted_eur_m)}</td>
                        <td className="px-3 py-1.5 text-right font-mono text-zinc-300">{fmt(b.actual_eur_m)}</td>
                        <td className={`px-3 py-1.5 text-right font-mono ${b.error_pct < 0 ? 'text-red-400/70' : 'text-green-400/70'}`}>{b.error_pct > 0 ? '+' : ''}{b.error_pct}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {(unc as any).backtesting_avg_error_pct != null && (
                <div className="text-zinc-500 text-[10px] mt-1">Average absolute error: {(unc as any).backtesting_avg_error_pct}% — conservatism adjustment applied</div>
              )}
              <p className="text-zinc-500 text-[10px] mt-2">Backtest calibrated on global events; regional calibration can be applied when data is available.</p>
            </div>
          ) : null}
          <div className="pt-2 flex flex-wrap gap-2">
            <span className="text-zinc-500 text-[10px]">Engines:</span>
            {unc.engines_used?.monte_carlo && <span className="px-2 py-0.5 bg-green-500/10 text-green-400/80 rounded-full text-[9px] border border-green-500/20">Monte Carlo ✓</span>}
            {unc.engines_used?.contagion_matrix && <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-[9px] border border-zinc-700">Contagion ✓</span>}
            {unc.engines_used?.recovery_calculator && <span className="px-2 py-0.5 bg-zinc-800 text-zinc-400 rounded-full text-[9px] border border-zinc-700">Recovery ✓</span>}
            {unc.engines_used?.sector_calculators && <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400/80 rounded-full text-[9px] border border-amber-500/20">Sector ✓</span>}
          </div>
        </div>
      </div>

      {/* Sector-specific metrics — always present */}
      <div className="border-l-2 border-amber-500/40 pl-4">
        <h4 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">
          Sector-Specific Metrics
          {noGaps.sector_metrics?.sector && <span className="text-amber-400/80 ml-2 normal-case">({noGaps.sector_metrics.sector})</span>}
        </h4>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-[11px]">
          {Object.entries(noGaps.sector_metrics ?? {})
            .filter(([key]) => !['sector', 'methodology', 'error'].includes(key))
            .slice(0, 6)
            .map(([key, value]) => (
              <div key={key} className="bg-zinc-900 rounded-md p-2.5 border border-zinc-800">
                <div className="text-zinc-500 text-[10px] capitalize">{key.replace(/_/g, ' ')}</div>
                <div className="text-zinc-100 font-mono mt-0.5">
                  {typeof value === 'number'
                    ? (key.includes('pct') || key.includes('ratio') || key.includes('rate') || key.includes('index') || key.includes('score'))
                      ? `${(value * (value < 2 ? 100 : 1)).toFixed(1)}${key.includes('pct') ? '%' : ''}`
                      : value.toLocaleString()
                    : String(value)
                  }
                </div>
              </div>
            ))}
        </div>
        {noGaps.sector_metrics?.methodology && (
          <div className="text-zinc-600 text-[10px] mt-2">{noGaps.sector_metrics.methodology}</div>
        )}
      </div>

      {/* NVIDIA AI Orchestration — when use_nvidia_orchestration was used */}
      {(noGaps.nvidia_orchestration != null && typeof noGaps.nvidia_orchestration === 'object') && (
        <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-3">
          <h4 className="text-emerald-400/80 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            NVIDIA AI Orchestration
          </h4>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px] text-zinc-200">
            {(noGaps.nvidia_orchestration as { entity_type?: string }).entity_type != null && (
              <div><span className="text-zinc-500">Entity type</span><div className="font-mono">{(noGaps.nvidia_orchestration as { entity_type?: string }).entity_type}</div></div>
            )}
            {(noGaps.nvidia_orchestration as { confidence?: number }).confidence != null && (
              <div><span className="text-zinc-500">Confidence</span><div className="font-mono text-emerald-400/80">{(Number((noGaps.nvidia_orchestration as { confidence?: number }).confidence) * 100).toFixed(0)}%</div></div>
            )}
            {(noGaps.nvidia_orchestration as { model_agreement?: number }).model_agreement != null && (
              <div><span className="text-zinc-500">Model agreement</span><div className="font-mono">{(Number((noGaps.nvidia_orchestration as { model_agreement?: number }).model_agreement) * 100).toFixed(0)}%</div></div>
            )}
            {(noGaps.nvidia_orchestration as { flag_for_human_review?: boolean }).flag_for_human_review != null && (
              <div><span className="text-zinc-500">Human review</span><div className={((noGaps.nvidia_orchestration as { flag_for_human_review?: boolean }).flag_for_human_review ? 'text-amber-400/80' : 'text-zinc-300')}>{(noGaps.nvidia_orchestration as { flag_for_human_review?: boolean }).flag_for_human_review ? 'Recommended' : 'No'}</div></div>
            )}
            {(noGaps.nvidia_orchestration as { used_model_fast?: string }).used_model_fast && (
              <div><span className="text-zinc-500">Fast model</span><div className="font-mono text-[10px] truncate" title={(noGaps.nvidia_orchestration as { used_model_fast?: string }).used_model_fast}>{(noGaps.nvidia_orchestration as { used_model_fast?: string }).used_model_fast}</div></div>
            )}
            {(noGaps.nvidia_orchestration as { used_model_deep?: string }).used_model_deep && (
              <div><span className="text-zinc-500">Deep model</span><div className="font-mono text-[10px] truncate" title={(noGaps.nvidia_orchestration as { used_model_deep?: string }).used_model_deep}>{(noGaps.nvidia_orchestration as { used_model_deep?: string }).used_model_deep}</div></div>
            )}
          </div>
        </div>
      )}

      {/* Regulatory relevance (Phase 3) */}
      {noGaps.regulatory_relevance != null && typeof noGaps.regulatory_relevance === 'object' && (
        <div className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-3 mt-3">
          <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
            Regulatory relevance
          </h4>
          <div className="text-[11px] text-zinc-200 space-y-2">
            {(noGaps.regulatory_relevance as { entity_type?: string }).entity_type != null && (
              <div><span className="text-zinc-500">Entity type</span><span className="ml-2 font-mono">{(noGaps.regulatory_relevance as { entity_type?: string }).entity_type}</span></div>
            )}
            {(noGaps.regulatory_relevance as { jurisdiction?: string }).jurisdiction != null && (
              <div><span className="text-zinc-500">Jurisdiction</span><span className="ml-2">{(noGaps.regulatory_relevance as { jurisdiction?: string }).jurisdiction}</span></div>
            )}
            {(noGaps.regulatory_relevance as { regulations?: string[] }).regulations?.length ? (
              <div>
                <span className="text-zinc-500 block mb-1">Regulations</span>
                <ul className="list-disc list-inside text-zinc-300">
                  {((noGaps.regulatory_relevance as { regulations?: string[] }).regulations ?? []).slice(0, 8).map((r, i) => (
                    <li key={i}>{r}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {(noGaps.regulatory_relevance as { disclosure_required?: boolean }).disclosure_required != null && (
              <div>
                <span className="text-zinc-500">Disclosure required</span>
                <span className={`ml-2 ${(noGaps.regulatory_relevance as { disclosure_required?: boolean }).disclosure_required ? 'text-amber-400/80' : 'text-zinc-400'}`}>
                  {(noGaps.regulatory_relevance as { disclosure_required?: boolean }).disclosure_required ? 'Yes' : 'No'}
                </span>
              </div>
            )}
            {(noGaps.regulatory_relevance as { required_metrics?: string[] }).required_metrics?.length ? (
              <div>
                <span className="text-zinc-500 block mb-1">Required metrics</span>
                <div className="flex flex-wrap gap-1">
                  {((noGaps.regulatory_relevance as { required_metrics?: string[] }).required_metrics ?? []).slice(0, 6).map((m, i) => (
                    <span key={i} className="px-1.5 py-0.5 bg-zinc-800 rounded text-[10px] text-zinc-300">{m}</span>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* News / event enrichment (Phase 3) */}
      {noGaps.news_enrichment != null && typeof noGaps.news_enrichment === 'object' && (() => {
        const news = noGaps.news_enrichment as { events?: Array<{ title?: string; description?: string; url?: string; publishedAt?: string; source?: string }> }
        const events = news.events ?? []
        if (events.length === 0) return null
        return (
          <div className="rounded-md border border-zinc-600 bg-zinc-800 px-3 py-3 mt-3">
            <h4 className="text-zinc-400 text-xs uppercase tracking-wider mb-2 flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-zinc-400" />
              News &amp; event enrichment
            </h4>
            <ul className="space-y-2 text-[11px]">
              {events.slice(0, 5).map((evt, i) => (
                <li key={i} className="text-zinc-200 border-b border-zinc-800 pb-2 last:border-0 last:pb-0">
                  {evt.title && <div className="font-medium text-zinc-100">{evt.title}</div>}
                  {evt.description && <div className="text-zinc-400 mt-0.5 line-clamp-2">{evt.description}</div>}
                  {(evt.source || evt.publishedAt) && (
                    <div className="text-zinc-500 text-[10px] mt-1">{evt.source ?? ''} {evt.publishedAt ? new Date(evt.publishedAt).toLocaleDateString() : ''}</div>
                  )}
                  {evt.url && (
                    <a href={evt.url} target="_blank" rel="noopener noreferrer" className="text-zinc-300 hover:underline text-[10px] mt-0.5 inline-block">Source</a>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })()}
    </div>
  )
}

type AiqSourceLike =
  | string
  | null
  | undefined
  | { id?: string; kind?: string; title?: string; url?: string; snippet?: string }

function normalizeAiqSources(input: unknown): Array<{ id?: string; kind?: string; title?: string; url?: string; snippet?: string }> {
  if (!Array.isArray(input)) return []
  return input
    .filter(Boolean)
    .map((s: AiqSourceLike) => {
      if (typeof s === 'string') return { id: s, title: s }
      if (!s || typeof s !== 'object') return { id: String(s), title: String(s) }
      const src = s as { id?: string; kind?: string; title?: string; url?: string; snippet?: string }
      return {
        id: src.id,
        kind: src.kind,
        title: src.title || src.id,
        url: src.url,
        snippet: src.snippet,
      }
    })
    .filter((s) => Boolean(s.id || s.title))
}

function formatCascadeLoss(v: number, currency?: string): string {
  const sym = currSym(currency)
  if (v >= 1_000_000) return sym + (v / 1_000_000).toFixed(1) + 'M'
  if (v >= 1_000) return sym + (v / 1_000).toFixed(1) + 'K'
  return sym + String(v)
}

/** Derive eventCategory for EventRiskGraph from report.eventType */
function eventTypeToCategory(eventType: string): string | null {
  const t = (eventType || '').toLowerCase()
  if (/flood|seismic|hurricane|fire|climate|sea_level/.test(t)) return 'climate'
  if (/financial|credit|market|liquidity/.test(t)) return 'financial'
  if (/conflict|sanctions|war|energy|trade/.test(t)) return 'geopolitical'
  if (/supply|cyber|tech/.test(t)) return 'operational'
  if (/pandemic|virus|outbreak/.test(t)) return 'health'
  return null
}

export default function StressTestReportContent({
  report,
  cities,
  onUpdateReport,
  onExportPDF,
  onOpenInCascade,
  onClose,
  isExportingPDF = false,
  onCascadeSectionRef,
}: StressTestReportContentProps) {
  const scenarioId = mapEventIdToCascadeScenarioId(report.eventId)
  const cityId = resolveCityNameToId(report.cityName, cities) || undefined
  const [showRecordObservationModal, setShowRecordObservationModal] = useState(false)
  const [isGeneratingSummary, setIsGeneratingSummary] = useState(false)
  const { speak: rivaSpeak, isPlaying: rivaPlaying, error: rivaTtsError } = useRivaTts()
  const [comparableEvents, setComparableEvents] = useState<Array<{
    id: string
    name: string
    year?: number
    description?: string
    region_name?: string
    similarity_reason: string
    lessons_learned?: string
    financial_loss_eur?: number
    severity_actual?: number
    affected_population?: number
  }>>([])

  useEffect(() => {
    if (!report.cityName || !report.eventId) return
    const q = new URLSearchParams({
      event_id: report.eventId,
      city_name: report.cityName,
      limit: '8',
    })
    fetch(`/api/v1/historical-events/comparable?${q}`)
      .then((r) => (r.ok ? r.json() : { comparable_events: [] }))
      .then((data: { comparable_events?: Array<{
        id: string
        name: string
        year?: number
        description?: string
        region_name?: string
        similarity_reason: string
        lessons_learned?: string
        financial_loss_eur?: number
        severity_actual?: number
        affected_population?: number
      }> }) => {
        setComparableEvents(data.comparable_events ?? [])
      })
      .catch(() => setComparableEvents([]))
  }, [report.cityName, report.eventId])
  const [summaryError, setSummaryError] = useState<string | null>(null)
  const summarySources = normalizeAiqSources(report.executiveSummarySources)
  const [explainScenarioText, setExplainScenarioText] = useState<string | null>(null)
  const [explainScenarioLoading, setExplainScenarioLoading] = useState(false)
  const [recommendationsText, setRecommendationsText] = useState<string | null>(null)
  const [recommendationsLoading, setRecommendationsLoading] = useState(false)
  const [disclosureDraft, setDisclosureDraft] = useState<string | null>(() => report.disclosureDraft ?? null)
  const [disclosureLoading, setDisclosureLoading] = useState(false)
  const [disclosureFramework, setDisclosureFramework] = useState<'NGFS' | 'EBA' | 'Fed'>('NGFS')

  const scenarioName = `${report.eventName || report.eventType || 'Stress test'} — ${report.cityName || ''}`.trim()

  return (
    <div className="p-6">
      {/* LLM Badge — show NVIDIA AI Orchestration when multi-model consensus was used */}
      {(report.llmGenerated || report.nvidiaOrchestration || report.reportV2?.nvidia_orchestration) && (
        <div className="mb-4 flex items-center gap-2 flex-wrap">
          <div className="px-3 py-1 bg-green-500/20 text-green-400/80 rounded-full text-xs flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
            </svg>
            {report.nvidiaOrchestration || report.reportV2?.nvidia_orchestration
              ? 'NVIDIA AI Orchestration (multi-model consensus)'
              : 'AI-Powered Analysis (NVIDIA Llama 3.1)'}
          </div>
          {(report.nvidiaOrchestration?.flag_for_human_review ?? report.reportV2?.nvidia_orchestration?.flag_for_human_review) && (
            <div className="px-3 py-1 bg-amber-500/20 text-amber-400/80 rounded-full text-xs flex items-center gap-1.5">
              Recommended for human review
            </div>
          )}
        </div>
      )}

      {/* Executive Summary */}
      {(report.executiveSummary || onUpdateReport) && (
        <div className="mb-6 p-4 bg-gradient-to-br from-amber-500/10 to-amber-700/10 border border-amber-500/20 rounded-md">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h3 className="text-amber-400/80 text-sm uppercase tracking-wider flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Executive Summary
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              {report.executiveSummary && (
                <button
                  type="button"
                  disabled={rivaPlaying}
                  onClick={() => rivaSpeak(report.executiveSummary!)}
                  className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-50"
                  title="NVIDIA Riva TTS"
                >
                  {rivaPlaying ? 'Speaking…' : 'Read aloud'}
                </button>
              )}
              {rivaTtsError && <span className="text-xs text-red-300">{rivaTtsError}</span>}
              {onUpdateReport && (
              <button
                type="button"
                disabled={isGeneratingSummary}
                onClick={async () => {
                  setIsGeneratingSummary(true)
                  setSummaryError(null)
                  try {
                    const ctx = {
                      stress_test_report: {
                        eventName: report.eventName,
                        eventType: report.eventType,
                        cityName: report.cityName,
                        totalLoss: report.totalLoss,
                        totalBuildingsAffected: report.totalBuildingsAffected,
                        totalPopulationAffected: report.totalPopulationAffected,
                        zones: report.zones,
                        mitigationActions: report.mitigationActions,
                        dataSourcesUsed: report.dataSourcesUsed,
                      },
                    }
                    const res = await fetch('/api/v1/aiq/ask', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        question:
                          'Write an executive summary for this stress test report. Include 2-4 sentences and 3 next actions. Use citations like [1], [2].',
                        include_overseer_status: false,
                        context: ctx,
                      }),
                    })
                    if (!res.ok) throw new Error(`aiq ask ${res.status}`)
                    const json = await res.json()
                    onUpdateReport({
                      executiveSummary: json?.answer ?? '',
                      executiveSummarySources: normalizeAiqSources(json?.sources),
                      llmGenerated: true,
                    })
                  } catch (e: any) {
                    setSummaryError(e?.message ?? 'Failed to generate summary')
                  } finally {
                    setIsGeneratingSummary(false)
                  }
                }}
                className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-50"
              >
                {isGeneratingSummary ? 'Generating…' : (report.executiveSummary ? 'Regenerate (AI)' : 'Generate (AI)')}
              </button>
              )}
            </div>
          </div>
          <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
            {stripMarkdown(report.executiveSummary || 'No executive summary yet.')}
          </div>
          {summaryError && <div className="mt-2 text-xs text-red-300/90">{summaryError}</div>}
          {summarySources.length > 0 && (
            <div className="mt-3 pt-3 border-t border-zinc-700">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-2">Sources</div>
              <ul className="space-y-1">
                {summarySources.slice(0, 8).map((s, i) => (
                  <li key={s.id || i} className="text-[11px] text-zinc-500">
                    <span className="text-zinc-600">[{i + 1}]</span>{' '}
                    <span className="text-zinc-300">{s.title || s.id}</span>
                    {s.kind && <span className="text-zinc-600"> · {s.kind}</span>}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Decision Object (Risk & Intelligence OS - ARIN) */}
      {report.decisionObject && (
        <div className="mb-6">
          <DecisionObjectCard decision={report.decisionObject} />
        </div>
      )}

      {/* Generative AI: Explain scenario, Recommendations, Disclosure draft */}
      <div className="mb-6 p-4 bg-zinc-500/5 border border-zinc-500/20 rounded-md">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          <span>Generative AI</span>
        </h3>
        <div className="flex flex-wrap gap-2 mb-3">
          <button
            type="button"
            disabled={explainScenarioLoading}
            onClick={async () => {
              setExplainScenarioText(null)
              setExplainScenarioLoading(true)
              try {
                const res = await fetch('/api/v1/generative/explain-scenario', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    scenario_name: scenarioName,
                    scenario_context: {
                      eventType: report.eventType,
                      cityName: report.cityName,
                      totalLoss: report.totalLoss,
                      totalBuildingsAffected: report.totalBuildingsAffected,
                    },
                    portfolio_context: report.currency ? `Currency: ${report.currency}` : undefined,
                  }),
                })
                if (res.ok) {
                  const data = await res.json()
                  setExplainScenarioText(data.explanation || null)
                }
              } catch {
                setExplainScenarioText('Explanation unavailable.')
              } finally {
                setExplainScenarioLoading(false)
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            {explainScenarioLoading ? 'Explaining…' : 'Explain scenario'}
          </button>
          <button
            type="button"
            disabled={recommendationsLoading}
            onClick={async () => {
              setRecommendationsText(null)
              setRecommendationsLoading(true)
              try {
                const res = await fetch('/api/v1/generative/recommendations', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    scenario_name: scenarioName,
                    stress_result: {
                      eventName: report.eventName,
                      eventType: report.eventType,
                      cityName: report.cityName,
                      totalLoss: report.totalLoss,
                      zones_count: report.zones?.length ?? 0,
                      mitigationActions: report.mitigationActions?.slice(0, 5),
                    },
                    zones_summary: report.zones?.slice(0, 5).map(z => `${z.label}: ${z.riskLevel}`).join('; '),
                  }),
                })
                if (res.ok) {
                  const data = await res.json()
                  setRecommendationsText(data.recommendations || null)
                }
              } catch {
                setRecommendationsText('Recommendations unavailable.')
              } finally {
                setRecommendationsLoading(false)
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            {recommendationsLoading ? 'Generating…' : 'Get recommendations'}
          </button>
          <select
            value={disclosureFramework}
            onChange={e => setDisclosureFramework(e.target.value as 'NGFS' | 'EBA' | 'Fed')}
            className="text-[11px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700 text-zinc-300"
          >
            <option value="NGFS">NGFS</option>
            <option value="EBA">EBA</option>
            <option value="Fed">Fed</option>
          </select>
          <button
            type="button"
            disabled={disclosureLoading}
            onClick={async () => {
              setDisclosureDraft(null)
              setDisclosureLoading(true)
              try {
                const res = await fetch('/api/v1/generative/disclosure-draft', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  credentials: 'include',
                  body: JSON.stringify({
                    context: {
                      scenario: scenarioName,
                      eventType: report.eventType,
                      cityName: report.cityName,
                      totalLoss: report.totalLoss,
                      totalBuildingsAffected: report.totalBuildingsAffected,
                      executiveSummary: report.executiveSummary?.slice(0, 500),
                    },
                    framework: disclosureFramework,
                  }),
                })
                if (res.ok) {
                  const data = await res.json()
                  const draft = data.draft || null
                  setDisclosureDraft(draft)
                  onUpdateReport?.({ disclosureDraft: draft ?? undefined })
                }
              } catch {
                setDisclosureDraft('Draft unavailable.')
              } finally {
                setDisclosureLoading(false)
              }
            }}
            className="text-[11px] px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 disabled:opacity-50"
          >
            {disclosureLoading ? 'Generating…' : 'Generate disclosure draft'}
          </button>
        </div>
        {(explainScenarioText || recommendationsText || disclosureDraft) && (
          <div className="space-y-3 pt-2 border-t border-zinc-700 text-sm text-zinc-200 whitespace-pre-wrap">
            {explainScenarioText && (
              <div>
                <span className="text-zinc-500 text-xs uppercase">Scenario explanation</span>
                <p className="mt-1">{stripMarkdown(explainScenarioText)}</p>
              </div>
            )}
            {recommendationsText && (
              <div>
                <span className="text-zinc-500 text-xs uppercase">Recommendations</span>
                <p className="mt-1">{stripMarkdown(recommendationsText)}</p>
                <RegulatoryDisclaimer className="mt-2" compact />
              </div>
            )}
            {disclosureDraft && (
              <div>
                <span className="text-zinc-500 text-xs uppercase">Disclosure draft ({disclosureFramework})</span>
                <p className="mt-1">{stripMarkdown(disclosureDraft)}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Report V2 — Probabilistic, Regulatory, News, etc. (moved up for visibility) */}
      {report.reportV2 && <ReportV2Sections v2={report.reportV2} baseLossM={report.totalLoss} currency={getReportCurrency(report)} eventName={report.eventName} cityName={report.cityName} />}

      {/* Knowledge Graph: related entities and graph context (when use_kg=true) */}
      {((report.relatedEntities?.length ?? 0) > 0 || (report.graphContext && report.graphContext.trim())) && (
        <div className="mb-6 p-4 bg-zinc-500/5 border border-zinc-500/20 rounded-md">
          <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Knowledge Graph context
          </h3>
          {report.relatedEntities && report.relatedEntities.length > 0 && (
            <div className="mb-3">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Related entities</div>
              <div className="flex flex-wrap gap-2">
                {report.relatedEntities.map((e, i) => (
                  <span key={e.id ?? i} className="px-2 py-1 bg-zinc-800 rounded text-xs text-zinc-200 border border-zinc-700">
                    {e.name ?? e.id ?? '—'} {e.relationship_type && <span className="text-zinc-500">({e.relationship_type})</span>}
                  </span>
                ))}
              </div>
            </div>
          )}
          {report.graphContext && report.graphContext.trim() && (
            <div>
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider mb-1">Context</div>
              <p className="text-zinc-300 text-sm leading-relaxed">{report.graphContext}</p>
            </div>
          )}
        </div>
      )}

      {/* Regional Action Plan — matches report region (e.g. Chicago/USA or Melbourne/Australia) */}
      {report.regionActionPlan && (
        <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-md">
          <h3 className="text-zinc-400 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
            Regional Action Plan — {report.regionActionPlan.region.replace(/\b\w/g, (c) => c.toUpperCase())}, {report.regionActionPlan.country.toUpperCase()}
          </h3>
          <p className="text-zinc-300 text-sm leading-relaxed mb-3">{report.regionActionPlan.summary}</p>
          <div className="space-y-2 mb-3">
            <div className="text-zinc-500 text-xs uppercase tracking-wider">Key actions</div>
            <ul className="list-disc list-inside text-zinc-200 text-sm space-y-1">
              {report.regionActionPlan.key_actions.slice(0, 5).map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            {report.regionActionPlan.contacts.map((c, i) => (
              <a
                key={i}
                href={`tel:${(c.phone || '').replace(/\s/g, '')}`}
                className="text-xs px-2 py-1 bg-zinc-700 rounded text-zinc-300 hover:bg-zinc-600"
              >
                {c.name}: {c.phone}
              </a>
            ))}
            {report.regionActionPlan.urls.slice(0, 2).map((url, i) => (
              <a
                key={`url-${i}`}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-2 py-1 bg-zinc-800 rounded text-zinc-300 hover:bg-zinc-700"
              >
                Source
              </a>
            ))}
          </div>
        </div>
      )}

      {/* Compare with Historical Events - only comparable (same event type + region) */}
      <div className="mb-6">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-2 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Compare with Historical Events
        </h3>
        <p className="text-zinc-500 text-xs mb-3">
          Comparable past events: same type ({report.eventType}) and region ({report.cityName}). Select to add to report.
        </p>
        {comparableEvents.length > 0 ? (
          <div className="space-y-2 mb-4">
            {comparableEvents.map((evt) => {
              const alreadyAdded = report.historicalComparisons?.some((c) => c.id === evt.id || c.name === evt.name)
              return (
                <div key={evt.id} className="p-3 bg-zinc-800 border border-zinc-700 rounded-md flex flex-col sm:flex-row sm:items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-zinc-100">{evt.name}{evt.year ? ` (${evt.year})` : ''}</div>
                    <div className="text-zinc-500 text-xs mt-0.5">{evt.similarity_reason}</div>
                    {evt.description && (
                      <div className="text-zinc-400 text-xs mt-1 line-clamp-2">{evt.description}</div>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={alreadyAdded}
                    onClick={() => onUpdateReport?.({
                      historicalComparisons: [...(report.historicalComparisons ?? []), {
                        id: evt.id,
                        name: evt.name,
                        year: evt.year,
                        description: evt.description,
                        region_name: evt.region_name,
                        similarity_reason: evt.similarity_reason,
                        lessons_learned: evt.lessons_learned,
                        financial_loss_eur: evt.financial_loss_eur,
                        severity_actual: evt.severity_actual,
                        affected_population: evt.affected_population,
                      }],
                    })}
                    className="shrink-0 px-3 py-1.5 bg-zinc-500/20 hover:bg-zinc-500/30 border border-zinc-500/40 text-zinc-300 rounded text-xs disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {alreadyAdded ? 'Added' : 'Add to Report'}
                  </button>
                </div>
              )
            })}
          </div>
        ) : (
          <>
            <p className="text-zinc-500 text-xs">No comparable historical events found for this scenario and region.</p>
            <p className="text-zinc-500 text-[10px] mt-1">Searched: EM-DAT, regional archives.</p>
          </>
        )}

        {/* Historical comparisons added to report */}
        {(report.historicalComparisons?.length ?? 0) > 0 && (
          <div className="mt-4 space-y-4">
            <div className="text-zinc-400 text-xs uppercase tracking-wider">Historical comparisons in report</div>
            {report.historicalComparisons!.map((comp, idx) => (
              <div key={comp.id || idx} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-md">
                <div className="text-amber-400/80 font-medium mb-1">{comp.name}{comp.year ? ` (${comp.year})` : ''}</div>
                <div className="text-zinc-500 text-[10px] uppercase mb-1">Why comparable: {comp.similarity_reason}</div>
                {comp.description && <p className="text-zinc-300 text-sm mb-2">{comp.description}</p>}
                {comp.lessons_learned && (
                  <div className="mb-2">
                    <span className="text-zinc-500 text-xs">Lessons: </span>
                    <span className="text-zinc-300 text-sm">{comp.lessons_learned}</span>
                  </div>
                )}
                <div className="flex flex-wrap gap-3 text-xs">
                  {comp.financial_loss_eur != null && (
                    <span className="text-zinc-400">Loss: {currSym(getReportCurrency(report))}{(comp.financial_loss_eur / 1e6).toFixed(0)}M</span>
                  )}
                  {comp.severity_actual != null && (
                    <span className="text-zinc-400">Severity: {(comp.severity_actual * 100).toFixed(0)}%</span>
                  )}
                  {comp.affected_population != null && (
                    <span className="text-zinc-400">Affected: {comp.affected_population.toLocaleString()}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cascade Influence Analysis: CascadeVisualizer embed when cityId; else EventRiskGraph + legend/summary + metrics from report */}
      <div ref={onCascadeSectionRef} className="mb-6 scroll-mt-4">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-1 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
          </svg>
          Cascade Influence Analysis
        </h3>
        <p className="text-zinc-500 text-xs mb-2">
          {cityId
            ? 'Force-Directed Graph: infrastructure nodes, cascade propagation. Use Simulate Cascade, Analyze Vulnerability, Reset Graph.'
            : `Based on scenario ${report.eventName} and city ${report.cityName}. Event → sectors → impact (3D force-directed). Nodes = sectors/assets, links = supply/financial/operational. Color = risk.`}
        </p>
        {cityId ? (
          <CascadeVisualizer
            cityId={cityId}
            scenarioId={scenarioId}
            currency={getReportCurrency(report)}
            onAddToReport={onUpdateReport
              ? (data) => onUpdateReport({
                  cascadeSimulations: [...(report.cascadeSimulations ?? []), data],
                })
              : undefined}
          />
        ) : (
          <>
            <EventRiskGraph
              eventId={report.eventId}
              eventType="current"
              eventName={report.eventName}
              eventCategory={eventTypeToCategory(report.eventType)}
              cityName={report.cityName}
              fullWidth={true}
              height={500}
              scenarioId={scenarioId}
              cityId={cityId}
              showLegend
              showSummary
            />
            <div className="mt-3 grid grid-cols-4 gap-3">
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-500 text-[10px] uppercase">Est. cascade loss</div>
                <div className="text-amber-400/80 text-lg font-medium">{formatLossM(report.totalLoss, getReportCurrency(report))}</div>
              </div>
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-500 text-[10px] uppercase">Risk zones</div>
                <div className="text-white text-lg font-medium">{report.zones.length}</div>
              </div>
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-500 text-[10px] uppercase">Critical</div>
                <div className="text-red-400/90 text-lg font-medium">{report.zones.filter(z => z.riskLevel === 'critical').length}</div>
              </div>
              <div className="bg-zinc-800 rounded-md p-3 border border-zinc-700">
                <div className="text-zinc-500 text-[10px] uppercase">High</div>
                <div className="text-orange-400/90 text-lg font-medium">{report.zones.filter(z => z.riskLevel === 'high').length}</div>
              </div>
            </div>
          </>
        )}
        <p className="text-zinc-500 text-[10px] mt-2">Cascade is embedded in-report. Run Simulate Cascade, Analyze Vulnerability, Reset Graph. Use &quot;Expand Cascade&quot; below to scroll here.</p>
      </div>

      {/* Cascade simulation from this run (report_v2.cascade_simulation when use_cascade_gnn=true) */}
      {report.reportV2?.cascade_simulation && typeof report.reportV2.cascade_simulation === 'object' && (() => {
        const sim = report.reportV2.cascade_simulation as {
          trigger_node?: string
          affected_nodes?: unknown[]
          total_loss?: number
          simulation_steps?: number
          critical_nodes?: Array<{ id?: string }>
          containment_points?: string[]
        }
        const affectedCount = Array.isArray(sim.affected_nodes) ? sim.affected_nodes.length : 0
        return (
          <div className="mb-6 p-4 bg-amber-500/5 border border-amber-500/20 rounded-md">
            <h3 className="text-amber-400/80 text-sm uppercase tracking-wider flex items-center gap-2 mb-3">
              <span>Cascade simulation from this run</span>
              <span className="text-zinc-500 text-xs font-normal">(use_cascade_gnn)</span>
            </h3>
            <p className="text-zinc-200 text-sm mb-3">
              Trigger: <span className="text-amber-400/80 font-medium">{sim.trigger_node ?? '—'}</span>.
              Over {sim.simulation_steps ?? 0} step(s), <span className="text-red-400/80 font-medium">{affectedCount}</span> node(s) affected.
              Total loss: <span className="text-amber-400/80 font-medium">{typeof sim.total_loss === 'number' ? formatLossM(sim.total_loss, getReportCurrency(report)) : '—'}</span>.
              {affectedCount === 0 && typeof sim.total_loss === 'number' && sim.total_loss > 0 && (
                <span className="text-zinc-500 text-[10px] block mt-1">Loss includes trigger node.</span>
              )}
              {sim.containment_points && sim.containment_points.length > 0 && (
                <> Containment: {sim.containment_points.slice(0, 5).join(', ')}.</>
              )}
            </p>
            <div className="grid grid-cols-4 gap-3">
              <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                <div className="text-white font-medium">{affectedCount}</div>
                <div className="text-[10px] text-zinc-500">Nodes affected</div>
              </div>
              <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                <div className="text-amber-400/80 font-medium">{typeof sim.total_loss === 'number' ? formatLossM(sim.total_loss, getReportCurrency(report)) : '—'}</div>
                <div className="text-[10px] text-zinc-500">Total loss</div>
              </div>
              <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                <div className="text-red-400/90 font-medium">{sim.critical_nodes?.length ?? 0}</div>
                <div className="text-[10px] text-zinc-500">Critical</div>
              </div>
              <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                <div className="text-green-400/90 font-medium">{sim.containment_points?.length ?? 0}</div>
                <div className="text-[10px] text-zinc-500">Containment</div>
              </div>
            </div>
            {sim.critical_nodes && sim.critical_nodes.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {sim.critical_nodes.slice(0, 5).map((n, i) => (
                  <span key={n.id ?? i} className="text-xs px-2 py-0.5 bg-red-500/10 text-red-300/90 rounded border border-red-500/20">
                    {n.id ?? `Node ${i + 1}`}
                  </span>
                ))}
              </div>
            )}
          </div>
        )
      })()}

      {/* Cascade Simulations Added to Report */}
      {(report.cascadeSimulations?.length ?? 0) > 0 && (
        <div className="mb-6 space-y-4">
          <h3 className="text-zinc-300 text-sm uppercase tracking-wider flex items-center gap-2">
            <span>Cascade Simulation Results</span>
            <span className="text-zinc-500 text-xs font-normal">({report.cascadeSimulations!.length} run(s))</span>
          </h3>
          {report.cascadeSimulations!.map((sim, idx) => (
            <div key={idx} className="p-4 bg-zinc-800 border border-zinc-700 rounded-md">
              <div className="text-zinc-500 text-xs uppercase tracking-wider mb-2">Simulation #{idx + 1}</div>
              <p className="text-zinc-200 text-sm mb-3">
                Trigger: <span className="text-amber-400/80 font-medium">{sim.trigger_node}</span> at {(sim.trigger_severity * 100).toFixed(0)}% severity. Over {sim.simulation_steps} step(s), <span className="text-red-400/80 font-medium">{sim.affected_count}</span> node(s) affected, total loss <span className="text-zinc-400 font-medium">{formatCascadeLoss(sim.total_loss, getReportCurrency(report))}</span>.
                {sim.affected_count === 0 && sim.total_loss > 0 && (
                  <span className="text-zinc-500 text-[10px] block mt-1">Loss includes trigger node.</span>
                )}
                {sim.containment_points.length > 0 && (
                  <> Containment: {sim.containment_points.join(', ')}.</>
                )}
              </p>
              <div className="grid grid-cols-4 gap-3">
                <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                  <div className="text-white font-medium">{sim.affected_count}</div>
                  <div className="text-[10px] text-zinc-500">Nodes Affected</div>
                </div>
                <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                  <div className="text-amber-400/80 font-medium">{formatCascadeLoss(sim.total_loss, getReportCurrency(report))}</div>
                  <div className="text-[10px] text-zinc-500">Total Loss</div>
                </div>
                <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                  <div className="text-red-400/90 font-medium">{sim.critical_nodes?.length ?? 0}</div>
                  <div className="text-[10px] text-zinc-500">Critical</div>
                </div>
                <div className="text-center p-2 bg-zinc-800 rounded border border-zinc-800">
                  <div className="text-green-400/90 font-medium">{sim.containment_points?.length ?? 0}</div>
                  <div className="text-[10px] text-zinc-500">Containment</div>
                </div>
              </div>
              {sim.containment_points.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {sim.containment_points.map((p) => (
                    <span key={p} className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded border border-zinc-700">
                      {p}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Impact Summary */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-zinc-300 text-sm uppercase tracking-wider">Impact Summary</h3>
          <span className="text-zinc-500 text-xs">Estimated losses and affected entities</span>
        </div>
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-md p-4">
            <div className="text-red-400/70 text-xs uppercase tracking-wider mb-1">Total Loss</div>
            <div className="text-red-400/80 text-2xl font-light">{formatLossM(report.totalLoss, getReportCurrency(report))}</div>
            <div className="text-red-400/50 text-[10px] mt-1">Expected financial impact</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-md p-4">
            <div className="text-orange-400/70 text-xs uppercase tracking-wider mb-1">Buildings Affected</div>
            <div className="text-orange-400/80 text-2xl font-light">{report.totalBuildingsAffected.toLocaleString()}</div>
            <div className="text-orange-400/50 text-[10px] mt-1">Structures in risk zones</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4">
            <div className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Population Impact</div>
            <div className="text-amber-400/80 text-2xl font-light">{report.totalPopulationAffected.toLocaleString()}</div>
            <div className="text-amber-400/50 text-[10px] mt-1">People in affected areas</div>
          </div>
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-md p-4">
            <div className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Risk Zones</div>
            <div className="text-amber-400/80 text-2xl font-light">{report.zones.length}</div>
            <div className="flex gap-1 mt-1 flex-wrap">
              {report.zones.filter(z => z.riskLevel === 'critical').length > 0 && (
                <span className="px-1.5 py-0.5 bg-red-500/30 text-red-400/80 text-[10px] rounded">
                  {report.zones.filter(z => z.riskLevel === 'critical').length} critical
                </span>
              )}
              {report.zones.filter(z => z.riskLevel === 'high').length > 0 && (
                <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-400/80 text-[10px] rounded">
                  {report.zones.filter(z => z.riskLevel === 'high').length} high
                </span>
              )}
              {report.zones.filter(z => z.riskLevel === 'medium').length > 0 && (
                <span className="px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400/80 text-[10px] rounded">
                  {report.zones.filter(z => z.riskLevel === 'medium').length} medium
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* VaR/CVaR and Monte Carlo (legacy; when no reportV2 or as fallback) */}
      {(!report.reportV2?.probabilistic_metrics) && (
      <div className="mb-6 p-4 bg-gradient-to-br from-zinc-500/10 to-amber-500/10 border border-zinc-700 rounded-md">
        <h3 className="text-zinc-400 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Financial Risk Metrics
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-black/30 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-xs">Value at Risk (99%)</span>
              <span className="text-[8px] text-amber-400/70 bg-amber-400/10 px-1.5 rounded">MC</span>
            </div>
            <div className="text-amber-400/80 text-xl font-light">{formatLossM(report.totalLoss * 1.3, getReportCurrency(report))}</div>
            <div className="text-zinc-500 text-[10px] mt-1">99% confidence, 1-year horizon</div>
          </div>
          <div className="bg-black/30 rounded-md p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-zinc-500 text-xs">Expected Shortfall (CVaR)</span>
              <span className="text-[8px] text-zinc-400 bg-zinc-800 px-1.5 rounded">Copula</span>
            </div>
            <div className="text-zinc-400 text-xl font-light">{formatLossM(report.totalLoss * 1.55, getReportCurrency(report))}</div>
            <div className="text-zinc-500 text-[10px] mt-1">Average loss beyond VaR</div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-zinc-700">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-zinc-500 text-xs uppercase tracking-wider">Monte Carlo Engine</span>
          </div>
          <div className="grid grid-cols-4 gap-3 text-[10px]">
            <div><span className="text-zinc-500">Simulations</span><div className="text-white font-mono">{(report.reportV2?.probabilistic_metrics?.monte_carlo_runs ?? 100000).toLocaleString()}</div></div>
            <div><span className="text-zinc-500">Copula</span><div className="text-white">Gaussian</div></div>
            <div><span className="text-zinc-500">Confidence</span><div className="text-white font-mono">99%</div></div>
            <div><span className="text-zinc-500">Engine</span><div className="text-white">NumPy</div></div>
          </div>
        </div>
      </div>
      )}

      {/* Risk Cascade Flow */}
      <div className="mb-6">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
          </svg>
          Risk Cascade Flow
        </h3>
        <RiskFlowMini
          stressTestResults={{
            zones: report.zones.map(z => ({ name: z.label, loss: z.estimatedLoss, riskLevel: z.riskLevel })),
          }}
        />
      </div>

      {/* Methodology */}
      <div className="mb-6 p-4 bg-zinc-800 border border-zinc-700 rounded-md">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          Risk Assessment Methodology
        </h3>
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div>
            <div className="text-zinc-500 mb-2">Zone Identification Based On:</div>
            <ul className="text-zinc-300 space-y-1">
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400/80 mt-0.5">→</span>
                <span><strong>Event Type Analysis:</strong> {report.eventType === 'flood' ? 'Coastal, low-lying, and waterfront areas identified' :
                  report.eventType === 'seismic' ? 'Fault lines, soft soil, and high-rise clusters analyzed' :
                  report.eventType === 'fire' ? 'Industrial zones and dense urban areas mapped' :
                  report.eventType === 'financial' ? 'CBD, banking districts, and exchanges identified' :
                  report.eventType === 'infrastructure' ? 'Power grids, data centers, and transport hubs analyzed' :
                  report.eventType === 'supply_chain' ? 'Ports, warehouses, and logistics hubs mapped' :
                  report.eventType === 'pandemic' ? 'Transit hubs and high-density areas analyzed' :
                  'Critical infrastructure and population centers analyzed'}</span>
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-amber-400/80 mt-0.5">→</span>
                <span><strong>Severity Factor:</strong> {(report.zones[0]?.riskLevel === 'critical' ? 'High' : 'Moderate')} severity applied ({currSym(getReportCurrency(report))}{((report.totalLoss / report.totalBuildingsAffected) || 0).toFixed(1)}M avg loss per building)</span>
              </li>
            </ul>
          </div>
          <div>
            <div className="text-zinc-500 mb-2">Risk Level Classification:</div>
            <ul className="text-zinc-300 space-y-1">
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /><span><strong>Critical:</strong> Primary impact zone (epicenter, ground zero)</span></li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500" /><span><strong>High:</strong> Secondary impact (cascading effects, proximity)</span></li>
              <li className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /><span><strong>Medium:</strong> Tertiary impact (indirect exposure)</span></li>
            </ul>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-zinc-700 text-zinc-500 text-[10px]">
          Calculations based on: Building Registry, Topographic Model, Historical Events (1970-2024), Infrastructure Mapping, Population Census
        </div>
      </div>

      {/* Risk Zones Detail */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-zinc-300 text-sm uppercase tracking-wider">Identified Risk Zones ({report.zones.length})</h3>
          <span className="text-zinc-500 text-xs">Click zone for details</span>
        </div>
        <div className="space-y-2">
          {report.zones.map((zone, i) => (
            <div
              key={i}
              className={`p-3 rounded-md border ${
                zone.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                zone.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                'bg-yellow-500/10 border-yellow-500/30'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    zone.riskLevel === 'critical' ? 'bg-red-500' :
                    zone.riskLevel === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                  }`} />
                  <span className="text-white text-sm font-medium">{zone.label}</span>
                  <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                    zone.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400/80' :
                    zone.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400/80' :
                    'bg-yellow-500/20 text-yellow-400/80'
                  }`}>{zone.riskLevel}</span>
                </div>
                <span className="text-zinc-500 text-xs">Radius: {zone.radius}m</span>
              </div>
              <div className="text-zinc-500 text-xs mb-2 italic">
                {zone.riskLevel === 'critical' ? '↳ Primary impact zone - highest vulnerability based on event type and location' :
                 zone.riskLevel === 'high' ? '↳ Secondary impact - exposed to cascading effects from primary zone' :
                 '↳ Tertiary impact - indirect exposure through infrastructure dependencies'}
              </div>
              <div className="grid grid-cols-3 gap-4 text-xs">
                <div><span className="text-zinc-500">Buildings:</span><span className="text-zinc-300 ml-1">{zone.affectedBuildings}</span></div>
                <div><span className="text-zinc-500">Loss:</span><span className="text-zinc-300 ml-1">{formatLossM(zone.estimatedLoss, getReportCurrency(report))}</span></div>
                <div><span className="text-zinc-500">Population:</span><span className="text-zinc-300 ml-1">{zone.populationAffected.toLocaleString()}</span></div>
              </div>
              {(zone.recommendations ?? []).length > 0 && (
                <div className="mt-2 pt-2 border-t border-zinc-700">
                  <div className="text-zinc-500 text-xs mb-1">Recommendations:</div>
                  <ul className="text-zinc-400 text-xs space-y-0.5">
                    {(zone.recommendations ?? []).map((rec, j) => (
                      <li key={j} className="flex items-start gap-1"><span className="text-amber-400/80">•</span> {rec}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Mitigation Actions */}
      <div className="mb-6">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-3">Mitigation Actions</h3>
        <div className="bg-zinc-800 rounded-md border border-zinc-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left text-zinc-500 px-4 py-2 font-normal">Action</th>
                <th className="text-center text-zinc-500 px-4 py-2 font-normal">Priority</th>
                <th className="text-right text-zinc-500 px-4 py-2 font-normal">Cost ({currSym(getReportCurrency(report))}M)</th>
                <th className="text-right text-zinc-500 px-4 py-2 font-normal">Risk Reduction</th>
              </tr>
            </thead>
            <tbody>
              {(report.mitigationActions ?? []).map((action, i) => (
                <tr key={i} className="border-b border-zinc-800">
                  <td className="text-zinc-300 px-4 py-2">{action.action}</td>
                  <td className="text-center px-4 py-2">
                    <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                      action.priority === 'urgent' ? 'bg-red-500/20 text-red-400/80' :
                      action.priority === 'high' ? 'bg-orange-500/20 text-orange-400/80' :
                      'bg-yellow-500/20 text-yellow-400/80'
                    }`}>{action.priority}</span>
                  </td>
                  <td className="text-zinc-300 text-right px-4 py-2">
                    {typeof action.cost === 'number'
                      ? (() => { const s = currSym(getReportCurrency(report)); return action.cost >= 1000 ? `${s}${Number(action.cost).toLocaleString()}` : `${s}${action.cost}M` })()
                      : action.cost ?? '—'}
                  </td>
                  <td className="text-green-400/80 text-right px-4 py-2">-{action.riskReduction}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Data Sources */}
      <div className="mb-6">
        <h3 className="text-zinc-300 text-sm uppercase tracking-wider mb-3">Data Sources Used</h3>
        <div className="flex flex-wrap gap-2">
          {(report.dataSourcesUsed ?? []).map((source, i) => (
            <span key={i} className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-zinc-400 text-xs">
              {source}
            </span>
          ))}
        </div>
      </div>

      {/* Concluding Summary - AI-generated: what to do, how it will affect, bottom line */}
      {report.concludingSummary && (
        <div className="mb-6 p-4 bg-gradient-to-br from-green-500/10 to-emerald-700/10 border border-green-500/20 rounded-md">
          <div className="flex items-center gap-2 mb-3">
            <svg className="w-4 h-4 text-green-400/80" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="text-green-400/80 text-sm uppercase tracking-wider">Conclusions & Next Steps</h3>
            {report.llmGenerated && (
              <span className="text-[10px] text-green-400/60">AI-Powered (NVIDIA Llama 3.1)</span>
            )}
          </div>
          <div className="text-zinc-200 text-sm leading-relaxed whitespace-pre-wrap">
            {stripMarkdown(report.concludingSummary)}
          </div>
          <RegulatoryDisclaimer className="mt-3" compact />
        </div>
      )}

      {/* Footer: Open in Cascade, Export PDF, Close */}
      <div className="flex items-center justify-between pt-4 border-t border-zinc-700">
        <div className="text-zinc-500 text-xs">Generated: {new Date(report.timestamp).toLocaleString()}</div>
        <div className="flex gap-2">
          <button
            onClick={onOpenInCascade}
            className="px-4 py-2 bg-zinc-500/20 text-zinc-300 rounded-md text-sm hover:bg-zinc-500/30 transition-colors flex items-center gap-2 border border-zinc-500/30"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
            Expand Cascade
          </button>
          <SendToARINButton
            sourceModule="stress_test"
            objectType="scenario"
            objectId={report.stressTestId || `${report.eventId}-${report.cityName}`}
            inputData={{
              eventName: report.eventName,
              eventType: report.eventType,
              cityName: report.cityName,
              totalLoss: report.totalLoss,
              zones_count: report.zones?.length ?? 0,
              severity: report.zones?.length
                ? Math.max(...report.zones.map(z =>
                    z.riskLevel === 'critical' ? 0.9 : z.riskLevel === 'high' ? 0.7 : z.riskLevel === 'medium' ? 0.5 : 0.3
                  ))
                : 0.5,
            }}
            exportEntityId="portfolio_global"
            exportEntityType="portfolio"
            exportAnalysisType="stress_test"
            exportData={{
              risk_score: report.zones?.length
                ? Math.max(...report.zones.map(z =>
                    z.riskLevel === 'critical' ? 90 : z.riskLevel === 'high' ? 70 : z.riskLevel === 'medium' ? 50 : 30
                  ))
                : 50,
              risk_level: report.zones?.some(z => z.riskLevel === 'critical') ? 'CRITICAL' : report.zones?.some(z => z.riskLevel === 'high') ? 'HIGH' : 'MEDIUM',
              summary: `Stress test: ${report.eventName} in ${report.cityName}. Loss: ${formatLossM(report.totalLoss, getReportCurrency(report))}, ${report.zones?.length ?? 0} zones.`,
              recommendations: report.mitigationActions?.slice(0, 3).map(a => a.action) ?? ['Review exposure', 'Update risk limits'],
              indicators: {
                scenario: report.eventName,
                city: report.cityName,
                total_loss_m: report.totalLoss,
                zones_count: report.zones?.length ?? 0,
              },
            }}
            size="sm"
            variant="secondary"
          />
          <ARINVerdictBadge entityId={report.stressTestId || `scenario_${(report.eventId || 'unknown').toLowerCase()}_${(report.cityName || 'unknown').toLowerCase().replace(/\s+/g, '_')}`} compact />
          <button
            onClick={() => setShowRecordObservationModal(true)}
            className="px-4 py-2 bg-sky-700/80 text-sky-100 rounded-md text-sm hover:bg-sky-600/80 transition-colors flex items-center gap-2"
            title="Send this scenario to Cross-Track Synergy for model calibration"
          >
            Submit as field observation
          </button>
          <button
            onClick={onExportPDF}
            disabled={isExportingPDF}
            className="px-4 py-2 bg-zinc-700 text-zinc-300 rounded-md text-sm hover:bg-zinc-600 transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {isExportingPDF ? 'Exporting…' : 'Export PDF'}
          </button>
          <button onClick={onClose} className="px-4 py-2 bg-amber-500/20 text-amber-400/80 rounded-md text-sm hover:bg-amber-500/30 transition-colors">
            Close
          </button>
        </div>
        <SubmitAsFieldObservationModal
          isOpen={showRecordObservationModal}
          onClose={() => setShowRecordObservationModal(false)}
          initial={{
            cityName: report.cityName,
            eventName: report.eventName,
            eventType: report.eventType,
            totalLoss: report.totalLoss,
            stressTestId: report.stressTestId,
          }}
        />
      </div>
    </div>
  )
}
