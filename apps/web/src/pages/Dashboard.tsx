import { motion } from 'framer-motion'
import {
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  ArrowTrendingUpIcon,
  CubeTransparentIcon,
} from '@heroicons/react/24/outline'

const stats = [
  { name: 'Total Assets', value: '1,284', icon: BuildingOffice2Icon, change: '+12%', color: 'primary' },
  { name: 'At Risk', value: '23', icon: ExclamationTriangleIcon, change: '-5%', color: 'risk-high' },
  { name: 'Digital Twins', value: '1,156', icon: CubeTransparentIcon, change: '+8%', color: 'accent' },
  { name: 'Portfolio Value', value: '€4.2B', icon: ArrowTrendingUpIcon, change: '+3.2%', color: 'primary' },
]

const recentAlerts = [
  { id: 1, asset: 'Munich Office Tower', type: 'Climate', message: 'Flood risk increased to HIGH', severity: 'high' },
  { id: 2, asset: 'Berlin Data Center', type: 'Infrastructure', message: 'Power grid dependency detected', severity: 'medium' },
  { id: 3, asset: 'Hamburg Logistics Hub', type: 'Physical', message: 'Structural inspection due in 30 days', severity: 'low' },
]

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function Dashboard() {
  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-8"
      >
        <h1 className="text-3xl font-display font-bold gradient-text">
          Physical-Financial Risk Platform
        </h1>
        <p className="text-dark-muted mt-2">
          The Operating System for the Physical Economy
        </p>
      </motion.div>

      {/* Stats Grid */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
      >
        {stats.map((stat) => (
          <motion.div
            key={stat.name}
            variants={item}
            className="glass rounded-2xl p-6 hover:glow-primary transition-shadow"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-dark-muted text-sm">{stat.name}</p>
                <p className="text-3xl font-display font-bold mt-2">{stat.value}</p>
                <p className={`text-sm mt-2 ${stat.change.startsWith('+') ? 'text-risk-low' : 'text-risk-high'}`}>
                  {stat.change} from last month
                </p>
              </div>
              <div className={`p-3 rounded-xl ${stat.color === 'primary' ? 'bg-primary-500/20' : stat.color === 'accent' ? 'bg-accent-500/20' : 'bg-red-500/20'}`}>
                <stat.icon className={`w-6 h-6 ${stat.color === 'primary' ? 'text-primary-400' : stat.color === 'accent' ? 'text-accent-400' : 'text-red-400'}`} />
              </div>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* Two Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Alerts */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-display font-semibold mb-4">Recent Alerts</h2>
          <div className="space-y-4">
            {recentAlerts.map((alert) => (
              <div
                key={alert.id}
                className="flex items-start gap-4 p-4 bg-dark-bg rounded-xl"
              >
                <div className={`w-2 h-2 mt-2 rounded-full ${
                  alert.severity === 'high' ? 'bg-risk-high' :
                  alert.severity === 'medium' ? 'bg-risk-medium' : 'bg-risk-low'
                }`} />
                <div className="flex-1">
                  <p className="font-medium">{alert.asset}</p>
                  <p className="text-sm text-dark-muted">{alert.message}</p>
                  <span className="inline-block mt-2 text-xs px-2 py-1 rounded-full bg-dark-card text-dark-muted">
                    {alert.type}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Risk Distribution */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.4 }}
          className="glass rounded-2xl p-6"
        >
          <h2 className="text-xl font-display font-semibold mb-4">Risk Distribution</h2>
          <div className="space-y-4">
            {[
              { label: 'Climate Risk', value: 45, color: 'primary' },
              { label: 'Physical Risk', value: 28, color: 'accent' },
              { label: 'Network Risk', value: 62, color: 'risk-medium' },
              { label: 'Financial Risk', value: 35, color: 'primary' },
            ].map((risk) => (
              <div key={risk.label}>
                <div className="flex justify-between text-sm mb-1">
                  <span>{risk.label}</span>
                  <span className={
                    risk.value > 60 ? 'text-risk-high' :
                    risk.value > 40 ? 'text-risk-medium' : 'text-risk-low'
                  }>{risk.value}%</span>
                </div>
                <div className="h-2 bg-dark-bg rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${risk.value}%` }}
                    transition={{ duration: 1, delay: 0.5 }}
                    className={`h-full rounded-full ${
                      risk.color === 'primary' ? 'bg-primary-500' :
                      risk.color === 'accent' ? 'bg-accent-500' :
                      'bg-amber-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Five Layers */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="mt-8 glass rounded-2xl p-6"
      >
        <h2 className="text-xl font-display font-semibold mb-6">Platform Layers</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[
            { layer: 0, name: 'Verified Truth', status: 'active', count: '12.4K' },
            { layer: 1, name: 'Digital Twins', status: 'active', count: '1,156' },
            { layer: 2, name: 'Network Intelligence', status: 'active', count: '8.2K' },
            { layer: 3, name: 'Simulation Engine', status: 'active', count: '234' },
            { layer: 4, name: 'Autonomous Agents', status: 'beta', count: '12' },
            { layer: 5, name: 'Protocol (PARS)', status: 'dev', count: 'v0.1' },
          ].map((l) => (
            <div
              key={l.layer}
              className="p-4 bg-dark-bg rounded-xl text-center"
            >
              <div className="text-xs text-dark-muted mb-1">Layer {l.layer}</div>
              <div className="font-medium text-sm mb-2">{l.name}</div>
              <div className="text-2xl font-display font-bold gradient-text">{l.count}</div>
              <span className={`inline-block mt-2 text-xs px-2 py-1 rounded-full ${
                l.status === 'active' ? 'bg-risk-low/20 text-risk-low' :
                l.status === 'beta' ? 'bg-amber-500/20 text-amber-400' :
                'bg-primary-500/20 text-primary-400'
              }`}>
                {l.status}
              </span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  )
}
