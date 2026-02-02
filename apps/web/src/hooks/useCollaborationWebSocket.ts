/**
 * useCollaborationWebSocket (Phase 6.3-6.4)
 * Connects to backend websocket and exchanges viewer/annotation events.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useCollaborationStore } from '../store/collaborationStore'

type CollaborationEvent =
  | { event: 'viewer.position'; payload: { position: { x: number; y: number; z: number }; focus_asset_id?: string | null } }
  | { event: 'viewer.focus_asset'; payload: { focus_asset_id: string | null } }
  | { event: 'annotation.add'; payload: { id: string; text: string; position: { x: number; y: number; z: number }; asset_id?: string | null; project_id?: string | null; author_id?: string | null; created_at?: string } }

export function useCollaborationWebSocket() {
  const setMyConnectionId = useCollaborationStore((s) => s.setMyConnectionId)
  const upsertPeer = useCollaborationStore((s) => s.upsertPeer)
  const addAnnotation = useCollaborationStore((s) => s.addAnnotation)
  const prunePeers = useCollaborationStore((s) => s.prunePeers)

  const wsRef = useRef<WebSocket | null>(null)
  const [status, setStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

  const wsUrl = useMemo(() => {
    const proto = window.location.protocol === 'https:' ? 'wss' : 'ws'
    // Backend websocket router is mounted at /api/v1/ws
    // In dev, connect directly to API to avoid Vite WS proxy flakiness (EPIPE/ECONNRESET/ECONNREFUSED).
    const host = import.meta.env.DEV ? '127.0.0.1:9002' : window.location.host
    return `${proto}://${host}/api/v1/ws/connect?channels=viewer,annotations`
  }, [])

  useEffect(() => {
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws
    setStatus('connecting')

    ws.onopen = () => setStatus('connected')
    ws.onclose = () => setStatus('disconnected')
    ws.onerror = () => setStatus('disconnected')

    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data)

        if (msg?.type === 'connected') {
          if (msg.connection_id) setMyConnectionId(String(msg.connection_id))
          return
        }

        if (msg?.type === 'message') {
          const channel = msg.channel
          const data = msg.data
          const event = data?.event as CollaborationEvent['event'] | undefined
          const payload = data?.payload ?? {}
          const from = data?.from_connection_id ? String(data.from_connection_id) : null
          if (!event || !from) return

          if (channel === 'viewer') {
            if (event === 'viewer.position') {
              upsertPeer({
                id: from,
                last_seen_at: Date.now(),
                position: payload.position,
                focus_asset_id: payload.focus_asset_id ?? null,
              })
            } else if (event === 'viewer.focus_asset') {
              upsertPeer({
                id: from,
                last_seen_at: Date.now(),
                focus_asset_id: payload.focus_asset_id ?? null,
              })
            }
          }

          if (channel === 'annotations' && event === 'annotation.add') {
            addAnnotation({
              id: String(payload.id),
              text: String(payload.text || ''),
              position: payload.position,
              asset_id: payload.asset_id ?? null,
              project_id: payload.project_id ?? null,
              author_id: payload.author_id ?? null,
              created_at: payload.created_at ?? new Date().toISOString(),
            })
          }
        }
      } catch {
        // ignore
      }
    }

    const pruneInterval = window.setInterval(() => prunePeers(60_000), 10_000)
    return () => {
      window.clearInterval(pruneInterval)
      // Avoid noisy browser warning when closing a CONNECTING websocket in React StrictMode.
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
    }
  }, [wsUrl, setMyConnectionId, upsertPeer, addAnnotation, prunePeers])

  const sendEvent = (event: CollaborationEvent['event'], payload: any) => {
    const ws = wsRef.current
    if (!ws || ws.readyState !== WebSocket.OPEN) return
    ws.send(JSON.stringify({ action: 'event', event, payload }))
  }

  return {
    status,
    sendViewerPosition: (position: { x: number; y: number; z: number }, focus_asset_id?: string | null) =>
      sendEvent('viewer.position', { position, focus_asset_id: focus_asset_id ?? null }),
    sendFocusAsset: (focus_asset_id: string | null) => sendEvent('viewer.focus_asset', { focus_asset_id }),
    sendAnnotationAdd: (payload: Extract<CollaborationEvent, { event: 'annotation.add' }>['payload']) =>
      sendEvent('annotation.add', payload),
  }
}

