/**
 * Immersive Login Experience
 * ===========================
 * 
 * Features:
 * - 3D globe background (Three.js - lightweight)
 * - Floating login form
 * - Smooth transition to Command Center
 * - "Entering the system" animation
 */
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CubeTransparentIcon } from '@heroicons/react/24/outline'
import { authService } from '../lib/auth'
import { Canvas, useFrame } from '@react-three/fiber'
import { Sphere, Stars } from '@react-three/drei'
import * as THREE from 'three'

// Simple rotating globe for login background
function LoginGlobe() {
  const meshRef = useRef<THREE.Mesh>(null)
  
  useFrame(({ clock }) => {
    if (meshRef.current) {
      meshRef.current.rotation.y = clock.elapsedTime * 0.1
    }
  })

  return (
    <>
      <ambientLight intensity={0.2} />
      <pointLight position={[10, 5, 10]} intensity={0.8} color="#4488ff" />
      <pointLight position={[-10, -5, -10]} intensity={0.3} color="#ff8844" />
      
      <Stars radius={100} depth={50} count={1000} factor={3} saturation={0} fade speed={0.5} />
      
      <Sphere ref={meshRef} args={[2, 64, 64]} position={[0, 0, -2]}>
        <meshStandardMaterial
          color="#1a3a6a"
          wireframe
          transparent
          opacity={0.3}
        />
      </Sphere>
      
      {/* Atmosphere glow */}
      <Sphere args={[2.1, 32, 32]} position={[0, 0, -2]}>
        <meshBasicMaterial
          color="#00aaff"
          transparent
          opacity={0.1}
          side={THREE.BackSide}
        />
      </Sphere>
    </>
  )
}

// Transition animation component
function TransitionOverlay({ isTransitioning }: { isTransitioning: boolean }) {
  return (
    <AnimatePresence>
      {isTransitioning && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: '#09090b' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
        >
          <motion.div
            className="text-center"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5 }}
          >
            <motion.div
              className="w-24 h-24 mx-auto mb-6 rounded-full border-2 border-zinc-600 flex items-center justify-center"
              animate={{ 
                scale: [1, 1.2, 1],
                borderColor: ['rgba(161, 161, 170, 0.3)', 'rgba(161, 161, 170, 0.8)', 'rgba(161, 161, 170, 0.3)'],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <CubeTransparentIcon className="w-12 h-12 text-zinc-400" />
            </motion.div>
            
            <motion.div
              className="text-zinc-400 text-sm uppercase tracking-[0.3em]"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              Initializing Global View
            </motion.div>
            
            <motion.div
              className="mt-4 flex justify-center gap-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
            >
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={i}
                  className="w-2 h-2 rounded-full bg-zinc-400"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
                />
              ))}
            </motion.div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [isTransitioning, setIsTransitioning] = useState(false)

  const handleEnter = () => {
    setLoading(true)
    authService.loginAsGuest()
    setIsTransitioning(true)
    setTimeout(() => {
      navigate('/command')
    }, 2000)
  }

  return (
    <div className="relative min-h-screen overflow-hidden" style={{ background: '#09090b' }}>
      {/* 3D Background */}
      <div className="absolute inset-0 opacity-60">
        <Canvas camera={{ position: [0, 0, 5], fov: 50 }}>
          <LoginGlobe />
        </Canvas>
      </div>
      
      {/* Gradient overlays */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#09090b]/90" />
      <div className="absolute inset-0 bg-gradient-to-r from-[#09090b]/50 via-transparent to-[#09090b]/50" />
      
      {/* Login Form */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-8">
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="w-full max-w-md"
        >
          {/* Glass card */}
          <div className="bg-zinc-800 border border-zinc-700 rounded-md p-8 shadow-2xl">
            {/* Logo & Title */}
            <motion.div 
              className="text-center mb-8"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.div 
                className="inline-flex items-center justify-center w-20 h-20 rounded-md bg-gradient-to-br from-zinc-500 to-zinc-700 mb-6 shadow-lg shadow-zinc-500/20"
                whileHover={{ scale: 1.05, rotate: 5 }}
              >
                <CubeTransparentIcon className="w-10 h-10 text-zinc-100" />
              </motion.div>
              
              <h1 className="text-2xl font-display font-light text-zinc-100 mb-2">
                Global Risk Command Center
              </h1>
              <p className="text-zinc-500 text-sm">
                Physical-Financial Risk Platform
              </p>
            </motion.div>

            {/* Free entry — no password */}
            <div className="space-y-5">
              <motion.button
                type="button"
                onClick={handleEnter}
                disabled={loading || isTransitioning}
                className="w-full py-4 bg-gradient-to-r from-zinc-500 to-zinc-600 text-zinc-100 rounded-md font-medium hover:from-zinc-400 hover:to-zinc-500 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-zinc-500/20"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {loading || isTransitioning ? (
                  <span className="flex items-center justify-center gap-2">
                    <motion.div
                      className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                    />
                    Entering...
                  </span>
                ) : (
                  'Enter'
                )}
              </motion.button>
            </div>

            <motion.div 
              className="mt-6 text-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              <p className="text-zinc-600 text-xs">Free entry — no password required</p>
            </motion.div>
          </div>
          
          {/* Bottom branding */}
          <motion.div 
            className="text-center mt-8 text-zinc-700 text-xs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Powered by CesiumJS + NVIDIA Earth-2
          </motion.div>
        </motion.div>
      </div>
      
      {/* Transition overlay */}
      <TransitionOverlay isTransitioning={isTransitioning} />
    </div>
  )
}
