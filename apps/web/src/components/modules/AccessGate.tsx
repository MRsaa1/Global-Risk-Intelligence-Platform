/**
 * AccessGate - Controls access to strategic modules based on user permissions
 */
import { ReactNode, useEffect, useState } from 'react'
import { LockClosedIcon } from '@heroicons/react/24/outline'
import { ModuleAccessLevel } from '../../lib/modules'

interface AccessGateProps {
  accessLevel: ModuleAccessLevel
  children: ReactNode
  fallback?: ReactNode
}

interface UserAccess {
  authenticated: boolean
  securityClearance: boolean
  metaAccess: boolean
}

export default function AccessGate({ accessLevel, children, fallback }: AccessGateProps) {
  const [userAccess, setUserAccess] = useState<UserAccess>({
    authenticated: false,
    securityClearance: false,
    metaAccess: false,
  })

  useEffect(() => {
    fetch('/api/v1/auth/me', { credentials: 'include' })
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
    <div className="flex flex-col items-center justify-center p-8 bg-black/40 rounded-xl border border-white/10">
      <LockClosedIcon className="w-12 h-12 text-white/30 mb-4" />
      <p className="text-white/60 text-sm mb-2">Access Restricted</p>
      <p className="text-white/40 text-xs text-center max-w-xs">
        This module requires {accessLevel === 'classified' ? 'security clearance' : accessLevel === 'meta' ? 'meta-level access' : 'authentication'}.
      </p>
    </div>
  )
}
