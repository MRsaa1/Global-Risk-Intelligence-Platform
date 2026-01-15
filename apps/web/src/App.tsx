import { Routes, Route, Navigate } from 'react-router-dom'
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

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())

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
                <CommandCenter />
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
        </Route>
      </Routes>
    </ErrorBoundary>
  )
}

export default App
