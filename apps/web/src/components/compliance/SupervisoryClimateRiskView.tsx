/**
 * Supervisory Climate Risk View — embeddable in Compliance Dashboard (tab) or standalone.
 * Unified Corporate Style: section labels font-mono text-[10px] uppercase tracking-widest,
 * rounded-md only, zinc palette (light theme variant: zinc-50/100/200 for borders/bg).
 * Aligned with ISO 22301 / DORA / ECB Expectations.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

type TabId = 'coverage' | 'scenarios' | 'loss-chain' | 'results' | 'governance'

const coverageData = {
  totalAUM: 4200,
  coveredAUM: 3864,
  coveragePercent: 92,
  exclusions: [
    { category: 'Cash & Equivalents', aum: 168, reason: 'Immaterial climate exposure' },
    { category: 'Short-term Derivatives', aum: 126, reason: 'Hedging instruments' },
    { category: 'Private Holdings <€1M', aum: 42, reason: 'Below materiality threshold' },
  ],
  assetClasses: [
    { name: 'Real Estate', coverage: 100, aum: 1680 },
    { name: 'Infrastructure', coverage: 100, aum: 840 },
    { name: 'Private Equity', coverage: 88, aum: 672 },
    { name: 'Listed Equities', coverage: 85, aum: 504 },
    { name: 'Fixed Income', coverage: 78, aum: 336 },
  ],
}

const scenarioData = [
  { id: 'orderly', name: 'Orderly Transition', description: 'Climate policies are introduced early and gradually become more stringent', horizons: ['2030', '2040', '2050'], variables: ['Temperature +1.5°C', 'Carbon Price €150/t', 'GDP -2.1%'], probability: 'Moderate' },
  { id: 'disorderly', name: 'Disorderly Transition', description: 'Delayed and sudden climate policies lead to higher transition costs', horizons: ['2030', '2040', '2050'], variables: ['Temperature +1.8°C', 'Carbon Price €250/t', 'GDP -4.2%'], probability: 'Low-Moderate' },
  { id: 'hothouse', name: 'Hot House World', description: 'Limited policy action leads to severe physical risks', horizons: ['2030', '2040', '2050'], variables: ['Temperature +3.0°C', 'Carbon Price €50/t', 'GDP -8.5%'], probability: 'Low' },
]

const lossChainSteps = [
  { step: 1, name: 'Hazard', description: 'Physical climate hazard identification', formula: 'P(hazard) = f(location, climate_scenario, time_horizon)', source: 'NGFS Climate Scenarios v3.2', confidence: 95 },
  { step: 2, name: 'Exposure', description: 'Asset exposure to identified hazards', formula: 'Exposure = Σ(asset_value × location_factor)', source: 'Internal Asset Registry + GRESB', confidence: 92 },
  { step: 3, name: 'Vulnerability', description: 'Asset vulnerability assessment', formula: 'V = f(building_type, construction_year, adaptation_measures)', source: 'OASIS LMF + Internal Engineering', confidence: 85 },
  { step: 4, name: 'Damage', description: 'Physical damage estimation', formula: 'Damage = Exposure × Vulnerability × Hazard_Intensity', source: 'Catastrophe Modeling (AIR/RMS calibrated)', confidence: 80 },
  { step: 5, name: 'Financial Loss', description: 'Translation to financial impact', formula: 'Loss = Damage × (1 - Insurance_Coverage) + Business_Interruption', source: 'Internal Financial Models', confidence: 78 },
]

const stressResults = [
  { scenario: 'Orderly 2030', loss: 125, pctNAV: 2.98, confidence: 'High' },
  { scenario: 'Orderly 2050', loss: 340, pctNAV: 8.10, confidence: 'Medium' },
  { scenario: 'Disorderly 2030', loss: 285, pctNAV: 6.79, confidence: 'Medium' },
  { scenario: 'Disorderly 2050', loss: 620, pctNAV: 14.76, confidence: 'Low' },
  { scenario: 'Hot House 2030', loss: 520, pctNAV: 12.38, confidence: 'Medium' },
  { scenario: 'Hot House 2050', loss: 1680, pctNAV: 40.00, confidence: 'Low' },
]

const governanceData = {
  modelOwner: 'Head of Climate Risk',
  validationOwner: 'Model Validation Committee',
  lastValidation: '2025-12-15',
  nextValidation: '2026-06-15',
  backtestDate: '2025-11-20',
  backtestResult: 'Passed',
  overrideLog: [
    { date: '2026-01-28', reason: 'Updated flood depth parameters for EU region', approver: 'CRO' },
    { date: '2026-01-15', reason: 'Excluded new acquisition pending data integration', approver: 'Head of Risk' },
    { date: '2025-12-20', reason: 'Adjusted recovery time assumptions post-audit', approver: 'Model Validation' },
  ],
}

const tabs: { id: TabId; label: string }[] = [
  { id: 'coverage', label: 'Coverage Map' },
  { id: 'scenarios', label: 'Scenario Framework' },
  { id: 'loss-chain', label: 'Loss Calculation' },
  { id: 'results', label: 'Stress Test Results' },
  { id: 'governance', label: 'Governance' },
]

export default function SupervisoryClimateRiskView() {
  const [activeTab, setActiveTab] = useState<TabId>('coverage')
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  return (
    <div className="min-h-full bg-white text-zinc-900 rounded-md border border-zinc-200 overflow-hidden">
      {/* Header — Strategic Modules style (light theme) */}
      <header className="border-b border-zinc-200 bg-zinc-50/80 px-6 py-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-md border border-zinc-200 bg-white">
              <ShieldCheckIcon className="w-8 h-8 text-zinc-500" />
            </div>
            <div>
              <h2 className="text-xl font-display font-semibold text-zinc-900">
                Supervisory Climate Risk View
              </h2>
              <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                Aligned with ISO 22301 / DORA / ECB Expectations
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Compliant</span>
            </div>
            <button type="button" className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-white text-sm font-medium hover:bg-zinc-700 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
        <div className="flex items-center gap-6 mt-4 font-mono text-[10px] uppercase tracking-wider text-zinc-500 flex-wrap">
          <span><span className="text-zinc-400">Institution:</span> Global Risk Platform</span>
          <span><span className="text-zinc-400">Reference Date:</span> {today}</span>
          <span><span className="text-zinc-400">Methodology:</span> v3.2.1</span>
          <span><span className="text-zinc-400">Scope:</span> {coverageData.coveragePercent}% AUM</span>
        </div>
      </header>

      {/* Tab nav — 100% ModuleFilter layout */}
      <nav className="border-b border-zinc-200 bg-zinc-50/50 px-6 py-4">
        <div className="flex flex-wrap items-center gap-4">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">View:</span>
          <div className="flex gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all border ${
                  activeTab === t.id
                    ? 'bg-zinc-700 text-zinc-100 border-zinc-600'
                    : 'bg-white text-zinc-600 border-zinc-200 hover:bg-zinc-100 hover:border-zinc-300'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <main className="p-6 max-w-[1920px] mx-auto">
        {activeTab === 'coverage' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            {/* Section divider — Strategic Modules style (light) */}
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Coverage Summary</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded border border-zinc-200">AUM</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Coverage Summary</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-md border border-zinc-200 bg-zinc-50/80">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Total AUM</div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-zinc-900">€{coverageData.totalAUM}M</div>
                </div>
                <div className="p-4 rounded-md border border-zinc-200 bg-zinc-50/80">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Covered AUM</div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-emerald-700">€{coverageData.coveredAUM}M</div>
                </div>
                <div className="p-4 rounded-md border border-zinc-200 bg-zinc-50/80">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Coverage Rate</div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-zinc-900">{coverageData.coveragePercent}%</div>
                </div>
                <div className="p-4 rounded-md border border-zinc-200 bg-zinc-50/80">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Exclusions</div>
                  <div className="text-xl font-semibold font-mono tabular-nums text-amber-600">€{coverageData.totalAUM - coverageData.coveredAUM}M</div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Coverage by Asset Class</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Coverage by Asset Class</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Asset Class</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">AUM (€M)</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Coverage</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3 pl-4">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.assetClasses.map((ac) => (
                    <tr key={ac.name} className="border-b border-zinc-100">
                      <td className="py-3 text-sm text-zinc-900">{ac.name}</td>
                      <td className="py-3 text-sm font-mono tabular-nums text-zinc-900 text-right">€{ac.aum}M</td>
                      <td className="py-3 text-sm font-mono tabular-nums text-right">
                        <span className={ac.coverage >= 90 ? 'text-emerald-600' : ac.coverage >= 80 ? 'text-amber-600' : 'text-red-600'}>{ac.coverage}%</span>
                      </td>
                      <td className="py-3 pl-4">
                        {ac.coverage >= 90 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-md">
                            <CheckCircleIcon className="w-3 h-3" /> Full
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-md">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Partial
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Exclusion Justification</span>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Exclusion Justification</h3>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Category</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">AUM (€M)</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3 pl-4">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.exclusions.map((exc, i) => (
                    <tr key={i} className="border-b border-zinc-100">
                      <td className="py-3 text-sm text-zinc-900">{exc.category}</td>
                      <td className="py-3 text-sm font-mono tabular-nums text-zinc-900 text-right">€{exc.aum}M</td>
                      <td className="py-3 text-sm text-zinc-600 pl-4">{exc.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'scenarios' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Scenario Framework</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded border border-zinc-200">{scenarioData.length} scenarios</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">NGFS Scenario Framework</h3>
              <p className="text-sm text-zinc-500 mb-6">Scenarios aligned with Network for Greening the Financial System (NGFS) Phase IV</p>
              <div className="space-y-4">
                {scenarioData.map((s) => (
                  <div key={s.id} className="rounded-md border border-zinc-200 p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h4 className="font-semibold text-zinc-900">{s.name}</h4>
                        <p className="text-sm text-zinc-500">{s.description}</p>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-600 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-md">Probability: {s.probability}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Time Horizons</div>
                        <div className="flex gap-2 flex-wrap">
                          {s.horizons.map((h) => (
                            <span key={h} className="px-2 py-1 text-xs font-mono bg-zinc-100 border border-zinc-200 rounded-md">{h}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Key Variables</div>
                        <div className="flex flex-wrap gap-2">
                          {s.variables.map((v, i) => (
                            <span key={i} className="px-2 py-1 text-xs bg-zinc-100 border border-zinc-200 rounded-md">{v}</span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'loss-chain' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Loss Calculation</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded border border-zinc-200">{lossChainSteps.length} steps</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Loss Calculation Methodology</h3>
              <p className="text-sm text-zinc-500 mb-6">End-to-end causal chain from physical hazard to financial loss</p>
              <div className="space-y-4">
                {lossChainSteps.map((step, i) => (
                  <div key={step.step} className="relative">
                    {i > 0 && <div className="absolute left-6 -top-4 w-px h-4 bg-zinc-300" />}
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold font-mono tabular-nums shrink-0">{step.step}</div>
                      <div className="flex-1 rounded-md border border-zinc-200 p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h4 className="font-semibold text-zinc-900">{step.name}</h4>
                          <span className={`font-mono text-[10px] uppercase tracking-wider px-2 py-1 rounded-md border ${
                            step.confidence >= 90 ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                            step.confidence >= 80 ? 'bg-amber-50 border-amber-200 text-amber-700' :
                            'bg-orange-50 border-orange-200 text-orange-700'
                          }`}>Confidence: {step.confidence}%</span>
                        </div>
                        <p className="text-sm text-zinc-600 mb-3">{step.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Formula</div>
                            <code className="text-xs bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-md font-mono text-zinc-700 block">{step.formula}</code>
                          </div>
                          <div>
                            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Data Source</div>
                            <span className="text-zinc-700">{step.source}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'results' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Stress Test Results</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded border border-zinc-200">{stressResults.length} scenarios</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Stress Test Results</h3>
                  <p className="text-sm text-zinc-500">Scenario-based loss projections</p>
                </div>
                <div className="flex gap-2">
                  <button type="button" className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white hover:bg-zinc-50">Export CSV</button>
                  <button type="button" className="px-3 py-1.5 text-sm rounded-md border border-zinc-200 bg-white hover:bg-zinc-50">Export PDF</button>
                </div>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Scenario</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Loss (€M)</th>
                    <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">% NAV</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3 pl-4">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {stressResults.map((r, i) => (
                    <tr key={i} className="border-b border-zinc-100">
                      <td className="py-3 text-sm font-medium text-zinc-900">{r.scenario}</td>
                      <td className="py-3 text-sm font-mono tabular-nums text-right">
                        <span className={r.loss > 500 ? 'text-red-600' : r.loss > 200 ? 'text-amber-600' : 'text-zinc-900'}>€{r.loss}M</span>
                      </td>
                      <td className="py-3 text-sm font-mono tabular-nums text-right">
                        <span className={r.pctNAV > 20 ? 'text-red-600' : r.pctNAV > 10 ? 'text-amber-600' : 'text-zinc-900'}>{r.pctNAV.toFixed(2)}%</span>
                      </td>
                      <td className="py-3 pl-4">
                        <span className={`text-xs font-medium px-2 py-1 rounded-md border ${
                          r.confidence === 'High' ? 'bg-emerald-50 border-emerald-200 text-emerald-700' :
                          r.confidence === 'Medium' ? 'bg-amber-50 border-amber-200 text-amber-700' :
                          'bg-orange-50 border-orange-200 text-orange-700'
                        }`}>{r.confidence}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {activeTab === 'governance' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-12">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
              <div className="flex items-center gap-2">
                <span className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">Model Governance</span>
                <span className="px-2 py-1 bg-zinc-100 text-zinc-600 text-xs rounded border border-zinc-200">Override log</span>
              </div>
              <div className="h-px flex-1 bg-gradient-to-r from-transparent via-zinc-200 to-transparent" />
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Model Governance</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-0">
                  {[
                    { label: 'Model Owner', value: governanceData.modelOwner },
                    { label: 'Validation Owner', value: governanceData.validationOwner },
                    { label: 'Last Validation', value: governanceData.lastValidation },
                    { label: 'Next Validation', value: governanceData.nextValidation },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between py-3 border-b border-zinc-100">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{row.label}</span>
                      <span className="text-sm font-medium text-zinc-900">{row.value}</span>
                    </div>
                  ))}
                </div>
                <div className="space-y-0">
                  {[
                    { label: 'Last Backtest', value: governanceData.backtestDate },
                    { label: 'Backtest Result', value: governanceData.backtestResult, icon: CheckCircleIcon },
                    { label: 'Update Frequency', value: 'Quarterly' },
                    { label: 'Audit Status', value: 'Audited', icon: ShieldCheckIcon },
                  ].map((row) => (
                    <div key={row.label} className="flex justify-between items-center py-3 border-b border-zinc-100">
                      <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500">{row.label}</span>
                      <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                        {row.icon && <row.icon className="w-4 h-4" />}
                        {row.value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="rounded-md border border-zinc-200 bg-white p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Override Log</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-zinc-500 bg-zinc-100 border border-zinc-200 px-2 py-1 rounded-md">Mandatory for compliance</span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-zinc-200">
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Date</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Reason</th>
                    <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {governanceData.overrideLog.map((entry, i) => (
                    <tr key={i} className="border-b border-zinc-100">
                      <td className="py-3 text-sm font-mono text-zinc-600">{entry.date}</td>
                      <td className="py-3 text-sm text-zinc-900">{entry.reason}</td>
                      <td className="py-3 text-sm text-zinc-600">{entry.approver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="rounded-md border border-emerald-200 bg-emerald-50 p-6">
              <div className="flex items-start gap-4">
                <ShieldCheckIcon className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-emerald-800 mb-2">Regulatory Assurance Statement</h3>
                  <p className="text-sm text-emerald-800">
                    This climate risk assessment provides compliance with applicable operational resilience
                    requirements and may be submitted to supervisory authorities as evidence of BCMS maturity.
                    The methodology is aligned with ISO 22301, DORA (EU Regulation 2022/2554), and ECB
                    supervisory expectations for climate-related and environmental risks.
                  </p>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* About Supervisory Climate Risk View — 100% Strategic footer (light theme) */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-12 p-6 bg-zinc-100 rounded-md border border-zinc-200"
        >
          <h3 className="text-zinc-900 font-semibold mb-3">About Supervisory Climate Risk View</h3>
          <p className="text-zinc-600 text-sm mb-4">
            This view supports supervisory reporting and internal governance. It aligns with operational resilience
            and climate risk expectations from ISO 22301, DORA and ECB. All sections are exportable for audit and submission.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-zinc-500 mb-2">Standards:</p>
              <ul className="text-zinc-600 space-y-1 list-disc list-inside">
                <li>ISO 22301 (BCMS)</li>
                <li>DORA (EU 2022/2554)</li>
                <li>ECB climate & environmental risk</li>
                <li>NGFS scenarios</li>
              </ul>
            </div>
            <div>
              <p className="text-zinc-500 mb-2">Sections:</p>
              <ul className="text-zinc-600 space-y-1">
                <li><span className="text-zinc-800 font-medium">Coverage Map</span> — AUM and exclusions</li>
                <li><span className="text-zinc-800 font-medium">Scenario Framework</span> — NGFS scenarios</li>
                <li><span className="text-zinc-800 font-medium">Loss Calculation</span> — Hazard to loss chain</li>
                <li><span className="text-zinc-800 font-medium">Stress Test Results</span> — Scenario losses</li>
                <li><span className="text-zinc-800 font-medium">Governance</span> — Model owner, overrides</li>
              </ul>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  )
}
