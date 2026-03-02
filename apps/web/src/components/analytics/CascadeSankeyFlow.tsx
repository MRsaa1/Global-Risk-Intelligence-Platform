/**
 * CascadeSankeyFlow — Institutional-grade Sankey for cascade simulation results.
 *
 * Columns: Source Event -> Impacted Modules (by depth) -> Severity Bands
 */
import { useMemo } from 'react'
import Plot from 'react-plotly.js'

interface ModuleInfo {
  label: string
  full: string
  color: string
}

interface CascadeSankeyFlowProps {
  simulationResult: any
  moduleInfo: Record<string, ModuleInfo>
  categoryLabel: string
  height?: number
}

const SEVERITY_BANDS = [
  { id: 'critical', label: 'Critical (>60%)', color: '#7a3d3d', min: 0.6 },
  { id: 'high',     label: 'High (30-60%)',   color: '#8a6a3d', min: 0.3 },
  { id: 'medium',   label: 'Medium (10-30%)', color: '#8a7a3d', min: 0.1 },
  { id: 'low',      label: 'Low (<10%)',      color: '#4a7a5a', min: 0 },
]

function getSeverityBand(severity: number) {
  return SEVERITY_BANDS.find(b => severity >= b.min) || SEVERITY_BANDS[SEVERITY_BANDS.length - 1]
}

