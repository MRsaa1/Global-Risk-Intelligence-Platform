/**
 * Platform Store - Global State Management for Command Center and Dashboard
 * 
 * Uses Zustand for lightweight, performant state management.
 * Implements dual state model: Intent (optimistic) vs Confirmed (backend verified)
 */
import { create } from 'zustand'
import { PlatformEvent, EventTypes } from '../types/events'
import { RiskZone } from '../components/CesiumGlobe'

// Portfolio State
export interface PortfolioState {
  totalExposure: number  // in billions
  atRisk: number         // in billions
  criticalCount: number  // number of critical hotspots
  weightedRisk: number   // 0-1
  totalAssets?: number
  digitalTwins?: number
  portfolioValue?: number  // in billions
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
  
  // WebSocket status
  wsStatus: 'connecting' | 'connected' | 'disconnected'
  
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
  
  // Actions - WebSocket
  setWsStatus: (status: 'connecting' | 'connected' | 'disconnected') => void
  
  // Reset
  reset: () => void
}

// Default portfolio state
const defaultPortfolio: PortfolioState = {
  totalExposure: 247.3,
  atRisk: 52.1,
  criticalCount: 4,
  weightedRisk: 0.68,
  totalAssets: 1284,
  digitalTwins: 1156,
  portfolioValue: 4.2,
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
  recentEvents: [],
  lastEventId: null,
  wsStatus: 'disconnected',
  
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
  
  // Event actions
  addEvent: (event) => {
    const current = get().recentEvents
    set({ 
      recentEvents: [event, ...current].slice(0, 100)  // Keep last 100
    })
  },
  
  setLastEventId: (eventId) => {
    set({ lastEventId: eventId })
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
      recentEvents: [],
      lastEventId: null,
      wsStatus: 'disconnected',
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
