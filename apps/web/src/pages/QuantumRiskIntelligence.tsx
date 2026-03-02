/**
 * Quantum Risk Intelligence — Quantum-inspired risk analysis dashboard.
 *
 * Sections:
 *  1. Path Integral (trajectory ensemble + interference heatmap)
 *  2. Tunneling Dashboard (barrier energy table)
 *  3. Entanglement Network (correlation matrix)
 *  4. Swarm Convergence (particle observer results)
 *  5. Uncertainty Bands (Heisenberg degradation)
 */
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  BoltIcon,
  CpuChipIcon,
  ArrowPathIcon,
  ShieldExclamationIcon,
  ChartBarIcon,
  LinkIcon,
  InformationCircleIcon,
  ExclamationTriangleIcon,
  LightBulbIcon,
  EyeIcon,
} from '@heroicons/react/24/outline'
import {
  runPathIntegral,
  scanTunneling,
  getEntanglementMatrix,
  deploySwarm,
  degradeRiskScore,
  type PathIntegralResult,
  type TunnelingScenario,
  type SwarmResult,
  type UncertaintyResult,
  type EntanglementMatrix,
} from '../services/quantumApi'

const CC_CARD = 'rounded-md bg-zinc-900 border border-zinc-800 p-5'
const CC_LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
const BTN_PRIMARY = 'px-4 py-2 rounded-md bg-amber-600/80 border border-amber-500/40 text-zinc-100 text-sm hover:bg-amber-600 transition-colors disabled:opacity-50'

type Tab = 'path-integral' | 'tunneling' | 'entanglement' | 'swarm' | 'uncertainty'

interface TabDef {
  id: Tab
  label: string
  icon: typeof BoltIcon
  brief: string
}

function InfoBox({ children, variant = 'info' }: { children: React.ReactNode; variant?: 'info' | 'warn' | 'tip' }) {
  const styles = {
    info: 'border-blue-500/30 bg-blue-500/5 text-blue-300',
    warn: 'border-amber-500/30 bg-amber-500/5 text-amber-300',
    tip: 'border-emerald-500/30 bg-emerald-500/5 text-emerald-300',
  }
  const icons = {
    info: InformationCircleIcon,
    warn: ExclamationTriangleIcon,
    tip: LightBulbIcon,
  }
  const Icon = icons[variant]
  return (
    <div className={`flex gap-3 rounded-md border p-4 text-sm leading-relaxed ${styles[variant]}`}>
      <Icon className="w-5 h-5 mt-0.5 shrink-0" />
      <div>{children}</div>
    </div>
  )
}

function MetricCard({ label, value, hint, color = 'text-zinc-100' }: { label: string; value: string | number; hint: string; color?: string }) {
  const [showHint, setShowHint] = useState(false)
  return (
    <div className={CC_CARD + ' relative group'}>
      <div className="flex items-center gap-1.5">
        <div className={CC_LABEL}>{label}</div>
        <button
          onClick={() => setShowHint(!showHint)}
          className="text-zinc-600 hover:text-zinc-400 transition-colors"
          aria-label={`Info about ${label}`}
        >
          <InformationCircleIcon className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className={`text-2xl font-bold mt-1 ${color}`}>{typeof value === 'number' ? value.toLocaleString() : value}</div>
      {showHint && (
        <div className="absolute z-10 left-0 right-0 top-full mt-1 p-3 rounded bg-zinc-800 border border-zinc-700 text-xs text-zinc-300 shadow-lg">
          {hint}
        </div>
      )}
    </div>
  )
}

