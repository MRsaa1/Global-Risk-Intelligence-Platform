import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  HomeIcon,
  Cog6ToothIcon,
  GlobeAltIcon,
  ArrowRightOnRectangleIcon,
  ArrowPathIcon,
  ChartBarIcon,
  Square3Stack3DIcon,
  BuildingOffice2Icon,
  BriefcaseIcon,
  BanknotesIcon,
  ShieldExclamationIcon,
  ShieldCheckIcon,
  SparklesIcon,
  ServerStackIcon,
  BeakerIcon,
  ClipboardDocumentListIcon,
  BuildingLibraryIcon,
  ArrowsRightLeftIcon,
  MapIcon,
  ClipboardDocumentCheckIcon,
  ScaleIcon,
  RectangleGroupIcon,
  AcademicCapIcon,
  PresentationChartLineIcon,
  BoltIcon,
  CloudIcon,
} from '@heroicons/react/24/outline'
import { authService } from '../lib/auth'
import { usePlatformWebSocket, DEFAULT_CHANNELS } from '../hooks/usePlatformWebSocket'
import AIAssistant from './AIAssistant'
import ApiUnavailableBanner from './ApiUnavailableBanner'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: HomeIcon },
  { name: 'Assets', href: '/assets', icon: BuildingOffice2Icon },
  { name: 'Projects', href: '/projects', icon: BriefcaseIcon },
  { name: 'Portfolios', href: '/portfolios', icon: BanknotesIcon },
  { name: 'Fraud Detection', href: '/fraud', icon: ShieldExclamationIcon },
  { name: 'Strategic Modules', href: '/modules', icon: Square3Stack3DIcon },
  { name: 'Compliance', href: '/compliance', icon: ScaleIcon },
  { name: 'Municipal', href: '/municipal', icon: BuildingLibraryIcon },
  { name: 'Cross-Track', href: '/cross-track', icon: ArrowsRightLeftIcon },
  { name: 'Scenario Replay', href: '/replay', icon: ArrowPathIcon },
  { name: 'Analytics', href: '/analytics', icon: PresentationChartLineIcon },
  { name: 'Risk Flow', href: '/visualizations', icon: ChartBarIcon },
  { name: 'Risk Zones Analysis', href: '/risk-zones-analysis', icon: MapIcon },
  { name: 'Action Plans', href: '/action-plans', icon: ClipboardDocumentCheckIcon },
  { name: 'Stress Planner', href: '/stress-planner', icon: BeakerIcon },
  { name: 'BCP Generator', href: '/bcp-generator', icon: ClipboardDocumentListIcon },
  { name: 'AI Agents', href: '/agents', icon: SparklesIcon },
  { name: 'Workflows', href: '/workflows', icon: RectangleGroupIcon },
  { name: 'Quantum Risk', href: '/quantum-risk', icon: BoltIcon },
  { name: 'AI Models', href: '/ai-models', icon: AcademicCapIcon },
  { name: 'ARIN', href: '/arin', icon: ShieldCheckIcon },
  { name: 'NVIDIA Services', href: '/nvidia-services', icon: ServerStackIcon },
  { name: 'Earth Engine', href: '/earth-engine', icon: CloudIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
]

export default function Layout() {
  const navigate = useNavigate()
  const location = useLocation()
  usePlatformWebSocket(DEFAULT_CHANNELS)

  // Free entry: if user reached Layout without auth, treat as guest so app is open
  useEffect(() => {
    if (!authService.isAuthenticated()) {
      authService.loginAsGuest()
    }
  }, [])

  const isCommandCenter = location.pathname === '/command'
  // Sidebar always visible so Strategic Modules, Replay, ARIN, etc. are one click away
  
  const handleLogout = async () => {
    await authService.logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen bg-zinc-950 font-sans" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      {/* Sidebar — institutional zinc */}
      <aside className="w-20 flex flex-col items-center py-4 border-r border-zinc-800 bg-zinc-900 shrink-0">
        {/* Logo */}
        <div className="mb-6 shrink-0">
          <motion.div
            className="w-12 h-12 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center cursor-pointer"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => navigate('/command')}
          >
            <GlobeAltIcon className="w-7 h-7 text-zinc-300" />
          </motion.div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 flex flex-col gap-1.5 min-h-0 overflow-y-auto overflow-x-hidden w-full items-center py-1 custom-scrollbar">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              className={({ isActive }) =>
                `w-12 h-12 shrink-0 rounded-md flex items-center justify-center transition-all ${
                  isActive
                    ? 'bg-zinc-700 text-zinc-100'
                    : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200'
                }`
              }
              title={item.name}
            >
              {({ isActive }) => (
                <motion.div
                  initial={false}
                  animate={{ scale: isActive ? 1.05 : 1 }}
                >
                  <item.icon className="w-6 h-6" />
                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User & Logout */}
        <div className="mt-auto flex flex-col gap-2 shrink-0">
          <div className="w-10 h-10 text-sm rounded-full bg-zinc-700 border border-zinc-600 flex items-center justify-center text-zinc-200 font-semibold">
            A
          </div>
          <button
            onClick={handleLogout}
            className="w-10 h-10 rounded-md flex items-center justify-center text-zinc-500 hover:bg-zinc-800 hover:text-zinc-200 transition-colors"
            title="Logout"
          >
            <ArrowRightOnRectangleIcon className="w-4 h-4" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 relative min-h-0 bg-zinc-950 flex flex-col ${isCommandCenter ? 'overflow-hidden' : 'overflow-y-auto'}`}>
        <ApiUnavailableBanner />
        <div className={`flex-1 min-h-0 ${isCommandCenter ? 'overflow-hidden' : 'overflow-y-auto'}`}>
          <Outlet />
        </div>
      </main>
      {/* Global AI Assistant — hidden on Command Center (CC has its own trigger in bottom bar) */}
      {location.pathname !== '/command' && <AIAssistant pathname={location.pathname} />}
    </div>
  )
}
