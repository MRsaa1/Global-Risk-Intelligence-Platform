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
import SendToARINButton from '../components/SendToARINButton'
import ARINVerdictBadge from '../components/ARINVerdictBadge'

const SECTOR_COLORS: Record<string, string> = {
  '1': 'zinc',
  '2': 'zinc',
  '3': 'zinc',
  '4': 'zinc',
  '5': 'zinc',
}

const BORDER_CLASSES: Record<string, string> = {
  zinc: 'border-zinc-800/60',
}

function SectorDetailCard({ sector }: { sector: SectorActionPlan }) {
  const color = SECTOR_COLORS[sector.id] ?? 'zinc'
  const borderCls = BORDER_CLASSES[color]

  return (
    <section
      className={`rounded-md border ${borderCls} bg-zinc-900/50 overflow-hidden`}
      id={`sector-${sector.id}`}
    >
      <div className={`px-4 py-3 border-b ${borderCls} bg-zinc-900/80`}>
        <h2 className={`text-sm font-semibold text-zinc-100`}>
          {sector.id}. {sector.sector}
        </h2>
        <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
          {sector.responseTime} • Risk reduction target: {sector.riskReductionPercent}%
        </p>
      </div>
      <div className="p-4 space-y-5">
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Focus areas</h3>
          <div className="rounded-md border border-zinc-800/60 overflow-hidden">
            <table className="w-full text-[11px] min-w-[320px] font-sans">
              <thead>
                <tr className="bg-zinc-900/90 border-b border-zinc-800/60">
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Category</th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Stress scenarios</th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Actions</th>
                  <th className="text-left px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">Success metrics</th>
                </tr>
              </thead>
              <tbody>
                {sector.focusAreas.map((fa, i) => (
                  <tr key={i} className="border-t border-zinc-800/60">
                    <td className="px-3 py-2 text-zinc-200">{fa.category}</td>
                    <td className="px-3 py-2 text-zinc-400/90">{fa.stressScenarios}</td>
                    <td className="px-3 py-2 text-zinc-400/90">{fa.actions}</td>
                    <td className="px-3 py-2 text-zinc-500">{fa.successMetrics}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Phases & actions</h3>
          <div className="space-y-3">
            {sector.phases.map((phase, pi) => (
              <div key={pi} className="border border-zinc-800/60 rounded-md overflow-hidden bg-zinc-900/30">
                <div className="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/60 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  {phase.name}
                </div>
                <ul className="px-3 py-2 space-y-1">
                  {phase.items.map((item, ii) => (
                    <li key={ii} className="flex items-start gap-2 text-[11px] text-zinc-300/90 font-sans">
                      <span className="text-zinc-500 mt-0.5 font-mono">├</span>
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
    <div className="min-h-full bg-zinc-950 p-6 font-sans" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-[1920px] mx-auto">
        <header className="mb-6 flex items-center gap-4">
          <Link
            to="/command"
            className="p-2 rounded-md text-zinc-500 hover:text-zinc-100 hover:bg-zinc-800/80 border border-transparent hover:border-zinc-700"
            aria-label="Back to Command Center"
          >
            <ArrowLeftIcon className="w-5 h-5" />
          </Link>
          <div className="flex items-center justify-between gap-4 flex-1">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-md bg-zinc-900/80 border border-zinc-800/60">
                <DocumentTextIcon className="w-5 h-5 text-zinc-400/80" />
              </div>
              <div>
                <h1 className="text-lg font-display font-semibold text-zinc-100 tracking-tight">{template.title}</h1>
                <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-0.5">
                  Detailed sector plans • {template.dateCreated}
                </p>
              </div>
            </div>
            <SendToARINButton
              sourceModule="action_plans"
              objectType="scenario"
              objectId="universal-action-plan"
              inputData={{
                sectors_count: template.sectors?.length ?? 0,
                title: template.title,
                dateCreated: template.dateCreated,
              }}
              exportEntityId="portfolio_global"
              exportEntityType="portfolio"
              exportAnalysisType="compliance_check"
              exportData={{
                risk_score: 45,
                risk_level: 'MEDIUM',
                summary: `${template.title}: ${template.sectors?.length ?? 0} sectors, ${template.dateCreated}.`,
                recommendations: ['Execute sector plans', 'Monitor metrics'],
                indicators: {
                  sectors_count: template.sectors?.length ?? 0,
                  date_created: template.dateCreated,
                },
              }}
              size="sm"
            />
            <ARINVerdictBadge entityId="portfolio_global" compact />
          </div>
        </header>

        <div className="space-y-6">
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
