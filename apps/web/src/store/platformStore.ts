/**
 * Platform Store - Global State Management for Command Center and Dashboard
 * 
 * Uses Zustand for lightweight, performant state management.
 * Implements dual state model: Intent (optimistic) vs Confirmed (backend verified)
 */
import { create } from 'zustand'
import { PlatformEvent, EventTypes, type ThreatSignal } from '../types/events'
import { RiskZone } from '../components/CesiumGlobe'

// Portfolio State
export interface PortfolioState {
  totalExposure: number  // €M
  atRisk: number         // €M Capital at Risk
  totalExpectedLoss?: number  // €M from geo risk formula (real)
  criticalCount: number  // number of critical hotspots
  highCount?: number     // high risk zones
  mediumCount?: number   // medium risk zones
  lowCount?: number      // low risk zones
  weightedRisk: number   // 0-1
  totalAssets?: number
  digitalTwins?: number
  portfolioValue?: number  // in billions
  riskVelocityMomPct?: number | null  // MoM % from risk_posture_snapshots
  riskModelVersion?: number  // 1 = legacy, 2 = GDELT/World Bank/OFAC + hysteresis
  dataSourcesFreshness?: string  // e.g. "GDELT 15m, World Bank 24h"
}

// Stress Test State
export interface StressTestState {
  id: string
  name: string
  type: string
  severity: number
  probability: number
  started_at?: string
  progress?: number
  status?: 'running' | 'completed' | 'failed'
}

// Active Scenario State (for stress test visualization)
export interface ActiveScenarioState {
  type: string
  severity: number
  probability: number
  started_at: string
}

// Platform Store State
interface PlatformState {
  // Portfolio (dual state)
  portfolioIntent: PortfolioState | null
  portfolioConfirmed: PortfolioState
  
  // Active operations
  activeStressTest: StressTestState | null
  activeScenario: ActiveScenarioState | null  // For stress test visualization in CC
  selectedStressTestId: string | null          // Selected test ID for zone calculations
  selectedZone: RiskZone | null  // Single selected zone (Command Center)
  selectedZones: RiskZone[]      // Multiple zones (for batch operations)
  openDigitalTwins: string[]     // city IDs
  showDigitalTwinPanel: boolean  // Digital Twin panel visibility
  
  // Event history (last 100 events)
  recentEvents: PlatformEvent[]
  lastEventId: string | null
  
  // Real-time: threat feed, market data, data refresh trigger
  threatFeed: ThreatSignal[]
  marketData: Record<string, number>
  dataRefreshVersion: number
  /** Per-source last refresh ISO timestamp (e.g. threat_intelligence, natural_hazards, market_data) for Live Data Bar */
  lastRefreshBySource: Record<string, string>
  /** Per-source last snapshot (summary + last_events) for DataSourcesPanel */
  lastSnapshotBySource: Record<string, { summary: Record<string, unknown>; last_events: unknown[]; updated_at: string }>
  
  // WebSocket status
  wsStatus: 'connecting' | 'connected' | 'disconnected'
  
  // Command Mode (split-view transformation)
  commandMode: boolean
  
  // Actions - Command Mode
  setCommandMode: (mode: boolean) => void
  toggleCommandMode: () => void
  
  // Actions - Portfolio
  setPortfolioIntent: (portfolio: PortfolioState) => void
  setPortfolioConfirmed: (portfolio: PortfolioState) => void
  updatePortfolio: (portfolio: Partial<PortfolioState>) => void
  
  // Actions - Stress Tests
  setStressTestIntent: (test: StressTestState) => void
  confirmStressTest: (test: StressTestState) => void
  updateStressTestProgress: (testId: string, progress: number, status?: StressTestState['status']) => void
  clearStressTest: () => void
  
  // Actions - Active Scenario
  setActiveScenario: (scenario: ActiveScenarioState) => void
  clearActiveScenario: () => void
  
  // Actions - Selected Stress Test ID
  setSelectedStressTestId: (id: string | null) => void
  
  // Actions - Zones (single zone for Command Center)
  setSelectedZone: (zone: RiskZone | null) => void
  
  // Actions - Zones (multiple zones for batch operations)
  selectZone: (zone: RiskZone, metadata?: { eventId?: string; causedBy?: string | null }) => void
  deselectZone: (zoneId: string) => void
  setSelectedZones: (zones: RiskZone[]) => void
  
  // Actions - Digital Twins
  openDigitalTwin: (cityId: string) => void
  closeDigitalTwin: (cityId: string) => void
  setShowDigitalTwinPanel: (show: boolean) => void
  
  // Actions - Events
  addEvent: (event: PlatformEvent) => void
  setLastEventId: (eventId: string) => void
  
  addThreatSignal: (signal: ThreatSignal) => void
  setThreatFeed: (signals: ThreatSignal[]) => void
  setMarketData: (data: Record<string, number>) => void
  incrementDataRefreshVersion: () => void
  setLastRefresh: (sourceId: string, timestamp: string) => void
  setLastSnapshotForSource: (sourceId: string, payload: { summary?: Record<string, unknown>; last_events?: unknown[]; updated_at?: string }) => void
  
