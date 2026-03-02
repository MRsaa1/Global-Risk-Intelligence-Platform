/**
 * Quick Actions — compact horizontal bar on Dashboard (institutional layout).
 * Icon + label only; no subtitles. Uses shared config with Command Center.
 */
import { Link } from 'react-router-dom'
import { quickActionsCore, quickActionColors, type QuickActionItem } from '../config/quickActions'

export default function QuickActionsCards() {
  return (
    <div className="flex flex-nowrap gap-2 overflow-x-auto pb-1 scrollbar-thin">
      {quickActionsCore.map((item) => (
        <QuickActionCard key={item.path} item={item} />
      ))}
    </div>
  )
}

function QuickActionCard({ item }: { item: QuickActionItem }) {
  const colors = quickActionColors[item.color]
  const Icon = item.icon
  return (
    <Link to={item.path} className="flex-shrink-0 group">
      <div className={`flex items-center gap-2 px-4 py-2.5 rounded-md border ${colors.border} transition-all ${colors.hover}`}>
        <Icon className={`w-4 h-4 ${colors.icon}`} />
        <span className="text-xs font-medium text-zinc-200 whitespace-nowrap group-hover:text-zinc-100">{item.label}</span>
      </div>
    </Link>
  )
}