export default function QuantumRiskIntelligence() {
  const [tab, setTab] = useState<Tab>('path-integral')

  const tabs: TabDef[] = [
    { id: 'path-integral', label: 'Path Integral', icon: BoltIcon, brief: 'Monte Carlo trajectory simulation' },
    { id: 'tunneling', label: 'Tunneling', icon: ShieldExclamationIcon, brief: 'Hidden vulnerability detection' },
    { id: 'entanglement', label: 'Entanglement', icon: LinkIcon, brief: 'Cross-domain correlation map' },
    { id: 'swarm', label: 'Swarm', icon: CpuChipIcon, brief: 'Multi-agent convergence search' },
    { id: 'uncertainty', label: 'Uncertainty', icon: ChartBarIcon, brief: 'Confidence degradation over time' },
  ]

  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16 space-y-6">
      {/* ---- Header ---- */}
      <div>
        <h1 className="text-2xl font-display font-semibold text-zinc-100">Quantum Risk Intelligence</h1>
        <p className="text-sm text-zinc-400 mt-1 max-w-3xl font-sans">
          Advanced risk analytics inspired by quantum physics. Each tool applies a different mathematical
          methodology to uncover risks that traditional models miss — hidden correlations, sudden
          regime shifts, and cascading failures across asset classes.
        </p>
      </div>

      {/* ---- How to use this page ---- */}
      <InfoBox variant="tip">
        <strong>Quick start:</strong> Select a tab below, read the methodology overview, then run the analysis.
        Results include highlighted warnings and actionable recommendations. Work through each tab
        left to right for a complete quantum risk profile of your portfolio.
      </InfoBox>

      {/* ---- Tab bar ---- */}
      <div className="flex flex-wrap gap-2 border-b border-zinc-800 pb-2">
        {tabs.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm transition-colors ${
                tab === t.id
                  ? 'bg-amber-600/20 text-amber-400 border border-amber-500/30'
                  : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{t.label}</span>
              {tab === t.id && <span className="text-[10px] text-amber-500/70 ml-1 hidden md:inline">— {t.brief}</span>}
            </button>
          )
        })}
      </div>

      {/* ---- Tab content ---- */}
      <motion.div
        key={tab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
      >
        {tab === 'path-integral' && <PathIntegralSection />}
        {tab === 'tunneling' && <TunnelingSection />}
        {tab === 'entanglement' && <EntanglementSection />}
        {tab === 'swarm' && <SwarmSection />}
        {tab === 'uncertainty' && <UncertaintySection />}
      </motion.div>
    </div>
  )
}

