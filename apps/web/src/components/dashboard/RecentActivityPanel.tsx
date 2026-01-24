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
  } else {
    return ClockIcon
  }
}

function getEventColor(eventType: string): string {
  if (eventType.includes('started') || eventType.includes('opened')) {
    return 'text-amber-400'
  } else if (eventType.includes('completed')) {
    return 'text-emerald-400'
  } else if (eventType.includes('failed') || eventType.includes('alert')) {
    return 'text-red-400'
  } else if (eventType.includes('selected')) {
    return 'text-blue-400'
  } else {
    return 'text-white/50'
  }
}

function formatEventName(event: PlatformEvent): string {
  const actionMap: Record<string, string> = {
    [EventTypes.STRESS_TEST_STARTED]: 'Stress test started',
    [EventTypes.STRESS_TEST_COMPLETED]: 'Stress test completed',
    [EventTypes.STRESS_TEST_FAILED]: 'Stress test failed',
    [EventTypes.ZONE_SELECTED]: 'Zone selected',
    [EventTypes.ZONE_DESELECTED]: 'Zone deselected',
    [EventTypes.TWIN_OPENED]: 'Digital Twin opened',
    [EventTypes.TWIN_CLOSED]: 'Digital Twin closed',
    [EventTypes.PORTFOLIO_UPDATED]: 'Portfolio updated',
    [EventTypes.ALERT_GENERATED]: 'Alert generated',
  }
  
  return actionMap[event.event_type] || event.event_type.replace(/_/g, ' ').replace(/\./g, ': ')
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
      <div className="glass rounded-xl border border-white/5 p-6">
        <h3 className="text-sm font-display font-semibold mb-4 text-white/80">
          Recent Activity
        </h3>
        <div className="text-center py-8">
          <ClockIcon className="w-8 h-8 mx-auto text-white/20 mb-2" />
          <p className="text-xs text-white/40">No recent activity</p>
          <p className="text-xs text-white/30 mt-1">Actions from Command Center will appear here</p>
        </div>
      </div>
    )
  }
  
  return (
    <div className="glass rounded-xl border border-white/5 p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-display font-semibold text-white/80">
          Recent Activity
        </h3>
        <span className="text-xs text-white/40">
          {events.length} events
        </span>
      </div>
      
      <div className="max-h-[400px] overflow-y-auto custom-scrollbar pr-1">
        <div className="space-y-3">
          {displayEvents.map((event, index) => {
          const Icon = getEventIcon(event.event_type)
          const color = getEventColor(event.event_type)
          
          return (
            <motion.div
              key={event.event_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex items-start gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors"
            >
              <div className={`p-1.5 rounded-lg bg-white/5 ${color}`}>
                <Icon className="w-4 h-4" />
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/70 font-medium">
                    {formatEventName(event)}
                  </span>
                  {event.intent && (
                    <span className="text-[10px] text-amber-400/70 bg-amber-500/10 px-1 rounded">
                      pending
                    </span>
                  )}
                </div>
                
                {event.data.name && (
                  <p className="text-xs text-white/40 truncate">
                    {event.data.name}
                  </p>
                )}
              </div>
              
              <span className="text-[10px] text-white/30">
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
