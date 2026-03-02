/**
 * Platform WebSocket Hook
 * 
 * Connects to multi-channel WebSocket for real-time platform events.
 * Handles reconnection, channel subscription, and event routing to store.
 */
import { useEffect, useRef } from 'react'
import { usePlatformStore } from '../store/platformStore'
import { PlatformEvent, EventTypes } from '../types/events'
import { getApiBase } from '../config/env'

const WS_URL = '/api/v1/ws/connect'
const INITIAL_RECONNECT_DELAY = 3000
const MAX_RECONNECT_DELAY = 30000
const MAX_RECONNECT_ATTEMPTS = 5  // Reduced to avoid spam

// Check if we're in development mode without backend
const isDev = import.meta.env.DEV

interface WebSocketMessage {
  type: 'message' | 'connected' | 'subscribed' | 'unsubscribed' | 'pong' | 'stats'
  channel?: string
  data?: PlatformEvent | any
  timestamp?: string
}

const DEFAULT_CHANNELS = [
  'command_center',
  'dashboard',
  'stress_tests',
  'alerts',
  'threat_intelligence',
  'market_data',
  'natural_hazards',
  'weather',
  'biosecurity',
  'cyber_threats',
  'infrastructure',
]
export { DEFAULT_CHANNELS }
export function usePlatformWebSocket(channels: string[] = DEFAULT_CHANNELS) {
  const store = usePlatformStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    // Determine WebSocket URL
    const apiBase = getApiBase()
    const channelsParam = channels.join(',')
    // Runtime ?api= or VITE_API_URL: use that host for WS. Dev: direct to 9002. Else same-origin.
    let wsUrl: string
    if (apiBase) {
      wsUrl = apiBase.replace(/^http/, 'ws').replace(/\/+$/, '') + WS_URL + '?channels=' + channelsParam
    } else if (isDev) {
      wsUrl = `ws://127.0.0.1:9002${WS_URL}?channels=${channelsParam}`
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
      wsUrl = `${protocol}//${window.location.host}${WS_URL}?channels=${channelsParam}`
    }
    
    const connect = () => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        return
      }
      
      store.setWsStatus('connecting')
      
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws
        
        ws.onopen = () => {
          if (!isDev) {
            console.log('[PlatformWS] Connected')
          }
          store.setWsStatus('connected')
          reconnectAttemptsRef.current = 0
        }
        
        ws.onmessage = (event) => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data)
            
            switch (message.type) {
              case 'connected':
                // Silent - connection already logged in onopen
                break
                
              case 'message':
                if (message.data && message.channel) {
                  if (message.channel === 'market_data' && typeof message.data === 'object' && !Array.isArray(message.data) && message.data !== null) {
                    store.setMarketData(message.data as Record<string, number>)
                    store.setLastRefresh('market_data', new Date().toISOString())
                  } else if (
                    ['natural_hazards', 'weather', 'biosecurity', 'cyber_threats', 'infrastructure'].includes(message.channel) &&
                    typeof message.data === 'object' &&
                    message.data !== null &&
                    'source_id' in message.data
                  ) {
                    const payload = message.data as { source_id: string; summary?: Record<string, unknown>; last_events?: unknown[]; updated_at?: string }
                    const lastEvents = Array.isArray(payload.last_events) ? payload.last_events : []
                    store.setLastSnapshotForSource(payload.source_id, {
                      summary: payload.summary,
                      last_events: lastEvents,
                      updated_at: payload.updated_at,
                    })
                    if (payload.updated_at) store.setLastRefresh(payload.source_id, payload.updated_at)
                  } else {
                    handleEvent(message.data as PlatformEvent, message.channel)
                  }
                }
                break
                
              case 'subscribed':
                // Silent
                break
                
              case 'pong':
                // Keepalive response
                break
                
              default:
                // Ignore unknown message types silently
                break
            }
          } catch {
            // Silently ignore parse errors
          }
        }
        
        ws.onerror = () => {
          // Don't spam console - backend might not be running
          if (!isDev && reconnectAttemptsRef.current === 0) {
            console.warn('[PlatformWS] Connection failed (backend may be offline)')
          }
          store.setWsStatus('disconnected')
        }
        
        ws.onclose = () => {
          store.setWsStatus('disconnected')
          
          // Attempt reconnection with exponential backoff
          if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttemptsRef.current++
            // Exponential backoff: 3s, 6s, 12s, 24s, 30s (max)
            const delay = Math.min(
              INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current - 1),
              MAX_RECONNECT_DELAY
            )
            
            // Only log first attempt in production
            if (reconnectAttemptsRef.current === 1 && !isDev) {
              console.log('[PlatformWS] Will retry connection...')
            }
            
            reconnectTimeoutRef.current = setTimeout(() => {
              connect()
            }, delay)
          } else {
            // Silent - just stay offline
            if (!isDev) {
              console.warn('[PlatformWS] Connection unavailable, staying offline')
            }
          }
        }
        
        // Send ping every 30 seconds for keepalive
        const pingInterval = setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ action: 'ping' }))
          }
        }, 30000)
        
        // Cleanup ping interval on close
        ws.addEventListener('close', () => {
          clearInterval(pingInterval)
        })
        
      } catch {
        // WebSocket creation failed - stay offline silently
        store.setWsStatus('disconnected')
      }
    }
    
    const handleEvent = (event: PlatformEvent, _channel: string) => {
      // Add event to history
      store.addEvent(event)
      store.setLastEventId(event.event_id)

      // Ignore summary messages without data (audit 3.3: dashboard duplicate can send event_type without full payload)
      const needsData: string[] = [
        EventTypes.STRESS_TEST_STARTED,
        EventTypes.STRESS_TEST_PROGRESS,
        EventTypes.PORTFOLIO_UPDATED,
        EventTypes.ZONE_SELECTED,
      ]
      if (needsData.includes(event.event_type) && (event.data == null || typeof event.data !== 'object')) {
        return
      }
      
      // Route event to appropriate store action based on event type
      switch (event.event_type) {
        case EventTypes.STRESS_TEST_STARTED:
          // Update active stress test
          if (event.intent) {
            store.setStressTestIntent({
              id: event.entity_id,
              name: event.data.name || 'Stress Test',
              type: event.data.type || 'unknown',
              severity: event.data.severity || 0.5,
              probability: event.data.probability || 0.5,
              started_at: event.timestamp,
            })
          }
          // Set active scenario for visualization (syncs to Dashboard)
          store.setActiveScenario({
            type: event.data.test_type || event.data.type || 'unknown',
            severity: event.data.severity || 0.5,
            probability: event.data.probability || 0.5,
            started_at: event.timestamp,
          })
          // Set selected stress test ID
          store.setSelectedStressTestId(event.entity_id)
          break
          
        case EventTypes.STRESS_TEST_COMPLETED:
        case EventTypes.STRESS_TEST_FAILED:
          store.confirmStressTest({
            id: event.entity_id,
            name: event.data.name || 'Stress Test',
            type: event.data.type || 'unknown',
            severity: event.data.severity || 0.5,
            probability: event.data.probability || 0.5,
            status: event.event_type === EventTypes.STRESS_TEST_COMPLETED ? 'completed' : 'failed',
          })
          // Clear active scenario when test completes (keeps results visible in store)
          // Note: We don't clear immediately to allow Dashboard to show completion
          // The activeScenario will be cleared when a new test starts
          break
          
        case EventTypes.STRESS_TEST_PROGRESS:
          store.updateStressTestProgress(
            event.entity_id,
            event.data.progress || 0,
            event.data.status
          )
          break
          
        case EventTypes.STRESS_TEST_DELETED:
          // If the deleted test is the currently selected one, clear it
          if (store.selectedStressTestId === event.entity_id) {
            store.setSelectedStressTestId(null)
            store.clearActiveScenario()
            store.clearStressTest()
          }
          break
          
        case EventTypes.RISK_ZONE_CREATED:
          // Zone created - could trigger refresh of zones list
          // For now, just log it (actual zone data will be fetched on demand)
          console.log('[PlatformWS] Risk zone created:', event.data.name)
          break
          
        case EventTypes.ZONE_SELECTED: {
          const zone = event.data?.zone ?? (event.entity_id && event.data ? {
            id: event.entity_id,
            name: event.data.name,
            risk_score: typeof event.data.risk_score === 'number' ? event.data.risk_score : 0,
            total_exposure: typeof event.data.exposure === 'number' ? event.data.exposure : (event.data.total_exposure ?? 0),
            zone_level: (event.data.zone_level as 'critical' | 'high' | 'medium' | 'low') || 'medium',
            center_latitude: typeof event.data.center_latitude === 'number' ? event.data.center_latitude : 0,
            center_longitude: typeof event.data.center_longitude === 'number' ? event.data.center_longitude : 0,
            radius_km: typeof event.data.radius_km === 'number' ? event.data.radius_km : 0,
          } : null)
          if (zone && zone.id) {
            store.selectZone(zone, {
              eventId: event.event_id,
              causedBy: event.caused_by || null,
            })
          }
          break
        }
          
        case EventTypes.ZONE_DESELECTED:
          if (event.entity_id) {
            store.deselectZone(event.entity_id)
          }
          break
          
        case EventTypes.PORTFOLIO_UPDATED:
          const p = event.data?.portfolio
          // Guard: only update store if portfolio looks like PortfolioState (audit 3.1)
          const hasShape = p && typeof p === 'object' &&
            typeof (p as Record<string, unknown>).totalExposure === 'number' &&
            typeof (p as Record<string, unknown>).atRisk === 'number' &&
            typeof (p as Record<string, unknown>).criticalCount === 'number' &&
            typeof (p as Record<string, unknown>).weightedRisk === 'number'
          if (hasShape) {
            const portfolio = p as { totalExposure: number; atRisk: number; criticalCount: number; weightedRisk: number }
            if (event.intent) {
              store.setPortfolioIntent(portfolio)
            } else {
              store.setPortfolioConfirmed(portfolio)
            }
          }
          console.log('[PlatformWS] Portfolio updated:', event.data?.action || 'update')
          break
          
        case EventTypes.ASSET_RISK_UPDATED:
          // Asset risk was recalculated - log for activity feed
          console.log('[PlatformWS] Asset risk updated:', event.data?.name)
          break
          
        case EventTypes.TWIN_OPENED:
          if (event.entity_id) {
            store.openDigitalTwin(event.entity_id)
          }
          break
          
        case EventTypes.TWIN_CLOSED:
          if (event.entity_id) {
            store.closeDigitalTwin(event.entity_id)
          }
          break

        case EventTypes.SOCIAL_THREAT_DETECTED:
          if (event.data && typeof event.data === 'object') {
            store.addThreatSignal({
              id: event.event_id,
              source: (event.data.source as string) ?? 'social',
              text: (event.data.text as string) ?? (event.data.snippet as string) ?? '',
              sentiment_score: typeof event.data.sentiment_score === 'number' ? event.data.sentiment_score : undefined,
              threat_level: typeof event.data.threat_level === 'number' ? event.data.threat_level : undefined,
              risk_type: typeof event.data.risk_type === 'string' ? event.data.risk_type : undefined,
              timestamp: event.timestamp,
              url: typeof event.data.url === 'string' ? event.data.url : undefined,
              entities: typeof event.data.entities === 'object' && event.data.entities !== null ? event.data.entities as Record<string, unknown> : undefined,
            })
          }
          break

        case EventTypes.DATA_REFRESH_COMPLETED:
          store.incrementDataRefreshVersion()
          if (event.data?.source_id) {
            const ts = event.data?.summary?.updated_at ?? event.timestamp
            if (ts) store.setLastRefresh(String(event.data.source_id), typeof ts === 'string' ? ts : (ts as Date)?.toISOString?.() ?? String(ts))
          }
          break
          
        default:
          // Silently ignore unhandled event types
          break
      }
    }
    
    connect()
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        const ws = wsRef.current
        // Avoid noisy browser warning in React StrictMode:
        // "WebSocket is closed before the connection is established."
        // If we're still CONNECTING, don't call close() immediately; instead close right after open.
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.close() } catch { /* ignore */ }
        } else if (ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.onopen = () => {
              try { ws.close() } catch { /* ignore */ }
            }
            ws.onerror = null
          } catch { /* ignore */ }
        }
        wsRef.current = null
      }
    }
  }, [channels.join(',')])  // Reconnect if channels change
  
  return {
    status: store.wsStatus,
    send: (data: any) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data))
      }
    },
  }
}
