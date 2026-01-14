import { motion } from 'framer-motion'
import { Cog6ToothIcon, KeyIcon, BellIcon, ShieldCheckIcon } from '@heroicons/react/24/outline'

export default function Settings() {
  return (
    <div className="h-full overflow-auto p-8">
      <div className="max-w-3xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-display font-bold">Settings</h1>
          <p className="text-dark-muted mt-1">
            Configure your platform preferences
          </p>
        </div>

        {/* Sections */}
        <div className="space-y-6">
          {/* API Keys */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <KeyIcon className="w-5 h-5 text-primary-400" />
              API Configuration
            </h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-dark-muted mb-2">Climate Data API</label>
                <input
                  type="password"
                  defaultValue="••••••••••••"
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>
              <div>
                <label className="block text-sm text-dark-muted mb-2">Satellite Imagery API</label>
                <input
                  type="password"
                  defaultValue="••••••••••••"
                  className="w-full px-4 py-2 bg-dark-bg border border-dark-border rounded-xl focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>
          </motion.div>

          {/* Notifications */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BellIcon className="w-5 h-5 text-accent-400" />
              Notifications
            </h2>
            <div className="space-y-4">
              {[
                { label: 'Climate risk alerts', checked: true },
                { label: 'Infrastructure dependency changes', checked: true },
                { label: 'Simulation completed', checked: false },
                { label: 'Weekly digest', checked: true },
              ].map((item) => (
                <label key={item.label} className="flex items-center justify-between cursor-pointer">
                  <span>{item.label}</span>
                  <input
                    type="checkbox"
                    defaultChecked={item.checked}
                    className="w-5 h-5 rounded bg-dark-bg border-dark-border"
                  />
                </label>
              ))}
            </div>
          </motion.div>

          {/* Security */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <ShieldCheckIcon className="w-5 h-5 text-risk-low" />
              Security
            </h2>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Two-Factor Authentication</p>
                  <p className="text-sm text-dark-muted">Add an extra layer of security</p>
                </div>
                <button className="px-4 py-2 bg-primary-500 text-white rounded-xl text-sm">
                  Enable
                </button>
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">API Access Tokens</p>
                  <p className="text-sm text-dark-muted">Manage programmatic access</p>
                </div>
                <button className="px-4 py-2 bg-dark-card border border-dark-border rounded-xl text-sm">
                  Manage
                </button>
              </div>
            </div>
          </motion.div>

          {/* Platform Info */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="glass rounded-2xl p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Cog6ToothIcon className="w-5 h-5 text-dark-muted" />
              Platform Information
            </h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-dark-muted">Version</span>
                <span>0.1.0</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">Environment</span>
                <span>Development</span>
              </div>
              <div className="flex justify-between">
                <span className="text-dark-muted">API Endpoint</span>
                <span className="font-mono">localhost:9002</span>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
