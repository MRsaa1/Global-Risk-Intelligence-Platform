/**
 * Platform Event Types for Event-Driven Architecture
 * 
 * Mirrors backend events.py for type safety
 */

export interface PlatformEvent {
  event_id: string
  event_type: string
  version: string
  timestamp: string
  
  // Causality chain
  caused_by?: string | null
  triggers: string[]
  
  // Actor
  actor_id?: string | null
  actor_type: 'user' | 'system' | 'agent'
  
  // Payload
  entity_type: string
  entity_id: string
  action: string
  data: Record<string, any>
  
  // State
  intent: boolean  // true = intent (optimistic), false = confirmed
}

export const EventTypes = {
  // Stress Tests
  STRESS_TEST_STARTED: 'stress_test.started',
  STRESS_TEST_COMPLETED: 'stress_test.completed',
  STRESS_TEST_FAILED: 'stress_test.failed',
  STRESS_TEST_PROGRESS: 'stress_test.progress',
  STRESS_TEST_DELETED: 'STRESS_TEST_DELETED',  // Backend uses uppercase
  
  // Zones
  ZONE_SELECTED: 'zone.selected',
  ZONE_DESELECTED: 'zone.deselected',
  ZONE_RISK_UPDATED: 'zone.risk_updated',
  RISK_ZONE_CREATED: 'RISK_ZONE_CREATED',  // Backend uses uppercase
  
  // Portfolio
  PORTFOLIO_UPDATED: 'portfolio.updated',
  EXPOSURE_CHANGED: 'exposure.changed',
  ASSET_RISK_UPDATED: 'asset.risk_updated',
  
  // Digital Twin
  TWIN_OPENED: 'twin.opened',
  TWIN_CLOSED: 'twin.closed',
  TWIN_STATE_CHANGED: 'twin.state_changed',
  
  // Historical Events
  HISTORICAL_EVENT_SELECTED: 'historical.selected',
  HISTORICAL_SCENARIO_APPLIED: 'historical.applied',
  
  // System
  SYSTEM_HEALTH_CHANGED: 'system.health_changed',
  ALERT_GENERATED: 'alert.generated',
} as const

export type EventType = typeof EventTypes[keyof typeof EventTypes]

/**
 * Get WebSocket channel for event type
 */
export function getChannelForEvent(eventType: string): string {
  if (eventType.startsWith('stress_test')) {
    return 'stress_tests'
  } else if (eventType.startsWith('zone') || eventType.startsWith('twin') || eventType.startsWith('historical')) {
    return 'command_center'
  } else if (eventType.startsWith('portfolio') || eventType.startsWith('exposure') || eventType.startsWith('asset')) {
    return 'dashboard'
  } else if (eventType.startsWith('alert')) {
    return 'alerts'
  } else {
    return 'dashboard'
  }
}
