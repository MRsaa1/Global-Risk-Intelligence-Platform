import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import Onboarding from './components/Onboarding'
import Layout from './components/Layout'
import LoadingScreen from './components/LoadingScreen'
import { authService } from './lib/auth'

// Lazy load pages
const Dashboard = lazy(() => import('./pages/Dashboard'))
const Assets = lazy(() => import('./pages/Assets'))
const AssetDetail = lazy(() => import('./pages/AssetDetail'))
const Map = lazy(() => import('./pages/Map'))
const Simulations = lazy(() => import('./pages/Simulations'))
const Settings = lazy(() => import('./pages/Settings'))
const Login = lazy(() => import('./pages/Login'))
const Visualizations = lazy(() => import('./pages/Visualizations'))
const CommandCenter = lazy(() => import('./pages/CommandCenter'))
const Analytics = lazy(() => import('./pages/Analytics'))
const StrategicModules = lazy(() => import('./pages/StrategicModules'))
const CIPModule = lazy(() => import('./pages/modules/CIPModule'))
const SCSSModule = lazy(() => import('./pages/modules/SCSSModule'))
const SROModule = lazy(() => import('./pages/modules/SROModule'))

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())
  const location = useLocation()

  useEffect(() => {
    // Debug: log current location and routes
    console.log('🔍 App - Current location:', location.pathname)
    console.log('🔍 App - Is authenticated:', isAuthenticated)
    console.log('🔍 App - Routes should match /command')
    
    // Check if routes are mounted
    if (location.pathname === '/command') {
      console.log('✅ App - Command route should be active')
    }
  }, [location, isAuthenticated])

  useEffect(() => {
    // Check if onboarding was completed
    const onboardingCompleted = localStorage.getItem('onboarding_completed')
    if (!onboardingCompleted && isAuthenticated) {
      setShowOnboarding(true)
    }
  }, [isAuthenticated])

  const handleOnboardingComplete = () => {
    setShowOnboarding(false)
  }

  // Debug: Log route structure
  useEffect(() => {
    console.log('🔍 App - Routes structure:', {
      location: location.pathname,
      isAuthenticated,
      showOnboarding
    })
  }, [location.pathname, isAuthenticated, showOnboarding])

  console.log('🔍 App - Rendering, location:', location.pathname)

  return (
    <ErrorBoundary>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <Routes>
        <Route path="/login" element={
          <Suspense fallback={<LoadingScreen />}>
            <Login />
          </Suspense>
        } />
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/command" replace />} />
          <Route
            path="command"
            element={
              <Suspense fallback={<LoadingScreen />}>
                {(() => {
                  console.log('✅ CommandCenter route is rendering')
                  return <CommandCenter />
                })()}
              </Suspense>
            }
          />
          <Route
            path="dashboard"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Dashboard />
              </Suspense>
            }
          />
          <Route
            path="assets"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Assets />
              </Suspense>
            }
          />
          <Route
            path="assets/:id"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AssetDetail />
              </Suspense>
            }
          />
          <Route
            path="map"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Map />
              </Suspense>
            }
          />
          <Route
            path="simulations"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Simulations />
              </Suspense>
            }
          />
          <Route
            path="settings"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Settings />
              </Suspense>
            }
          />
          <Route
            path="visualizations"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Visualizations />
              </Suspense>
            }
          />
          <Route
            path="analytics"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Analytics />
              </Suspense>
            }
          />
          <Route
            path="modules"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <StrategicModules />
              </Suspense>
            }
          />
          <Route
            path="modules/cip"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <CIPModule />
              </Suspense>
            }
          />
          <Route
            path="modules/scss"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <SCSSModule />
              </Suspense>
            }
          />
          <Route
            path="modules/sro"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <SROModule />
              </Suspense>
            }
          />
        </Route>
        {/* Fallback route for debugging */}
        <Route path="*" element={
          <div style={{ padding: '2rem', color: 'white' }}>
            <h1>404 - Route not found</h1>
            <p>Current path: {location.pathname}</p>
            <p>Available routes: /, /login, /command, /dashboard, etc.</p>
          </div>
        } />
      </Routes>
    </ErrorBoundary>
  )
}

export default App
