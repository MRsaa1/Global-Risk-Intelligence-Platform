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

import { useState, useRef } from 'react'
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

// Slide type
interface BoardSlide {
  id: number
  title: string
  subtitle: string
  content: React.ReactNode
}

// Mock data for board presentation
const boardData = {
  posture: {
    level: 'ELEVATED',
    color: 'text-orange-500',
    capitalAtRisk: 420, // €M
    capitalAtRiskChange: '+€65M WoW',
    stressLossP95: 315, // €M
    stressLossP95Change: '+11%',
    riskVelocity: 22, // %
    velocityDirection: 'up',
  },
  drivers: [
    { name: 'Flood & Heat (Physical)', pct: 43, color: 'bg-red-500' },
    { name: 'Network / Supply Chain', pct: 31, color: 'bg-orange-500' },
    { name: 'Energy & Grid Stress', pct: 18, color: 'bg-amber-500' },
    { name: 'Residual / Other', pct: 8, color: 'bg-slate-400' },
  ],
  topExposures: [
    { asset: 'Kyiv Data Center', loss: 48, driver: 'Flood' },
    { asset: 'Texas Grid Node', loss: 46, driver: 'Heat' },
    { asset: 'HK Logistics Hub', loss: 42, driver: 'Network' },
    { asset: 'Singapore Marina', loss: 38, driver: 'Storm' },
    { asset: 'Frankfurt Tower', loss: 35, driver: 'Heat' },
  ],
  mitigation: {
    totalCost: 58, // €M
    lossAvoided: 221, // €M
    roi: 3.8,
    timeToImpact: '30-90 days',
    topActions: [
      { action: 'Relocate Kyiv DC backup', cost: 12, lossAvoided: 42, roi: 3.5 },
      { action: 'Grid hardening Texas', cost: 18, lossAvoided: 68, roi: 3.8 },
      { action: 'Supplier diversification', cost: 15, lossAvoided: 52, roi: 3.5 },
      { action: 'Insurance coverage increase', cost: 8, lossAvoided: 35, roi: 4.4 },
    ],
  },
  decisions: [
    { decision: 'Approve €60M mitigation CAPEX', priority: 'critical', deadline: '2026-02-15' },
    { decision: 'Rebalance exposure in 3 regions', priority: 'high', deadline: '2026-03-01' },
    { decision: 'Mandate quarterly physical risk stress tests', priority: 'medium', deadline: '2026-03-31' },
  ],
}

