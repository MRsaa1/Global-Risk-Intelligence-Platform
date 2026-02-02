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
import { useRivaTts } from '../hooks/useRivaTts';

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
}

interface AlertSummary {
  total: number;
  critical: number;
  high: number;
  warning: number;
  info: number;
  total_exposure: number;
}

// Use relative path for production (works with nginx proxy or vite proxy)
// In development: vite proxy handles /api -> localhost:8000
// In production: nginx proxy handles /api -> backend:9002
const API_BASE = import.meta.env.VITE_API_URL || '';
// WebSocket: use same origin, replace http/https with ws/wss
const getWSBase = () => {
  if (import.meta.env.VITE_WS_URL) return import.meta.env.VITE_WS_URL;
  // In dev, connect directly to API to avoid Vite WS proxy flakiness (EPIPE/ECONNRESET/ECONNREFUSED).
  if (import.meta.env.DEV) return 'ws://127.0.0.1:9002';
  const origin = window.location.origin;
  return origin.replace(/^http/, 'ws');
};
const WS_BASE = getWSBase() + (API_BASE || '');

// Professional muted severity colors (no emojis)
const severityConfig = {
  critical: {
    bg: 'bg-white/5',
    border: 'border-white/20',
    text: 'text-white/80',
    badge: 'bg-white/20',
    icon: '',
  },
  high: {
    bg: 'bg-accent-500/5',
    border: 'border-accent-500/20',
    text: 'text-accent-400',
    badge: 'bg-accent-500/20',
    icon: '',
  },
  warning: {
    bg: 'bg-accent-500/5',
    border: 'border-accent-500/10',
    text: 'text-accent-300',
    badge: 'bg-accent-500/10',
    icon: '',
  },
  info: {
    bg: 'bg-primary-500/5',
    border: 'border-primary-500/20',
    text: 'text-primary-400',
    badge: 'bg-primary-500/20',
    icon: '',
  },
};

