import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircleIcon,
  XMarkIcon,
  CubeTransparentIcon,
  ShieldCheckIcon,
  BeakerIcon,
  ChartBarIcon,
} from '@heroicons/react/24/outline'

interface OnboardingProps {
  onComplete: () => void
}

const steps = [
  {
    id: 1,
    title: 'Welcome to Physical-Financial Risk Platform',
    description: 'The Operating System for the Physical Economy',
    icon: CubeTransparentIcon,
    content: (
      <div className="space-y-4">
        <p className="text-dark-muted">
          Our platform connects physical reality with financial models in real-time.
        </p>
        <div className="grid grid-cols-2 gap-4">
          <div className="p-4 bg-dark-bg rounded-md">
            <p className="text-sm font-medium mb-1">5 Layers</p>
            <p className="text-xs text-dark-muted">From Verified Truth to Autonomous Agents</p>
          </div>
          <div className="p-4 bg-dark-bg rounded-md">
            <p className="text-sm font-medium mb-1">Real-time</p>
            <p className="text-xs text-dark-muted">Continuous synchronization</p>
          </div>
        </div>
      </div>
    ),
  },
  {
    id: 2,
    title: 'Layer 1: Living Digital Twins',
    description: 'Complete temporal history of your assets',
    icon: CubeTransparentIcon,
    content: (
      <div className="space-y-4">
        <p className="text-dark-muted">
          Every asset has a Digital Twin that remembers everything:
        </p>
        <ul className="space-y-2 text-sm">
          <li className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400/80" />
            <span>3D BIM models with full geometry</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400/80" />
            <span>Complete timeline from construction to now</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400/80" />
            <span>Real-time sensor data</span>
          </li>
          <li className="flex items-center gap-2">
            <CheckCircleIcon className="w-5 h-5 text-green-400/80" />
            <span>Climate exposures and risk scores</span>
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: 3,
    title: 'Layer 2: Network Intelligence',
    description: 'Discover hidden dependencies and cascade risks',
    icon: ShieldCheckIcon,
    content: (
      <div className="space-y-4">
        <p className="text-dark-muted">
          Traditional models miss hidden risks. We map the full dependency network:
        </p>
        <div className="p-4 bg-dark-bg rounded-md">
          <p className="text-sm font-medium mb-2">Example:</p>
          <p className="text-xs text-dark-muted">
            Power Grid Sector 7 failure affects 23 assets with €1.2B exposure.
            Traditional models show: €0. You see: €1.2B.
          </p>
        </div>
      </div>
    ),
  },
  {
    id: 4,
    title: 'Layer 3: Simulation Engine',
    description: 'Physics + Climate + Economics in one engine',
    icon: BeakerIcon,
    content: (
      <div className="space-y-4">
        <p className="text-dark-muted">
          Run unlimited scenarios with four integrated engines:
        </p>
        <div className="grid grid-cols-2 gap-3">
          {['Physics', 'Climate', 'Economics', 'Cascade'].map((engine) => (
            <div key={engine} className="p-3 bg-dark-bg rounded-md text-center">
              <p className="text-sm font-medium">{engine}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 5,
    title: 'Layer 4: Autonomous Agents',
    description: '24/7 monitoring, analysis, and recommendations',
    icon: ChartBarIcon,
    content: (
      <div className="space-y-4">
        <p className="text-dark-muted">
          AI agents work for you around the clock:
        </p>
        <div className="space-y-2">
          {[
            { name: 'SENTINEL', desc: 'Monitors threats 24/7' },
            { name: 'ANALYST', desc: 'Deep dives on alerts' },
            { name: 'ADVISOR', desc: 'Recommends actions with ROI' },
          ].map((agent) => (
            <div key={agent.name} className="p-3 bg-dark-bg rounded-md">
              <p className="text-sm font-medium">{agent.name}</p>
              <p className="text-xs text-dark-muted">{agent.desc}</p>
            </div>
          ))}
        </div>
      </div>
    ),
  },
]

export default function Onboarding({ onComplete }: OnboardingProps) {
  const [currentStep, setCurrentStep] = useState(0)
  const [skipped, setSkipped] = useState(false)

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1)
    } else {
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleSkip = () => {
    setSkipped(true)
    onComplete()
  }

  const handleComplete = () => {
    localStorage.setItem('onboarding_completed', 'true')
    onComplete()
  }

  if (skipped) return null

  const step = steps[currentStep]
  const Icon = step.icon

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-8">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="glass rounded-md p-8 max-w-2xl w-full max-h-[90vh] overflow-auto"
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-zinc-500/20 rounded-md">
              <Icon className="w-8 h-8 text-zinc-400" />
            </div>
            <div>
              <h2 className="text-2xl font-display font-bold">{step.title}</h2>
              <p className="text-dark-muted mt-1">{step.description}</p>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-dark-bg rounded-md transition-colors"
          >
            <XMarkIcon className="w-5 h-5 text-dark-muted" />
          </button>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="flex gap-2 mb-2">
            {steps.map((s, idx) => (
              <div
                key={s.id}
                className={`h-1 flex-1 rounded-full ${
                  idx <= currentStep ? 'bg-zinc-500' : 'bg-dark-border'
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-dark-muted text-right">
            Step {currentStep + 1} of {steps.length}
          </p>
        </div>

        {/* Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentStep}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >
            {step.content}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <div className="flex items-center justify-between mt-8 pt-6 border-t border-dark-border">
          <button
            onClick={handlePrevious}
            disabled={currentStep === 0}
            className="px-4 py-2 bg-dark-card border border-dark-border rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:bg-dark-bg transition-colors"
          >
            Previous
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleSkip}
              className="px-4 py-2 text-dark-muted hover:text-white transition-colors"
            >
              Skip
            </button>
            <button
              onClick={handleNext}
              className="px-6 py-2 bg-zinc-500 text-white rounded-md font-medium hover:bg-zinc-600 transition-colors"
            >
              {currentStep === steps.length - 1 ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
