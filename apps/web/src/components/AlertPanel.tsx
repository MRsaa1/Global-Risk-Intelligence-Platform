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
  onAlertClick?: (alert: Alert) => void;
}

export default function AlertPanel({
  maxAlerts = 10,
  minSeverity = 'info',
  showHeader = true,
  compact = false,
  onAlertClick,
}: AlertPanelProps) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isMonitoring, setIsMonitoring] = useState(false);
  const [filter, setFilter] = useState<string>('all');
  const [expandedAlert, setExpandedAlert] = useState<string | null>(null);
  
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
      console.log('Alert WebSocket connected');
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
        // Only close if not already closed
        if (wsRef.current.readyState === WebSocket.OPEN || wsRef.current.readyState === WebSocket.CONNECTING) {
          wsRef.current.close();
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
    <div className="glass rounded-xl border border-white/10 overflow-hidden">
      {/* Header */}
      {showHeader && (
        <div className="p-4 border-b border-slate-700">
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
      <div className={`${compact ? 'max-h-[300px]' : 'max-h-[500px]'} overflow-y-auto`}>
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
                        
                        {alert.exposure > 0 && (
                          <div className="text-sm text-white/40 mt-1">
                            Exposure: <span className={config.text}>{formatCurrency(alert.exposure)}</span>
                          </div>
                        )}

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
                            <div className="flex gap-2 pt-2">
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
    </div>
  );
}
