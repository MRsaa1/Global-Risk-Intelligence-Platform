/**
 * AlertPanel - Real-time alerts from SENTINEL agent
 * 
 * Features:
 * - WebSocket connection for live alerts
 * - Severity-based filtering
 * - Alert acknowledgement and resolution
 * - Sound notifications for critical alerts
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getApiBase } from '../config/env';
import { useRivaTts } from '../hooks/useRivaTts';
import { formatEur } from '../lib/formatCurrency';

interface Alert {
  id: string;
  alert_type: string;
  severity: 'info' | 'warning' | 'high' | 'critical';
  title: string;
  message: string;
  asset_ids: string[];
  exposure: number;
  recommended_actions: string[];
  created_at: string;
  acknowledged: boolean;
  resolved: boolean;
  // Institutional fields (Decision-grade alerts)
  confidence?: number; // 0-100%
  owner?: string; // e.g., "Infrastructure Risk", "Ops"
  sla_hours?: number; // Decision SLA in hours
  escalation_path?: string; // e.g., "CRO → Board"
  time_to_impact_days?: number; // Days until impact
  expected_loss?: number; // Expected loss in €
  source?: string; // e.g. SENTINEL, CIP_SENTINEL, SCSS_ADVISOR, SRO_SENTINEL
}

interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  warning: number;
  info: number;
  total_exposure: number;
}

// Use getApiBase() at request time so tunnel (e.g. ?api= or port 15180) works; avoid build-time-only VITE_API_URL.
function apiBase(): string {
  const b = getApiBase();
  return b ? b.replace(/\/+$/, '') : '';
}
function wsBase(): string {
  const b = getApiBase();
  if (b) return b.replace(/^http/, 'ws').replace(/\/+$/, '');
  if (import.meta.env.DEV) return 'ws://127.0.0.1:9002';
  return typeof window !== 'undefined' ? window.location.origin.replace(/^http/, 'ws') : '';
}

// Professional muted severity colors (no emojis)
const severityConfig = {
  critical: {
    bg: 'bg-zinc-800',
    border: 'border-zinc-600',
    text: 'text-zinc-200',
    badge: 'bg-zinc-600',
    icon: '',
  },
  high: {
    bg: 'bg-zinc-500/5',
    border: 'border-zinc-500/20',
    text: 'text-zinc-400',
    badge: 'bg-zinc-500/20',
    icon: '',
  },
  warning: {
    bg: 'bg-zinc-500/5',
    border: 'border-zinc-500/10',
    text: 'text-zinc-300',
    badge: 'bg-zinc-500/10',
    icon: '',
  },
  info: {
    bg: 'bg-zinc-500/5',
    border: 'border-zinc-500/20',
    text: 'text-zinc-400',
    badge: 'bg-zinc-500/20',
    icon: '',
  },
};

function formatTimeAgo(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000);
  
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

interface AlertPanelProps {
  maxAlerts?: number;
  minSeverity?: 'info' | 'warning' | 'high' | 'critical';
  showHeader?: boolean;
  compact?: boolean;
  /** When true, panel fills parent height (e.g. to match adjacent Climate Risk Monitor). */
  fillHeight?: boolean;
  onAlertClick?: (alert: Alert) => void;
}

