/**
 * Action Plans Page — Detailed sector action plans
 *
 * Renders each sector's detailed plan: focus areas, phases, actions,
 * and success metrics in one scroll. Single reference per sector.
 */
import { Link } from 'react-router-dom'
import { UNIVERSAL_ACTION_PLAN_TEMPLATE } from '../lib/universalActionPlanTemplate'
import type { SectorActionPlan } from '../lib/universalActionPlanTemplate'
import { ArrowLeftIcon, DocumentTextIcon } from '@heroicons/react/24/outline'

const SECTOR_COLORS: Record<string, string> = {
  '1': 'purple',
  '2': 'blue',
  '3': 'emerald',
  '4': 'cyan',
  '5': 'orange',
}

const BORDER_CLASSES: Record<string, string> = {
  purple: 'border-purple-500/30',
  blue: 'border-blue-500/30',
  emerald: 'border-emerald-500/30',
  cyan: 'border-amber-500/30',
  orange: 'border-orange-500/30',
}

const TEXT_CLASSES: Record<string, string> = {
  purple: 'text-purple-400',
  blue: 'text-blue-400',
  emerald: 'text-emerald-400',
  cyan: 'text-amber-400',
  orange: 'text-orange-400',
}

function SectorDetailCard({ sector }: { sector: SectorActionPlan }) {
  const color = SECTOR_COLORS[sector.id] ?? 'cyan'
  const borderCls = BORDER_CLASSES[color]
  const textCls = TEXT_CLASSES[color]

  return (
    <section
      className={`rounded-xl border ${borderCls} bg-white/[0.02] overflow-hidden`}
      id={`sector-${sector.id}`}
    >
      <div className={`px-4 py-3 border-b ${borderCls} bg-white/5`}>
        <h2 className={`text-base font-medium ${textCls}`}>
          {sector.id}. {sector.sector}
        </h2>
        <p className="text-[11px] text-white/50 mt-0.5">
          {sector.responseTime} • Risk reduction target: {sector.riskReductionPercent}%
        </p>
      </div>
      <div className="p-4 space-y-5">
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-white/60 mb-2">Focus areas</h3>
          <div className="rounded-lg border border-white/10 overflow-hidden">
            <table className="w-full text-[11px] min-w-[320px]">
              <thead>
                <tr className="bg-white/5">
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Category</th>
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Stress scenarios</th>
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Actions</th>
                  <th className="text-left px-3 py-2 text-white/50 font-medium">Success metrics</th>
                </tr>
              </thead>
              <tbody>
                {sector.focusAreas.map((fa, i) => (
                  <tr key={i} className="border-t border-white/5">
                    <td className="px-3 py-2 text-white/80">{fa.category}</td>
                    <td className="px-3 py-2 text-white/60">{fa.stressScenarios}</td>
                    <td className="px-3 py-2 text-white/60">{fa.actions}</td>
                    <td className="px-3 py-2 text-white/50">{fa.successMetrics}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="text-[10px] uppercase tracking-wider text-white/60 mb-2">Phases & actions</h3>
          <div className="space-y-3">
            {sector.phases.map((phase, pi) => (
              <div key={pi} className="border border-white/10 rounded-lg overflow-hidden">
                <div className="px-3 py-2 bg-white/5 text-[11px] font-medium text-white/80 border-b border-white/5">
                  {phase.name}
                </div>
                <ul className="px-3 py-2 space-y-1">
                  {phase.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-[11px] text-white/70">
                      <span className="text-white/40 mt-0.5">├</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default function ActionPlansPage() {
  const template = UNIVERSAL_ACTION_PLAN_TEMPLATE

  return (
    <div className="h-full flex flex-col bg-[#0a0e17]">
      <header className="shrink-0 px-6 py-4 border-b border-white/10 bg-[#0a0f18]">
        <div className="flex items-center gap-4">
          <Link
            to="/command"
            className="p-2 rounded-lg text-white/50 hover:text-white hover:bg-white/5"
            aria-label="Back to Command Center"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-6 h-6 text-amber-400" />
            <div>
              <h1 className="text-lg font-medium text-white">{template.title}</h1>
              <p className="text-[11px] text-white/50">
                Detailed sector plans • {template.dateCreated}
              </p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-4xl mx-auto space-y-6">
          {template.sectors.map((sector) => (
            <SectorDetailCard
              key={sector.id}
              sector={sector}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
