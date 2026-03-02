import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { ErrorBoundary } from './components/ErrorBoundary'
import ApiErrorToast from './components/ApiErrorToast'
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
const ASGIModule = lazy(() => import('./pages/modules/ASGIModule'))
const ERFModule = lazy(() => import('./pages/modules/ERFModule'))
const BIOSECModule = lazy(() => import('./pages/modules/BIOSECModule'))
const ASMModule = lazy(() => import('./pages/modules/ASMModule'))
const CADAPTModule = lazy(() => import('./pages/modules/CADAPTModule'))
const SRSModule = lazy(() => import('./pages/modules/SRSModule'))
const CityOSModule = lazy(() => import('./pages/modules/CityOSModule'))
const FSTModule = lazy(() => import('./pages/modules/FSTModule'))
const MunicipalDashboard = lazy(() => import('./pages/MunicipalDashboard'))
const SRORegulatorDashboard = lazy(() => import('./pages/modules/SRORegulatorDashboard'))
const StressTestReportPage = lazy(() => import('./pages/StressTestReportPage'))
const ActionPlansPage = lazy(() => import('./pages/ActionPlansPage'))
const StressPlannerPage = lazy(() => import('./pages/StressPlannerPage'))
const BCPGeneratorPage = lazy(() => import('./pages/BCPGeneratorPage'))
const UnifiedStressReportPage = lazy(() => import('./pages/UnifiedStressReportPage'))

// 3D + AI Fintech Strategy Pages
const Projects = lazy(() => import('./pages/Projects'))
const ProjectCreate = lazy(() => import('./pages/ProjectCreate'))
const ProjectDetail = lazy(() => import('./pages/ProjectDetail'))
const Portfolios = lazy(() => import('./pages/Portfolios'))
const PortfolioCreate = lazy(() => import('./pages/PortfolioCreate'))
const PortfolioDetail = lazy(() => import('./pages/PortfolioDetail'))
const PortfolioGlobePage = lazy(() => import('./pages/PortfolioGlobePage'))
const FraudClaims = lazy(() => import('./pages/FraudClaims'))
const FraudClaimCreate = lazy(() => import('./pages/FraudClaimCreate'))
const FraudClaimDetail = lazy(() => import('./pages/FraudClaimDetail'))
const AgentMonitoring = lazy(() => import('./pages/AgentMonitoring'))
const RiskZoneAnalysis = lazy(() => import('./pages/RiskZoneAnalysis'))
const NvidiaServices = lazy(() => import('./pages/NvidiaServices'))
const EarthEnginePage = lazy(() => import('./pages/EarthEnginePage'))
const RegulatorMode = lazy(() => import('./pages/RegulatorMode'))
const BoardMode = lazy(() => import('./pages/BoardMode'))
const ARINPage = lazy(() => import('./pages/ARINPage'))
const CrossTrackPage = lazy(() => import('./pages/CrossTrackPage'))
const ReplayPage = lazy(() => import('./pages/ReplayPage'))
const AuditExtPage = lazy(() => import('./pages/AuditExtPage'))
const ComplianceDashboard = lazy(() => import('./pages/ComplianceDashboard'))
const MeasuresEffectivenessPage = lazy(() => import('./pages/MeasuresEffectivenessPage'))
const AgentWorkflows = lazy(() => import('./pages/AgentWorkflows'))
const QuantumRiskIntelligence = lazy(() => import('./pages/QuantumRiskIntelligence'))
const AIModels = lazy(() => import('./pages/AIModels'))
const FloodPage = lazy(() => import('./pages/product/FloodPage'))
const HeatPage = lazy(() => import('./pages/product/HeatPage'))
const DroughtPage = lazy(() => import('./pages/product/DroughtPage'))
const GrantPage = lazy(() => import('./pages/product/GrantPage'))
const AlertPage = lazy(() => import('./pages/product/AlertPage'))
const LPRPage = lazy(() => import('./pages/LPRPage'))
const LPRProfilePage = lazy(() => import('./pages/LPRProfilePage'))

