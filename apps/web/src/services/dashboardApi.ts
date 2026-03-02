/**
 * Dashboard API — RiskMirror (Today Card), Sentiment Meter, War Room Card.
 */

const API_BASE = '/api/v1/dashboard'

export interface SignalSource {
  type: 'news' | 'climate' | 'market' | 'alert'
  headline: string
  severity: 'low' | 'medium' | 'high' | 'critical'
}

export interface TodayCardResponse {
  focus: string
  top_risk: string
  top_risk_id: string | null
  dont_touch: string
  dont_touch_id: string | null
  main_reason: string | null
  morning_brief: string | null
  sources: string[]
  signals: SignalSource[]
}

export interface SentimentMeterResponse {
  value: number
  label: 'panic' | 'neutral' | 'hype'
  main_reason: string
}

export interface WarRoomRisk {
  name: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  sector: string
}

export interface WarRoomAction {
  action: string
  priority: 'immediate' | 'short-term' | 'medium-term'
  impact: string
}

export interface WarRoomCardResponse {
  top_risks: WarRoomRisk[]
  actions: WarRoomAction[]
  today_priority: { title: string; reason: string }
  generated_at: string
  data_sources: string[]
}

const DASHBOARD_FETCH_TIMEOUT_MS = 20_000 // 20s — backend has 10s signals + 8s LLM timeouts

export async function getTodayCard(callerSignal?: AbortSignal): Promise<TodayCardResponse> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), DASHBOARD_FETCH_TIMEOUT_MS)
  if (callerSignal) callerSignal.addEventListener('abort', () => { clearTimeout(t); controller.abort() })
  try {
    const res = await fetch(`${API_BASE}/today-card`, { signal: controller.signal })
    if (!res.ok) throw new Error('Failed to fetch today card')
    return res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function getSentimentMeter(callerSignal?: AbortSignal): Promise<SentimentMeterResponse> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), 10_000)
  if (callerSignal) callerSignal.addEventListener('abort', () => { clearTimeout(t); controller.abort() })
  try {
    const res = await fetch(`${API_BASE}/sentiment-meter`, { signal: controller.signal })
    if (!res.ok) throw new Error('Failed to fetch sentiment meter')
    return res.json()
  } finally {
    clearTimeout(t)
  }
}

export async function getWarRoomCard(callerSignal?: AbortSignal): Promise<WarRoomCardResponse> {
  const controller = new AbortController()
  const t = setTimeout(() => controller.abort(), DASHBOARD_FETCH_TIMEOUT_MS)
  if (callerSignal) callerSignal.addEventListener('abort', () => { clearTimeout(t); controller.abort() })
  try {
    const res = await fetch(`${API_BASE}/war-room-card`, { signal: controller.signal })
    if (!res.ok) throw new Error('Failed to fetch war room card')
    return res.json()
  } finally {
    clearTimeout(t)
  }
}
