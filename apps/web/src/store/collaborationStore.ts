/**
 * Collaboration Store (Phase 6.3-6.4)
 * Tracks peers and scene annotations for Present/3D collaboration.
 */
import { create } from 'zustand'

export interface ViewerVector3 {
  x: number
  y: number
  z: number
}

export interface PeerState {
  id: string
  last_seen_at: number
  position?: ViewerVector3
  focus_asset_id?: string | null
}

export interface SceneAnnotation {
  id: string
  asset_id?: string | null
  project_id?: string | null
  position: ViewerVector3
  text: string
  created_at: string
  author_id?: string | null
}

interface CollaborationState {
  my_connection_id: string | null
  peers: Record<string, PeerState>
  annotations: SceneAnnotation[]

  setMyConnectionId: (id: string | null) => void
  upsertPeer: (peer: PeerState) => void
  removePeer: (id: string) => void
  prunePeers: (maxAgeMs: number) => void

  addAnnotation: (a: SceneAnnotation) => void
  setAnnotations: (items: SceneAnnotation[]) => void
  resetSessionData: () => void
  clear: () => void
}

export const useCollaborationStore = create<CollaborationState>((set, get) => ({
  my_connection_id: null,
  peers: {},
  annotations: [],

  setMyConnectionId: (id) => set({ my_connection_id: id }),

  upsertPeer: (peer) =>
    set((state) => ({
      peers: {
        ...state.peers,
        [peer.id]: peer,
      },
    })),

  removePeer: (id) =>
    set((state) => {
      const next = { ...state.peers }
      delete next[id]
      return { peers: next }
    }),

  prunePeers: (maxAgeMs) => {
    const now = Date.now()
    const peers = get().peers
    const next: Record<string, PeerState> = {}
    for (const [id, peer] of Object.entries(peers)) {
      if (now - peer.last_seen_at <= maxAgeMs) next[id] = peer
    }
    set({ peers: next })
  },

  addAnnotation: (a) =>
    set((state) => {
      const existing = state.annotations
      const idx = existing.findIndex((x) => x.id === a.id)
      if (idx >= 0) {
        const next = existing.slice()
        next[idx] = { ...next[idx], ...a }
        return { annotations: next }
      }
      return { annotations: [a, ...existing].slice(0, 200) }
    }),

  setAnnotations: (items) =>
    set(() => {
      // Dedupe (keep newest ordering)
      const seen = new Set<string>()
      const next: SceneAnnotation[] = []
      for (const a of items) {
        if (!a?.id || seen.has(a.id)) continue
        seen.add(a.id)
        next.push(a)
      }
      return { annotations: next.slice(0, 200) }
    }),

  resetSessionData: () => set((state) => ({ peers: {}, annotations: [], my_connection_id: state.my_connection_id })),
  clear: () => set({ my_connection_id: null, peers: {}, annotations: [] }),
}))

