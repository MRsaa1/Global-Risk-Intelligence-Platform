/**
 * BOARD MODE
 * ===========
 * 
 * Board-ready executive summary with 5-slide narrative.
 * 
 * Slides:
 * 1. Portfolio Risk Posture (how bad?)
 * 2. What Drives the Risk (why now?)
 * 3. Where Capital Is Exposed (where losses?)
 * 4. What We Can Do (mitigation ROI)
 * 5. Decisions Requested (Board asks)
 * 
 * Features:
 * - PDF/Static export for Board deck
 * - Minimal design, maximum signal
 * - Every metric → €
 */

import { useState, useRef, useMemo, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowLeftIcon, 
  DocumentArrowDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  PlayIcon,
  PauseIcon,
} from '@heroicons/react/24/outline'
import { usePlatformStore } from '../store/platformStore'
import { BOARD_DISCLAIMER } from '../constants/regulatoryDisclaimers'
import WarRoomCard from '../components/dashboard/WarRoomCard'

// Slide type
interface BoardSlide {
  id: number
  title: string
  subtitle: string
  content: React.ReactNode
}

// Default data (fallback if APIs are unavailable)
const boardDataDefaults = {
  posture: { level: 'ELEVATED', color: 'text-orange-500' },
  drivers: [
    { name: 'Flood & Heat (Physical)', pct: 43, color: 'bg-red-500' },
    { name: 'Network / Supply Chain', pct: 31, color: 'bg-orange-500' },
    { name: 'Energy & Grid Stress', pct: 18, color: 'bg-amber-500' },
    { name: 'Residual / Other', pct: 8, color: 'bg-zinc-400' },
  ],
  topExposures: [] as { asset: string; loss: number; driver: string }[],
  mitigation: {
    totalCost: 0, lossAvoided: 0, roi: 0, timeToImpact: '—',
    topActions: [] as { action: string; cost: number; lossAvoided: number; roi: number }[],
  },
  decisions: [
    { decision: 'Review mitigation CAPEX approval', priority: 'critical', deadline: '—' },
    { decision: 'Rebalance high-exposure regions', priority: 'high', deadline: '—' },
    { decision: 'Mandate quarterly stress tests', priority: 'medium', deadline: '—' },
  ],
}

function getRiskPosture(weightedRisk: number) {
  if (weightedRisk > 0.7) return { level: 'CRITICAL', color: 'text-red-500' }
  if (weightedRisk > 0.5) return { level: 'ELEVATED', color: 'text-orange-500' }
  if (weightedRisk > 0.4) return { level: 'MODERATE', color: 'text-amber-400/80' }
  return { level: 'STABLE', color: 'text-emerald-400/80' }
}