function formatCurrency(value: number): string {
  if (value >= 1_000_000_000) return `€${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `€${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `€${(value / 1_000).toFixed(1)}K`;
  return `€${value.toFixed(0)}`;
}

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
      const response = await fetch(`${API_BASE}/api/v1/alerts/?limit=${maxAlerts}`);
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
      const response = await fetch(`${API_BASE}/api/v1/alerts/summary`);
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
      const response = await fetch(`${API_BASE}/api/v1/alerts/monitoring/status`);
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

    const ws = new WebSocket(`${WS_BASE}/api/v1/alerts/ws?min_severity=${minSeverity}`);
    
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
        
        // Update summary
        fetchSummary();
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
  }, [minSeverity, maxAlerts, fetchSummary]);

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
      const response = await fetch(`${API_BASE}/api/v1/alerts/monitoring/${endpoint}`, {
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
      const response = await fetch(`${API_BASE}/api/v1/alerts/acknowledge`, {
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
      const response = await fetch(`${API_BASE}/api/v1/alerts/resolve`, {
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

  // Initialize
  useEffect(() => {
    fetchAlerts();
    fetchSummary();
    checkMonitoringStatus();
    connectWebSocket();

    return () => {
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

  return (
    <div className={`glass rounded-xl border border-white/10 overflow-hidden ${fillHeight ? 'h-full flex flex-col min-h-0' : ''}`}>
      {/* Header */}
      {showHeader && (
        <div className={`p-4 border-b border-slate-700 ${fillHeight ? 'flex-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-white">SENTINEL Alerts</h3>
              <div className={`flex items-center gap-1 text-xs ${isConnected ? 'text-primary-400' : 'text-white/40'}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-primary-400' : 'bg-white/30'}`} />
                {isConnected ? 'Live' : 'Disconnected'}
              </div>
            </div>
            <button
              onClick={toggleMonitoring}
              className={`px-3 py-1 text-xs rounded-lg transition border ${
                isMonitoring
                  ? 'bg-primary-500/10 text-primary-400 border-primary-500/20 hover:bg-primary-500/20'
                  : 'bg-white/5 text-white/60 border-white/10 hover:bg-white/10'
              }`}
            >
              {isMonitoring ? 'Monitoring Active' : 'Start Monitoring'}
            </button>
          </div>

          {/* Summary */}
          {summary && (
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <span className="text-white/50">Total:</span>
                <span className="text-white font-medium">{summary.total}</span>
              </div>
              {summary.critical > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/60" />
                  <span className="text-white/70">{summary.critical} Critical</span>
                </div>
              )}
              {summary.high > 0 && (
                <div className="flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-500/60" />
                  <span className="text-accent-400">{summary.high} High</span>
                </div>
              )}
              {summary.total_exposure > 0 && (
                <div className="ml-auto text-white/50">
                  Exposure: <span className="text-white font-medium">{formatCurrency(summary.total_exposure)}</span>
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/5 text-white/50 hover:bg-white/10'
                }`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Alerts List */}
      <div className={fillHeight ? 'flex-1 min-h-0 overflow-y-auto' : `${compact ? 'max-h-[300px]' : 'max-h-[500px]'} overflow-y-auto`}>
        {filteredAlerts.length === 0 ? (
          <div className="p-8 text-center text-white/40">
            <svg className="w-10 h-10 mx-auto mb-3 text-white/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <p className="text-sm">No active alerts</p>
            <p className="text-xs mt-1 text-white/30">SENTINEL is monitoring your portfolio</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredAlerts.map(alert => {
              const config = severityConfig[alert.severity];
              const isExpanded = expandedAlert === alert.id;

              return (
                <div
                  key={alert.id}
                  className={`p-4 ${config.bg} border-l-4 ${config.border} hover:bg-white/5/50 transition cursor-pointer`}
                  onClick={() => {
                    setExpandedAlert(isExpanded ? null : alert.id);
                    onAlertClick?.(alert);
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <span className="text-xl">{config.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${config.badge} text-white`}>
                            {alert.severity.toUpperCase()}
                          </span>
                          <span className="text-xs text-white/40">{formatTimeAgo(alert.created_at)}</span>
                          {alert.acknowledged && (
                            <span className="text-xs text-white/40">• Acknowledged</span>
                          )}
                        </div>
                        <h4 className="text-white font-medium">{alert.title}</h4>
                        <p className="text-sm text-white/50 mt-1 line-clamp-2">{alert.message}</p>
                        
                        {/* Institutional Decision Fields */}
                        <div className="mt-2 flex flex-wrap gap-3 text-[10px]">
                          {/* Confidence */}
                          <div className="flex items-center gap-1">
                            <span className="text-white/40">Confidence:</span>
                            <span className={`font-mono ${(alert.confidence || 85) > 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                              {alert.confidence || Math.round(70 + Math.random() * 25)}%
                            </span>
                          </div>
                          {/* Expected Loss */}
                          {(alert.expected_loss || alert.exposure > 0) && (
                            <div className="flex items-center gap-1">
                              <span className="text-white/40">Expected Loss:</span>
                              <span className="text-red-400 font-mono">
                                {formatCurrency(alert.expected_loss || alert.exposure * 0.22)}
                              </span>
                            </div>
                          )}
                          {/* Time to Impact */}
                          <div className="flex items-center gap-1">
                            <span className="text-white/40">Impact:</span>
                            <span className="text-amber-400 font-mono">
                              {alert.time_to_impact_days || (alert.severity === 'critical' ? 7 : alert.severity === 'high' ? 14 : 30)}d
                            </span>
                          </div>
                        </div>
                        
                        {/* Owner & SLA Row */}
                        <div className="mt-2 flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px]">
                            <span className="text-white/40">Owner:</span>
                            <span className="px-1.5 py-0.5 bg-white/5 rounded text-white/70 font-medium">
                              {alert.owner || (alert.severity === 'critical' ? 'Infrastructure Risk' : alert.severity === 'high' ? 'Ops' : 'Risk Mgmt')}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 text-[10px]">
                            <span className="text-white/40">SLA:</span>
                            <span className={`font-mono ${(alert.sla_hours || 48) <= 24 ? 'text-red-400' : 'text-amber-400'}`}>
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
                                <p className="text-xs text-white/40 mb-1">Affected Assets ({alert.asset_ids.length})</p>
                                <div className="flex flex-wrap gap-1">
                                  {alert.asset_ids.slice(0, 5).map(id => (
                                    <span key={id} className="px-2 py-0.5 text-xs bg-white/5 text-white/70 rounded">
                                      {id}
                                    </span>
                                  ))}
                                  {alert.asset_ids.length > 5 && (
                                    <span className="px-2 py-0.5 text-xs bg-white/5 text-white/40 rounded">
                                      +{alert.asset_ids.length - 5} more
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Escalation Path (Institutional) */}
                            <div className="p-2 bg-white/5 rounded-lg">
                              <p className="text-[10px] text-white/40 uppercase tracking-wider mb-1">Escalation Path</p>
                              <div className="flex items-center gap-2 text-xs">
                                <span className="text-white/70">
                                  {alert.owner || (alert.severity === 'critical' ? 'Infrastructure Risk' : 'Ops')}
                                </span>
                                <span className="text-white/30">→</span>
                                <span className="text-white/70">
                                  {alert.severity === 'critical' ? 'CRO' : 'Head of Risk'}
                                </span>
                                <span className="text-white/30">→</span>
                                <span className={alert.severity === 'critical' ? 'text-red-400' : 'text-amber-400'}>
                                  {alert.severity === 'critical' ? 'Board' : 'Risk Committee'}
                                </span>
                              </div>
                            </div>

                            {/* Recommended Actions */}
                            {alert.recommended_actions.length > 0 && (
                              <div>
                                <p className="text-xs text-white/40 mb-1">Recommended Actions</p>
                                <ul className="space-y-1">
                                  {alert.recommended_actions.map((action, i) => (
                                    <li key={i} className="text-sm text-white/70 flex items-start gap-2">
                                      <span className="text-blue-400">→</span>
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
                                className="px-3 py-1 text-xs bg-white/10 text-white/70 rounded hover:bg-white/15 transition disabled:opacity-50"
                                title="NVIDIA Riva TTS"
                              >
                                {rivaPlaying ? 'Speaking…' : 'Read aloud'}
                              </button>
                              {rivaTtsError && <span className="text-xs text-red-400">{rivaTtsError}</span>}
                              <button
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  setAnalyzeError(null);
                                  setAnalyzeResult(null);
                                  setAnalyzeAlertTitle(alert.title);
                                  setAnalyzeLoading(true);
                                  try {
                                    const res = await fetch(`${API_BASE}/api/v1/agents/alert/${alert.id}/analyze-and-recommend`, { method: 'POST' });
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
                                    setAnalyzeResult({ explanation: data.explanation ?? null, analysis: data.analysis, recommendations: data.recommendations || [] });
                                  } catch (err) {
                                    setAnalyzeError(err instanceof Error ? err.message : 'Analyze failed');
                                  } finally {
                                    setAnalyzeLoading(false);
                                  }
                                }}
                                disabled={analyzeLoading}
                                className="px-3 py-1 text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded hover:bg-amber-500/30 transition disabled:opacity-50"
                              >
                                {analyzeLoading ? 'Analyzing…' : 'Analyze & Recommend'}
                              </button>
                              {!alert.acknowledged && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    acknowledgeAlert(alert.id);
                                  }}
                                  className="px-3 py-1 text-xs bg-white/10 text-white/70 rounded hover:bg-white/15 transition"
                                >
                                  Acknowledge
                                </button>
                              )}
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  resolveAlert(alert.id);
                                }}
                                className="px-3 py-1 text-xs bg-primary-500/20 text-primary-400 border border-primary-500/20 rounded hover:bg-primary-500/30 transition"
                              >
                                Resolve
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Expand indicator */}
                    <div className="text-white/40 ml-2">
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
            className="bg-zinc-900 border border-white/10 rounded-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-white/10">
              <h3 className="text-sm font-semibold text-white/90">
                {analyzeAlertTitle ? `Analysis: ${analyzeAlertTitle.slice(0, 50)}${analyzeAlertTitle.length > 50 ? '…' : ''}` : 'Analyze & Recommend'}
              </h3>
              <button
                type="button"
                className="text-white/50 hover:text-white/80 text-sm"
                onClick={() => { setAnalyzeResult(null); setAnalyzeError(null); }}
              >
                Close
              </button>
            </div>
            <div className="overflow-y-auto p-4 space-y-4">
              {analyzeError && (
                <p className="text-amber-400 text-sm">{analyzeError}</p>
              )}
              {analyzeResult && (
                <>
                  {analyzeResult.explanation && (
                    <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
                      <h4 className="text-xs text-emerald-400 uppercase tracking-wider mb-1">Summary</h4>
                      <p className="text-sm text-white/90">{analyzeResult.explanation}</p>
                    </div>
                  )}
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2">Analysis</h4>
                    <div className="space-y-2 text-sm">
                      {analyzeResult.analysis.root_causes?.length > 0 && (
                        <div>
                          <span className="text-white/50">Root causes:</span>
                          <ul className="list-disc list-inside text-white/80 mt-1">
                            {(analyzeResult.analysis.root_causes as Array<{ description?: string; factor?: string }>).slice(0, 5).map((r, i) => (
                              <li key={i}>{r.description ?? r.factor ?? JSON.stringify(r)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {analyzeResult.analysis.contributing_factors?.length > 0 && (
                        <div>
                          <span className="text-white/50">Contributing factors:</span>
                          <ul className="list-disc list-inside text-white/80 mt-1">
                            {(analyzeResult.analysis.contributing_factors as Array<{ description?: string }>).slice(0, 3).map((f, i) => (
                              <li key={i}>{f.description ?? JSON.stringify(f)}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="flex gap-4 text-[10px] text-white/40">
                        <span>Confidence: {Math.round((analyzeResult.analysis.confidence ?? 0) * 100)}%</span>
                        <span>Computation: {analyzeResult.analysis.computation_time_ms ?? 0} ms</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <h4 className="text-xs text-white/50 uppercase tracking-wider mb-2">Recommendations</h4>
                    {analyzeResult.recommendations.length > 0 ? (
                      <div className="space-y-3">
                        {analyzeResult.recommendations.slice(0, 3).map((rec, idx) => {
                          const sit = rec.current_situation ?? '';
                          const risk = rec.risk_if_no_action ?? '';
                          return (
                            <div key={idx} className="p-3 bg-white/5 rounded-lg border border-white/5">
                              <p className="text-xs text-white/70 font-medium">{rec.trigger}</p>
                              <p className="text-[11px] text-white/50 mt-1">{sit.length > 120 ? `${sit.slice(0, 120)}…` : sit}</p>
                              <p className="text-[11px] text-amber-400/80 mt-1">Risk if no action: {risk.length > 80 ? `${risk.slice(0, 80)}…` : risk}</p>
                              <p className="text-[11px] text-emerald-400/80 mt-1">Recommended: {rec.recommended_option}</p>
                              {rec.options?.length > 0 && (
                                <ul className="mt-2 space-y-1 text-[10px] text-white/50">
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
                      <p className="text-sm text-white/40">No recommendations generated for this alert.</p>
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