/* ==================== PATH INTEGRAL ==================== */
function PathIntegralSection() {
  const mutation = useMutation({ mutationFn: () => runPathIntegral(120, 200) })
  const data = mutation.data as PathIntegralResult | undefined

  return (
    <div className="space-y-5">
      {/* Methodology */}
      <div className={CC_CARD + ' space-y-3'}>
        <div className="flex items-center gap-2">
          <BoltIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Path Integral — Trajectory Ensemble Simulation</h2>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">
          <p>
            <strong className="text-zinc-300">Methodology:</strong> Inspired by Feynman's path integral formulation.
            Instead of predicting a single "most likely" risk scenario, this tool generates <em>thousands of possible
            risk trajectories</em> simultaneously and identifies where multiple trajectories converge on the same
            asset at the same time — creating amplified, compound losses.
          </p>
          <p>
            <strong className="text-zinc-300">What it reveals:</strong> "Interference zones" — points where
            independent risk chains (e.g., climate + supply chain + geopolitical) collide on the same asset,
            producing losses 2-5x larger than any single chain alone.
          </p>
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <InfoBox variant="info">
          <strong>What happens when you click:</strong> The system generates 200 risk trajectories across 120 time
          steps for your portfolio. Each trajectory simulates a different combination of risk events propagating
          through the asset dependency graph. Processing takes 5-15 seconds.
        </InfoBox>
        <button onClick={() => mutation.mutate()} className={BTN_PRIMARY + ' whitespace-nowrap shrink-0'} disabled={mutation.isPending}>
          {mutation.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-1" /> : <BoltIcon className="w-4 h-4 inline mr-1" />}
          Run Path Integral
        </button>
      </div>

      {mutation.isError && (
        <InfoBox variant="warn">Analysis failed. Check that the API server is running and try again.</InfoBox>
      )}

      {/* Results */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <MetricCard
              label="Trajectories Generated"
              value={data.trajectories_count}
              hint="Total number of alternative risk evolution paths simulated. More trajectories = higher statistical confidence. 200+ is recommended for production analysis."
            />
            <MetricCard
              label="Risk Chains Used"
              value={data.risk_chains_used?.length || 0}
              hint="Number of distinct causal risk chains (e.g., 'earthquake → supply disruption → revenue loss') used as seeds for trajectory generation. Each chain represents a known risk propagation path."
              color="text-amber-400"
            />
            <MetricCard
              label="Interference Zones"
              value={data.interference_zones?.length || 0}
              hint="CRITICAL METRIC — Number of points where 2+ independent risk chains converge on the same asset at the same time step. These are your highest-priority compound risk exposures."
              color="text-red-400"
            />
          </div>

          {/* Interpretation guidance */}
          {data.interference_zones && data.interference_zones.length > 0 && (
            <InfoBox variant="warn">
              <strong>Action required:</strong> {data.interference_zones.length} interference zone(s) detected.
              Focus on zones with <em>amplification ratio &gt; 2.0x</em> — these represent compound risk events
              where losses multiply. <em>Constructive</em> interference (red) amplifies losses;
              <em> destructive</em> (blue) partially cancels them out.
            </InfoBox>
          )}
          {data.interference_zones && data.interference_zones.length === 0 && (
            <InfoBox variant="tip">
              No interference zones detected. Your portfolio's risk chains do not converge significantly —
              risk exposures are well-diversified across time and assets.
            </InfoBox>
          )}

          {data?.interference_zones && data.interference_zones.length > 0 && (
            <div className={CC_CARD}>
              <div className="flex items-center gap-2 mb-1">
                <EyeIcon className="w-4 h-4 text-zinc-500" />
                <div className={CC_LABEL}>Interference Zone Details</div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                Each row is a point where multiple risk chains hit the same asset. Sort by <em>Amplification</em> to
                find the most dangerous compound exposures.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-zinc-300">
                  <thead className="text-zinc-500 border-b border-zinc-800">
                    <tr>
                      <th className="text-left py-2">Asset</th>
                      <th className="text-left py-2">
                        <span title="Simulation step where chains converge (higher = further in the future)">Time Step</span>
                      </th>
                      <th className="text-left py-2">
                        <span title="Which risk chains are colliding at this point">Converging Chains</span>
                      </th>
                      <th className="text-right py-2">
                        <span title="Loss multiplier: how much worse the combined hit is vs. single chains. Above 2.0x = critical.">Amplification</span>
                      </th>
                      <th className="text-right py-2">
                        <span title="Estimated monetary impact of the combined event">Combined Loss</span>
                      </th>
                      <th className="text-left py-2">
                        <span title="Constructive = losses ADD UP (dangerous). Destructive = losses partially CANCEL (less dangerous).">Type</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.interference_zones.slice(0, 15).map((z, i) => (
                      <tr key={i} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                        <td className="py-2 font-mono text-xs">{z.asset_id}</td>
                        <td className="py-2">{z.time_step}</td>
                        <td className="py-2 text-xs">{z.converging_chains.join(', ')}</td>
                        <td className={`py-2 text-right font-bold ${z.amplification_ratio >= 2 ? 'text-red-400' : 'text-amber-400'}`}>
                          {z.amplification_ratio.toFixed(2)}x
                          {z.amplification_ratio >= 2 && <ExclamationTriangleIcon className="w-3.5 h-3.5 inline ml-1" />}
                        </td>
                        <td className="py-2 text-right">{z.combined_loss.toFixed(2)}</td>
                        <td className="py-2">
                          <span className={`px-1.5 py-0.5 rounded text-xs ${z.resonance_type === 'constructive' ? 'bg-red-500/20 text-red-400' : 'bg-blue-500/20 text-blue-400'}`}>
                            {z.resonance_type === 'constructive' ? 'Constructive (amplifies)' : 'Destructive (dampens)'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.interference_zones.length > 15 && (
                <p className="text-xs text-zinc-600 mt-2">Showing top 15 of {data.interference_zones.length} zones.</p>
              )}
            </div>
          )}
        </>
      )}

      {!data && !mutation.isPending && (
        <div className="text-center py-12 text-zinc-600">
          <BoltIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click <strong>"Run Path Integral"</strong> above to generate trajectory analysis</p>
        </div>
      )}
    </div>
  )
}

/* ==================== TUNNELING ==================== */
function TunnelingSection() {
  const mutation = useMutation({ mutationFn: () => scanTunneling([], 15) })
  const data = mutation.data as { scenarios: TunnelingScenario[] } | undefined

  return (
    <div className="space-y-5">
      {/* Methodology */}
      <div className={CC_CARD + ' space-y-3'}>
        <div className="flex items-center gap-2">
          <ShieldExclamationIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Tunneling — Hidden Vulnerability Scanner</h2>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">
          <p>
            <strong className="text-zinc-300">Methodology:</strong> Inspired by quantum tunneling, where particles
            pass through energy barriers that classical physics says are impassable. In risk terms, this finds scenarios
            where <em>seemingly impossible events</em> can bypass your risk controls — "tunneling" through safeguards
            that appear solid.
          </p>
          <p>
            <strong className="text-zinc-300">What it reveals:</strong> Combinations of events that individually
            seem manageable, but together can bypass intermediate risk states (like a borrower going from "investment grade"
            to "default" without passing through warning stages). These are the "black swan" blind spots in your risk framework.
          </p>
          <p>
            <strong className="text-zinc-300">Key metrics to watch:</strong>
          </p>
          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
            <li><strong className="text-zinc-400">Barrier Energy</strong> — How "strong" the protection is. Lower = easier to tunnel through = higher risk.</li>
            <li><strong className="text-zinc-400">Probability</strong> — Estimated chance this tunneling event occurs. Above 5% is a concern; above 15% is critical.</li>
            <li><strong className="text-zinc-400">Bypassed States</strong> — Which normal risk stages are skipped (the "warning signs" you would miss).</li>
          </ul>
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <InfoBox variant="info">
          <strong>What happens when you click:</strong> The system analyzes your portfolio for event combinations
          that can bypass risk controls. It examines all known risk triggers, calculates barrier energies,
          and ranks results by vulnerability. Takes 5-10 seconds.
        </InfoBox>
        <button onClick={() => mutation.mutate()} className={BTN_PRIMARY + ' whitespace-nowrap shrink-0'} disabled={mutation.isPending}>
          {mutation.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-1" /> : <ShieldExclamationIcon className="w-4 h-4 inline mr-1" />}
          Scan for Tunneling Vulnerabilities
        </button>
      </div>

      {mutation.isError && (
        <InfoBox variant="warn">Scan failed. Check API connectivity and retry.</InfoBox>
      )}

      {/* Results */}
      {data?.scenarios && data.scenarios.length > 0 && (
        <>
          <InfoBox variant="warn">
            <strong>{data.scenarios.length} tunneling scenario(s) detected.</strong> Prioritize scenarios with
            barrier energy below 0.3 — these represent the weakest points in your risk framework.
            Review the "Bypassed States" column to understand which early warning stages would be skipped.
          </InfoBox>

          <div className={CC_CARD}>
            <div className="flex items-center gap-2 mb-1">
              <EyeIcon className="w-4 h-4 text-zinc-500" />
              <div className={CC_LABEL}>Tunneling Scenarios (sorted by barrier energy, lowest first)</div>
            </div>
            <p className="text-xs text-zinc-500 mb-3">
              Each scenario shows a combination of triggers that could bypass your defenses. Lower barrier
              energy = weaker protection. The "Explanation" field describes the real-world mechanism.
            </p>
            <div className="space-y-3">
              {data.scenarios.map((s) => (
                <div
                  key={s.scenario_id}
                  className={`rounded border p-3 hover:bg-zinc-800/30 ${
                    s.barrier_energy < 0.3
                      ? 'border-red-500/30 bg-red-500/5'
                      : s.barrier_energy < 0.6
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-zinc-800'
                  }`}
                >
                  <div className="flex justify-between items-start gap-4">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        {s.barrier_energy < 0.3 && <ExclamationTriangleIcon className="w-4 h-4 text-red-400 shrink-0" />}
                        <span className="text-sm font-semibold text-zinc-200">
                          {(s.trigger_combination ?? []).map((t) => t.event.replace(/_/g, ' ')).join(' + ')}
                        </span>
                      </div>
                      <div className="text-xs text-zinc-500">
                        <strong className="text-zinc-400">Bypassed stages:</strong>{' '}
                        {(s.bypassed_states ?? []).join(' → ')}
                      </div>
                      <div className="text-xs text-zinc-600">
                        These are the warning stages your current risk framework expects to see <em>before</em> a
                        critical event — but this scenario skips them entirely.
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className={`text-sm font-bold ${s.barrier_energy < 0.3 ? 'text-red-400' : 'text-amber-400'}`}>
                        Barrier: {s.barrier_energy.toFixed(3)}
                      </div>
                      <div className={`text-xs ${s.probability > 0.15 ? 'text-red-400 font-bold' : s.probability > 0.05 ? 'text-amber-400' : 'text-zinc-500'}`}>
                        P = {(s.probability * 100).toFixed(2)}%
                        {s.probability > 0.15 && ' (HIGH)'}
                      </div>
                    </div>
                  </div>
                  {s.explanation && (
                    <div className="mt-2 p-2 rounded bg-zinc-800/50 text-xs text-zinc-400">
                      <strong className="text-zinc-300">Mechanism:</strong> {s.explanation}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {data?.scenarios && data.scenarios.length === 0 && (
        <InfoBox variant="tip">
          No tunneling vulnerabilities detected. Your risk controls adequately cover known event combinations.
          Re-run periodically as market conditions change.
        </InfoBox>
      )}

      {!data && !mutation.isPending && (
        <div className="text-center py-12 text-zinc-600">
          <ShieldExclamationIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click <strong>"Scan for Tunneling Vulnerabilities"</strong> to detect hidden risk bypass paths</p>
        </div>
      )}
    </div>
  )
}

/* ==================== ENTANGLEMENT ==================== */
function EntanglementSection() {
  const { data: matrix, isLoading, isError } = useQuery<EntanglementMatrix>({
    queryKey: ['entanglement-matrix'],
    queryFn: getEntanglementMatrix,
  })

  const getColor = (v: number) => {
    if (v >= 0.6) return 'bg-red-500/40 text-red-300'
    if (v >= 0.4) return 'bg-amber-500/30 text-amber-300'
    if (v >= 0.2) return 'bg-blue-500/20 text-blue-300'
    return 'bg-zinc-800 text-zinc-500'
  }

  const getLabel = (v: number) => {
    const abs = Math.abs(v)
    if (abs >= 0.6) return 'Strong'
    if (abs >= 0.4) return 'Moderate'
    if (abs >= 0.2) return 'Weak'
    return 'None'
  }

  return (
    <div className="space-y-5">
      {/* Methodology */}
      <div className={CC_CARD + ' space-y-3'}>
        <div className="flex items-center gap-2">
          <LinkIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Entanglement — Cross-Domain Correlation Map</h2>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">
          <p>
            <strong className="text-zinc-300">Methodology:</strong> Inspired by quantum entanglement, where measuring
            one particle instantly affects its paired particle. This tool measures how strongly different risk domains
            (climate, financial, geopolitical, cyber, etc.) are "entangled" — when one domain experiences a shock,
            how strongly do the others react?
          </p>
          <p>
            <strong className="text-zinc-300">What it reveals:</strong> Hidden dependencies between risk domains.
            A portfolio may appear diversified, but if climate risk and financial risk are strongly entangled (correlation
            &gt; 0.6), a climate event will simultaneously trigger financial losses — defeating the purpose of diversification.
          </p>
          <p>
            <strong className="text-zinc-300">How to read the matrix:</strong>
          </p>
          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
            <li><span className="inline-block w-3 h-3 rounded bg-red-500/40 align-middle mr-1" /> <strong className="text-red-300">Red (≥ 0.6)</strong> — Strong entanglement. These domains move together. Diversification between them is ineffective.</li>
            <li><span className="inline-block w-3 h-3 rounded bg-amber-500/30 align-middle mr-1" /> <strong className="text-amber-300">Amber (0.4 – 0.6)</strong> — Moderate. Partial correlation. Monitor for trend strengthening.</li>
            <li><span className="inline-block w-3 h-3 rounded bg-blue-500/20 align-middle mr-1" /> <strong className="text-blue-300">Blue (0.2 – 0.4)</strong> — Weak correlation. Generally independent.</li>
            <li><span className="inline-block w-3 h-3 rounded bg-zinc-800 align-middle mr-1" /> <strong className="text-zinc-400">Gray (&lt; 0.2)</strong> — No significant correlation. True diversification.</li>
          </ul>
        </div>
      </div>

      {/* Data loads automatically */}
      <InfoBox variant="info">
        This matrix loads automatically from the latest portfolio correlation analysis.
        Focus on <strong>red cells (≥ 0.6)</strong> — these are pairs of risk domains that will amplify each other during a crisis.
        If you see a red cell between two domains where you hold significant exposure, consider rebalancing.
      </InfoBox>

      {isLoading && (
        <div className="text-center py-8 text-zinc-500">
          <ArrowPathIcon className="w-8 h-8 mx-auto mb-2 animate-spin opacity-30" />
          <p className="text-sm">Loading correlation matrix...</p>
        </div>
      )}

      {isError && (
        <InfoBox variant="warn">Failed to load entanglement matrix. Ensure the API is running.</InfoBox>
      )}

      {matrix && (
        <div className={CC_CARD + ' overflow-x-auto'}>
          <div className="flex items-center gap-2 mb-3">
            <EyeIcon className="w-4 h-4 text-zinc-500" />
            <div className={CC_LABEL}>Cross-Domain Entanglement Matrix</div>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr>
                <th className="py-2 px-3 text-left text-zinc-500">Domain</th>
                {matrix.domains.map((d) => (
                  <th key={d} className="py-2 px-3 text-center text-zinc-400 capitalize">{d}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.domains.map((row, ri) => (
                <tr key={row}>
                  <td className="py-2 px-3 text-zinc-400 capitalize font-medium">{row}</td>
                  {matrix.matrix[ri].map((val, ci) => (
                    <td key={ci} className="py-2 px-3 text-center">
                      <span
                        className={`px-2 py-1 rounded ${getColor(Math.abs(val))} font-mono cursor-default`}
                        title={`${row} ↔ ${matrix.domains[ci]}: ${getLabel(val)} correlation (${val.toFixed(3)})`}
                      >
                        {val.toFixed(2)}
                      </span>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {matrix && (
        <InfoBox variant="tip">
          <strong>Next step:</strong> For any strongly entangled pair (red), go to the
          <em> Tunneling</em> tab to check if those domains share bypass vulnerabilities.
          Then use <em>Uncertainty</em> to see how the correlation evolves over time.
        </InfoBox>
      )}
    </div>
  )
}

/* ==================== SWARM ==================== */
function SwarmSection() {
  const mutation = useMutation({ mutationFn: () => deploySwarm(50, 120) })
  const data = mutation.data as SwarmResult | undefined

  return (
    <div className="space-y-5">
      {/* Methodology */}
      <div className={CC_CARD + ' space-y-3'}>
        <div className="flex items-center gap-2">
          <CpuChipIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Swarm — Particle Swarm Optimization Analysis</h2>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">
          <p>
            <strong className="text-zinc-300">Methodology:</strong> Deploys a swarm of 50 "particles" (virtual
            agents) that independently explore the risk landscape. Each particle searches for the worst-case loss
            scenario from a random starting position. Where multiple particles converge on the same point, it
            confirms a genuine risk concentration — not a statistical fluke.
          </p>
          <p>
            <strong className="text-zinc-300">What it reveals:</strong> Two things: (1) <em>convergence points</em> —
            confirmed high-risk zones where multiple independent searches agree, and (2) <em>black swan particles</em> —
            isolated extreme outliers that found catastrophic scenarios no other particle reached.
          </p>
          <p>
            <strong className="text-zinc-300">Key metrics:</strong>
          </p>
          <ul className="list-disc list-inside text-xs text-zinc-500 space-y-1">
            <li><strong className="text-zinc-400">Convergence Points</strong> — Where particles agree. More = higher confidence in identified risk.</li>
            <li><strong className="text-zinc-400">Black Swans (z &gt; 2.5)</strong> — Outlier particles that found extreme scenarios. Even one is worth investigating.</li>
            <li><strong className="text-zinc-400">Explained Variance</strong> — How much of the total risk landscape the swarm covered. Above 80% = thorough. Below 60% = consider re-running with more particles.</li>
          </ul>
        </div>
      </div>

      {/* Action */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <InfoBox variant="info">
          <strong>What happens when you click:</strong> 50 virtual agents independently explore your risk landscape
          over 120 iterations. They share their findings to converge on the most dangerous scenarios.
          Results include convergence confidence and black swan detection. Takes 10-20 seconds.
        </InfoBox>
        <button onClick={() => mutation.mutate()} className={BTN_PRIMARY + ' whitespace-nowrap shrink-0'} disabled={mutation.isPending}>
          {mutation.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-1" /> : <CpuChipIcon className="w-4 h-4 inline mr-1" />}
          Deploy Swarm (50 particles)
        </button>
      </div>

      {mutation.isError && (
        <InfoBox variant="warn">Swarm deployment failed. Check API connectivity and retry.</InfoBox>
      )}

      {/* Results */}
      {data && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <MetricCard
              label="Particles Deployed"
              value={data.num_particles}
              hint="Number of independent search agents exploring your risk landscape. More particles = more thorough coverage but longer processing time."
            />
            <MetricCard
              label="Convergence Points"
              value={data.convergence_points?.length || 0}
              hint="Locations in the risk space where multiple particles independently converged — confirmed risk concentrations. More convergence points = more identified risk pockets."
              color="text-amber-400"
            />
            <MetricCard
              label="Black Swans"
              value={data.black_swans?.length || 0}
              hint="Extreme outlier particles (z-score > 2.5) that found catastrophic scenarios far from where other particles converged. Even 1 black swan warrants investigation — it may represent a tail risk your models don't capture."
              color="text-red-400"
            />
            <MetricCard
              label="Explained Variance"
              value={`${(data.explained_variance * 100).toFixed(1)}%`}
              hint="Percentage of the total risk landscape the swarm successfully explored. Above 80% = comprehensive coverage. Below 60% = significant unexplored risk territory, consider re-running with more particles."
              color="text-emerald-400"
            />
          </div>

          {data.explained_variance < 0.6 && (
            <InfoBox variant="warn">
              <strong>Low coverage warning:</strong> The swarm only explored {(data.explained_variance * 100).toFixed(0)}%
              of the risk landscape. Consider re-running the analysis — there may be significant risk pockets
              that were not reached.
            </InfoBox>
          )}

          {data.black_swans && data.black_swans.length > 0 && (
            <div className={CC_CARD}>
              <div className="flex items-center gap-2 mb-1">
                <ExclamationTriangleIcon className="w-4 h-4 text-red-400" />
                <div className={CC_LABEL}>Black Swan Particles (z-score &gt; 2.5 — extreme outliers)</div>
              </div>
              <p className="text-xs text-zinc-500 mb-3">
                These particles found catastrophic scenarios that no other particle reached.
                The higher the z-score, the more anomalous the scenario.
                Each should be reviewed manually — they may represent genuine tail risks or model artifacts.
              </p>
              <div className="space-y-2">
                {data.black_swans.map((bs: any, i: number) => (
                  <div key={i} className="flex justify-between items-center rounded border border-red-500/20 bg-red-500/5 p-3">
                    <div>
                      <span className="text-sm text-zinc-300 font-mono">{bs.particle_id}</span>
                      <span className="text-xs text-zinc-600 ml-2">Particle ID</span>
                    </div>
                    <div className="text-right space-y-0.5">
                      <div className="text-sm text-red-400 font-bold">z-score: {bs.z_score}</div>
                      <div className="text-xs text-zinc-400">
                        Est. Loss: {bs.final_loss?.toLocaleString() || 'N/A'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {(!data.black_swans || data.black_swans.length === 0) && (
            <InfoBox variant="tip">
              No black swan particles detected. All search agents converged within normal bounds. Your risk
              landscape does not exhibit extreme outlier scenarios under current parameters.
            </InfoBox>
          )}
        </>
      )}

      {!data && !mutation.isPending && (
        <div className="text-center py-12 text-zinc-600">
          <CpuChipIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Click <strong>"Deploy Swarm"</strong> to search for risk concentrations and black swan scenarios</p>
        </div>
      )}
    </div>
  )
}

/* ==================== UNCERTAINTY ==================== */
function UncertaintySection() {
  const [score, setScore] = useState(65)
  const [years, setYears] = useState(30)
  const [scoreType, setScoreType] = useState('climate')
  const mutation = useMutation({
    mutationFn: () => degradeRiskScore(score, years, scoreType),
  })
  const data = mutation.data as UncertaintyResult | undefined

  const scoreTypeDescriptions: Record<string, string> = {
    climate: 'Physical climate risk — sea level, temperature, extreme weather frequency',
    financial: 'Market and credit risk — interest rates, defaults, liquidity',
    structural: 'Infrastructure integrity — building degradation, material fatigue',
    operational: 'Business continuity — process failures, human error, supply chain',
    geopolitical: 'Political stability — sanctions, regime change, conflict',
  }

  return (
    <div className="space-y-5">
      {/* Methodology */}
      <div className={CC_CARD + ' space-y-3'}>
        <div className="flex items-center gap-2">
          <ChartBarIcon className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-semibold text-zinc-200">Uncertainty — Risk Score Degradation Projector</h2>
        </div>
        <div className="text-sm text-zinc-400 leading-relaxed space-y-2">
          <p>
            <strong className="text-zinc-300">Methodology:</strong> Inspired by the Heisenberg uncertainty principle —
            the further into the future you project a risk score, the wider the uncertainty band becomes. This tool
            calculates how quickly your confidence in a risk assessment degrades over time, and shows the full range
            of possible future values.
          </p>
          <p>
            <strong className="text-zinc-300">What it reveals:</strong> How reliable your current risk scores will be
            in 5, 10, or 30 years. A score of 65 today might mean anything from 30 to 95 in 30 years — this tool
            quantifies exactly how wide that uncertainty band is for each risk type.
          </p>
          <p>
            <strong className="text-zinc-300">Practical use:</strong> Use this to determine your capital reserve
            planning horizon. If the uncertainty band exceeds your risk tolerance within 10 years, you need more
            frequent reassessment cycles. If the band stays narrow for 20+ years, your current assessment frequency
            is adequate.
          </p>
        </div>
      </div>

      {/* Input form */}
      <div className={CC_CARD}>
        <div className="flex items-center gap-2 mb-4">
          <InformationCircleIcon className="w-4 h-4 text-zinc-500" />
          <span className="text-xs text-zinc-500">Configure your projection parameters below, then click Calculate</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div>
            <label htmlFor="risk-score" className={CC_LABEL}>Current Risk Score (0–100)</label>
            <input
              type="number"
              value={score}
              onChange={(e) => setScore(Number(e.target.value))}
              className="mt-1 w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm"
              id="risk-score"
              name="risk-score"
              min={0}
              max={100}
            />
            <p className="text-[10px] text-zinc-600 mt-1">Your asset's current assessed risk level</p>
          </div>
          <div>
            <label htmlFor="projection-years" className={CC_LABEL}>Projection Horizon (years)</label>
            <input
              type="number"
              value={years}
              onChange={(e) => setYears(Number(e.target.value))}
              className="mt-1 w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm"
              id="projection-years"
              name="projection-years"
              min={1}
              max={100}
            />
            <p className="text-[10px] text-zinc-600 mt-1">How far ahead to project uncertainty</p>
          </div>
          <div>
            <label htmlFor="score-type" className={CC_LABEL}>Risk Type</label>
            <select
              value={scoreType}
              onChange={(e) => setScoreType(e.target.value)}
              className="mt-1 w-full rounded bg-zinc-800 border border-zinc-700 text-zinc-100 px-3 py-2 text-sm"
              id="score-type"
              name="score-type"
            >
              <option value="climate">Climate</option>
              <option value="financial">Financial</option>
              <option value="structural">Structural</option>
              <option value="operational">Operational</option>
              <option value="geopolitical">Geopolitical</option>
            </select>
            <p className="text-[10px] text-zinc-600 mt-1">{scoreTypeDescriptions[scoreType]}</p>
          </div>
          <button onClick={() => mutation.mutate()} className={BTN_PRIMARY} disabled={mutation.isPending}>
            {mutation.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin inline mr-1" /> : null}
            Calculate Degradation
          </button>
        </div>
      </div>

      {mutation.isError && (
        <InfoBox variant="warn">Calculation failed. Check API connectivity and retry.</InfoBox>
      )}

      {/* Results */}
      {data && (
        <>
          <div className={CC_CARD}>
            <div className="flex items-center gap-2 mb-1">
              <EyeIcon className="w-4 h-4 text-zinc-500" />
              <div className={CC_LABEL}>Uncertainty Band ({(data.confidence_level * 100).toFixed(0)}% Confidence Interval)</div>
            </div>
            <p className="text-xs text-zinc-500 mb-4">
              The band shows the range of possible risk scores after {years} years.
              The amber line marks the central (most likely) estimate. The shaded area covers
              {' '}{(data.confidence_level * 100).toFixed(0)}% of possible outcomes.
            </p>

            {/* Visual bar */}
            <div className="relative h-20 bg-zinc-800 rounded overflow-hidden">
              {/* Scale markers */}
              {[0, 25, 50, 75, 100].map((mark) => (
                <div key={mark} className="absolute top-0 bottom-0 w-px bg-zinc-700/50" style={{ left: `${mark}%` }}>
                  <span className="absolute -top-0 text-[9px] text-zinc-600" style={{ transform: 'translateX(-50%)' }}>{mark}</span>
                </div>
              ))}
              {/* CI band */}
              <div
                className="absolute inset-y-3 bg-amber-500/20 border-l border-r border-amber-500/40"
                style={{
                  left: `${Math.max(0, data.lower_bound)}%`,
                  width: `${Math.min(100, data.upper_bound) - Math.max(0, data.lower_bound)}%`,
                }}
              />
              {/* Central estimate marker */}
              <div
                className="absolute inset-y-2 w-0.5 bg-amber-400"
                style={{ left: `${data.central_estimate}%` }}
              />
              {/* Labels */}
              <div className="absolute bottom-1 text-xs font-mono text-zinc-400" style={{ left: `${Math.max(0, data.lower_bound)}%`, transform: 'translateX(-50%)' }}>
                {data.lower_bound.toFixed(1)}
              </div>
              <div className="absolute bottom-1 text-xs font-mono text-zinc-400" style={{ left: `${Math.min(100, data.upper_bound)}%`, transform: 'translateX(-50%)' }}>
                {data.upper_bound.toFixed(1)}
              </div>
              <div
                className="absolute top-7 text-xs font-bold text-amber-400"
                style={{ left: `${data.central_estimate}%`, transform: 'translateX(-50%)' }}
              >
                {data.central_estimate}
              </div>
            </div>

            {/* Summary stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Central Estimate</div>
                <div className="text-lg font-bold text-amber-400">{data.central_estimate}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Band Width</div>
                <div className="text-lg font-bold text-zinc-200">{(data.upper_bound - data.lower_bound).toFixed(1)} pts</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Degradation Factor</div>
                <div className="text-lg font-bold text-zinc-200">{data.degradation_factor.toFixed(4)}</div>
              </div>
              <div>
                <div className="text-[10px] text-zinc-500 uppercase">Projection</div>
                <div className="text-lg font-bold text-zinc-200">{years}y / {scoreType}</div>
              </div>
            </div>
          </div>

          {/* Interpretation */}
          {(data.upper_bound - data.lower_bound) > 40 ? (
            <InfoBox variant="warn">
              <strong>Wide uncertainty band ({(data.upper_bound - data.lower_bound).toFixed(1)} points).</strong>{' '}
              Your {scoreType} risk score becomes unreliable over a {years}-year horizon. Consider: (1) shortening
              your reassessment cycle, (2) adding more data sources to reduce baseline uncertainty, or
              (3) hedging against the upper bound scenario ({data.upper_bound.toFixed(1)}).
            </InfoBox>
          ) : (data.upper_bound - data.lower_bound) > 20 ? (
            <InfoBox variant="info">
              <strong>Moderate uncertainty ({(data.upper_bound - data.lower_bound).toFixed(1)} points).</strong>{' '}
              Your {scoreType} risk score retains reasonable predictive power over {years} years, but plan for
              the possibility of scores reaching {data.upper_bound.toFixed(1)} in adverse conditions.
            </InfoBox>
          ) : (
            <InfoBox variant="tip">
              <strong>Narrow uncertainty band ({(data.upper_bound - data.lower_bound).toFixed(1)} points).</strong>{' '}
              Your {scoreType} risk score is highly stable over {years} years. Current assessment frequency
              and data quality are adequate. No immediate action required.
            </InfoBox>
          )}
        </>
      )}

      {!data && !mutation.isPending && (
        <div className="text-center py-12 text-zinc-600">
          <ChartBarIcon className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Configure parameters above and click <strong>"Calculate Degradation"</strong> to see uncertainty projection</p>
        </div>
      )}
    </div>
  )
}
