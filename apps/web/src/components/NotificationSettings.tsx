/**
 * Notification Settings Component
 * 
 * Toggle for enabling/disabling push notifications
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { BellIcon, BellSlashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { useNotifications } from '../lib/notifications'
import { useI18n } from '../lib/i18n'

interface NotificationSettingsProps {
  variant?: 'default' | 'inline'
  className?: string
}

export default function NotificationSettings({
  variant = 'default',
  className = '',
}: NotificationSettingsProps) {
  const { t } = useI18n()
  const { enabled, permission, isSupported, enable, disable, requestPermission } = useNotifications()
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    setIsLoading(true)
    try {
      if (enabled) {
        disable()
      } else {
        await enable()
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleRequestPermission = async () => {
    setIsLoading(true)
    try {
      await requestPermission()
    } finally {
      setIsLoading(false)
    }
  }

  if (!isSupported) {
    return (
      <div className={`flex items-center gap-3 text-white/40 text-sm ${className}`}>
        <BellSlashIcon className="w-5 h-5" />
        <span>Notifications not supported in this browser</span>
      </div>
    )
  }

  if (variant === 'inline') {
    return (
      <div className={`flex items-center gap-3 ${className}`}>
        <button
          onClick={handleToggle}
          disabled={isLoading || permission === 'denied'}
          className={`p-2 rounded-lg transition-colors ${
            enabled
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-white/5 text-white/60 hover:bg-white/10'
          } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
          title={enabled ? t('notification.enabled') : t('notification.disabled')}
        >
          {enabled ? (
            <BellIcon className="w-5 h-5" />
          ) : (
            <BellSlashIcon className="w-5 h-5" />
          )}
        </button>
        
        {permission === 'denied' && (
          <span className="text-xs text-red-400">
            {t('notification.permission_denied')}
          </span>
        )}
      </div>
    )
  }

  // Default variant with more details
  return (
    <div className={`p-4 bg-white/5 rounded-xl border border-white/10 ${className}`}>
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          {enabled ? (
            <div className="p-2 bg-amber-500/10 rounded-lg">
              <BellIcon className="w-5 h-5 text-amber-400" />
            </div>
          ) : (
            <div className="p-2 bg-white/5 rounded-lg">
              <BellSlashIcon className="w-5 h-5 text-white/40" />
            </div>
          )}
          <div>
            <h3 className="text-white font-medium">Push Notifications</h3>
            <p className="text-white/50 text-sm">
              Receive alerts for stress tests and critical events
            </p>
          </div>
        </div>

        {/* Toggle Switch */}
        <button
          onClick={permission === 'default' ? handleRequestPermission : handleToggle}
          disabled={isLoading || permission === 'denied'}
          className={`relative w-12 h-6 rounded-full transition-colors ${
            enabled ? 'bg-amber-500' : 'bg-white/20'
          } ${permission === 'denied' ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <motion.div
            className="absolute top-1 w-4 h-4 bg-white rounded-full"
            animate={{ left: enabled ? 28 : 4 }}
            transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          />
        </button>
      </div>

      {/* Permission Status */}
      <div className="flex items-center gap-2 text-xs">
        {permission === 'granted' && (
          <>
            <CheckCircleIcon className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-400">Permission granted</span>
          </>
        )}
        {permission === 'denied' && (
          <>
            <XCircleIcon className="w-4 h-4 text-red-400" />
            <span className="text-red-400">
              Permission denied. Enable in browser settings.
            </span>
          </>
        )}
        {permission === 'default' && (
          <span className="text-white/40">
            Click to enable notifications
          </span>
        )}
      </div>

      {/* Notification Types */}
      {enabled && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-4 border-t border-white/10"
        >
          <p className="text-white/50 text-xs mb-3">You will receive notifications for:</p>
          <div className="space-y-2">
            {[
              'Stress test completions',
              'Critical risk alerts',
              'Infrastructure status changes',
              'Cascade failure warnings',
            ].map((item, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-white/70">
                <CheckCircleIcon className="w-4 h-4 text-amber-400" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  )
}
