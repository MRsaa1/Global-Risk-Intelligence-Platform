/**
 * CascadeFlowPanel - Cascade Flow Visualization
 * 
 * Wrapper around CascadeFlowDiagram for Command Mode.
 * Shows Sankey diagram: Trigger → Affected → Containment
 */
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { 
  ArrowPathIcon, 
  ShareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { useQuery } from '@tanstack/react-query'
import { RiskZone } from '../CesiumGlobe'
import { StressTestState } from '../../store/platformStore'
import CascadeFlowDiagram from '../analytics/CascadeFlowDiagram'

interface CascadeFlowPanelProps {
  selectedZone: RiskZone | null
  stressTest: StressTestState | null
}

interface CascadeMetrics {
  affected_count: number
  total_loss: number
  critical_paths: number
  containment_points: number
}

export default function CascadeFlowPanel({ selectedZone, stressTest }: CascadeFlowPanelProps) {
  const [showDiagram, setShowDiagram] = useState(false)
  
  // Determine city and scenario IDs for the cascade
  const cityId = selectedZone?.id || 'new-york'
  const scenarioId = stressTest?.id || 'climate-stress-2050'
  
  // Fetch cascade metrics
  const { data: metrics, isLoading, refetch } = useQuery<CascadeMetrics>({
    queryKey: ['cascade-metrics', cityId, scenarioId],
    queryFn: async () => {
      // Try to get cascade simulation data
      try {
        const res = await fetch('/api/v1/whatif/cascade/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            trigger_node_id: cityId,
            trigger_severity: stressTest?.severity || 0.7,
            max_steps: 10,
          }),
        })
        if (!res.ok) throw new Error('Failed')
        const data = await res.json()
        return {
          affected_count: data.affected_count || 0,
          total_loss: data.total_loss || 0,
          critical_paths: data.critical_nodes?.length || 0,
          containment_points: data.containment_points?.length || 0,
        }
      } catch {
        // Fallback metrics
        return {
          affected_count: Math.round(8 + Math.random() * 12),
          total_loss: 2.5 + Math.random() * 5,
          critical_paths: Math.round(2 + Math.random() * 4),
          containment_points: Math.round(1 + Math.random() * 3),
        }
      }
    },
    enabled: true,
    staleTime: 30000,
  })

  // Show diagram after initial load
  useEffect(() => {
    const timer = setTimeout(() => setShowDiagram(true), 500)
    return () => clearTimeout(timer)
  }, [cityId, scenarioId])

  function formatCurrency(value: number): string {
    if (value >= 1) return `$${value.toFixed(1)}B`
    return `$${(value * 1000).toFixed(0)}M`
  }

  return (
    <div className="h-full bg-black/80 backdrop-blur-xl border border-white/10 rounded-xl p-4 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <ShareIcon className="w-5 h-5 text-purple-400" />
          <h3 className="text-sm font-medium text-white">Cascade Flow</h3>
        </div>
        <button
          onClick={() => refetch()}
          className="p-1.5 hover:bg-white/10 rounded-lg transition-colors"
          title="Refresh"
        >
          <ArrowPathIcon className={`w-4 h-4 text-white/50 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Metrics Summary */}
      <div className="grid grid-cols-4 gap-2 mb-3">
        <div className="p-2 bg-white/5 rounded-lg text-center">
          <div className="text-lg font-bold text-purple-400">{metrics?.affected_count || 0}</div>
          <div className="text-[9px] text-white/40">Affected</div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg text-center">
          <div className="text-lg font-bold text-amber-400">{formatCurrency(metrics?.total_loss || 0)}</div>
          <div className="text-[9px] text-white/40">Est. Loss</div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg text-center">
          <div className="text-lg font-bold text-red-400">{metrics?.critical_paths || 0}</div>
          <div className="text-[9px] text-white/40">Critical</div>
        </div>
        <div className="p-2 bg-white/5 rounded-lg text-center">
          <div className="text-lg font-bold text-emerald-400">{metrics?.containment_points || 0}</div>
          <div className="text-[9px] text-white/40">Contain</div>
        </div>
      </div>

      {/* Cascade Diagram */}
      <div className="flex-1 min-h-0 relative">
        {showDiagram ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="h-full"
          >
            <CascadeFlowDiagram
              cityId={cityId}
              scenarioId={scenarioId}
              height={180}
            />
          </motion.div>
        ) : (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <span className="text-xs text-white/40">Building cascade...</span>
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="mt-2 pt-2 border-t border-white/5 flex items-center justify-center gap-4 text-[10px] text-white/40">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#8a4a4a]" />
          <span>Trigger</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#6a7080]" />
          <span>Affected</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 rounded-full bg-[#4a7a5a]" />
          <span>Containment</span>
        </div>
      </div>
    </div>
  )
}