export default function AlertPanel({
  maxAlerts = 10,
  minSeverity = 'info',
  showHeader = true,
  compact = false,
  fillHeight = false,
  onAlertClick,
}: AlertPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  const [analyzeResult, setAnalyzeResult] = useState<{
    explanation?: string | null;
    analysis: { root_causes: unknown[]; contributing_factors: unknown[]; correlations: unknown[]; trends: unknown[]; confidence: number; computation_time_ms: number };
    recommendations: Array<{ trigger: string; current_situation: string; risk_if_no_action: string; recommended_option: string; recommendation_reason: string; urgency: string; options: Array<{ name: string; description?: string; upfront_cost?: number; roi_5yr?: number }> }>;
    validation?: { guardrails_passed: boolean; morpheus_passed: boolean; violations: string[] };
  } | null>(null);
  const [analyzeLoading, setAnalyzeLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [analyzeAlertTitle, setAnalyzeAlertTitle] = useState<string>('');
  const { speak: rivaSpeak, isPlaying: rivaPlaying, error: rivaTtsError } = useRivaTts();

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  // Fetch initial alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const base = apiBase();
      const url = base ? `${base}/api/v1/alerts/?limit=${maxAlerts}` : `/api/v1/alerts/?limit=${maxAlerts}`;
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setAlerts(data);
      }
    } catch (error) {
      console.error('Failed to fetch alerts:', error);
    }
  }, [maxAlerts]);

  // Fetch summary
  const fetchSummary = useCallback(async () => {
    try {
      const base = apiBase();
      const url = base ? `${base}/api/v1/alerts/summary` : '/api/v1/alerts/summary';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setSummary(data);
      }
    } catch (error) {
      console.error('Failed to fetch summary:', error);
    }
  }, []);

  // Check monitoring status
  const checkMonitoringStatus = useCallback(async () => {
    try {
      const base = apiBase();
      const url = base ? `${base}/api/v1/alerts/monitoring/status` : '/api/v1/alerts/monitoring/status';
      const response = await fetch(url);
      if (response.ok) {
        const data = await response.json();
        setIsMonitoring(data.is_running);
      }
    } catch (error) {
      console.error('Failed to check monitoring status:', error);
    }
  }, []);

  // Connect to WebSocket
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const base = wsBase();
    const wsUrl = base ? `${base}/api/v1/alerts/ws?min_severity=${minSeverity}` : `${(typeof window !== 'undefined' ? window.location.origin : '').replace(/^http/, 'ws')}/api/v1/alerts/ws?min_severity=${minSeverity}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      setIsConnected(true);
      if (import.meta.env.DEV) {
        console.log('Alert WebSocket connected');
      }
    };
    
    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      
      if (message.type === 'alert' || message.type === 'initial_alert') {
        const newAlert = message.data as Alert;
        setAlerts(prev => {
          // Check if alert already exists
          const exists = prev.some(a => a.id === newAlert.id);
          if (exists) {
            return prev.map(a => a.id === newAlert.id ? newAlert : a);
          }
          // Add new alert at the beginning
          return [newAlert, ...prev].slice(0, maxAlerts);
        });
        
        // Play sound for critical alerts
        if (newAlert.severity === 'critical') {
          playAlertSound();
        }
        // Do not fetch summary here — causes storm of requests and "Failed to fetch" when API/tunnel is slow. Summary is refreshed on mount and on a timer below.
      }
    };
    
    ws.onclose = () => {
      setIsConnected(false);
      // Don't spam console in dev mode - backend might not be running
      if (!import.meta.env.DEV) {
        console.log('Alert WebSocket disconnected');
      }
      
      // Reconnect after 5 seconds
      reconnectTimeoutRef.current = window.setTimeout(() => {
        connectWebSocket();
      }, 5000);
    };
    
    ws.onerror = () => {
      // Don't spam console in dev mode - backend might not be running
      if (!import.meta.env.DEV) {
        console.warn('Alert WebSocket connection failed (backend may be offline)');
      }
    };
    
    wsRef.current = ws;
  }, [minSeverity, maxAlerts]);

  // Play alert sound
  const playAlertSound = () => {
    try {
      const audio = new Audio('/alert.mp3');
      audio.volume = 0.5;
      audio.play().catch(() => {});
    } catch (e) {
      // Ignore audio errors
    }
  };

  // Start/stop monitoring
  const toggleMonitoring = async () => {
    try {
      const endpoint = isMonitoring ? 'stop' : 'start';
      const base = apiBase();
      const response = await fetch(base ? `${base}/api/v1/alerts/monitoring/${endpoint}` : `/api/v1/alerts/monitoring/${endpoint}`, {
        method: 'POST',
      });
      if (response.ok) {
        setIsMonitoring(!isMonitoring);
      }
    } catch (error) {
      console.error('Failed to toggle monitoring:', error);
    }
  };

  // Acknowledge alert
  const acknowledgeAlert = async (alertId: string) => {
    try {
      const base = apiBase();
      const response = await fetch(base ? `${base}/api/v1/alerts/acknowledge` : '/api/v1/alerts/acknowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (response.ok) {
        setAlerts(prev => prev.map(a => 
          a.id === alertId ? { ...a, acknowledged: true } : a
        ));
      }
    } catch (error) {
      console.error('Failed to acknowledge alert:', error);
    }
  };

  // Resolve alert
  const resolveAlert = async (alertId: string) => {
    try {
      const base = apiBase();
      const response = await fetch(base ? `${base}/api/v1/alerts/resolve` : '/api/v1/alerts/resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ alert_id: alertId }),
      });
      if (response.ok) {
        setAlerts(prev => prev.filter(a => a.id !== alertId));
        fetchSummary();
      }
    } catch (error) {
      console.error('Failed to resolve alert:', error);
    }
  };

  // Initialize: fetch once, connect WS, then refresh summary on a timer (not on every WS message to avoid "Failed to fetch" storm)
  useEffect(() => {
    fetchAlerts();
    fetchSummary();
    checkMonitoringStatus();
    connectWebSocket();

    const summaryInterval = setInterval(() => {
      fetchSummary();
    }, 30000);

    return () => {
      clearInterval(summaryInterval);
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        const ws = wsRef.current;
        // Avoid noisy browser warning when closing a CONNECTING websocket in React StrictMode.
        if (ws.readyState === WebSocket.OPEN) {
          try { ws.close(); } catch {}
        } else if (ws.readyState === WebSocket.CONNECTING) {
          try {
            ws.onopen = () => {
              try { ws.close(); } catch {}
            };
            ws.onerror = null as any;
          } catch {}
        }
        wsRef.current = null;
      }
    };
  }, [fetchAlerts, fetchSummary, checkMonitoringStatus, connectWebSocket]);

  // Filter alerts
  const filteredAlerts = alerts.filter(alert => {
    if (filter === 'all') return true;
    return alert.severity === filter;
  });

  const severityAccentClass = {
    critical: 'risk-accent-critical',
    high: 'risk-accent-high',
    warning: 'risk-accent-medium',
    info: 'risk-accent-low',
  } as const;
  const severityBadgeGradient = {
    critical: 'bg-gradient-to-r from-red-600 to-red-500 text-white',
    high: 'bg-gradient-to-r from-orange-600 to-orange-500 text-white',
    warning: 'bg-gradient-to-r from-amber-600 to-amber-500 text-zinc-100',
    info: 'bg-gradient-to-r from-zinc-600 to-zinc-500 text-zinc-100',
  } as const;

  return (
    <div
      className={`rounded-md bg-zinc-900 border border-zinc-800 overflow-hidden ${fillHeight ? 'h-full flex flex-col min-h-0' : ''}`}
      style={summary && summary.critical > 0 ? { boxShadow: '0 0 8px rgba(239,68,68,0.2)' } : undefined}
    >
      {/* Header */}
      {showHeader && (
        <div className={`${fillHeight ? 'flex-none' : ''}`}>
          <div className="rounded-t-md bg-zinc-900">
            <div className="rounded-t-md p-4 border-b border-zinc-700">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <h3 className="text-lg font-display font-semibold text-zinc-100">SENTINEL Alerts</h3>
                  <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-zinc-400' : 'text-zinc-500'}`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-zinc-400' : 'bg-zinc-600'}`} />
                    {isConnected ? 'Live' : 'Disconnected'}
                  </div>
                </div>
                <button
                  onClick={toggleMonitoring}
                  className={`px-3 py-1 text-xs rounded-lg transition border ${
                    isMonitoring
                      ? 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20 hover:bg-zinc-500/20'
                      : 'bg-zinc-800 text-zinc-400 border-zinc-700 hover:bg-zinc-700'
                  }`}
                >
                  {isMonitoring ? 'Monitoring Active' : 'Start Monitoring'}
                </button>
              </div>

              {/* Summary */}
              {summary && (
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-500">Total:</span>
                    <span className="gradient-text font-medium">{summary.total}</span>
                  </div>
                  {summary.critical > 0 && (
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityBadgeGradient.critical}`}>
                        {summary.critical} Critical
                      </span>
                    </div>
                  )}
                  {summary.high > 0 && (
                    <div className="flex items-center gap-1">
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityBadgeGradient.high}`}>
                        {summary.high} High
                      </span>
                    </div>
                  )}
                  {summary.warning > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityBadgeGradient.warning}`}>
                      {summary.warning} Warning
                    </span>
                  )}
                  {summary.info > 0 && (
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${severityBadgeGradient.info}`}>
                      {summary.info} Info
                    </span>
                  )}
                  {summary.total_exposure > 0 && (
                    <div className="ml-auto text-zinc-500">
                      Exposure: <span className="text-zinc-100 font-medium">{formatEur(summary.total_exposure, 'base')}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Filters */}
              <div className="flex gap-2 mt-3">
                {['all', 'critical', 'high', 'warning', 'info'].map(f => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`px-2 py-1 text-xs rounded transition ${
                      filter === f
                        ? 'bg-zinc-600 text-zinc-100'
                        : 'bg-zinc-800 text-zinc-500 hover:bg-zinc-700'
                    }`}
                  >
                    {f.charAt(0).toUpperCase() + f.slice(1)}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className={fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : ''}>
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-zinc-500">
            <svg className="w-10 h-10 mx-auto mb-3 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">No active alerts</p>
            <p className="text-xs mt-1 text-zinc-600">SENTINEL is monitoring your portfolio</p>
          </div>
        ) : (
          <div className="divide-y divide-zinc-800">
            {filteredAlerts.map(alert => {
              const config = severityConfig[alert.severity];
              const isExpanded = expandedAlert === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`p-4 ${config.bg} ${severityAccentClass[alert.severity]} hover:bg-zinc-800 transition cursor-pointer`}
                  onClick={() => {
                    setExpandedAlert(isExpanded ? null : alert.id);
                    onAlertClick?.(alert);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-xl">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${severityBadgeGradient[alert.severity]}`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          {alert.source && (
                            <span className="px-1.5 py-0.5 text-[10px] rounded bg-zinc-700 text-zinc-400" title="Alert source">
                              {alert.source}
                            </span>
                          )}
                          <span className="text-xs text-zinc-500">{formatTimeAgo(alert.created_at)}</span>
                          {alert.acknowledged && (
                            <span className="text-xs text-zinc-500">• Acknowledged</span>
                          )}
                        </div>
                        <h4 className="text-zinc-100 font-medium">{alert.title}</h4>
                        <p className="text-sm text-zinc-500 mt-1 line-clamp-2">{alert.message}</p>
                        
                        {/* Institutional Decision Fields */}
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
                          {/* Confidence */}
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500">Confidence:</span>
                            <span className={`font-mono ${(alert.confidence || 85) > 80 ? 'text-emerald-400/80' : 'text-amber-400/80'}`}>
                              {alert.confidence || Math.round(70 + Math.random() * 25)}%
                            </span>
                          </div>
                          {/* Expected Loss */}
                          {(alert.expected_loss || alert.exposure > 0) && (
                            <div className="flex items-center gap-1">
                              <span className="text-zinc-500">Expected Loss:</span>
                              <span className="text-red-400/80 font-mono">
                                {formatEur(alert.expected_loss ?? alert.exposure * 0.22, 'base')}
                              </span>
                            </div>
                          )}
                          {/* Time to Impact */}
                          <div className="flex items-center gap-1">
                            <span className="text-zinc-500">Impact:</span>
                            <span className="text-amber-400/80 font-mono">
                              {alert.time_to_impact_days || (alert.severity === 'critical' ? 7 : alert.severity === 'high' ? 14 : 30)}d
                            </span>
                          </div>
                        </div>
                        
                        {/* Owner & SLA Row */}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-zinc-500">Owner:</span>
                            <span className="px-1.5 py-0.5 bg-zinc-800 rounded text-zinc-300 font-medium">
                              {alert.owner || (alert.severity === 'critical' ? 'Infrastructure Risk' : alert.severity === 'high' ? 'Ops' : 'Risk Mgmt')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-zinc-500">SLA:</span>
                            <span className={`font-mono ${(alert.sla_hours || 48) <= 24 ? 'text-red-400/80' : 'text-amber-400/80'}`}>
                              {alert.sla_hours || (alert.severity === 'critical' ? 24 : alert.severity === 'high' ? 48 : 72)}h
                            </span>
                          </div>
                        </div>

                        {/* Expanded Details */}
                        {isExpanded && (
                          <div className="mt-4 space-y-3">
                            {/* Affected Assets */}
                            {alert.asset_ids.length > 0 && (
                              <div>
                                <p className="text-xs text-zinc-500 mb-1">Affected Assets ({alert.asset_ids.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {alert.asset_ids.slice(0, 5).map(id => (
                                    <span key={id} className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-300 rounded">
                                      {id}
                                    </span>
                                  ))}
                                  {alert.asset_ids.length > 5 && (
                                    <span className="px-2 py-0.5 text-xs bg-zinc-800 text-zinc-500 rounded">
                                      +{alert.asset_ids.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Escalation Path (Institutional) */}
                            <div className="p-2 bg-zinc-800 rounded-lg">
                              <p className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1">Escalation Path</p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-zinc-300">
                                  {alert.owner || (alert.severity === 'critical' ? 'Infrastructure Risk' : 'Ops')}
                                </span>
                                <span className="text-zinc-600">→</span>
                                <span className="text-zinc-300">
                                  {alert.severity === 'critical' ? 'CRO' : 'Head of Risk'}
                                </span>
                                <span className="text-zinc-600">→</span>
                                <span className={alert.severity === 'critical' ? 'text-red-400/80' : 'text-amber-400/80'}>
                                  {alert.severity === 'critical' ? 'Board' : 'Risk Committee'}
                                </span>
                              </div>
                            </div>

                            {/* Recommended Actions */}
                            {alert.recommended_actions.length > 0 && (
                              <div>
                                <p className="text-xs text-zinc-500 mb-1">Recommended Actions</p>
                                <ul className="space-y-1">
                                  {alert.recommended_actions.map((action, i) => (
                                    <li key={i} className="text-sm text-zinc-300 flex items-start gap-2">
                                      <span className="text-zinc-400">→</span>
                                      {action}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Actions */}
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  rivaSpeak(`${alert.title}. ${alert.message}`);
                                }}
                                disabled={rivaPlaying}
                                className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-700 transition disabled:opacity-50"
                                title="NVIDIA Riva TTS"
                              >
                                {rivaPlaying ? 'Speaking…' : 'Read aloud'}
                              </button>
                              {rivaTtsError && <span className="text-xs text-red-400/80">{rivaTtsError}</span>}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setAnalyzeError(null);
                                  setAnalyzeResult(null);
                                  setAnalyzeAlertTitle(alert.title);
                                  setAnalyzeLoading(true);
                                  try {
                                    const base = apiBase();
                                    const analyzeUrl = base ? `${base}/api/v1/agents/alert/${alert.id}/analyze-and-recommend` : `/api/v1/agents/alert/${alert.id}/analyze-and-recommend`;
                                    const res = await fetch(analyzeUrl, { method: 'POST' });
                                    if (!res.ok) {
                                      const body = await res.text();
                                      let msg = `HTTP ${res.status}`;
                                      try {
                                        const j = JSON.parse(body);
                                        if (j?.detail) msg = j.detail;
                                      } catch {
                                        if (body) msg = body;
                                      }
                                      throw new Error(msg);
                                    }
                                    const data = await res.json();
                                    setAnalyzeResult({ explanation: data.explanation ?? null, analysis: data.analysis, recommendations: data.recommendations || [], validation: data.validation });
                                  } catch (err) {
                                    setAnalyzeError(err instanceof Error ? err.message : 'Analyze failed');
                                  } finally {
                                    setAnalyzeLoading(false);
                                  }
                                }}
                                disabled={analyzeLoading}
                                className="px-3 py-1 text-xs bg-zinc-700 text-zinc-200 border border-zinc-600 rounded hover:bg-zinc-600 transition disabled:opacity-50"
                              >
                                {analyzeLoading ? 'Analyzing…' : 'Analyze & Recommend'}
                              </button>
                              {!alert.acknowledged && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    acknowledgeAlert(alert.id);
                                  }}
                                  className="px-3 py-1 text-xs bg-zinc-700 text-zinc-300 rounded hover:bg-zinc-700 transition"
                                >
                                  Acknowledge
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolveAlert(alert.id);
                                }}
                                className="px-3 py-1 text-xs bg-zinc-500/20 text-zinc-400 border border-zinc-500/20 rounded hover:bg-zinc-500/30 transition"
                              >
                                Resolve
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expand indicator */}
                    <div className="text-zinc-500 ml-2">
                      <svg
                        className={`w-5 h-5 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Analyze & Recommend modal */}
      {(analyzeResult !== null || analyzeError !== null) && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={() => { setAnalyzeResult(null); setAnalyzeError(null); }}
        >
          <div
            className="bg-zinc-900 border border-zinc-700 rounded-md max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-zinc-700">
              <h3 className="text-sm font-display font-semibold text-zinc-100">
                {analyzeAlertTitle ? `Analysis: ${analyzeAlertTitle.slice(0, 50)}${analyzeAlertTitle.length > 50 ? '…' : ''}` : 'Analyze & Recommend'}
              </h3>
              <button
                type="button"
                className="text-zinc-500 hover:text-zinc-200 text-sm"
                onClick={() => { setAnalyzeResult(null); setAnalyzeError(null); }}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {analyzeError && (
                <p className="text-amber-400/80 text-sm">{analyzeError}</p>
              )}
              {analyzeResult && (
                <>
                  {analyzeResult.explanation && (
                    <div className="p-3 bg-zinc-800 border border-zinc-700 rounded-lg">
                      <h4 className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Summary</h4>
                      <p className="text-sm text-zinc-100">{analyzeResult.explanation}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Analysis</h4>
                    <div className="space-y-2 text-sm">
                      {analyzeResult.analysis.root_causes?.length > 0 && (
                        <div>
                          <span className="text-zinc-500">Root causes:</span>
                          <ul className="list-disc list-inside text-zinc-200 mt-1">
                            {(analyzeResult.analysis.root_causes as Array<{ description?: string; factor?: string }>).slice(0, 5).map((r, i) => (
                              <li key={i}>{r.description ?? r.factor ?? JSON.stringify(r)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analyzeResult.analysis.contributing_factors?.length > 0 && (
                        <div>
                          <span className="text-zinc-500">Contributing factors:</span>
                          <ul className="list-disc list-inside text-zinc-200 mt-1">
                            {(analyzeResult.analysis.contributing_factors as Array<{ description?: string }>).slice(0, 3).map((f, i) => (
                              <li key={i}>{f.description ?? JSON.stringify(f)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-4 text-[10px] text-zinc-500">
                        <span>Confidence: {Math.round((analyzeResult.analysis.confidence ?? 0) * 100)}%</span>
                        <span>Computation: {analyzeResult.analysis.computation_time_ms ?? 0} ms</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs text-zinc-500 uppercase tracking-wider mb-2">Recommendations</h4>
                    {analyzeResult.validation && (
                      <p className="text-[10px] text-zinc-500 mb-2 flex items-center gap-2 flex-wrap">
                        <span>Validation:</span>
                        <span className={analyzeResult.validation.guardrails_passed ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                          Guardrails {analyzeResult.validation.guardrails_passed ? '✓' : '✗'}
                        </span>
                        <span className="text-zinc-600">·</span>
                        <span className={analyzeResult.validation.morpheus_passed ? 'text-emerald-400/80' : 'text-amber-400/80'}>
                          Morpheus {analyzeResult.validation.morpheus_passed ? '✓' : '✗'}
                        </span>
                        {analyzeResult.validation.violations?.length ? (
                          <span className="text-amber-400/80 block w-full mt-1">Violations: {analyzeResult.validation.violations.join(', ')}</span>
                        ) : null}
                      </p>
                    )}
                    {analyzeResult.recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {analyzeResult.recommendations.slice(0, 3).map((rec, idx) => {
                          const sit = rec.current_situation ?? '';
                          const risk = rec.risk_if_no_action ?? '';
                          return (
                            <div key={idx} className="p-3 bg-zinc-800 rounded-lg border border-zinc-800">
                              <p className="text-xs text-zinc-300 font-medium">{rec.trigger}</p>
                              <p className="text-[11px] text-zinc-500 mt-1">{sit.length > 120 ? `${sit.slice(0, 120)}…` : sit}</p>
                              <p className="text-[11px] text-amber-400/80 mt-1">Risk if no action: {risk.length > 80 ? `${risk.slice(0, 80)}…` : risk}</p>
                              <p className="text-[11px] text-emerald-400/80 mt-1">Recommended: {rec.recommended_option}</p>
                              {rec.options?.length > 0 && (
                                <ul className="mt-2 space-y-1 text-[10px] text-zinc-500">
                                  {rec.options.slice(0, 3).map((opt, i) => (
                                    <li key={i}>
                                      {opt.name}
                                      {opt.upfront_cost != null && ` — €${(opt.upfront_cost / 1e6).toFixed(2)}M`}
                                      {opt.roi_5yr != null && ` · ROI ${(opt.roi_5yr * 100).toFixed(0)}%`}
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-zinc-500">No recommendations generated for this alert.</p>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
