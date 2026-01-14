/**
 * WebSocket Hook for Real-time Updates
 * =====================================
 * 
 * Connects to backend streaming API for:
 * - Live risk score updates
 * - Sensor data streaming
 * - Alert notifications
 * - Market data feeds
 */
import { useEffect, useRef, useState, useCallback } from 'react'

export type WebSocketStatus = 'connecting' | 'connected' | 'disconnected' | 'error'

export interface RiskUpdate {
  type: 'risk_update'
  hotspot_id: string
  risk_score: number
  previous_score: number
  timestamp: string
}

export interface AlertMessage {
  type: 'alert'
  severity: 'info' | 'warning' | 'critical'
  title: string
  message: string
  timestamp: string
}

export interface SensorData {
  type: 'sensor'
  asset_id: string
  sensor_type: string
  value: number
  unit: string
  timestamp: string
}

export type WebSocketMessage = RiskUpdate | AlertMessage | SensorData

interface UseWebSocketOptions {
  url?: string
  onMessage?: (message: WebSocketMessage) => void
  onConnect?: () => void
  onDisconnect?: () => void
  reconnectInterval?: number
  maxReconnectAttempts?: number
}

export function useWebSocket({
  url = '/api/v1/streaming/ws/stream',
  onMessage,
  onConnect,
  onDisconnect,
  reconnectInterval = 5000,
  maxReconnectAttempts = 10,
}: UseWebSocketOptions = {}) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>()
  
  const [status, setStatus] = useState<WebSocketStatus>('disconnected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const [messages, setMessages] = useState<WebSocketMessage[]>([])

  const connect = useCallback(() => {
    // Determine WebSocket URL
    const wsUrl = url.startsWith('ws') 
      ? url 
      : `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}${url}`

    console.log('WebSocket connecting to:', wsUrl)
    setStatus('connecting')

    try {
      const ws = new WebSocket(wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        console.log('WebSocket connected')
        setStatus('connected')
        reconnectAttemptsRef.current = 0
        onConnect?.()
      }

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data) as WebSocketMessage
          setLastMessage(data)
          setMessages(prev => [...prev.slice(-99), data]) // Keep last 100 messages
          onMessage?.(data)
        } catch (e) {
          console.warn('Failed to parse WebSocket message:', e)
        }
      }

      ws.onerror = (error) => {
        console.error('WebSocket error:', error)
        setStatus('error')
      }

      ws.onclose = () => {
        console.log('WebSocket disconnected')
        setStatus('disconnected')
        onDisconnect?.()

        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++
          console.log(`Reconnecting in ${reconnectInterval}ms (attempt ${reconnectAttemptsRef.current}/${maxReconnectAttempts})`)
          
          reconnectTimeoutRef.current = setTimeout(() => {
            connect()
          }, reconnectInterval)
        }
      }
    } catch (e) {
      console.error('Failed to create WebSocket:', e)
      setStatus('error')
    }
  }, [url, onMessage, onConnect, onDisconnect, reconnectInterval, maxReconnectAttempts])

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    
    setStatus('disconnected')
  }, [])

  const send = useCallback((data: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data))
    } else {
      console.warn('WebSocket not connected, cannot send message')
    }
  }, [])

  // Connect on mount
  useEffect(() => {
    connect()
    
    return () => {
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    status,
    lastMessage,
    messages,
    send,
    connect,
    disconnect,
  }
}

// Simulated WebSocket for demo (when backend WS is not available)
export function useSimulatedWebSocket(
  onMessage?: (message: WebSocketMessage) => void
) {
  const [status, setStatus] = useState<WebSocketStatus>('connected')
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null)
  const intervalRef = useRef<NodeJS.Timeout>()

  useEffect(() => {
    setStatus('connected')
    
    // Simulate random risk updates
    intervalRef.current = setInterval(() => {
      const hotspots = ['tokyo', 'shanghai', 'newyork', 'london', 'dubai', 'hongkong', 'singapore']
      const randomHotspot = hotspots[Math.floor(Math.random() * hotspots.length)]
      const previousScore = 0.5 + Math.random() * 0.4
      const change = (Math.random() - 0.5) * 0.1
      const newScore = Math.max(0.1, Math.min(0.99, previousScore + change))

      const message: RiskUpdate = {
        type: 'risk_update',
        hotspot_id: randomHotspot,
        risk_score: newScore,
        previous_score: previousScore,
        timestamp: new Date().toISOString(),
      }

      setLastMessage(message)
      onMessage?.(message)
    }, 5000) // Update every 5 seconds

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [onMessage])

  return {
    status,
    lastMessage,
    messages: lastMessage ? [lastMessage] : [],
    send: () => {},
    connect: () => {},
    disconnect: () => {},
  }
}