  // Actions - WebSocket
  setWsStatus: (status: 'connecting' | 'connected' | 'disconnected') => void
  
  // Reset
  reset: () => void
}

// Default portfolio state (replaced by geodata/summary on load)
const defaultPortfolio: PortfolioState = {
  totalExposure: 0,
  atRisk: 0,
  criticalCount: 0,
  weightedRisk: 0,
  totalAssets: 0,
  digitalTwins: 0,
  portfolioValue: 0,
  riskVelocityMomPct: null,
}

const RECENT_EVENTS_STORAGE_KEY = 'pfrp_recent_events'
const RECENT_EVENTS_MAX_PERSISTED = 50
const RECENT_EVENTS_MAX_AGE_DAYS = 7

const MAX_THREAT_FEED_ITEMS = 200

function threatSignalKey(signal: ThreatSignal): string {
  const source = (signal.source ?? '').toLowerCase().trim()
  const text = (signal.text ?? '').toLowerCase().trim()
  const url = (signal.url ?? '').toLowerCase().trim()
  // Prefer semantic signature so repeated same content with new event_id
  // does not flood the feed after each refresh cycle.
  if (source || text || url) {
    return `sig:${source}|${url}|${text}`
  }
  if (signal.id && String(signal.id).trim()) {
    return `id:${String(signal.id).trim()}`
  }
  return `ts:${signal.timestamp}`
}

function dedupeThreatSignals(signals: ThreatSignal[]): ThreatSignal[] {
  const out: ThreatSignal[] = []
  const seen = new Set<string>()
  for (const signal of signals) {
    const key = threatSignalKey(signal)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(signal)
    if (out.length >= MAX_THREAT_FEED_ITEMS) break
  }
  return out
}

function getInitialRecentEvents(): PlatformEvent[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(RECENT_EVENTS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PlatformEvent[]
    if (!Array.isArray(parsed)) return []
    const cutoff = Date.now() - RECENT_EVENTS_MAX_AGE_DAYS * 24 * 60 * 60 * 1000
    return parsed
      .filter((e) => e && e.timestamp && new Date(e.timestamp).getTime() > cutoff)
      .slice(0, RECENT_EVENTS_MAX_PERSISTED)
  } catch {
    return []
  }
}

function persistRecentEvents(events: PlatformEvent[]) {
  if (typeof window === 'undefined') return
  try {
    const toSave = events.slice(0, RECENT_EVENTS_MAX_PERSISTED)
    localStorage.setItem(RECENT_EVENTS_STORAGE_KEY, JSON.stringify(toSave))
  } catch {
    // ignore quota or parse errors
  }
}

