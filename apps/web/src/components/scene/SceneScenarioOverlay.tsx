/**
 * SceneScenarioOverlay - minimal scenario selector overlay for 3D scenes.
 *
 * Phase 5.1-5.2 MVP:
 * - lets user pick a scenario preset
 * - optionally pulls scenario catalog from backend (stress-tests library/extended)
 * - emits selection via callback so the scene can adjust visuals
 */
import { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { SparklesIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

type ScenarioPreset = {
  id: string
  name: string
  type: 'flood' | 'fire' | 'heat' | 'wind' | 'earthquake' | 'custom'
  severity: number // 0-1
}

interface SceneScenarioOverlayProps {
  value?: ScenarioPreset
  onChange: (preset: ScenarioPreset) => void
}

const defaultPresets: ScenarioPreset[] = [
  { id: 'Flood_Extreme_100y', name: 'Flood (Extreme 100y)', type: 'flood', severity: 0.85 },
  { id: 'Wildfire_Insurance', name: 'Wildfire', type: 'fire', severity: 0.75 },
  { id: 'Heat_Stress_Energy', name: 'Heat Stress', type: 'heat', severity: 0.65 },
  { id: 'Storm_Wind', name: 'Wind Storm', type: 'wind', severity: 0.70 },
  { id: 'Seismic_Shock', name: 'Earthquake', type: 'earthquake', severity: 0.70 },
]

export default function SceneScenarioOverlay({ value, onChange }: SceneScenarioOverlayProps) {
  const [open, setOpen] = useState(false)
  const [catalog, setCatalog] = useState<ScenarioPreset[] | null>(null)

  // Lightweight catalog fetch (optional). If it fails, fall back to presets.
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [libRes, extRes] = await Promise.all([
          fetch('/api/v1/stress-tests/scenarios/library'),
          fetch('/api/v1/stress-tests/scenarios/extended'),
        ])
        if (!libRes.ok || !extRes.ok) throw new Error('scenario catalog unavailable')
        const lib = (await libRes.json()) as any[]
        const ext = (await extRes.json()) as any
        const extScenarios = Array.isArray(ext?.categories)
          ? ext.categories.flatMap((c: any) => c?.scenarios || [])
          : []

        const normalized = [...lib, ...extScenarios]
          .filter(Boolean)
          .slice(0, 40)
          .map((s: any) => {
            const sev = typeof s?.severity_numeric === 'number' ? s.severity_numeric : 0.6
            return {
              id: String(s.id),
              name: String(s.name || s.id),
              type: 'custom' as const,
              severity: Math.max(0, Math.min(1, sev)),
            }
          })

        if (!cancelled) setCatalog(normalized)
      } catch {
        // ignore, use presets
        if (!cancelled) setCatalog(null)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => catalog ?? defaultPresets, [catalog])
  const selected = value ?? options[0]

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="glass rounded-md px-3 py-2 flex items-center gap-2 border border-white/10 hover:border-white/20 transition-colors"
      >
        <SparklesIcon className="w-4 h-4 text-primary-300" />
        <span className="text-xs text-white/80 truncate max-w-[180px]">{selected.name}</span>
        <ChevronDownIcon className="w-4 h-4 text-white/40" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            className="mt-2 glass rounded-md border border-white/10 overflow-hidden w-[320px] max-h-[320px]"
          >
            <div className="max-h-[320px] overflow-y-auto custom-scrollbar">
              {options.map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    onChange(opt)
                    setOpen(false)
                  }}
                  className={`w-full text-left px-3 py-2 text-xs flex items-center justify-between hover:bg-white/5 transition-colors ${
                    opt.id === selected.id ? 'bg-primary-500/10' : ''
                  }`}
                >
                  <span className="text-white/80 truncate">{opt.name}</span>
                  <span className="text-white/40 font-mono">{Math.round(opt.severity * 100)}%</span>
                </button>
              ))}
            </div>
            <div className="px-3 py-2 border-t border-white/10 text-[10px] text-white/40">
              Applies a visualization preset (MVP). Catalog loads from backend when available.
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

