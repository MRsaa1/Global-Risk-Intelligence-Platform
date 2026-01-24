/**
 * Platform WebSocket Hook
 * 
 * Connects to multi-channel WebSocket for real-time platform events.
 * Handles reconnection, channel subscription, and event routing to store.
 */
import { useEffect, useRef } from 'react'
import { usePlatformStore } from '../store/platformStore'
import { PlatformEvent, EventTypes, getChannelForEvent } from '../types/events'

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

export function usePlatformWebSocket(channels: string[] = ['command_center', 'dashboard', 'stress_tests']) {
  const store = usePlatformStore()
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  useEffect(() => {
    // Determine WebSocket URL
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.host
    const channelsParam = channels.join(',')
    const wsUrl = `${protocol}//${host}${WS_URL}?channels=${channelsParam}`
    
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
                  handleEvent(message.data as PlatformEvent, message.channel)
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
    
    const handleEvent = (event: PlatformEvent, channel: string) => {
      // Add event to history
      store.addEvent(event)
      
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
          
        case EventTypes.ZONE_SELECTED:
          if (event.data.zone) {
            store.selectZone(event.data.zone, {
              eventId: event.event_id,
              causedBy: event.caused_by || null,
            })
          }
          break
          
        case EventTypes.ZONE_DESELECTED:
          if (event.entity_id) {
            store.deselectZone(event.entity_id)
          }
          break
          
        case EventTypes.PORTFOLIO_UPDATED:
          const p = event.data?.portfolio
          // Guard: only update store if portfolio looks like PortfolioState
          if (p && typeof p.totalExposure === 'number' && typeof p.atRisk === 'number') {
            if (event.intent) {
              store.setPortfolioIntent(p)
            } else {
              store.setPortfolioConfirmed(p)
            }
          }
          // Always log for activity feed
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
          
        default:
          // Silently ignore unhandled event types
          break
      }
      
      // Update last event ID for causality chain
      store.setLastEventId(event.event_id)
    }
    
    connect()
    
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (wsRef.current) {
        try {
          // Only close if not already closed
          if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
            try {
              wsRef.current.close()
            } catch (e) {
              // Ignore errors when closing during connection
            }
          }
        } catch (e) {
          // Ignore errors during cleanup
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
