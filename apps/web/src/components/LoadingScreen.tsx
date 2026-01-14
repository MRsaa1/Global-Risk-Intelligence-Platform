import { motion } from 'framer-motion'

export default function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center bg-dark-bg">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-accent-500"
          animate={{
            rotate: 360,
            borderRadius: ['20%', '50%', '20%'],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
        <p className="text-dark-muted text-sm">Loading...</p>
      </div>
    </div>
  )
}