export default function BoardMode() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const portfolio = usePlatformStore((s) => s.portfolioConfirmed)
  const setPortfolioConfirmed = usePlatformStore((s) => s.setPortfolioConfirmed)
  const [boardData, setBoardData] = useState(boardDataDefaults)

  useEffect(() => {
    let cancelled = false
    // Fetch portfolio summary
    fetch('/api/v1/geodata/summary')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !cancelled) {
          const momFromSummary = data.risk_velocity_mom_pct ?? null
          setPortfolioConfirmed({
            totalExposure: data.total_exposure ?? 0,
            atRisk: data.at_risk_exposure ?? 0,
            totalExpectedLoss: data.total_expected_loss,
            criticalCount: data.critical_count ?? 0,
            highCount: data.high_count ?? 0,
            mediumCount: data.medium_count ?? 0,
            lowCount: data.low_count ?? 0,
            weightedRisk: data.weighted_risk ?? 0,
            riskVelocityMomPct: momFromSummary,
          })
          // Only fetch risk-velocity when summary didn't return MoM (avoids flicker + extra request)
          if (momFromSummary == null) {
            fetch('/api/v1/risk-engine/risk-velocity')
              .then((vr) => vr.ok ? vr.json() : null)
              .then((velData) => {
                if (velData?.risk_velocity?.mom_pct != null && !cancelled && typeof velData.risk_velocity.mom_pct === 'number') {
                  usePlatformStore.getState().updatePortfolio({ riskVelocityMomPct: velData.risk_velocity.mom_pct })
                }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})

    // Fetch auto-recommendations for Slides 4 & 5
    fetch('/api/v1/risk-engine/recommendations/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_type: 'climate', total_loss_m: 200, severity: 0.6 }),
    })
      .then((r) => r.ok ? r.json() : null)
      .then((plan) => {
        if (plan && !cancelled) {
          const recs = plan.recommendations || []
          setBoardData((prev) => ({
            ...prev,
            mitigation: {
              totalCost: Math.round(plan.total_mitigation_cost_m ?? 0),
              lossAvoided: Math.round(plan.total_loss_avoided_m ?? 0),
              roi: Math.round((plan.overall_roi ?? 0) * 10) / 10,
              timeToImpact: recs[0]?.time_to_implement || '30-90 days',
              topActions: recs.slice(0, 4).map((r: any) => ({
                action: r.title,
                cost: Math.round(r.estimated_cost_m ?? 0),
                lossAvoided: Math.round(r.estimated_loss_avoided_m ?? 0),
                roi: Math.round((r.roi ?? 0) * 10) / 10,
              })),
            },
            decisions: recs.filter((r: any) => r.priority === 'critical' || r.priority === 'high')
              .slice(0, 3)
              .map((r: any) => ({
                decision: r.title,
                priority: r.priority,
                deadline: r.time_to_implement || '—',
              })),
          }))
        }
      })
      .catch(() => {})

    // Fetch top risk assets for Slide 3
    fetch('/api/v1/assets?sort_by=risk_score&order=desc&limit=5')
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data && !cancelled) {
          const assets = (data.assets || data.items || data || []).slice(0, 5)
          if (assets.length > 0) {
            setBoardData((prev) => ({
              ...prev,
              topExposures: assets.map((a: any) => ({
                asset: a.name || a.asset_name || 'Unknown',
                loss: Math.round((a.current_valuation || 0) / 1e6 * (a.climate_risk_score || 50) / 100),
                driver: a.asset_type || 'Multi-risk',
              })),
            }))
          }
        }
      })
      .catch(() => {})

    return () => { cancelled = true }
  }, [setPortfolioConfirmed])

  const postureKPIs = useMemo(() => {
    const capitalAtRisk = portfolio.atRisk ?? 0
    const stressLossP95 = typeof portfolio.totalExpectedLoss === 'number' && portfolio.totalExpectedLoss > 0
      ? Math.round(portfolio.totalExpectedLoss)
      : capitalAtRisk > 0 ? Math.round(capitalAtRisk * 0.75) : 0
    const posture = getRiskPosture(portfolio.weightedRisk ?? 0)
    const mom = portfolio.riskVelocityMomPct
    const riskVelocityLabel = typeof mom === 'number' ? `${mom >= 0 ? '+' : ''}${mom}% MoM` : '—'
    return {
      capitalAtRisk,
      stressLossP95,
      posture,
      capitalAtRiskChange: '—',
      stressLossP95Pct: '—',
      riskVelocityLabel,
    }
  }, [portfolio])

  // Define slides
  const slides: BoardSlide[] = [
    // Slide 0: War Room Card
    {
      id: 0,
      title: 'War Room',
      subtitle: '3 risks · 3 actions · 1 priority',
      content: (
        <div className="max-w-2xl mx-auto">
          <WarRoomCard />
        </div>
      ),
    },
    // Slide 1: Portfolio Risk Posture
    {
      id: 1,
      title: 'Portfolio Risk Posture',
      subtitle: 'How bad?',
      content: (
        <div className="space-y-8">
          <div className="text-center">
            <div className={`text-7xl font-bold tracking-tight mb-2 ${postureKPIs.posture.color}`}>
              {postureKPIs.posture.level}
            </div>
            <div className="flex items-center justify-center gap-2 text-orange-400/80">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-lg">Risk from live portfolio</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-8 mt-12">
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Capital at Risk (30d)</div>
              <div className="text-4xl font-light font-mono tabular-nums text-zinc-100">€{postureKPIs.capitalAtRisk}M</div>
              {postureKPIs.capitalAtRiskChange !== '—' && (
                <div className="text-red-400/80 text-sm mt-1">{postureKPIs.capitalAtRiskChange}</div>
              )}
            </div>
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Stress Loss (P95)</div>
              <div className="text-4xl font-light font-mono tabular-nums text-zinc-100">€{postureKPIs.stressLossP95}M</div>
              {postureKPIs.stressLossP95Pct !== '—' && (
                <div className="text-orange-400/80 text-sm mt-1">{postureKPIs.stressLossP95Pct}</div>
              )}
            </div>
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Risk Velocity</div>
              <div className={`text-4xl font-light ${postureKPIs.riskVelocityLabel !== '—' ? 'text-red-400/80' : 'text-zinc-500'}`}>
                {postureKPIs.riskVelocityLabel}
              </div>
              <div className="text-zinc-400 text-sm mt-1">Month-over-month</div>
            </div>
          </div>
          
          <div className="text-center mt-8 text-zinc-400 text-lg">
            "Risk is not only high, it is accelerating."
          </div>
        </div>
      ),
    },
    
    // Slide 2: What Drives the Risk
    {
      id: 2,
      title: 'What Drives the Risk',
      subtitle: 'Why now?',
      content: (
        <div className="space-y-8">
          <div className="max-w-2xl mx-auto">
            {boardData.drivers.map((driver, i) => (
              <div key={i} className="mb-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-zinc-100 text-lg">{driver.name}</span>
                  <span className="text-zinc-100 font-bold text-xl">{driver.pct}%</span>
                </div>
                <div className="h-4 bg-zinc-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${driver.pct}%` }}
                    transition={{ duration: 0.8, delay: i * 0.2 }}
                    className={`h-full ${driver.color} rounded-full`}
                  />
                </div>
              </div>
            ))}
          </div>
          
          <div className="text-center mt-12 p-6 bg-zinc-800/50 rounded-md max-w-xl mx-auto">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Key Insight</div>
            <div className="text-zinc-100 text-xl">
              This is not abstract climate risk — these are{' '}
              <span className="text-orange-400/80 font-semibold">concrete nodes and assets</span>.
            </div>
          </div>
        </div>
      ),
    },
    
    // Slide 3: Where Capital Is Exposed
    {
      id: 3,
      title: 'Where Capital Is Exposed',
      subtitle: 'Where are we losing money?',
      content: (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Top 5 Assets = Total Exposure</div>
            <div className="text-5xl font-light font-mono tabular-nums text-red-400/80">€{boardData.topExposures.reduce((sum, e) => sum + e.loss, 0)}M</div>
          </div>
          
          <table className="w-full max-w-3xl mx-auto">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Rank</th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Asset</th>
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Driver</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Expected Loss</th>
              </tr>
            </thead>
            <tbody>
              {boardData.topExposures.map((exp, i) => (
                <tr key={i} className="border-b border-zinc-800">
                  <td className="py-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400/80 font-bold">
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-4 text-zinc-100 text-lg">{exp.asset}</td>
                  <td className="py-4 text-zinc-400">{exp.driver}</td>
                  <td className="py-4 text-right text-red-400/80 text-xl font-semibold">€{exp.loss}M</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="text-center mt-8 text-zinc-400 text-lg">
            "Risk is concentrated, not diversified."
          </div>
        </div>
      ),
    },
    
    // Slide 4: What We Can Do
    {
      id: 4,
      title: 'What We Can Do',
      subtitle: 'Mitigation ROI',
      content: (
        <div className="space-y-8">
          <div className="grid grid-cols-4 gap-6 mb-8">
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Mitigation Cost</div>
              <div className="text-3xl font-light font-mono tabular-nums text-amber-400/80">€{boardData.mitigation.totalCost}M</div>
            </div>
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Loss Avoided (P95)</div>
              <div className="text-3xl font-light font-mono tabular-nums text-emerald-400/80">€{boardData.mitigation.lossAvoided}M</div>
            </div>
            <div className="text-center p-6 bg-emerald-500/20 rounded-md border border-emerald-500/30">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">ROI</div>
              <div className="text-4xl font-bold font-mono tabular-nums text-emerald-400/80">{boardData.mitigation.roi}x</div>
            </div>
            <div className="text-center p-6 bg-zinc-800/50 rounded-md">
              <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Time to Impact</div>
              <div className="text-3xl font-light font-mono tabular-nums text-zinc-100">{boardData.mitigation.timeToImpact}</div>
            </div>
          </div>
          
          <table className="w-full max-w-3xl mx-auto">
            <thead>
              <tr className="border-b border-zinc-700">
                <th className="text-left font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Action</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Cost</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">Loss Avoided</th>
                <th className="text-right font-mono text-[10px] uppercase tracking-widest text-zinc-500 pb-3">ROI</th>
              </tr>
            </thead>
            <tbody>
              {boardData.mitigation.topActions.map((action, i) => (
                <tr key={i} className="border-b border-zinc-800">
                  <td className="py-3 text-zinc-100">{action.action}</td>
                  <td className="py-3 text-right text-amber-400/80">€{action.cost}M</td>
                  <td className="py-3 text-right text-emerald-400/80">€{action.lossAvoided}M</td>
                  <td className="py-3 text-right text-emerald-400/80 font-semibold">{action.roi}x</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="text-center mt-8 text-zinc-400 text-lg">
            "This is an investment decision, not an insurance case."
          </div>
        </div>
      ),
    },
    
    // Slide 5: Decisions Requested
    {
      id: 5,
      title: 'Decisions Requested',
      subtitle: 'What we need from the Board',
      content: (
        <div className="space-y-8 max-w-3xl mx-auto">
          {boardData.decisions.map((dec, i) => (
            <div 
              key={i} 
              className={`p-6 rounded-md border ${
                dec.priority === 'critical' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : dec.priority === 'high'
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-zinc-700 text-zinc-100 font-bold text-lg">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-zinc-100 text-xl font-medium mb-1">{dec.decision}</div>
                    <div className="text-zinc-400 text-sm">Deadline: {dec.deadline}</div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${
                  dec.priority === 'critical' 
                    ? 'bg-red-500/20 text-red-400/80' 
                    : dec.priority === 'high'
                    ? 'bg-orange-500/20 text-orange-400/80'
                    : 'bg-amber-500/20 text-amber-400/80'
                }`}>
                  {dec.priority}
                </span>
              </div>
            </div>
          ))}
          
          <div className="text-center mt-12 p-6 bg-zinc-800/50 rounded-md">
            <div className="text-zinc-100 text-xl mb-2">
              Total Investment Required
            </div>
            <div className="text-4xl font-bold font-mono tabular-nums text-amber-400/80">€60M</div>
            <div className="text-zinc-400 mt-2">Expected ROI: 3.8x over 12 months</div>
          </div>
        </div>
      ),
    },
  ]

  const nextSlide = () => {
    setCurrentSlide((prev) => (prev + 1) % slides.length)
  }

  const prevSlide = () => {
    setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length)
  }

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight' || e.key === ' ') {
      nextSlide()
    } else if (e.key === 'ArrowLeft') {
      prevSlide()
    }
  }

  const currentSlideData = slides[currentSlide]

  return (
    <div 
      ref={containerRef}
      className="min-h-screen bg-zinc-950 text-zinc-100"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 border-b border-zinc-800 px-8 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="p-2 rounded-md hover:bg-zinc-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-zinc-400" />
            </Link>
            <div>
              <h1 className="text-lg font-display font-semibold text-zinc-100">Board Presentation</h1>
              <p className="text-xs text-zinc-400">Executive Risk Summary</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Slide indicator */}
            <div className="flex items-center gap-2">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`w-2 h-2 rounded-full transition-colors ${
                    i === currentSlide ? 'bg-white' : 'bg-zinc-600 hover:bg-zinc-500'
                  }`}
                />
              ))}
            </div>
            
            <div className="text-zinc-400 text-sm">
              {currentSlide + 1} / {slides.length}
            </div>
            
            {/* Export */}
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-zinc-900 text-sm font-medium rounded-md hover:bg-zinc-100 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Regulatory disclaimer (Gap X2) */}
      <div className="fixed top-[52px] left-0 right-0 z-40 border-b border-zinc-700 bg-zinc-800/80 px-8 py-2">
        <p className="text-xs text-zinc-500 text-center max-w-4xl mx-auto">
          {BOARD_DISCLAIMER}
        </p>
      </div>

      {/* Slide Content */}
      <main className="pt-32 pb-24 px-8">
        <div className="max-w-6xl mx-auto">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentSlide}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="min-h-[70vh]"
            >
              {/* Slide header */}
              <div className="text-center mb-12">
                <div className="text-zinc-500 text-sm uppercase tracking-wider mb-2">
                  Slide {currentSlideData.id} • {currentSlideData.subtitle}
                </div>
                <h2 className="text-4xl font-bold text-zinc-100">{currentSlideData.title}</h2>
              </div>
              
              {/* Slide content */}
              {currentSlideData.content}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-zinc-950/80 border-t border-zinc-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Previous
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="p-3 rounded-full bg-zinc-800 hover:bg-zinc-700 transition-colors"
            >
              {isAutoPlay ? (
                <PauseIcon className="w-5 h-5" />
              ) : (
                <PlayIcon className="w-5 h-5" />
              )}
            </button>
          </div>
          
          <button
            onClick={nextSlide}
            disabled={currentSlide === slides.length - 1}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  )
}