export const usePlatformStore = create<PlatformState>((set, get) => ({
  // Initial state
  portfolioIntent: null,
  portfolioConfirmed: defaultPortfolio,
  activeStressTest: null,
  activeScenario: null,
  selectedStressTestId: null,
  selectedZone: null,
  selectedZones: [],
  openDigitalTwins: [],
  showDigitalTwinPanel: false,
  recentEvents: getInitialRecentEvents(),
  lastEventId: null,
  threatFeed: [],
  marketData: {},
  dataRefreshVersion: 0,
  lastRefreshBySource: {},
  lastSnapshotBySource: {},
  wsStatus: 'disconnected',
  commandMode: false,
  
  // Command Mode actions
  setCommandMode: (mode) => {
    set({ commandMode: mode })
  },
  
  toggleCommandMode: () => {
    set({ commandMode: !get().commandMode })
  },
  
  // Portfolio actions
  setPortfolioIntent: (portfolio) => {
    set({ portfolioIntent: portfolio })
  },
  
  setPortfolioConfirmed: (portfolio) => {
    set({ 
      portfolioConfirmed: portfolio,
      portfolioIntent: null  // Clear intent when confirmed
    })
  },
  
  updatePortfolio: (updates) => {
    const current = get().portfolioConfirmed
    set({ 
      portfolioConfirmed: { ...current, ...updates }
    })
  },
  
  // Stress test actions
  setStressTestIntent: (test) => {
    set({ 
      activeStressTest: { ...test, status: 'running' }
    })
  },
  
  confirmStressTest: (test) => {
    set({ 
      activeStressTest: { ...test, status: test.status || 'running' }
    })
  },
  
  updateStressTestProgress: (testId, progress, status) => {
    const current = get().activeStressTest
    if (current && current.id === testId) {
      set({ 
        activeStressTest: { 
          ...current, 
          progress,
          status: status || current.status
        }
      })
    }
  },
  
  clearStressTest: () => {
    set({ activeStressTest: null })
  },
  
  // Active Scenario actions
  setActiveScenario: (scenario) => {
    set({ activeScenario: scenario })
  },
  
  clearActiveScenario: () => {
    set({ activeScenario: null })
  },
  
  // Selected Stress Test ID actions
  setSelectedStressTestId: (id) => {
    set({ selectedStressTestId: id })
  },
  
  // Zone actions (single zone - Command Center)
  setSelectedZone: (zone) => {
    set({ selectedZone: zone })
  },
  
  // Zone actions (multiple zones - batch operations)
  selectZone: (zone, metadata) => {
    const current = get().selectedZones
    const exists = current.some(z => z.id === zone.id)
    
    if (!exists) {
      set({ 
        selectedZones: [...current, zone]
      })
      
      // Track event if metadata provided
      if (metadata?.eventId) {
        get().setLastEventId(metadata.eventId)
      }
    }
  },
  
  deselectZone: (zoneId) => {
    set({ 
      selectedZones: get().selectedZones.filter(z => z.id !== zoneId)
    })
  },
  
  setSelectedZones: (zones) => {
    set({ selectedZones: zones })
  },
  
  // Digital Twin actions
  openDigitalTwin: (cityId) => {
    const current = get().openDigitalTwins
    if (!current.includes(cityId)) {
      set({ openDigitalTwins: [...current, cityId] })
    }
  },
  
  closeDigitalTwin: (cityId) => {
    set({ 
      openDigitalTwins: get().openDigitalTwins.filter(id => id !== cityId)
    })
  },
  
  setShowDigitalTwinPanel: (show) => {
    set({ showDigitalTwinPanel: show })
  },
  
  // Event actions (keep last 100 in memory; persist last 50 to localStorage so Recent Activity survives refresh)
  addEvent: (event) => {
    const current = get().recentEvents
    const next = [event, ...current].slice(0, 100)
    set({ recentEvents: next })
    persistRecentEvents(next)
  },
  
  setLastEventId: (eventId) => {
    set({ lastEventId: eventId })
  },
  
  addThreatSignal: (signal) => {
    const withId = { ...signal, id: signal.id ?? `threat-${Date.now()}-${Math.random().toString(36).slice(2, 9)}` }
    set((s) => ({ threatFeed: dedupeThreatSignals([withId, ...s.threatFeed]) }))
  },
  setThreatFeed: (signals) => {
    set({ threatFeed: dedupeThreatSignals(signals ?? []) })
  },
  setMarketData: (data) => {
    set({ marketData: data ?? {} })
  },
  incrementDataRefreshVersion: () => {
    set((s) => ({ dataRefreshVersion: s.dataRefreshVersion + 1 }))
  },
  setLastRefresh: (sourceId, timestamp) => {
    if (!sourceId || !timestamp) return
    set((s) => ({
      lastRefreshBySource: {
        ...s.lastRefreshBySource,
        [sourceId]: timestamp,
      },
    }))
  },
  setLastSnapshotForSource: (sourceId, payload) => {
    if (!sourceId || !payload) return
    set((s) => ({
      lastSnapshotBySource: {
        ...s.lastSnapshotBySource,
        [sourceId]: {
          summary: payload.summary ?? {},
          last_events: Array.isArray(payload.last_events) ? payload.last_events : [],
          updated_at: payload.updated_at ?? new Date().toISOString(),
        },
      },
    }))
  },
  
  // WebSocket actions
  setWsStatus: (status) => {
    set({ wsStatus: status })
  },
  
  // Reset
  reset: () => {
    set({
      portfolioIntent: null,
      portfolioConfirmed: defaultPortfolio,
      activeStressTest: null,
      activeScenario: null,
      selectedStressTestId: null,
      selectedZone: null,
      selectedZones: [],
      openDigitalTwins: [],
      showDigitalTwinPanel: false,
      recentEvents: getInitialRecentEvents(),
      lastEventId: null,
      threatFeed: [],
      marketData: {},
      dataRefreshVersion: 0,
      lastRefreshBySource: {},
      lastSnapshotBySource: {},
      wsStatus: 'disconnected',
      commandMode: false,
    })
  },
}))

// Convenience hooks
export const usePortfolio = () => {
  const { portfolioIntent, portfolioConfirmed } = usePlatformStore()
  // Show intent if exists, otherwise confirmed
  return portfolioIntent ?? portfolioConfirmed
}

export const useActiveStressTest = () => {
  return usePlatformStore(state => state.activeStressTest)
}

export const useSelectedZone = () => {
  return usePlatformStore(state => state.selectedZone)
}

export const useSelectedZones = () => {
  return usePlatformStore(state => state.selectedZones)
}

export const useShowDigitalTwinPanel = () => {
  return usePlatformStore(state => state.showDigitalTwinPanel)
}

export const useRecentEvents = (limit: number = 10) => {
  return usePlatformStore(state => state.recentEvents.slice(0, limit))
}

export const useActiveScenario = () => {
  return usePlatformStore(state => state.activeScenario)
}

export const useSelectedStressTestId = () => {
  return usePlatformStore(state => state.selectedStressTestId)
}

export const useCommandMode = () => {
  return usePlatformStore(state => state.commandMode)
}

export const useToggleCommandMode = () => {
  return usePlatformStore(state => state.toggleCommandMode)
}
