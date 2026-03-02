/**
 * Recent Activity Panel
 * 
 * Shows recent events from Command Center.
 * Synced via platform store.
 */
import { motion } from 'framer-motion'
import { 
  BoltIcon, 
  MapPinIcon, 
  CubeTransparentIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ClockIcon,
} from '@heroicons/react/24/outline'
import { PlatformEvent, EventTypes } from '../../types/events'

interface RecentActivityPanelProps {
  events: PlatformEvent[]
  maxItems?: number
}

function getEventIcon(eventType: string) {
  if (eventType.startsWith('stress_test')) {
    return BoltIcon
  } else if (eventType.startsWith('zone')) {
    return MapPinIcon
  } else if (eventType.startsWith('twin')) {
    return CubeTransparentIcon
  } else if (eventType.startsWith('alert')) {
    return ExclamationTriangleIcon
  } else if (eventType.startsWith('portfolio')) {
    return ChartBarIcon
  } else if (eventType.startsWith('threat') || eventType.includes('threat')) {
    return ExclamationTriangleIcon
  } else if (eventType.startsWith('data.')) {
    return ChartBarIcon
  } else {
    return ClockIcon
  }
}

function getEventColor(eventType: string): string {
  if (eventType.includes('started') || eventType.includes('opened')) {
    return 'text-amber-400/80'
  } else if (eventType.includes('completed')) {
    return 'text-emerald-400/80'
  } else if (eventType.includes('failed') || eventType.includes('alert')) {
    return 'text-red-400/80'
  } else if (eventType.includes('selected')) {
    return 'text-zinc-400'
  } else {
    return 'text-zinc-400'
  }
}

function formatEventName(event: PlatformEvent): string {
  const actionMap: Record<string, string> = {
    [EventTypes.STRESS_TEST_STARTED]: 'Stress test started',
    [EventTypes.STRESS_TEST_COMPLETED]: 'Stress test completed',
    [EventTypes.STRESS_TEST_FAILED]: 'Stress test failed',
    [EventTypes.STRESS_TEST_PROGRESS]: 'Stress test progress',
    [EventTypes.STRESS_TEST_DELETED]: 'Stress test deleted',
    [EventTypes.ZONE_SELECTED]: 'Zone selected',
    [EventTypes.ZONE_DESELECTED]: 'Zone deselected',
    [EventTypes.ZONE_RISK_UPDATED]: 'Zone risk updated',
    [EventTypes.RISK_ZONE_CREATED]: 'Risk zone created',
    [EventTypes.TWIN_OPENED]: 'Digital Twin opened',
    [EventTypes.TWIN_CLOSED]: 'Digital Twin closed',
    [EventTypes.PORTFOLIO_UPDATED]: 'Portfolio updated',
    [EventTypes.ASSET_RISK_UPDATED]: 'Asset risk updated',
    [EventTypes.ALERT_GENERATED]: 'Alert generated',
    [EventTypes.SOCIAL_THREAT_DETECTED]: 'Threat signal detected',
    [EventTypes.DATA_REFRESH_COMPLETED]: 'Data refresh completed',
  }
  const base = actionMap[event.event_type] || event.event_type.replace(/_/g, ' ').replace(/\./g, ': ')
  const d = event.data
  if (event.event_type === EventTypes.SOCIAL_THREAT_DETECTED && d && (d.source || d.risk_type || d.text)) {
    const extra = [d.source, d.risk_type, typeof d.text === 'string' ? d.text.slice(0, 40) : null].find(Boolean)
    return extra ? `${base} · ${extra}` : base
  }
  return base
}

function formatTimeAgo(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function RecentActivityPanel({
  events,
  maxItems = 5,
}: RecentActivityPanelProps) {
  const displayEvents = events.slice(0, maxItems)
  
  if (displayEvents.length === 0) {
    return (
      <div className="rounded-md bg-zinc-900 border border-zinc-800 p-6">
        <h3 className="text-sm font-display font-semibold mb-4 text-zinc-300">
          Recent Activity
        </h3>
        <div className="text-center py-8">
          <ClockIcon className="w-8 h-8 mx-auto text-zinc-700 mb-2" />
          <p className="text-xs text-zinc-500">No recent activity</p>
          <p className="text-xs text-zinc-600 mt-1">Run a stress test, open a Digital Twin, or select a zone in Command Center to see activity here.</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold text-zinc-300">
          Recent Activity
        </h3>
        <span className="text-xs text-zinc-500">
          {events.length} events
        </span>
      </div>
      
      <div>
        <div className="space-y-3">
          {displayEvents.map((event, index) => {
          const Icon = getEventIcon(event.event_type)
          const color = getEventColor(event.event_type)
          const uniqueKey = event.event_id ? `${event.event_id}-${index}` : `event-${index}`
          
          return (
            <motion.div
              key={uniqueKey}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-md hover:bg-zinc-800 transition-colors"
            >
              <div className={`p-1.5 rounded-md bg-zinc-800 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-zinc-300 font-medium">
                    {formatEventName(event)}
                  </span>
                  {event.intent && (
                    <span className="text-[10px] text-zinc-400 bg-zinc-800 px-1 rounded">
                      pending
                    </span>
                  )}
                </div>
                
                {event.data.name && (
                  <p className="text-xs text-zinc-500 truncate">
                    {event.data.name}
                  </p>
                )}
              </div>
              
              <span className="text-[10px] text-zinc-600">
                {formatTimeAgo(event.timestamp)}
              </span>
            </motion.div>
          )
        })}
        </div>
      </div>
    </div>
  )
}
