import { motion } from 'framer-motion'

export default function LoadingScreen() {
  return (
    <div className="h-full flex items-center justify-center bg-zinc-950">
      <div className="flex flex-col items-center gap-4">
        <motion.div
          className="w-16 h-16 rounded-md bg-gradient-to-br from-zinc-500 to-zinc-600"
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
        <p className="text-zinc-500 text-sm">Loading...</p>
      </div>
    </div>
  )
}
