/**
 * Agent Monitoring Page
 * Full page view for monitoring AI agents with NeMo metrics
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { XMarkIcon } from '@heroicons/react/24/outline'
import AgentMonitoringWidget from '../components/dashboard/AgentMonitoringWidget'

export default function AgentMonitoring() {
  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-display font-bold gradient-text">
              AI Agents Monitoring
            </h1>
            <p className="text-dark-muted mt-2">
              Real-time performance metrics and health status (NeMo Agent Toolkit)
            </p>
          </div>
        </div>
      </motion.div>

      {/* Agent Monitoring Widget */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <AgentMonitoringWidget />
      </motion.div>
    </div>
  )
}
