import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  HomeIcon,
  Cog6ToothIcon,
  CubeTransparentIcon,
  ArrowRightOnRectangleIcon,
  ChartBarIcon,
  GlobeAltIcon,
  CpuChipIcon,
  Square3Stack3DIcon,
  BuildingOffice2Icon,
} from '@heroicons/react/24/outline'
import { authService } from '../lib/auth'
import AIAssistant from './AIAssistant'

const navigation = [
  { name: 'Command Center', href: '/command', icon: GlobeAltIcon },
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Assets', href: '/assets', icon: BuildingOffice2Icon },
  { name: 'Strategic Modules', href: '/modules', icon: Square3Stack3DIcon },
  { name: 'Analytics', href: '/analytics', icon: CpuChipIcon },
  { name: 'Risk Flow', href: '/visualizations', icon: ChartBarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  
  // Command Center uses minimal sidebar
  const isCommandCenter = location.pathname === '/command'
  
  console.log('🔍 Layout - Rendering, pathname:', location.pathname, 'isCommandCenter:', isCommandCenter)

  const handleLogout = async () => {
    await authService.logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-[#0a0e17]">
      {/* Sidebar - hidden for Command Center, visible elsewhere */}
      <aside className={`${isCommandCenter ? 'hidden' : 'w-20'} flex flex-col items-center py-4 border-r border-[#1a2535] bg-[#0a0f18] transition-all`}>
        {/* Logo */}
        <div className="mb-6">
          <motion.div
            className={`${isCommandCenter ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center cursor-pointer`}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/command')}
          >
            <CubeTransparentIcon className={`${isCommandCenter ? 'w-5 h-5' : 'w-7 h-7'} text-white`} />
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1.5">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `${isCommandCenter ? 'w-10 h-10' : 'w-12 h-12'} rounded-xl flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-400'
                    : 'text-gray-500 hover:bg-[#1a2535] hover:text-white'
                }`
              }
              title={item.name}
            >
              {({ isActive }) => (
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.1 : 1 }}
                >
                  <item.icon className={`${isCommandCenter ? 'w-5 h-5' : 'w-6 h-6'}`} />
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="mt-auto flex flex-col gap-2">
          <div className={`${isCommandCenter ? 'w-8 h-8 text-xs' : 'w-10 h-10 text-sm'} rounded-full bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-white font-semibold`}>
            A
          </div>
          <button
            onClick={handleLogout}
            className={`${isCommandCenter ? 'w-8 h-8' : 'w-10 h-10'} rounded-xl flex items-center justify-center text-gray-500 hover:bg-[#1a2535] hover:text-white transition-colors`}
            title="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 relative ${isCommandCenter ? 'overflow-hidden' : 'overflow-auto'}`}>
        {(() => {
          console.log('🔍 Layout - Rendering Outlet for path:', location.pathname)
          return <Outlet />
        })()}
      </main>
      
      {/* AI Assistant - only on Command Center */}
      {isCommandCenter && <AIAssistant />}
    </div>
  )
}
