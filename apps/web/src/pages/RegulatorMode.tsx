/**
 * REGULATOR / ECB MODE
 * ====================
 * 
 * Supervisory-grade interface for regulatory compliance and audits.
 * 
 * Design Principles:
 * - Read-only, audit-first, slow UI
 * - Light theme (optional), serif/neutral fonts
 * - Minimal interactivity
 * - Everything exportable
 * - Override log mandatory
 * 
 * Aligned with: ISO 22301, DORA, ECB Expectations
 */

import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { 
  ArrowLeftIcon, 
  DocumentArrowDownIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ShieldCheckIcon,
} from '@heroicons/react/24/outline'

// Tab types for the regulator mode
type RegulatorTab = 'coverage' | 'scenarios' | 'loss-chain' | 'results' | 'governance'

// Coverage data
const coverageData = {
  totalAUM: 4200, // €M
  coveredAUM: 3864, // €M
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

// NGFS Scenarios
const scenarioData = [
  {
    id: 'orderly',
    name: 'Orderly Transition',
    description: 'Climate policies are introduced early and gradually become more stringent',
    horizons: ['2030', '2040', '2050'],
    variables: ['Temperature +1.5°C', 'Carbon Price €150/t', 'GDP -2.1%'],
    probability: 'Moderate',
  },
  {
    id: 'disorderly',
    name: 'Disorderly Transition',
    description: 'Delayed and sudden climate policies lead to higher transition costs',
    horizons: ['2030', '2040', '2050'],
    variables: ['Temperature +1.8°C', 'Carbon Price €250/t', 'GDP -4.2%'],
    probability: 'Low-Moderate',
  },
  {
    id: 'hothouse',
    name: 'Hot House World',
    description: 'Limited policy action leads to severe physical risks',
    horizons: ['2030', '2040', '2050'],
    variables: ['Temperature +3.0°C', 'Carbon Price €50/t', 'GDP -8.5%'],
    probability: 'Low',
  },
]

// Loss calculation chain
const lossChainSteps = [
  {
    step: 1,
    name: 'Hazard',
    description: 'Physical climate hazard identification',
    formula: 'P(hazard) = f(location, climate_scenario, time_horizon)',
    source: 'NGFS Climate Scenarios v3.2',
    confidence: 95,
  },
  {
    step: 2,
    name: 'Exposure',
    description: 'Asset exposure to identified hazards',
    formula: 'Exposure = Σ(asset_value × location_factor)',
    source: 'Internal Asset Registry + GRESB',
    confidence: 92,
  },
  {
    step: 3,
    name: 'Vulnerability',
    description: 'Asset vulnerability assessment',
    formula: 'V = f(building_type, construction_year, adaptation_measures)',
    source: 'OASIS LMF + Internal Engineering',
    confidence: 85,
  },
  {
    step: 4,
    name: 'Damage',
    description: 'Physical damage estimation',
    formula: 'Damage = Exposure × Vulnerability × Hazard_Intensity',
    source: 'Catastrophe Modeling (AIR/RMS calibrated)',
    confidence: 80,
  },
  {
    step: 5,
    name: 'Financial Loss',
    description: 'Translation to financial impact',
    formula: 'Loss = Damage × (1 - Insurance_Coverage) + Business_Interruption',
    source: 'Internal Financial Models',
    confidence: 78,
  },
]

// Stress test results
const stressResults = [
  { scenario: 'Orderly 2030', loss: 125, pctNAV: 2.98, confidence: 'High' },
  { scenario: 'Orderly 2050', loss: 340, pctNAV: 8.10, confidence: 'Medium' },
  { scenario: 'Disorderly 2030', loss: 285, pctNAV: 6.79, confidence: 'Medium' },
  { scenario: 'Disorderly 2050', loss: 620, pctNAV: 14.76, confidence: 'Low' },
  { scenario: 'Hot House 2030', loss: 520, pctNAV: 12.38, confidence: 'Medium' },
  { scenario: 'Hot House 2050', loss: 1680, pctNAV: 40.00, confidence: 'Low' },
]

// Governance data
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

export default function RegulatorMode() {
  const [activeTab, setActiveTab] = useState<RegulatorTab>('coverage')
  const today = new Date().toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric' })

  const tabs: { id: RegulatorTab; label: string }[] = [
    { id: 'coverage', label: 'Coverage Map' },
    { id: 'scenarios', label: 'Scenario Framework' },
    { id: 'loss-chain', label: 'Loss Calculation' },
    { id: 'results', label: 'Stress Test Results' },
    { id: 'governance', label: 'Governance' },
  ]

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      {/* Header - Light theme, professional */}
      <header className="bg-white border-b border-slate-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="p-2 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-slate-600" />
            </Link>
            <div>
              <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                SUPERVISORY CLIMATE RISK VIEW
              </h1>
              <p className="text-sm text-slate-500">
                Aligned with ISO 22301 / DORA / ECB Expectations
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Compliance Status */}
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="w-5 h-5 text-emerald-600" />
              <span className="text-sm font-medium text-emerald-700">Compliant</span>
            </div>
            
            {/* Export */}
            <button className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white text-sm font-medium rounded-lg hover:bg-slate-800 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
        
        {/* Metadata bar */}
        <div className="flex items-center gap-8 mt-4 text-sm text-slate-600">
          <div>
            <span className="text-slate-400">Institution:</span>{' '}
            <span className="font-medium">Global Risk Platform</span>
          </div>
          <div>
            <span className="text-slate-400">Reference Date:</span>{' '}
            <span className="font-medium">{today}</span>
          </div>
          <div>
            <span className="text-slate-400">Methodology:</span>{' '}
            <span className="font-medium">v3.2.1</span>
          </div>
          <div>
            <span className="text-slate-400">Scope:</span>{' '}
            <span className="font-medium">{coverageData.coveragePercent}% AUM</span>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="bg-white border-b border-slate-200 px-8">
        <div className="flex gap-1">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-3 text-sm font-medium transition-colors border-b-2 ${
                activeTab === tab.id
                  ? 'border-slate-900 text-slate-900'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Content */}
      <main className="p-8 max-w-7xl mx-auto">
        {/* Coverage Map */}
        {activeTab === 'coverage' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Coverage Summary</h2>
              <div className="grid grid-cols-4 gap-6">
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-500">Total AUM</div>
                  <div className="text-2xl font-semibold text-slate-900">€{coverageData.totalAUM}M</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-500">Covered AUM</div>
                  <div className="text-2xl font-semibold text-emerald-700">€{coverageData.coveredAUM}M</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-500">Coverage Rate</div>
                  <div className="text-2xl font-semibold text-slate-900">{coverageData.coveragePercent}%</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg">
                  <div className="text-sm text-slate-500">Exclusions</div>
                  <div className="text-2xl font-semibold text-amber-600">€{coverageData.totalAUM - coverageData.coveredAUM}M</div>
                </div>
              </div>
            </div>

            {/* Asset Class Coverage */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Coverage by Asset Class</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Asset Class</th>
                    <th className="text-right text-sm font-medium text-slate-500 pb-3">AUM (€M)</th>
                    <th className="text-right text-sm font-medium text-slate-500 pb-3">Coverage</th>
                    <th className="text-left text-sm font-medium text-slate-500 pb-3 pl-6">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.assetClasses.map(ac => (
                    <tr key={ac.name} className="border-b border-slate-100">
                      <td className="py-3 text-sm text-slate-900">{ac.name}</td>
                      <td className="py-3 text-sm text-slate-900 text-right font-mono">€{ac.aum}M</td>
                      <td className="py-3 text-sm text-right font-mono">
                        <span className={ac.coverage >= 90 ? 'text-emerald-600' : ac.coverage >= 80 ? 'text-amber-600' : 'text-red-600'}>
                          {ac.coverage}%
                        </span>
                      </td>
                      <td className="py-3 pl-6">
                        {ac.coverage >= 90 ? (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                            <CheckCircleIcon className="w-3 h-3" /> Full
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-700 bg-amber-50 px-2 py-1 rounded">
                            <ExclamationTriangleIcon className="w-3 h-3" /> Partial
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Exclusions with Justification */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Exclusion Justification</h2>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Category</th>
                    <th className="text-right text-sm font-medium text-slate-500 pb-3">AUM (€M)</th>
                    <th className="text-left text-sm font-medium text-slate-500 pb-3 pl-6">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {coverageData.exclusions.map((exc, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 text-sm text-slate-900">{exc.category}</td>
                      <td className="py-3 text-sm text-slate-900 text-right font-mono">€{exc.aum}M</td>
                      <td className="py-3 text-sm text-slate-600 pl-6">{exc.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Scenario Framework */}
        {activeTab === 'scenarios' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">NGFS Scenario Framework</h2>
              <p className="text-sm text-slate-500 mb-6">
                Scenarios aligned with Network for Greening the Financial System (NGFS) Phase IV
              </p>
              
              <div className="space-y-4">
                {scenarioData.map(scenario => (
                  <div key={scenario.id} className="border border-slate-200 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="font-semibold text-slate-900">{scenario.name}</h3>
                        <p className="text-sm text-slate-500">{scenario.description}</p>
                      </div>
                      <span className="text-xs font-medium text-slate-600 bg-slate-100 px-2 py-1 rounded">
                        Probability: {scenario.probability}
                      </span>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Time Horizons</div>
                        <div className="flex gap-2">
                          {scenario.horizons.map(h => (
                            <span key={h} className="px-2 py-1 text-xs font-mono bg-slate-100 rounded">{h}</span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-slate-500 uppercase tracking-wider mb-2">Key Variables</div>
                        <div className="flex flex-wrap gap-2">
                          {scenario.variables.map((v, i) => (
                            <span key={i} className="px-2 py-1 text-xs bg-slate-100 rounded">{v}</span>
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

        {/* Loss Calculation Chain */}
        {activeTab === 'loss-chain' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-2">Loss Calculation Methodology</h2>
              <p className="text-sm text-slate-500 mb-6">
                End-to-end causal chain from physical hazard to financial loss
              </p>
              
              <div className="space-y-4">
                {lossChainSteps.map((step, i) => (
                  <div key={step.step} className="relative">
                    {i > 0 && (
                      <div className="absolute left-6 -top-4 w-px h-4 bg-slate-300" />
                    )}
                    <div className="flex gap-4">
                      <div className="w-12 h-12 rounded-full bg-slate-900 text-white flex items-center justify-center font-bold shrink-0">
                        {step.step}
                      </div>
                      <div className="flex-1 border border-slate-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <h3 className="font-semibold text-slate-900">{step.name}</h3>
                          <span className={`text-xs font-medium px-2 py-1 rounded ${
                            step.confidence >= 90 ? 'bg-emerald-50 text-emerald-700' :
                            step.confidence >= 80 ? 'bg-amber-50 text-amber-700' :
                            'bg-orange-50 text-orange-700'
                          }`}>
                            Confidence: {step.confidence}%
                          </span>
                        </div>
                        <p className="text-sm text-slate-600 mb-3">{step.description}</p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Formula</div>
                            <code className="text-xs bg-slate-100 px-2 py-1 rounded font-mono text-slate-700">
                              {step.formula}
                            </code>
                          </div>
                          <div>
                            <div className="text-xs text-slate-500 uppercase tracking-wider mb-1">Data Source</div>
                            <span className="text-slate-700">{step.source}</span>
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

        {/* Stress Test Results */}
        {activeTab === 'results' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-slate-900">Stress Test Results</h2>
                  <p className="text-sm text-slate-500">Scenario-based loss projections</p>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                    Export CSV
                  </button>
                  <button className="px-3 py-1.5 text-sm border border-slate-300 rounded hover:bg-slate-50 transition-colors">
                    Export PDF
                  </button>
                </div>
              </div>
              
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Scenario</th>
                    <th className="text-right text-sm font-medium text-slate-500 pb-3">Loss (€M)</th>
                    <th className="text-right text-sm font-medium text-slate-500 pb-3">% NAV</th>
                    <th className="text-left text-sm font-medium text-slate-500 pb-3 pl-6">Confidence</th>
                  </tr>
                </thead>
                <tbody>
                  {stressResults.map((result, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 text-sm text-slate-900 font-medium">{result.scenario}</td>
                      <td className="py-3 text-sm text-right font-mono">
                        <span className={result.loss > 500 ? 'text-red-600' : result.loss > 200 ? 'text-amber-600' : 'text-slate-900'}>
                          €{result.loss}M
                        </span>
                      </td>
                      <td className="py-3 text-sm text-right font-mono">
                        <span className={result.pctNAV > 20 ? 'text-red-600' : result.pctNAV > 10 ? 'text-amber-600' : 'text-slate-900'}>
                          {result.pctNAV.toFixed(2)}%
                        </span>
                      </td>
                      <td className="py-3 pl-6">
                        <span className={`text-xs font-medium px-2 py-1 rounded ${
                          result.confidence === 'High' ? 'bg-emerald-50 text-emerald-700' :
                          result.confidence === 'Medium' ? 'bg-amber-50 text-amber-700' :
                          'bg-orange-50 text-orange-700'
                        }`}>
                          {result.confidence}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </motion.div>
        )}

        {/* Governance */}
        {activeTab === 'governance' && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {/* Model Governance */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <h2 className="text-lg font-semibold text-slate-900 mb-4">Model Governance</h2>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Model Owner</span>
                    <span className="text-sm font-medium text-slate-900">{governanceData.modelOwner}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Validation Owner</span>
                    <span className="text-sm font-medium text-slate-900">{governanceData.validationOwner}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Last Validation</span>
                    <span className="text-sm font-medium text-slate-900">{governanceData.lastValidation}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Next Validation</span>
                    <span className="text-sm font-medium text-slate-900">{governanceData.nextValidation}</span>
                  </div>
                </div>
                <div className="space-y-4">
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Last Backtest</span>
                    <span className="text-sm font-medium text-slate-900">{governanceData.backtestDate}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Backtest Result</span>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-emerald-700">
                      <CheckCircleIcon className="w-4 h-4" />
                      {governanceData.backtestResult}
                    </span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Update Frequency</span>
                    <span className="text-sm font-medium text-slate-900">Quarterly</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-slate-100">
                    <span className="text-sm text-slate-500">Audit Status</span>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-1 rounded">
                      <ShieldCheckIcon className="w-3 h-3" />
                      Audited
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Override Log */}
            <div className="bg-white rounded-lg border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900">Override Log</h2>
                <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2 py-1 rounded">
                  Mandatory for compliance
                </span>
              </div>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-200">
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Date</th>
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Reason</th>
                    <th className="text-left text-sm font-medium text-slate-500 pb-3">Approver</th>
                  </tr>
                </thead>
                <tbody>
                  {governanceData.overrideLog.map((entry, i) => (
                    <tr key={i} className="border-b border-slate-100">
                      <td className="py-3 text-sm text-slate-600 font-mono">{entry.date}</td>
                      <td className="py-3 text-sm text-slate-900">{entry.reason}</td>
                      <td className="py-3 text-sm text-slate-600">{entry.approver}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Regulatory Assurance */}
            <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
              <div className="flex items-start gap-4">
                <ShieldCheckIcon className="w-8 h-8 text-emerald-600 shrink-0" />
                <div>
                  <h3 className="font-semibold text-emerald-900 mb-2">Regulatory Assurance Statement</h3>
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
      </main>
    </div>
  )
}
