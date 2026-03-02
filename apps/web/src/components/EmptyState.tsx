import { ReactNode } from 'react'
import { motion } from 'framer-motion'

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description: string
  action?: {
    label: string
    onClick: () => void
  }
}

export default function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-8 text-center"
    >
      <div className="w-20 h-20 rounded-md bg-zinc-700 flex items-center justify-center mb-6">
        <Icon className="w-10 h-10 text-zinc-400" />
      </div>
      <h3 className="text-xl font-display font-semibold mb-2">{title}</h3>
      <p className="text-zinc-500 max-w-md mb-6">{description}</p>
      {action && (
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={action.onClick}
          className="px-5 py-2.5 bg-zinc-600 text-zinc-100 rounded-md font-medium text-sm hover:bg-zinc-500 transition-colors"
        >
          {action.label}
        </motion.button>
      )}
    </motion.div>
  )
}