function App() {
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(authService.isAuthenticated())
  const location = useLocation()

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
      <ApiErrorToast />
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <Routes>
        <Route path="/login" element={
          <Suspense fallback={<LoadingScreen />}>
            <Login />
          </Suspense>
        } />
        <Route path="/report" element={
          <Suspense fallback={<LoadingScreen />}>
            <StressTestReportPage />
          </Suspense>
        } />
        <Route path="/unified-stress" element={
          <Suspense fallback={<LoadingScreen />}>
            <UnifiedStressReportPage />
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
          <Route
            path="modules/srs"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <SRSModule />
              </Suspense>
            }
          />
          <Route
            path="modules/cityos"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <CityOSModule />
              </Suspense>
            }
          />
          <Route
            path="modules/fst"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <FSTModule />
              </Suspense>
            }
          />
          <Route
            path="modules/asgi"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ASGIModule />
              </Suspense>
            }
          />
          <Route
            path="modules/erf"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ERFModule />
              </Suspense>
            }
          />
          <Route
            path="modules/biosec"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <BIOSECModule />
              </Suspense>
            }
          />
          <Route
            path="modules/asm"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ASMModule />
              </Suspense>
            }
          />
          <Route path="modules/cadapt" element={<Navigate to="/municipal" replace />} />
          <Route
            path="municipal"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <MunicipalDashboard />
              </Suspense>
            }
          />
          <Route path="effectiveness" element={<Suspense fallback={<LoadingScreen />}><MeasuresEffectivenessPage /></Suspense>} />
          <Route path="flood" element={<Suspense fallback={<LoadingScreen />}><FloodPage /></Suspense>} />
          <Route path="heat" element={<Suspense fallback={<LoadingScreen />}><HeatPage /></Suspense>} />
          <Route path="drought" element={<Suspense fallback={<LoadingScreen />}><DroughtPage /></Suspense>} />
          <Route path="grant" element={<Suspense fallback={<LoadingScreen />}><GrantPage /></Suspense>} />
          <Route path="alert" element={<Suspense fallback={<LoadingScreen />}><AlertPage /></Suspense>} />
          <Route path="lpr" element={<Suspense fallback={<LoadingScreen />}><LPRPage /></Suspense>} />
          <Route path="lpr/profile/:entity_id" element={<Suspense fallback={<LoadingScreen />}><LPRProfilePage /></Suspense>} />
          <Route
            element={
              <Suspense fallback={<LoadingScreen />}>
                <SRORegulatorDashboard />
              </Suspense>
            }
          />
          {/* 3D + AI Fintech Strategy Routes */}
          <Route
            path="projects"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Projects />
              </Suspense>
            }
          />
          <Route
            path="projects/new"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ProjectCreate />
              </Suspense>
            }
          />
          <Route
            path="projects/:id"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ProjectDetail />
              </Suspense>
            }
          />
          <Route
            path="portfolios"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <Portfolios />
              </Suspense>
            }
          />
          <Route
            path="portfolios/new"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PortfolioCreate />
              </Suspense>
            }
          />
          <Route
            path="portfolios/:id/globe"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PortfolioGlobePage />
              </Suspense>
            }
          />
          <Route
            path="portfolios/:id"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <PortfolioDetail />
              </Suspense>
            }
          />
          <Route
            path="fraud"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <FraudClaims />
              </Suspense>
            }
          />
          <Route
            path="fraud/claims/new"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <FraudClaimCreate />
              </Suspense>
            }
          />
          <Route
            path="fraud/claims/:id"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <FraudClaimDetail />
              </Suspense>
            }
          />
          <Route
            path="agents"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AgentMonitoring />
              </Suspense>
            }
          />
          <Route
            path="arin"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ARINPage />
              </Suspense>
            }
          />
          <Route
            path="cross-track"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <CrossTrackPage />
              </Suspense>
            }
          />
          <Route
            path="replay"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ReplayPage />
              </Suspense>
            }
          />
          <Route
            path="audit-ext"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AuditExtPage />
              </Suspense>
            }
          />
          <Route
            path="compliance"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ComplianceDashboard />
              </Suspense>
            }
          />
          <Route
            path="workflows"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AgentWorkflows />
              </Suspense>
            }
          />
          <Route
            path="quantum-risk"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <QuantumRiskIntelligence />
              </Suspense>
            }
          />
          <Route
            path="ai-models"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <AIModels />
              </Suspense>
            }
          />
          <Route
            path="nvidia-services"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <NvidiaServices />
              </Suspense>
            }
          />
          <Route
            path="earth-engine"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <EarthEnginePage />
              </Suspense>
            }
          />
          <Route
            path="risk-zones-analysis"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <RiskZoneAnalysis />
              </Suspense>
            }
          />
          <Route
            path="regulator-mode"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <RegulatorMode />
              </Suspense>
            }
          />
          <Route
            path="board-mode"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <BoardMode />
              </Suspense>
            }
          />
          <Route
            path="action-plans"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <ActionPlansPage />
              </Suspense>
            }
          />
          <Route
            path="stress-planner"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <StressPlannerPage />
              </Suspense>
            }
          />
          <Route
            path="bcp-generator"
            element={
              <Suspense fallback={<LoadingScreen />}>
                <BCPGeneratorPage />
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
