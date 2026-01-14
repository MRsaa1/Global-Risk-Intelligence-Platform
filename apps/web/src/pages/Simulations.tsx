import { motion } from 'framer-motion'
import { BeakerIcon, PlayIcon, ChartBarIcon } from '@heroicons/react/24/outline'

const scenarios = [
  {
    id: 1,
    name: 'Climate Stress Test SSP2-4.5',
    description: 'Middle-of-the-road scenario with moderate emissions',
    status: 'completed',
    assets: 1284,
    runtime: '4m 32s',
  },
  {
    id: 2,
    name: 'Flood Event - Rhine Valley',
    description: '100-year flood event simulation',
    status: 'running',
    assets: 234,
    runtime: '2m 15s',
  },
  {
    id: 3,
    name: 'Power Grid Cascade Failure',
    description: 'Infrastructure dependency analysis',
    status: 'queued',
    assets: 567,
    runtime: '--',
  },
]

export default function Simulations() {
  return (
    <div className="h-full overflow-auto p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold">Simulation Engine</h1>
          <p className="text-dark-muted mt-1">
            Layer 3: Physics + Climate + Economics + Cascade propagation
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-xl font-medium"
        >
          <PlayIcon className="w-5 h-5" />
          New Simulation
        </motion.button>
      </div>

      {/* Engine Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[
          { name: 'Physics Engine', status: 'active', load: '23%' },
          { name: 'Climate Engine', status: 'active', load: '45%' },
          { name: 'Economics Engine', status: 'active', load: '12%' },
          { name: 'Cascade Engine', status: 'active', load: '67%' },
        ].map((engine) => (
          <div key={engine.name} className="glass rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-dark-muted">{engine.name}</span>
              <span className="w-2 h-2 rounded-full bg-risk-low" />
            </div>
            <p className="text-2xl font-bold">{engine.load}</p>
            <p className="text-xs text-dark-muted">CPU Load</p>
          </div>
        ))}
      </div>

      {/* Scenarios */}
      <div className="glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-6 flex items-center gap-2">
          <BeakerIcon className="w-6 h-6 text-accent-400" />
          Scenarios
        </h2>
        
        <div className="space-y-4">
          {scenarios.map((scenario, index) => (
            <motion.div
              key={scenario.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-center gap-6 p-4 bg-dark-bg rounded-xl"
            >
              <div className={`p-3 rounded-xl ${
                scenario.status === 'completed' ? 'bg-risk-low/20' :
                scenario.status === 'running' ? 'bg-primary-500/20' :
                'bg-dark-card'
              }`}>
                {scenario.status === 'completed' ? (
                  <ChartBarIcon className="w-6 h-6 text-risk-low" />
                ) : scenario.status === 'running' ? (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                  >
                    <BeakerIcon className="w-6 h-6 text-primary-400" />
                  </motion.div>
                ) : (
                  <BeakerIcon className="w-6 h-6 text-dark-muted" />
                )}
              </div>
              
              <div className="flex-1">
                <h3 className="font-medium">{scenario.name}</h3>
                <p className="text-sm text-dark-muted">{scenario.description}</p>
              </div>
              
              <div className="text-right">
                <p className="text-sm">{scenario.assets} assets</p>
                <p className="text-xs text-dark-muted">{scenario.runtime}</p>
              </div>
              
              <span className={`px-3 py-1 rounded-full text-xs ${
                scenario.status === 'completed' ? 'bg-risk-low/20 text-risk-low' :
                scenario.status === 'running' ? 'bg-primary-500/20 text-primary-400' :
                'bg-dark-card text-dark-muted'
              }`}>
                {scenario.status}
              </span>
              
              <button className="p-2 rounded-lg hover:bg-dark-card transition-colors">
                <PlayIcon className="w-5 h-5" />
              </button>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Monte Carlo Info */}
      <div className="mt-8 glass rounded-2xl p-6">
        <h2 className="text-xl font-semibold mb-4">Cascade Engine</h2>
        <p className="text-dark-muted mb-4">
          The Cascade Engine propagates impacts through the Knowledge Graph using Monte Carlo simulation:
        </p>
        <pre className="bg-dark-bg p-4 rounded-xl text-sm font-mono text-accent-400 overflow-x-auto">
{`def simulate_cascade(trigger_event, graph, time_horizon):
    for monte_carlo_run in range(10_000):
        state = SystemState(graph)
        state.apply_event(trigger_event)
        
        for timestep in range(time_horizon):
            affected = graph.query_downstream(state.impaired_nodes)
            for node in affected:
                impact = calculate_impact(node, state)
                state.update_node(node, impact)
    
    return aggregate_results(results)`}
        </pre>
      </div>
    </div>
  )
}