export default function BoardMode() {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isAutoPlay, setIsAutoPlay] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Define slides
  const slides: BoardSlide[] = [
    // Slide 1: Portfolio Risk Posture
    {
      id: 1,
      title: 'Portfolio Risk Posture',
      subtitle: 'How bad?',
      content: (
        <div className="space-y-8">
          <div className="text-center">
            <div className="text-7xl font-bold tracking-tight text-orange-500 mb-2">
              {boardData.posture.level}
            </div>
            <div className="flex items-center justify-center gap-2 text-orange-400">
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5.293 9.707a1 1 0 010-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 01-1.414 1.414L11 7.414V15a1 1 0 11-2 0V7.414L6.707 9.707a1 1 0 01-1.414 0z" clipRule="evenodd" />
              </svg>
              <span className="text-lg">Risk is accelerating</span>
            </div>
          </div>
          
          <div className="grid grid-cols-3 gap-8 mt-12">
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Capital at Risk (30d)</div>
              <div className="text-4xl font-light text-white">€{boardData.posture.capitalAtRisk}M</div>
              <div className="text-red-400 text-sm mt-1">{boardData.posture.capitalAtRiskChange}</div>
            </div>
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Stress Loss (P95)</div>
              <div className="text-4xl font-light text-white">€{boardData.posture.stressLossP95}M</div>
              <div className="text-orange-400 text-sm mt-1">{boardData.posture.stressLossP95Change}</div>
            </div>
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Risk Velocity</div>
              <div className="text-4xl font-light text-red-400">+{boardData.posture.riskVelocity}%</div>
              <div className="text-slate-400 text-sm mt-1">Month-over-month</div>
            </div>
          </div>
          
          <div className="text-center mt-8 text-slate-400 text-lg">
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
                  <span className="text-white text-lg">{driver.name}</span>
                  <span className="text-white font-bold text-xl">{driver.pct}%</span>
                </div>
                <div className="h-4 bg-slate-700 rounded-full overflow-hidden">
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
          
          <div className="text-center mt-12 p-6 bg-slate-800/50 rounded-xl max-w-xl mx-auto">
            <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Key Insight</div>
            <div className="text-white text-xl">
              This is not abstract climate risk — these are{' '}
              <span className="text-orange-400 font-semibold">concrete nodes and assets</span>.
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
            <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Top 5 Assets = Total Exposure</div>
            <div className="text-5xl font-light text-red-400">€{boardData.topExposures.reduce((sum, e) => sum + e.loss, 0)}M</div>
          </div>
          
          <table className="w-full max-w-3xl mx-auto">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 text-sm uppercase tracking-wider pb-3">Rank</th>
                <th className="text-left text-slate-400 text-sm uppercase tracking-wider pb-3">Asset</th>
                <th className="text-left text-slate-400 text-sm uppercase tracking-wider pb-3">Driver</th>
                <th className="text-right text-slate-400 text-sm uppercase tracking-wider pb-3">Expected Loss</th>
              </tr>
            </thead>
            <tbody>
              {boardData.topExposures.map((exp, i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="py-4">
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-red-500/20 text-red-400 font-bold">
                      {i + 1}
                    </span>
                  </td>
                  <td className="py-4 text-white text-lg">{exp.asset}</td>
                  <td className="py-4 text-slate-400">{exp.driver}</td>
                  <td className="py-4 text-right text-red-400 text-xl font-semibold">€{exp.loss}M</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="text-center mt-8 text-slate-400 text-lg">
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
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Mitigation Cost</div>
              <div className="text-3xl font-light text-amber-400">€{boardData.mitigation.totalCost}M</div>
            </div>
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Loss Avoided (P95)</div>
              <div className="text-3xl font-light text-emerald-400">€{boardData.mitigation.lossAvoided}M</div>
            </div>
            <div className="text-center p-6 bg-emerald-500/20 rounded-xl border border-emerald-500/30">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">ROI</div>
              <div className="text-4xl font-bold text-emerald-400">{boardData.mitigation.roi}x</div>
            </div>
            <div className="text-center p-6 bg-slate-800/50 rounded-xl">
              <div className="text-slate-400 text-sm uppercase tracking-wider mb-2">Time to Impact</div>
              <div className="text-3xl font-light text-white">{boardData.mitigation.timeToImpact}</div>
            </div>
          </div>
          
          <table className="w-full max-w-3xl mx-auto">
            <thead>
              <tr className="border-b border-slate-700">
                <th className="text-left text-slate-400 text-sm uppercase tracking-wider pb-3">Action</th>
                <th className="text-right text-slate-400 text-sm uppercase tracking-wider pb-3">Cost</th>
                <th className="text-right text-slate-400 text-sm uppercase tracking-wider pb-3">Loss Avoided</th>
                <th className="text-right text-slate-400 text-sm uppercase tracking-wider pb-3">ROI</th>
              </tr>
            </thead>
            <tbody>
              {boardData.mitigation.topActions.map((action, i) => (
                <tr key={i} className="border-b border-slate-800">
                  <td className="py-3 text-white">{action.action}</td>
                  <td className="py-3 text-right text-amber-400">€{action.cost}M</td>
                  <td className="py-3 text-right text-emerald-400">€{action.lossAvoided}M</td>
                  <td className="py-3 text-right text-emerald-400 font-semibold">{action.roi}x</td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div className="text-center mt-8 text-slate-400 text-lg">
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
              className={`p-6 rounded-xl border ${
                dec.priority === 'critical' 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : dec.priority === 'high'
                  ? 'bg-orange-500/10 border-orange-500/30'
                  : 'bg-amber-500/10 border-amber-500/30'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <span className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-white/10 text-white font-bold text-lg">
                    {i + 1}
                  </span>
                  <div>
                    <div className="text-white text-xl font-medium mb-1">{dec.decision}</div>
                    <div className="text-slate-400 text-sm">Deadline: {dec.deadline}</div>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium uppercase ${
                  dec.priority === 'critical' 
                    ? 'bg-red-500/20 text-red-400' 
                    : dec.priority === 'high'
                    ? 'bg-orange-500/20 text-orange-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}>
                  {dec.priority}
                </span>
              </div>
            </div>
          ))}
          
          <div className="text-center mt-12 p-6 bg-slate-800/50 rounded-xl">
            <div className="text-white text-xl mb-2">
              Total Investment Required
            </div>
            <div className="text-4xl font-bold text-amber-400">€60M</div>
            <div className="text-slate-400 mt-2">Expected ROI: 3.8x over 12 months</div>
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
      className="min-h-screen bg-slate-900 text-white"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-800 px-8 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <Link 
              to="/dashboard" 
              className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
            >
              <ArrowLeftIcon className="w-5 h-5 text-slate-400" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold text-white">Board Presentation</h1>
              <p className="text-xs text-slate-400">Executive Risk Summary</p>
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
                    i === currentSlide ? 'bg-white' : 'bg-slate-600 hover:bg-slate-500'
                  }`}
                />
              ))}
            </div>
            
            <div className="text-slate-400 text-sm">
              {currentSlide + 1} / {slides.length}
            </div>
            
            {/* Export */}
            <button className="flex items-center gap-2 px-4 py-2 bg-white text-slate-900 text-sm font-medium rounded-lg hover:bg-slate-100 transition-colors">
              <DocumentArrowDownIcon className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </header>

      {/* Slide Content */}
      <main className="pt-24 pb-24 px-8">
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
                <div className="text-slate-500 text-sm uppercase tracking-wider mb-2">
                  Slide {currentSlideData.id} • {currentSlideData.subtitle}
                </div>
                <h2 className="text-4xl font-bold text-white">{currentSlideData.title}</h2>
              </div>
              
              {/* Slide content */}
              {currentSlideData.content}
            </motion.div>
          </AnimatePresence>
        </div>
      </main>

      {/* Navigation */}
      <footer className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900/80 backdrop-blur-lg border-t border-slate-800 px-8 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <button
            onClick={prevSlide}
            disabled={currentSlide === 0}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            Previous
          </button>
          
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsAutoPlay(!isAutoPlay)}
              className="p-3 rounded-full bg-slate-800 hover:bg-slate-700 transition-colors"
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Next
            <ChevronRightIcon className="w-5 h-5" />
          </button>
        </div>
      </footer>
    </div>
  )
}
