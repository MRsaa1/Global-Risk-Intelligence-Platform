/**
 * AccessGate - Controls access to strategic modules based on user permissions.
 * When API returns demo_mode (ALLOW_SEED_IN_PRODUCTION), all modules are open without login.
 */
import { ReactNode, useEffect, useState, useMemo } from 'react'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { ModuleAccessLevel, getModuleById } from '../../lib/modules'
import { authService } from '../../lib/auth'

interface AccessGateProps {
  accessLevel?: ModuleAccessLevel
  moduleId?: string
  children: ReactNode
  fallback?: ReactNode
}

interface UserAccess {
  authenticated: boolean
  securityClearance: boolean
  metaAccess: boolean
}

export default function AccessGate({ accessLevel: accessLevelProp, moduleId, children, fallback }: AccessGateProps) {
  const accessLevel = useMemo((): ModuleAccessLevel => {
    if (accessLevelProp) return accessLevelProp
    if (moduleId) {
      const mod = getModuleById(moduleId)
      return mod?.accessLevel ?? 'commercial'
    }
    return 'commercial'
  }, [accessLevelProp, moduleId])
  const [userAccess, setUserAccess] = useState<UserAccess>({
    authenticated: false,
    securityClearance: false,
    metaAccess: false,
  })
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    fetch('/api/v1/health', { credentials: 'include' })
      .then((r) => r.ok ? r.json() : {})
      .then((data) => setDemoMode(!!data?.demo_mode))
      .catch(() => {
        // When health fails (e.g. tunnel/API down), allow access on tunnel origin so modules aren't all locked
        const isTunnel = typeof window !== 'undefined' && (
          window.location.hostname === '127.0.0.1' && window.location.port === '15180'
        ) || window.location.port === '15180'
        setDemoMode(isTunnel)
      })
  }, [])

  useEffect(() => {
    const token = authService.getToken()
    if (!token) {
      setUserAccess({ authenticated: false, securityClearance: false, metaAccess: false })
      return
    }
    // Guest: no /auth/me call (backend would return 401), treat as authenticated
    if (authService.isGuest()) {
      setUserAccess({ authenticated: true, securityClearance: false, metaAccess: false })
      return
    }
    fetch('/api/v1/auth/me', {
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (res.ok) {
          return res.json().then((data) => ({
            authenticated: true,
            securityClearance: data?.role === 'admin' || data?.role === 'superuser' || false,
            metaAccess: data?.role === 'admin' || data?.role === 'superuser' || false,
          }))
        }
        return { authenticated: false, securityClearance: false, metaAccess: false }
      })
      .catch(() => ({ authenticated: false, securityClearance: false, metaAccess: false }))
      .then(setUserAccess)
  }, [])

  const hasAccess = (() => {
    if (import.meta.env.DEV || demoMode) {
      return true
    }
    switch (accessLevel) {
      case 'public':
        return true
      case 'commercial':
        return userAccess.authenticated
      case 'classified':
        return userAccess.securityClearance
      case 'meta':
        return userAccess.metaAccess
      default:
        return false
    }
  })()

  if (hasAccess) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-zinc-900 rounded-md border border-zinc-700">
      <LockClosedIcon className="w-12 h-12 text-zinc-500 mb-4" />
      <p className="text-zinc-300 text-sm mb-2">Access Restricted</p>
      <p className="text-zinc-500 text-xs text-center max-w-xs">
        This module requires {accessLevel === 'classified' ? 'security clearance' : accessLevel === 'meta' ? 'meta-level access' : 'authentication'}.
      </p>
    </div>
  )
}
