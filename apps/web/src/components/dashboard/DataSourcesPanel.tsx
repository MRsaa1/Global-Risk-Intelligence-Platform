/**
 * Data Sources Panel — last events from natural_hazards, weather, biosecurity, cyber_threats.
 * Uses lastSnapshotBySource from WebSocket; tabs per source.
 */
import { useState } from 'react'
import {
  CloudIcon,
  ShieldExclamationIcon,
  BoltIcon,
  ServerStackIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { usePlatformStore } from '../../store/platformStore'

const SOURCES: { id: string; label: string; icon: typeof CloudIcon }[] = [
  { id: 'natural_hazards', label: 'Natural Hazards', icon: ExclamationTriangleIcon },
  { id: 'weather', label: 'Weather', icon: CloudIcon },
  { id: 'biosecurity', label: 'Biosecurity', icon: ShieldExclamationIcon },
  { id: 'cyber_threats', label: 'Cyber', icon: ServerStackIcon },
  { id: 'infrastructure', label: 'Infrastructure', icon: BoltIcon },
]

// Demo events when no live data — so the panel is not empty
const DEMO_EVENTS_BY_SOURCE: Record<string, Record<string, unknown>[]> = {
  natural_hazards: [
    { type: 'earthquake', magnitude: 4.2, region: 'Pacific', source: 'USGS', timestamp: new Date().toISOString() },
    { type: 'wildfire', severity: 'moderate', region: 'Western US', source: 'NASA FIRMS', timestamp: new Date().toISOString() },
    { type: 'alert', category: 'NWS', summary: 'No active hazards in window', source: 'NWS', timestamp: new Date().toISOString() },
  ],
  weather: [
    { type: 'forecast', temp_min: 12, temp_max: 22, conditions: 'Partly cloudy', source: 'Open-Meteo', timestamp: new Date().toISOString() },
    { type: 'alert', level: 'info', message: 'No severe weather', source: 'Open-Meteo', timestamp: new Date().toISOString() },
  ],
  biosecurity: [
    { type: 'outbreak', pathogen: 'Influenza', cases_7d: 120, region: 'Global', source: 'WHO', timestamp: new Date().toISOString() },
    { type: 'bulletin', summary: 'Routine surveillance update', source: 'WHO', timestamp: new Date().toISOString() },
  ],
  cyber_threats: [
    { type: 'kev', cve: 'CVE-2024-XXXX', vendor: 'Example', source: 'CISA KEV', timestamp: new Date().toISOString() },
    { type: 'alert', severity: 'medium', count: 0, source: 'CISA', timestamp: new Date().toISOString() },
  ],
  infrastructure: [
    { type: 'status', sector: 'Power', status: 'normal', source: 'Grid', timestamp: new Date().toISOString() },
    { type: 'status', sector: 'Transport', status: 'normal', source: 'Internal', timestamp: new Date().toISOString() },
  ],
}

function formatTimeAgo(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'just now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

function renderEventItem(event: Record<string, unknown>, index: number) {
  const type = (event.type as string) || 'event'
  const keys = Object.keys(event).filter((k) => k !== 'type' && event[k] != null)
  return (
    <div
      key={`${type}-${index}`}
      className="p-2 rounded-md bg-zinc-800/50 border border-zinc-800 text-xs text-zinc-300"
    >
      <span className="font-mono text-[10px] uppercase text-zinc-500">{type}</span>
      <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5">
        {keys.slice(0, 6).map((k) => (
          <span key={k}>
            <span className="text-zinc-500">{k}:</span>{' '}
            {typeof event[k] === 'object' ? JSON.stringify(event[k]).slice(0, 40) : String(event[k])}
          </span>
        ))}
      </div>
    </div>
  )
}

export default function DataSourcesPanel() {
  const [activeTab, setActiveTab] = useState('natural_hazards')
  const lastSnapshotBySource = usePlatformStore((s) => s.lastSnapshotBySource)
  const lastRefreshBySource = usePlatformStore((s) => s.lastRefreshBySource)

  const snapshot = lastSnapshotBySource[activeTab]
  const updatedAt = snapshot?.updated_at ?? lastRefreshBySource[activeTab]
  const events = snapshot?.last_events ?? []
  const demoEvents = DEMO_EVENTS_BY_SOURCE[activeTab] ?? []
  const displayEvents = events.length > 0 ? events : demoEvents
  const isDemo = events.length === 0 && demoEvents.length > 0

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-display font-semibold text-zinc-300 flex items-center gap-2">
          <BoltIcon className="w-4 h-4 text-amber-400/80" />
          Data Sources
        </h3>
        {updatedAt && (
          <span className="text-[10px] text-zinc-500">{formatTimeAgo(updatedAt)}</span>
        )}
      </div>

      <div className="flex flex-wrap gap-1 mb-3 border-b border-zinc-800 pb-2">
        {SOURCES.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setActiveTab(id)}
            className={`px-2 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1 ${
              activeTab === id
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      <div className="max-h-56 overflow-y-auto space-y-2">
        {displayEvents.length === 0 ? (
          <div className="text-center py-6 text-zinc-500 text-xs">
            {updatedAt
              ? 'Last synced ' + formatTimeAgo(updatedAt) + '. No events in this time window. Run Sync to refresh.'
              : 'No recent events. Run ingestion sync or wait for next scheduled run.'}
          </div>
        ) : (
          <>
            {isDemo && (
              <p className="text-[10px] text-zinc-500 mb-2">Demo data — run Sync for live events.</p>
            )}
            {displayEvents.map((evt, i) => renderEventItem(evt as Record<string, unknown>, i))}
          </>
        )}
      </div>
    </div>
  )
}
