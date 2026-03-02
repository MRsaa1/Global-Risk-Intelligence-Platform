/**
 * Agent Monitoring Page
 * Full page view for monitoring AI agents with NeMo metrics
 */
import { motion } from 'framer-motion'
import AgentMonitoringWidget from '../components/dashboard/AgentMonitoringWidget'

export default function AgentMonitoring() {
  return (
    <div className="min-h-full bg-zinc-950 p-8 pb-16">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-display font-semibold text-zinc-100 tracking-tight">
              AI Agents Monitoring
            </h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
              Real-time performance metrics and health status (NeMo Agent Toolkit). Data is live from the API; use &quot;Test Agents&quot; to run all five agents and populate metrics, or &quot;Start Agents&quot; to run SENTINEL monitoring.
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