export default function CascadeSankeyFlow({
  simulationResult,
  moduleInfo,
  categoryLabel,
  height = 380,
}: CascadeSankeyFlowProps) {
  const plotData = useMemo(() => {
    if (!simulationResult) return null

    const impactEntries = Object.values(simulationResult.module_impacts || {}) as any[]

    const sourceModule = simulationResult.source_module || 'unknown'
    const sourceInfo = moduleInfo[sourceModule] || { label: sourceModule.toUpperCase(), full: sourceModule, color: '#555' }

    const nodeLabels: string[] = []
    const nodeColors: string[] = []
    const nodeIdxMap = new Map<string, number>()

    const addNode = (id: string, label: string, color: string) => {
      if (!nodeIdxMap.has(id)) {
        nodeIdxMap.set(id, nodeLabels.length)
        nodeLabels.push(label)
        nodeColors.push(color)
      }
      return nodeIdxMap.get(id)!
    }

    addNode('source', `${sourceInfo.label}: ${categoryLabel}`, sourceInfo.color)

    // No downstream propagation for this module/category — show minimal Sankey + hint
    if (!impactEntries.length) {
      addNode('none', 'No downstream propagation', '#52525b')
      return [{
        type: 'sankey' as const,
        orientation: 'h' as const,
        arrangement: 'snap' as const,
        node: {
          pad: 18,
          thickness: 18,
          line: { color: 'rgba(255,255,255,0.08)', width: 0.5 },
          label: nodeLabels,
          color: nodeColors,
          hovertemplate: '<b>%{label}</b><extra></extra>',
        },
        link: {
          source: [0],
          target: [1],
          value: [0.01],
          color: ['rgba(113,113,122,0.3)'],
          customdata: ['No edges from this module for this event category'],
          hovertemplate: '%{customdata}<extra></extra>',
        },
      }]
    }

    for (const imp of impactEntries) {
      const info = moduleInfo[imp.module] || { label: imp.module?.toUpperCase(), full: '', color: '#555' }
      const sev = imp.impact_severity || 0
      addNode(`mod_${imp.module}`, `${info.label} (${(sev * 100).toFixed(0)}%)`, info.color)
    }

    const usedBands = new Set<string>()
    for (const imp of impactEntries) {
      usedBands.add(getSeverityBand(imp.impact_severity || 0).id)
    }
    for (const band of SEVERITY_BANDS) {
      if (usedBands.has(band.id)) {
        addNode(`band_${band.id}`, band.label, band.color)
      }
    }

    const linkSources: number[] = []
    const linkTargets: number[] = []
    const linkValues: number[] = []
    const linkColors: string[] = []
    const linkCustomData: string[] = []

    for (const imp of impactEntries) {
      const depth = imp.depth || (imp.propagation_path?.length || 1) - 1
      if (depth === 1) {
        linkSources.push(nodeIdxMap.get('source')!)
        linkTargets.push(nodeIdxMap.get(`mod_${imp.module}`)!)
        linkValues.push(Math.max(0.01, imp.impact_severity || 0))
        linkColors.push(imp.impact_severity > 0.6 ? 'rgba(122,61,61,0.45)' : imp.impact_severity > 0.3 ? 'rgba(138,106,61,0.4)' : 'rgba(74,122,90,0.35)')
        linkCustomData.push(`Weight: ${(imp.propagation_weight || 0).toFixed(3)} | Loss x${(imp.estimated_loss_multiplier || 1).toFixed(2)}`)
      }
    }

    for (const imp of impactEntries) {
      const depth = imp.depth || (imp.propagation_path?.length || 1) - 1
      if (depth > 1 && imp.propagation_path && imp.propagation_path.length >= 2) {
        const parent = imp.propagation_path[imp.propagation_path.length - 2]
        const parentIdx = nodeIdxMap.get(`mod_${parent}`)
        const targetIdx = nodeIdxMap.get(`mod_${imp.module}`)
        if (parentIdx !== undefined && targetIdx !== undefined) {
          linkSources.push(parentIdx)
          linkTargets.push(targetIdx)
          linkValues.push(Math.max(0.01, imp.impact_severity || 0))
          linkColors.push(imp.impact_severity > 0.6 ? 'rgba(122,61,61,0.35)' : imp.impact_severity > 0.3 ? 'rgba(138,106,61,0.3)' : 'rgba(74,122,90,0.25)')
          linkCustomData.push(`Depth ${depth} | Weight: ${(imp.propagation_weight || 0).toFixed(3)}`)
        }
      }
    }

    for (const imp of impactEntries) {
      const band = getSeverityBand(imp.impact_severity || 0)
      const modIdx = nodeIdxMap.get(`mod_${imp.module}`)
      const bandIdx = nodeIdxMap.get(`band_${band.id}`)
      if (modIdx !== undefined && bandIdx !== undefined) {
        linkSources.push(modIdx)
        linkTargets.push(bandIdx)
        linkValues.push(Math.max(0.01, imp.impact_severity || 0))
        linkColors.push(band.color + '50')
        linkCustomData.push(`${(imp.impact_severity * 100).toFixed(1)}% severity`)
      }
    }

    return [{
      type: 'sankey' as const,
      orientation: 'h' as const,
      arrangement: 'snap' as const,
      node: {
        pad: 18,
        thickness: 18,
        line: { color: 'rgba(255,255,255,0.08)', width: 0.5 },
        label: nodeLabels,
        color: nodeColors,
        hovertemplate: '<b>%{label}</b><extra></extra>',
      },
      link: {
        source: linkSources,
        target: linkTargets,
        value: linkValues,
        color: linkColors,
        customdata: linkCustomData,
        hovertemplate: '<b>%{source.label}</b> \u2192 <b>%{target.label}</b><br>Severity: %{value:.2f}<br>%{customdata}<extra></extra>',
      },
    }]
  }, [simulationResult, moduleInfo, categoryLabel])

  const impactCount = simulationResult ? Object.values(simulationResult.module_impacts || {}).length : 0
  const noPropagation = simulationResult && impactCount === 0

  if (!plotData) {
    return (
      <div className="flex items-center justify-center h-32 text-zinc-600 text-[10px] font-mono tracking-wide">
        AWAITING SIMULATION...
      </div>
    )
  }

  return (
    <div>
      <div className="px-4 py-1.5 border-b border-zinc-800/60 flex items-center justify-between">
        <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
          CASCADE PROPAGATION FLOW
        </span>
        <span className="text-[9px] font-mono text-zinc-600">
          Trigger \u2192 Modules \u2192 Severity
        </span>
      </div>
      <Plot
        data={plotData}
        layout={{
          font: { family: '"JetBrains Mono", monospace', size: 10, color: 'rgba(161,161,170,0.8)' },
          paper_bgcolor: 'transparent',
          plot_bgcolor: 'transparent',
          margin: { l: 8, r: 8, t: 8, b: 8 },
          hoverlabel: { bgcolor: '#18181b', bordercolor: '#27272a', font: { color: '#e4e4e7', size: 10 } },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%', height: `${height}px` }}
      />
      {noPropagation && (
        <div className="px-4 py-2 border-t border-zinc-800/60 text-[10px] font-mono text-zinc-500 bg-zinc-900/30">
          No edges from this module for the selected event category. Try another Event (e.g. for <strong className="text-zinc-400">CIP</strong>: Infrastructure Failure, Cyber Attack, Climate Disaster; for <strong className="text-zinc-400">BIOSEC</strong>: Pandemic Outbreak).
        </div>
      )}
    </div>
  )
}
