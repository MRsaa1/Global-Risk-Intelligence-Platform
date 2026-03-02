/**
 * Runtime API base URL for browser.
 * - Set via ?api=http://host:port in the URL (e.g. SSH tunnel: ?api=http://127.0.0.1:19002).
 * - Or at build time via VITE_API_URL.
 */
export function getApiBase(): string {
  if (typeof window === 'undefined') return (import.meta.env?.VITE_API_URL as string) || ''
  const fromQuery = (window as unknown as { __VITE_API_URL__?: string }).__VITE_API_URL__
  return fromQuery ?? (import.meta.env?.VITE_API_URL as string) ?? ''
}

/** Base URL for /api/v1 (used by Stress Planner, BCP Generator, etc.). Resolves at request time for tunnel (e.g. port 15180 → 19002). */
export function getApiV1Base(): string {
  const b = getApiBase()
  return b ? b.replace(/\/+$/, '') + '/api/v1' : '/api/v1'
}
