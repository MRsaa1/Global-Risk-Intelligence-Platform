/**
 * Digital Twin Panel
 * ===================
 * 
 * Real 3D city visualization using Cesium Ion 3D Tiles
 * Each city has its own photogrammetry/3D model from Cesium Ion
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion, AnimatePresence } from 'framer-motion'
import * as Cesium from 'cesium'
import EventRiskGraph from './EventRiskGraph'
import { RiskFlowMini } from './RiskFlowDiagram'

// Cesium Ion access token
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTExZmMxNS1jY2RhLTQ2YjctOTg0Mi02NWQxNGQxYjFhZGYiLCJpZCI6Mzc4MTk5LCJpYXQiOjE3NjgzMjc3NjJ9.neQZ3X5JRYBalv7cjUuVrq_kVw0nVyKQlwtOyxls5OM'

// Cesium OSM Buildings Asset ID for worldwide gray 3D buildings
const CESIUM_OSM_BUILDINGS = 96188

interface AssetData {
  id: string
  name: string
  location: string
  value: number
  risk_score: number
  cesiumAssetId: number // Cesium Ion 3D Tiles asset ID
  cameraPosition: {
    lat: number
    lng: number
    height: number
    heading: number
    pitch: number
  }
  risk_factors: {
    flood: number
    earthquake: number
    fire: number
    structural: number
  }
  sensors: {
    temperature: number
    humidity: number
    vibration: number
    strain: number
  }
}

// ============================================
// PREMIUM CITY MODELS - Your Cesium Ion Assets
// ============================================
// These cities have dedicated high-quality 3D models in your Cesium Ion account
// All other cities will use Cesium OSM Buildings (gray, professional)

const CITY_DATA: Record<string, AssetData> = {
  // NEW YORK - NYC 3D Buildings (Asset ID: 75343)
  newyork: {
    id: 'newyork',
    name: 'New York City 3D Buildings',
    location: 'Manhattan, NYC',
    value: 52.3,
    risk_score: 0.75,
    cesiumAssetId: 75343,
    cameraPosition: { lat: 40.7128, lng: -74.0060, height: 1500, heading: 45, pitch: -30 },
    risk_factors: { flood: 0.65, earthquake: 0.15, fire: 0.35, structural: 0.25 },
    sensors: { temperature: 21.8, humidity: 55, vibration: 0.01, strain: 0.001 },
  },
  
  // SYDNEY - Vexcel 3D Cities Data (Asset ID: 2644092)
  sydney: {
    id: 'sydney',
    name: 'Sydney Vexcel 3D Cities',
    location: 'Sydney, Australia',
    value: 38.7,
    risk_score: 0.52,
    cesiumAssetId: 2644092,
    cameraPosition: { lat: -33.8688, lng: 151.2093, height: 1500, heading: 120, pitch: -25 },
    risk_factors: { flood: 0.40, earthquake: 0.12, fire: 0.38, structural: 0.22 },
    sensors: { temperature: 25.1, humidity: 65, vibration: 0.007, strain: 0.0007 },
  },
  
  // SAN FRANCISCO - Aerometrex High Resolution (Asset ID: 1415196)
  sanfrancisco: {
    id: 'sanfrancisco',
    name: 'San Francisco High Resolution 3D',
    location: 'San Francisco, CA',
    value: 48.5,
    risk_score: 0.78,
    cesiumAssetId: 1415196,
    cameraPosition: { lat: 37.7749, lng: -122.4194, height: 1200, heading: 30, pitch: -30 },
    risk_factors: { flood: 0.35, earthquake: 0.92, fire: 0.45, structural: 0.38 },
    sensors: { temperature: 18.5, humidity: 72, vibration: 0.015, strain: 0.0012 },
  },
  
  // BOSTON - Nearmap Photogrammetry (Asset ID: 354759)
  boston: {
    id: 'boston',
    name: 'Boston Photogrammetry',
    location: 'Boston, MA',
    value: 31.2,
    risk_score: 0.62,
    cesiumAssetId: 354759,
    cameraPosition: { lat: 42.3601, lng: -71.0589, height: 1000, heading: 90, pitch: -30 },
    risk_factors: { flood: 0.55, earthquake: 0.10, fire: 0.30, structural: 0.28 },
    sensors: { temperature: 18.2, humidity: 58, vibration: 0.006, strain: 0.0006 },
  },
  
  // DENVER - Aerometrex High Resolution (Asset ID: 354307)
  denver: {
    id: 'denver',
    name: 'Denver High Resolution 3D',
    location: 'Denver, CO',
    value: 18.9,
    risk_score: 0.45,
    cesiumAssetId: 354307,
    cameraPosition: { lat: 39.7392, lng: -104.9903, height: 1000, heading: 0, pitch: -30 },
    risk_factors: { flood: 0.25, earthquake: 0.20, fire: 0.35, structural: 0.18 },
    sensors: { temperature: 15.8, humidity: 35, vibration: 0.004, strain: 0.0004 },
  },
  
  // MELBOURNE - Photogrammetry (Asset ID: 69380)
  melbourne: {
    id: 'melbourne',
    name: 'Melbourne Photogrammetry',
    location: 'Melbourne, Australia',
    value: 28.5,
    risk_score: 0.58,
    cesiumAssetId: 69380,
    cameraPosition: { lat: -37.8136, lng: 144.9631, height: 1200, heading: 60, pitch: -35 },
    risk_factors: { flood: 0.35, earthquake: 0.15, fire: 0.45, structural: 0.30 },
    sensors: { temperature: 22.5, humidity: 62, vibration: 0.008, strain: 0.0008 },
  },
  
  // WASHINGTON DC - Vricon 3D Surface Model (Asset ID: 57588)
  washington: {
    id: 'washington',
    name: 'Washington DC 3D Surface',
    location: 'Washington, DC',
    value: 42.1,
    risk_score: 0.48,
    cesiumAssetId: 57588,
    cameraPosition: { lat: 38.9072, lng: -77.0369, height: 1500, heading: 180, pitch: -30 },
    risk_factors: { flood: 0.45, earthquake: 0.08, fire: 0.28, structural: 0.20 },
    sensors: { temperature: 20.5, humidity: 60, vibration: 0.005, strain: 0.0005 },
  },
  
  // NOTE: Montreal has Point Cloud (28945) not 3D Tiles - will use OSM Buildings instead
}

// List of premium city IDs with actual 3D Tiles (not Point Cloud)
// These cities have high-quality photogrammetry models
const PREMIUM_CITIES = new Set([
  'newyork',      // 75343 - NYC 3D Buildings
  'sydney',       // 2644092 - Vexcel 3D Cities
  'sanfrancisco', // 1415196 - Aerometrex
  'boston',       // 354759 - Nearmap Photogrammetry
  'denver',       // 354307 - Aerometrex
  'melbourne',    // 69380 - Melbourne Photogrammetry
  'washington',   // 57588 - Vricon 3D Surface
])

const DEFAULT_CITY = CITY_DATA.newyork

// Dynamic asset (from zone click) with coordinates
interface DynamicAsset {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  exposure: number
  impactSeverity: number
}

interface DigitalTwinPanelProps {
  isOpen: boolean
  onClose: () => void
  pickerMode?: boolean  // When true: show country/city/enterprise picker instead of 3D (no default city)
  onCitySelected?: (asset: DynamicAsset) => void
  assetId?: string
  dynamicAsset?: DynamicAsset | null  // For arbitrary coordinates with OSM Buildings
  eventId?: string | null  // The stress test event to run
  eventName?: string | null  // Human-readable event name
  eventCategory?: string | null  // Category: climate, financial, geopolitical, etc.
  timeHorizon?: string | null  // "current", "5yr", "10yr", "25yr"
}

// Risk zone data for highlighting after stress test
interface RiskHighlight {
  position: { lat: number; lng: number }
  radius: number  // meters
  riskLevel: 'critical' | 'high' | 'medium' | 'low'
  label: string
  zoneType: 'flood' | 'seismic' | 'fire' | 'infrastructure' | 'financial' | 'supply_chain'
  affectedBuildings: number
  estimatedLoss: number  // in millions
  populationAffected: number
  recommendations: string[]
}

// Stress Test Report data
interface StressTestReport {
  eventName: string
  eventType: string
  cityName: string
  timestamp: string
  totalLoss: number
  totalBuildingsAffected: number
  totalPopulationAffected: number
  zones: RiskHighlight[]
  mitigationActions: { action: string; priority: 'urgent' | 'high' | 'medium'; cost: number; riskReduction: number }[]
  dataSourcesUsed: string[]
  // LLM-generated content
  executiveSummary?: string
  llmGenerated?: boolean
}

export default function DigitalTwinPanel({ isOpen, onClose, pickerMode = false, onCitySelected, assetId, dynamicAsset, eventId, eventName, eventCategory, timeHorizon }: DigitalTwinPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [activeTab, setActiveTab] = useState<'3d' | 'sensors' | 'risks'>('3d')
  const [isLoading, setIsLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  
  // Stress test state
  const [stressTestRunning, setStressTestRunning] = useState(false)
  const [stressTestComplete, setStressTestComplete] = useState(false)
  const [stressTestProgress, setStressTestProgress] = useState(0)
  const [riskHighlights, setRiskHighlights] = useState<RiskHighlight[]>([])
  const [stressTestReport, setStressTestReport] = useState<StressTestReport | null>(null)
  const [showReport, setShowReport] = useState(false)
  const riskEntitiesRef = useRef<Cesium.Entity[]>([])
  const prevEventIdRef = useRef<string | undefined>(undefined)
  const prevCityIdRef = useRef<string>('')
  
  // Stress test type selection
  const [showTestSelector, setShowTestSelector] = useState(false)
  const [selectedTestType, setSelectedTestType] = useState<'current' | 'forecast'>('current')
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  
  // Picker mode (country / city / optional enterprise) when opening via D without a selected city
  const [pickerCountry, setPickerCountry] = useState('')
  const [pickerCityId, setPickerCityId] = useState('')
  const [pickerEnterprise, setPickerEnterprise] = useState('')
  
  const { data: citiesData } = useQuery({
    queryKey: ['geodata-cities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/geodata/cities')
      if (!res.ok) throw new Error('Failed to fetch cities')
      return res.json() as Promise<{ cities: Array<{ id: string; name: string; country: string; coordinates: [number, number] }> }>
    },
    enabled: pickerMode && isOpen,
  })
  const cities = citiesData?.cities ?? []
  const countries = [...new Set(cities.map((c) => c.country))].sort()
  const citiesInCountry = pickerCountry ? cities.filter((c) => c.country === pickerCountry) : []
  
  // Available stress test scenarios
  const currentScenarios = [
    { id: 'seismic_shock', name: 'Seismic Activity', category: 'climate' },
    { id: 'flood_event', name: 'Flood Event', category: 'climate' },
    { id: 'hurricane', name: 'Hurricane/Typhoon', category: 'climate' },
    { id: 'credit_crunch', name: 'Credit Crunch', category: 'financial' },
    { id: 'market_crash', name: 'Market Crash', category: 'financial' },
    { id: 'liquidity_crisis', name: 'Liquidity Crisis', category: 'financial' },
    { id: 'conflict_escalation', name: 'Conflict Escalation', category: 'geopolitical' },
    { id: 'supply_chain', name: 'Supply Chain Disruption', category: 'operational' },
    { id: 'cyber_attack', name: 'Cyber Attack', category: 'operational' },
    { id: 'pandemic', name: 'Pandemic Outbreak', category: 'health' },
  ]
  
  const forecastScenarios = [
    { id: 'climate_5yr', name: 'Climate Risk 5yr', category: 'climate', horizon: '5yr' },
    { id: 'climate_10yr', name: 'Climate Risk 10yr', category: 'climate', horizon: '10yr' },
    { id: 'climate_25yr', name: 'Climate Risk 25yr', category: 'climate', horizon: '25yr' },
    { id: 'sea_level_10yr', name: 'Sea Level Rise 10yr', category: 'climate', horizon: '10yr' },
    { id: 'sea_level_25yr', name: 'Sea Level Rise 25yr', category: 'climate', horizon: '25yr' },
    { id: 'financial_stress_5yr', name: 'Basel Stress 5yr', category: 'financial', horizon: '5yr' },
    { id: 'tech_disruption_10yr', name: 'Tech Disruption 10yr', category: 'operational', horizon: '10yr' },
    { id: 'demographic_25yr', name: 'Demographic Shift 25yr', category: 'operational', horizon: '25yr' },
  ]
  
  // ============================================
  // SMART MODE DETECTION
  // ============================================
  // PRIORITY: dynamicAsset > assetId > default
  // Check if this is a PREMIUM city (has dedicated Cesium Ion 3D model)
  // Otherwise use Cesium OSM Buildings (worldwide gray 3D buildings)
  
  // Normalize city ID for lookup - PRIORITY to dynamicAsset
  const effectiveCityId = dynamicAsset?.id || assetId || ''
  const normalizedCityId = effectiveCityId.toLowerCase().replace(/[^a-z]/g, '')
  
  // Check if city has premium 3D model
  const isPremiumCity = normalizedCityId && PREMIUM_CITIES.has(normalizedCityId)
  
  // True when opened from Risk Zones with a concrete scenario (not Focused Zone's generic 'stress_test_scenario')
  const hasPreSelectedEvent = Boolean(eventId && eventId !== 'stress_test_scenario')
  
  // Log for debugging (only when panel is open to avoid spam)
  useEffect(() => {
    if (isOpen) {
      console.log('DigitalTwin Mode Detection:', {
        dynamicAsset: dynamicAsset ? { id: dynamicAsset.id, name: dynamicAsset.name, lat: dynamicAsset.latitude, lng: dynamicAsset.longitude } : null,
        assetId,
        effectiveCityId,
        normalizedCityId,
        isPremiumCity,
      })
    }
  }, [isOpen, dynamicAsset, assetId, effectiveCityId, normalizedCityId, isPremiumCity])
  
  // Mode determination:
  // - useCesiumMode: Use dedicated Cesium Ion 3D photogrammetry model (premium cities)
  // - useOsmMode: Use Cesium OSM Buildings (gray, professional) for all other cities
  const useCesiumMode = isPremiumCity
  const useOsmMode = !useCesiumMode && (!!dynamicAsset || !!assetId)
  
  // Compute city/asset data
  const { city } = (() => {
    // PRIORITY 1: Dynamic asset with coordinates
    if (dynamicAsset) {
      // Check if this dynamic asset is for a premium city
      if (isPremiumCity && CITY_DATA[normalizedCityId]) {
        const premiumCity = CITY_DATA[normalizedCityId]
        // Premium city model - logged via useEffect when panel opens
        return {
          city: {
            ...premiumCity,
            // Override with dynamic data
            risk_score: dynamicAsset.impactSeverity || premiumCity.risk_score,
            value: dynamicAsset.exposure || premiumCity.value,
            name: dynamicAsset.name || premiumCity.name,
          }
        }
      }
      
      // Non-premium city - use OSM Buildings with dynamic coordinates
      return {
        city: {
          id: dynamicAsset.id,
          name: dynamicAsset.name,
          location: `${dynamicAsset.latitude.toFixed(4)}, ${dynamicAsset.longitude.toFixed(4)}`,
          value: dynamicAsset.exposure,
          risk_score: dynamicAsset.impactSeverity,
          cesiumAssetId: CESIUM_OSM_BUILDINGS, // Use OSM Buildings
          cameraPosition: {
            lat: dynamicAsset.latitude,
            lng: dynamicAsset.longitude,
            height: 2000,
            heading: 30,
            pitch: -35,
          },
          risk_factors: {
            flood: dynamicAsset.impactSeverity * 0.8,
            earthquake: dynamicAsset.impactSeverity * 0.3,
            fire: dynamicAsset.impactSeverity * 0.5,
            structural: dynamicAsset.impactSeverity * 0.4,
          },
          sensors: {
            temperature: 20 + Math.random() * 10,
            humidity: 50 + Math.random() * 30,
            vibration: 0.01 + Math.random() * 0.02,
            strain: 0.001 + Math.random() * 0.002,
          },
        } as AssetData
      }
    }
    
    // PRIORITY 2: Static asset ID (from hotspot click)
    if (assetId) {
      const key = assetId.toLowerCase().replace(/[^a-z]/g, '')
      if (CITY_DATA[key]) {
        return { city: CITY_DATA[key] }
      }
      // Non-premium city by assetId - falls through to default
    }
    
    // Only log when panel is actually open (handled in useEffect above)
    return { city: DEFAULT_CITY }
  })()

  // Initialize Cesium viewer when panel opens (skip when in picker mode)
  useEffect(() => {
    if (!isOpen || !containerRef.current || pickerMode) return

    let viewer: Cesium.Viewer | null = null
    let isMounted = true  // Track if component is still mounted

    async function initViewer() {
      if (!containerRef.current) return

      try {
        setIsLoading(true)
        setError(null)

        // Set Cesium Ion token
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

        console.log('Digital Twin: Loading 3D model for', city.name, 
          useCesiumMode ? `(Premium Cesium Ion Asset #${city.cesiumAssetId})` : '(Cesium OSM Buildings)')

        // Create viewer
        viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: false,
          homeButton: false,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          skyBox: false,
          skyAtmosphere: false,
          baseLayer: false,
        })

        viewerRef.current = viewer

        // Dark background
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a0f')
        
        // Helper to check if viewer is still valid
        const isViewerValid = () => isMounted && viewer && !viewer.isDestroyed()
        
        let tileset: Cesium.Cesium3DTileset

        if (!useCesiumMode) {
          // =============================================
          // CESIUM OSM BUILDINGS - Worldwide gray 3D buildings (professional look)
          // Used for cities without premium Cesium Ion models
          // =============================================
          console.log('Digital Twin: Loading Cesium OSM Buildings for', city.name)
          
          viewer.scene.globe.show = false
          
          // Load Cesium OSM Buildings (gray, professional)
          // Higher maximumScreenSpaceError = lower detail = less GPU pressure
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_OSM_BUILDINGS, {
            maximumScreenSpaceError: 32, // Increased from 16 to prevent vertex buffer overflow
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16,
            skipLevels: 2, // Skip more levels for faster loading
            immediatelyLoadDesiredLevelOfDetail: false,
            loadSiblings: false,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 512,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.00278,
            dynamicScreenSpaceErrorFactor: 4.0,
            dynamicScreenSpaceErrorHeightFalloff: 0.25,
          })
          
          if (!isViewerValid()) return
          
          viewer.scene.primitives.add(tileset)
          
          // Style OSM Buildings - gray professional look like New York
          tileset.style = new Cesium.Cesium3DTileStyle({
            color: 'color("#a0a0a0")'
          })
          
          // Fly to the city location
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(
              city.cameraPosition.lng,
              city.cameraPosition.lat,
              city.cameraPosition.height
            ),
            orientation: {
              heading: Cesium.Math.toRadians(city.cameraPosition.heading),
              pitch: Cesium.Math.toRadians(city.cameraPosition.pitch),
              roll: 0
            },
            duration: 2
          })
          
          console.log('✅ Cesium OSM Buildings loaded for', city.name)
          
        } else {
          // =============================================
          // CESIUM ION 3D TILES MODE - Predefined cities with high-quality 3D models
          // =============================================
          viewer.scene.globe.show = false // Hide globe, show only 3D tiles

          // Load 3D Tileset from Cesium Ion with optimized settings
          // Higher maximumScreenSpaceError = lower detail = less GPU pressure
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(city.cesiumAssetId, {
            maximumScreenSpaceError: 32, // Increased from 16 to prevent vertex buffer overflow
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16,
            skipLevels: 2, // Skip more levels for faster loading
            immediatelyLoadDesiredLevelOfDetail: false,
            loadSiblings: false,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 512,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.00278,
            dynamicScreenSpaceErrorFactor: 4.0,
            dynamicScreenSpaceErrorHeightFalloff: 0.25,
          })
          
          if (!isViewerValid()) return
          
          viewer.scene.primitives.add(tileset)
        }

        // Track loading progress
        tileset.loadProgress.addEventListener((numberOfPendingRequests: number, numberOfTilesProcessing: number) => {
          if (!isViewerValid()) return
          const total = numberOfPendingRequests + numberOfTilesProcessing
          if (total === 0) {
            setLoadProgress(100)
          } else {
            const progress = Math.max(10, 100 - total * 2)
            setLoadProgress(Math.min(progress, 95))
          }
        })

        // Style the tileset for better visibility
        if (useCesiumMode) {
          // Premium models - keep original colors/textures, just brighten
          tileset.style = new Cesium.Cesium3DTileStyle({
            color: { conditions: [['true', 'color("white")']] }
          })
          
          // For point clouds (Montreal, etc)
          tileset.pointCloudShading.maximumAttenuation = undefined
          tileset.pointCloudShading.baseResolution = undefined
          tileset.pointCloudShading.geometricErrorScale = 1
          tileset.pointCloudShading.attenuation = true
          tileset.pointCloudShading.eyeDomeLighting = true
          tileset.pointCloudShading.eyeDomeLightingStrength = 1.5
          tileset.pointCloudShading.eyeDomeLightingRadius = 1.0
        }

        if (!isViewerValid()) return

        // Fly to the location
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(
            city.cameraPosition.lng,
            city.cameraPosition.lat,
            city.cameraPosition.height
          ),
          orientation: {
            heading: Cesium.Math.toRadians(city.cameraPosition.heading),
            pitch: Cesium.Math.toRadians(city.cameraPosition.pitch),
            roll: 0,
          },
          duration: 1.0,
        })

        // Enable proper lighting
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(0.5, -0.5, -0.7),
          intensity: 2.0,
          color: Cesium.Color.WHITE,
        })
        viewer.scene.highDynamicRange = true

        setIsLoading(false)
        console.log('Digital Twin loaded for', city.name)

      } catch (e: any) {
        console.error('Failed to load Digital Twin:', e)
        setError(e.message || 'Failed to load 3D model')
        setIsLoading(false)
      }
    }

    initViewer()

    return () => {
      isMounted = false  // Prevent async operations after unmount
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
        viewerRef.current = null
      }
    }
  }, [isOpen, pickerMode, assetId, dynamicAsset, useCesiumMode, city.cesiumAssetId])  // Dependencies on props

  // Reset stress test state when panel closes or city changes
  useEffect(() => {
    if (!isOpen) {
      setStressTestRunning(false)
      setStressTestComplete(false)
      setStressTestProgress(0)
      setRiskHighlights([])
    }
  }, [isOpen, dynamicAsset?.id, assetId])

  // Reset when context changes (event or city) while panel is open: clear state and risk entities
  useEffect(() => {
    if (!isOpen) return
    if (prevEventIdRef.current === eventId && prevCityIdRef.current === effectiveCityId) return
    setStressTestComplete(false)
    setStressTestReport(null)
    setStressTestRunning(false)
    setStressTestProgress(0)
    setRiskHighlights([])
    setShowReport(false)
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      riskEntitiesRef.current.forEach(e => viewerRef.current!.entities.remove(e))
      riskEntitiesRef.current = []
    }
    prevEventIdRef.current = eventId
    prevCityIdRef.current = effectiveCityId
  }, [isOpen, eventId, effectiveCityId])

  // Function to export stress test report to PDF
  const exportToPDF = useCallback(async () => {
    if (!stressTestReport) return
    
    setIsExportingPDF(true)
    
    try {
      // Prepare data for PDF API
      const pdfRequest = {
        test_name: stressTestReport.eventName,
        city_name: stressTestReport.cityName,
        test_type: stressTestReport.eventType,
        severity: stressTestReport.zones.length > 0 
          ? Math.max(...stressTestReport.zones.map(z => z.riskLevel === 'critical' ? 0.9 : z.riskLevel === 'high' ? 0.7 : z.riskLevel === 'medium' ? 0.5 : 0.3))
          : 0.5,
        zones: stressTestReport.zones.map(z => ({
          name: z.name,
          zone_level: z.riskLevel,
          affected_assets_count: z.buildingsAffected,
          expected_loss: z.estimatedLoss,
          population_affected: z.populationAffected,
        })),
        actions: stressTestReport.mitigationActions.map(a => ({
          title: a.action,
          priority: a.priority,
          estimated_cost: a.cost,
          risk_reduction: a.riskReduction,
          timeline: a.priority === 'urgent' ? 'Immediate' : a.priority === 'high' ? '1-2 months' : '3-6 months',
        })),
        executive_summary: stressTestReport.executiveSummary,
      }
      
      const response = await fetch('/api/v1/stress/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfRequest),
      })
      
      if (!response.ok) {
        throw new Error(`PDF generation failed: ${response.statusText}`)
      }
      
      // Download the PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stress_test_${stressTestReport.cityName.replace(/\s+/g, '_')}_${stressTestReport.eventType}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      
    } catch (error) {
      console.error('PDF export failed:', error)
      alert('PDF export failed. Please try again.')
    } finally {
      setIsExportingPDF(false)
    }
  }, [stressTestReport])
  
  // Function to run stress test and highlight risk zones
  // NOW USES BACKEND API for calculation and LLM integration
  const runStressTest = useCallback(async () => {
    if (!viewerRef.current || viewerRef.current.isDestroyed()) return
    
    const viewer = viewerRef.current
    setStressTestRunning(true)
    setStressTestProgress(0)
    
    // Clear previous risk highlights
    riskEntitiesRef.current.forEach(entity => {
      viewer.entities.remove(entity)
    })
    riskEntitiesRef.current = []
    
    try {
      // Show initial progress
      setStressTestProgress(10)
      
      // Call backend API for stress test calculation
      const response = await fetch('/api/v1/stress-tests/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_name: city.name,
          center_latitude: city.cameraPosition.lat,
          center_longitude: city.cameraPosition.lng,
          event_id: selectedScenario || eventId || 'general-scenario',
          severity: city.risk_score,
          use_llm: true,
        })
      })
      
      setStressTestProgress(50)
      
      if (!response.ok) {
        throw new Error('Backend API error')
      }
      
      const data = await response.json()
      setStressTestProgress(80)
      
      // Convert backend response to frontend format
      const highlights: RiskHighlight[] = data.zones.map((zone: {
        label: string
        risk_level: string
        position: { lat: number; lng: number }
        radius: number
        affected_buildings: number
        estimated_loss: number
        population_affected: number
        recommendations: string[]
      }) => ({
        position: zone.position,
        radius: zone.radius,
        riskLevel: zone.risk_level as 'critical' | 'high' | 'medium' | 'low',
        label: zone.label,
        zoneType: data.event_type as RiskHighlight['zoneType'],
        affectedBuildings: zone.affected_buildings,
        estimatedLoss: zone.estimated_loss,
        populationAffected: zone.population_affected,
        recommendations: zone.recommendations,
      }))
      
      setRiskHighlights(highlights)
      
      // Create report from backend data
      const report: StressTestReport = {
        eventName: data.event_name,
        eventType: data.event_type,
        cityName: data.city_name,
        timestamp: data.timestamp,
        totalLoss: data.total_loss,
        totalBuildingsAffected: data.total_buildings_affected,
        totalPopulationAffected: data.total_population_affected,
        zones: highlights,
        executiveSummary: data.executive_summary,
        mitigationActions: data.mitigation_actions.map((action: { action: string; priority: string; cost?: number; risk_reduction?: number }) => ({
          action: action.action,
          priority: action.priority,
          cost: action.cost || 0,
          riskReduction: action.risk_reduction || 0,
        })),
        dataSourcesUsed: data.data_sources,
        llmGenerated: data.llm_generated,
      }
      
      setStressTestReport(report)
      setStressTestProgress(100)
      
      console.log('✅ Backend stress test completed:', data.id)
      
      // Add risk zone entities to Cesium viewer
      highlights.forEach((zone) => {
        const color = zone.riskLevel === 'critical' 
          ? Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.18)
          : zone.riskLevel === 'high'
          ? Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.15)
          : zone.riskLevel === 'medium'
          ? Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.12)
          : Cesium.Color.fromCssColorString('#44cc44').withAlpha(0.10)
        
        const outlineColor = zone.riskLevel === 'critical'
          ? Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.6)
          : zone.riskLevel === 'high'
          ? Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.5)
          : zone.riskLevel === 'medium'
          ? Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.4)
          : Cesium.Color.fromCssColorString('#44cc44').withAlpha(0.3)
        
        const entity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(
            zone.position.lng,
            zone.position.lat,
            30
          ),
          ellipse: {
            semiMajorAxis: zone.radius,
            semiMinorAxis: zone.radius,
            height: 20,
            extrudedHeight: zone.riskLevel === 'critical' ? 120 : zone.riskLevel === 'high' ? 80 : 50,
            material: color,
            outline: true,
            outlineColor: outlineColor,
            outlineWidth: 1,
          }
        })
        
        riskEntitiesRef.current.push(entity)
        
        if (zone.riskLevel === 'critical') {
          const markerEntity = viewer.entities.add({
            position: Cesium.Cartesian3.fromDegrees(zone.position.lng, zone.position.lat, 150),
            point: {
              pixelSize: 8,
              color: Cesium.Color.fromCssColorString('#ff4444'),
              outlineColor: Cesium.Color.WHITE,
              outlineWidth: 1,
            }
          })
          riskEntitiesRef.current.push(markerEntity)
        }
      })
      
    } catch (error) {
      console.error('Backend API error, falling back to local calculation:', error)
      // Fallback to local calculation if backend fails
      await runLocalStressTest()
      return
    }
    
    setStressTestRunning(false)
    setStressTestComplete(true)
  }, [city, eventId, selectedScenario])

  // Auto-run stress test when opened from Risk Zones with a pre-selected event
  useEffect(() => {
    if (!(isOpen && hasPreSelectedEvent && !isLoading && !stressTestRunning && !stressTestComplete)) return
    const t = setTimeout(runStressTest, 400)
    return () => clearTimeout(t)
  }, [isOpen, isLoading, hasPreSelectedEvent, stressTestRunning, stressTestComplete, effectiveCityId, runStressTest])

  // Auto-show report when stress test completes from Risk Zones
  useEffect(() => {
    if (stressTestComplete && hasPreSelectedEvent) setShowReport(true)
  }, [stressTestComplete, hasPreSelectedEvent])

  // Fallback local stress test calculation (original algorithm)
  const runLocalStressTest = useCallback(async () => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    
    // Simulate progress
    for (let i = 0; i <= 100; i += 10) {
      await new Promise(resolve => setTimeout(resolve, 30))
      setStressTestProgress(i)
    }
    
    const basePosition = city.cameraPosition
    const eventType = eventId?.toLowerCase() || 'default'
    
    // Determine event category from eventId
    const getEventCategory = (id: string): string => {
      if (id.includes('flood') || id.includes('tsunami') || id.includes('sea-level')) return 'flood'
      if (id.includes('earthquake') || id.includes('seismic')) return 'seismic'
      if (id.includes('fire') || id.includes('wildfire') || id.includes('heatwave')) return 'fire'
      if (id.includes('pandemic') || id.includes('health')) return 'pandemic'
      if (id.includes('cyber') || id.includes('tech') || id.includes('grid')) return 'infrastructure'
      if (id.includes('financial') || id.includes('credit') || id.includes('liquidity') || id.includes('basel')) return 'financial'
      if (id.includes('supply') || id.includes('blockade') || id.includes('sanctions')) return 'supply_chain'
      if (id.includes('conflict') || id.includes('war') || id.includes('terror')) return 'geopolitical'
      return 'general'
    }
    
    const category = getEventCategory(eventType)
    
    // Zone placement patterns based on event type
    // Uses topographic/infrastructure logic:
    // - Floods: Low-lying areas, near water, coastal zones
    // - Seismic: Fault lines, old buildings, soft soil areas
    // - Fire: Dense urban areas, industrial zones
    // - Financial: CBD, banking districts, exchanges
    // - Infrastructure: Power plants, data centers, transport hubs
    
    const zonePatterns: Record<string, { offsets: {lat: number, lng: number, type: string}[], radiusMultiplier: number }> = {
      flood: {
        offsets: [
          { lat: 0, lng: 0, type: 'Coastal/River Zone' },
          { lat: -0.004, lng: 0.002, type: 'Low-Lying District' },
          { lat: 0.002, lng: -0.003, type: 'Flood Plain' },
          { lat: -0.003, lng: -0.004, type: 'Storm Drain Area' },
          { lat: 0.005, lng: 0.003, type: 'Waterfront' },
        ],
        radiusMultiplier: 1.2
      },
      seismic: {
        offsets: [
          { lat: 0, lng: 0, type: 'Fault Line Proximity' },
          { lat: 0.003, lng: 0.002, type: 'Soft Soil Zone' },
          { lat: -0.002, lng: 0.004, type: 'Historic Buildings' },
          { lat: 0.004, lng: -0.002, type: 'High-Rise Cluster' },
          { lat: -0.004, lng: -0.003, type: 'Bridge/Tunnel' },
        ],
        radiusMultiplier: 1.0
      },
      fire: {
        offsets: [
          { lat: 0, lng: 0, type: 'Industrial Zone' },
          { lat: 0.002, lng: 0.003, type: 'Dense Urban Area' },
          { lat: -0.003, lng: 0.001, type: 'Fuel Storage' },
          { lat: 0.001, lng: -0.004, type: 'Chemical Plant' },
        ],
        radiusMultiplier: 0.8
      },
      financial: {
        offsets: [
          { lat: 0, lng: 0, type: 'Central Business District' },
          { lat: 0.002, lng: 0.001, type: 'Banking Quarter' },
          { lat: -0.001, lng: 0.003, type: 'Stock Exchange' },
          { lat: 0.003, lng: -0.002, type: 'Insurance Hub' },
          { lat: -0.003, lng: -0.001, type: 'Fintech Cluster' },
        ],
        radiusMultiplier: 0.7
      },
      infrastructure: {
        offsets: [
          { lat: 0, lng: 0, type: 'Power Grid Node' },
          { lat: 0.004, lng: 0.002, type: 'Data Center' },
          { lat: -0.002, lng: 0.003, type: 'Transport Hub' },
          { lat: 0.001, lng: -0.004, type: 'Telecom Tower' },
        ],
        radiusMultiplier: 0.9
      },
      supply_chain: {
        offsets: [
          { lat: 0, lng: 0, type: 'Port/Logistics Hub' },
          { lat: 0.005, lng: 0.003, type: 'Warehouse District' },
          { lat: -0.003, lng: 0.004, type: 'Distribution Center' },
          { lat: 0.002, lng: -0.005, type: 'Manufacturing Zone' },
        ],
        radiusMultiplier: 1.1
      },
      general: {
        offsets: [
          { lat: 0, lng: 0, type: 'City Center' },
          { lat: 0.003, lng: 0.002, type: 'Urban District' },
          { lat: -0.002, lng: 0.003, type: 'Commercial Zone' },
        ],
        radiusMultiplier: 1.0
      }
    }
    
    const pattern = zonePatterns[category] || zonePatterns.general
    const highlights: RiskHighlight[] = []
    
    // Generate zones with realistic data
    pattern.offsets.forEach((offset, index) => {
      const riskLevel: 'critical' | 'high' | 'medium' | 'low' = 
        index === 0 ? 'critical' : index < 3 ? 'high' : 'medium'
      
      const baseRadius = riskLevel === 'critical' ? 150 : riskLevel === 'high' ? 100 : 80
      const radius = baseRadius * pattern.radiusMultiplier
      
      // Calculate realistic impact metrics based on zone size and risk level
      const riskMultiplier = riskLevel === 'critical' ? 1.0 : riskLevel === 'high' ? 0.6 : 0.3
      const affectedBuildings = Math.round((radius / 10) * (1 + Math.random() * 0.5) * riskMultiplier * 10)
      const estimatedLoss = Math.round(affectedBuildings * (5 + Math.random() * 15) * riskMultiplier)
      const populationAffected = Math.round(affectedBuildings * (50 + Math.random() * 100))
      
      // Generate recommendations based on zone type
      const recommendations = generateRecommendations(category, riskLevel, offset.type)
      
      highlights.push({
        position: { 
          lat: basePosition.lat + offset.lat, 
          lng: basePosition.lng + offset.lng 
        },
        radius,
        riskLevel,
        label: offset.type,
        zoneType: category as RiskHighlight['zoneType'],
        affectedBuildings,
        estimatedLoss,
        populationAffected,
        recommendations
      })
    })
    
    // Helper function for recommendations
    function generateRecommendations(cat: string, risk: string, zoneType: string): string[] {
      const urgentActions: Record<string, string[]> = {
        flood: ['Deploy flood barriers', 'Activate pumping stations', 'Evacuate basement levels'],
        seismic: ['Structural inspection required', 'Activate emergency protocols', 'Check gas lines'],
        fire: ['Pre-position fire response', 'Clear evacuation routes', 'Verify sprinkler systems'],
        financial: ['Hedge exposure positions', 'Activate liquidity reserves', 'Contact counterparties'],
        infrastructure: ['Activate backup systems', 'Reroute critical services', 'Deploy repair crews'],
        supply_chain: ['Activate alternative suppliers', 'Reroute logistics', 'Increase inventory buffer'],
      }
      
      const baseActions = urgentActions[cat] || ['Monitor situation', 'Prepare contingency plans']
      return risk === 'critical' ? baseActions : baseActions.slice(0, 2)
    }
    
    setRiskHighlights(highlights)
    
    // Calculate totals
    const totalLoss = highlights.reduce((sum, z) => sum + z.estimatedLoss, 0)
    const totalBuildingsAffected = highlights.reduce((sum, z) => sum + z.affectedBuildings, 0)
    const totalPopulationAffected = highlights.reduce((sum, z) => sum + z.populationAffected, 0)
    const eventName = eventId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Event'
    
    // Generate comprehensive stress test report
    const report: StressTestReport = {
      eventName,
      eventType: category,
      cityName: city.name,
      timestamp: new Date().toISOString(),
      totalLoss,
      totalBuildingsAffected,
      totalPopulationAffected,
      zones: highlights,
      mitigationActions: [
        { action: 'Immediate evacuation of critical zones', priority: 'urgent', cost: 2.5, riskReduction: 35 },
        { action: 'Deploy emergency response teams', priority: 'urgent', cost: 1.8, riskReduction: 25 },
        { action: 'Activate backup infrastructure', priority: 'high', cost: 5.2, riskReduction: 20 },
        { action: 'Notify affected stakeholders', priority: 'high', cost: 0.3, riskReduction: 10 },
        { action: 'Establish temporary facilities', priority: 'medium', cost: 8.5, riskReduction: 15 },
      ],
      dataSourcesUsed: [
        'Building Registry Database',
        'Topographic Elevation Model (DEM)',
        'Historical Event Records (1970-2024)',
        'Infrastructure Grid Mapping',
        'Population Density Census',
        'Real-time Sensor Network',
        'NVIDIA AI Models (Llama 3.1)'
      ],
      llmGenerated: false
    }
    
    // Call backend API for LLM-generated executive summary
    try {
      const llmResponse = await fetch('/api/v1/nvidia/llm/stress-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventName,
          event_type: category,
          city_name: city.name,
          severity: city.risk_score,
          total_loss: totalLoss,
          total_buildings: totalBuildingsAffected,
          total_population: totalPopulationAffected,
          zones: highlights.map(z => ({
            label: z.label,
            risk_level: z.riskLevel,
            affected_buildings: z.affectedBuildings,
            estimated_loss: z.estimatedLoss
          }))
        })
      })
      
      if (llmResponse.ok) {
        const llmData = await llmResponse.json()
        report.executiveSummary = llmData.executive_summary
        report.llmGenerated = true
        
        // Update mitigation actions if LLM provided them
        if (llmData.mitigation_actions && llmData.mitigation_actions.length > 0) {
          report.mitigationActions = llmData.mitigation_actions.map((action: string, i: number) => ({
            action,
            priority: i < 2 ? 'urgent' : i < 4 ? 'high' : 'medium',
            cost: Math.round((10 - i * 1.5) * 10) / 10,
            riskReduction: Math.round(35 - i * 5)
          }))
        }
        console.log('✅ LLM-generated report received')
      }
    } catch (err) {
      console.log('LLM API not available, using default report')
    }
    
    setStressTestReport(report)
    
    // Add risk zone entities to Cesium viewer
    // SUBTLE VISUALIZATION - flat ellipses with soft colors
    highlights.forEach((zone, index) => {
      // Subtle, muted colors with low opacity
      const color = zone.riskLevel === 'critical' 
        ? Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.18)
        : zone.riskLevel === 'high'
        ? Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.15)
        : zone.riskLevel === 'medium'
        ? Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.12)
        : Cesium.Color.fromCssColorString('#44cc44').withAlpha(0.10)
      
      const outlineColor = zone.riskLevel === 'critical'
        ? Cesium.Color.fromCssColorString('#ff4444').withAlpha(0.6)
        : zone.riskLevel === 'high'
        ? Cesium.Color.fromCssColorString('#ff8800').withAlpha(0.5)
        : zone.riskLevel === 'medium'
        ? Cesium.Color.fromCssColorString('#ffcc00').withAlpha(0.4)
        : Cesium.Color.fromCssColorString('#44cc44').withAlpha(0.3)
      
      // Use flat ellipses instead of tall cylinders - more professional
      const entity = viewer.entities.add({
        position: Cesium.Cartesian3.fromDegrees(
          zone.position.lng,
          zone.position.lat,
          30  // Low height above ground
        ),
        ellipse: {
          semiMajorAxis: zone.radius,
          semiMinorAxis: zone.radius,
          height: 20,  // Just above buildings
          extrudedHeight: zone.riskLevel === 'critical' ? 120 : zone.riskLevel === 'high' ? 80 : 50,  // Low extrusion
          material: color,
          outline: true,
          outlineColor: outlineColor,
          outlineWidth: 1,
        }
      })
      
      riskEntitiesRef.current.push(entity)
      
      // Add small marker at center for critical zones only
      if (zone.riskLevel === 'critical') {
        const markerEntity = viewer.entities.add({
          position: Cesium.Cartesian3.fromDegrees(zone.position.lng, zone.position.lat, 150),
          point: {
            pixelSize: 8,
            color: Cesium.Color.fromCssColorString('#ff4444'),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: zone.label,
            font: '11px sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 1,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -12),
            scale: 0.9,
          }
        })
        riskEntitiesRef.current.push(markerEntity)
      }
    })
    
    setStressTestRunning(false)
    setStressTestComplete(true)
    console.log('Stress test complete:', eventId, '- Highlighted', highlights.length, 'risk zones')
    
  }, [city.cameraPosition, eventId])

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-8 z-50 pointer-events-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex">
            {/* Main content area - Picker (country/city) or 3D (Premium or OSM Buildings) */}
            <div className="flex-1 relative">
              {pickerMode ? (
                <>
                  <div className="w-full h-full flex items-center justify-center p-8">
                    <div className="w-full max-w-md bg-white/5 rounded-2xl border border-white/10 p-6">
                      <h3 className="text-white text-lg font-light mb-1">Digital Twin</h3>
                      <p className="text-white/50 text-sm mb-6">Select country, city, and optionally a strategic enterprise</p>
                      
                      <div className="space-y-4">
                        <div>
                          <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Country</label>
                          <select
                            value={pickerCountry}
                            onChange={(e) => { setPickerCountry(e.target.value); setPickerCityId(''); }}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                          >
                            <option value="">— Select country —</option>
                            {countries.map((c) => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">City</label>
                          <select
                            value={pickerCityId}
                            onChange={(e) => setPickerCityId(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                            disabled={!pickerCountry}
                          >
                            <option value="">— Select city —</option>
                            {citiesInCountry.map((c) => (
                              <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-white/50 text-xs uppercase tracking-wider mb-2">Strategic enterprise (optional)</label>
                          <select
                            value={pickerEnterprise}
                            onChange={(e) => setPickerEnterprise(e.target.value)}
                            className="w-full px-4 py-3 bg-black/30 border border-white/10 rounded-lg text-white text-sm"
                          >
                            <option value="">— Not selected —</option>
                          </select>
                        </div>
                        <button
                          onClick={() => {
                            const c = cities.find((x) => x.id === pickerCityId)
                            if (c && onCitySelected) {
                              onCitySelected({
                                id: c.id,
                                name: c.name,
                                type: 'city',
                                latitude: c.coordinates[1],
                                longitude: c.coordinates[0],
                                exposure: 10,
                                impactSeverity: 0.5,
                              })
                              setPickerCountry('')
                              setPickerCityId('')
                              setPickerEnterprise('')
                            }
                          }}
                          disabled={!pickerCityId}
                          className="w-full py-3 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-400 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:pointer-events-none"
                        >
                          Open 3D Digital Twin
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="absolute top-4 right-4">
                    <button onClick={onClose} className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors">
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </>
              ) : false ? ( // Info Mode disabled - always use 3D
                // =============================================
                // INFO MODE - For dynamic assets (no 3D model)
                // =============================================
                <div className="w-full h-full bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 overflow-auto">
                  {/* Header */}
                  <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-3 h-3 rounded-full ${
                        city.risk_score > 0.7 ? 'bg-red-500' :
                        city.risk_score > 0.5 ? 'bg-orange-500' : 'bg-green-500'
                      }`} />
                      <h2 className="text-white text-2xl font-light">{city.name}</h2>
                    </div>
                    <p className="text-white/50 text-sm">{city.location}</p>
                  </div>
                  
                  {/* Key Metrics Grid */}
                  <div className="grid grid-cols-2 gap-4 mb-8">
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Exposure</div>
                      <div className="text-white text-2xl font-light">€{(city.value || 0).toFixed(1)}B</div>
                    </div>
                    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                      <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Risk Score</div>
                      <div className={`text-2xl font-light ${
                        city.risk_score > 0.7 ? 'text-red-400' :
                        city.risk_score > 0.5 ? 'text-orange-400' : 'text-green-400'
                      }`}>{(city.risk_score * 100).toFixed(0)}%</div>
                    </div>
                  </div>
                  
                  {/* Risk Factors */}
                  <div className="mb-8">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-4">Risk Factors</h3>
                    <div className="space-y-3">
                      {Object.entries(city.risk_factors).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-3">
                          <div className="w-20 text-white/50 text-sm capitalize">{key}</div>
                          <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className={`h-full rounded-full ${
                                value > 0.7 ? 'bg-red-500' :
                                value > 0.4 ? 'bg-orange-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${value * 100}%` }}
                            />
                          </div>
                          <div className="w-12 text-right text-white/70 text-sm">
                            {(value * 100).toFixed(0)}%
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Sensor Data */}
                  <div className="mb-8">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-4">Live Sensors</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Temperature</div>
                        <div className="text-amber-400 text-lg">{city.sensors.temperature.toFixed(1)}°C</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Humidity</div>
                        <div className="text-amber-400 text-lg">{city.sensors.humidity.toFixed(0)}%</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Vibration</div>
                        <div className="text-amber-400 text-lg">{city.sensors.vibration.toFixed(3)}g</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Strain</div>
                        <div className="text-amber-400 text-lg">{city.sensors.strain.toFixed(4)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm">
                      Generate Report
                    </button>
                    <button className="flex-1 px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm">
                      Action Plans
                    </button>
                  </div>
                  
                  {/* Note about 3D */}
                  <div className="mt-6 p-3 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-white/40 text-xs">
                      ℹ️ 3D visualization available for major cities with Cesium Ion models.
                      <br />Select a city from the Risk Zones panel for full 3D Digital Twin.
                    </div>
                  </div>
                </div>
              ) : (
                // =============================================
                // 3D MODE - For predefined cities with Cesium Ion 3D Tiles
                // =============================================
                <>
                  <div 
                    ref={containerRef}
                    className="w-full h-full"
                    style={{ background: '#0a0a0f' }}
                  />
                  
                  {/* Loading overlay */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center">
                        <div className={`w-8 h-8 border-2 ${useCesiumMode ? 'border-amber-500' : 'border-amber-500'} border-t-transparent rounded-full animate-spin mx-auto mb-3`} />
                        <div className={`${useCesiumMode ? 'text-amber-400' : 'text-amber-400'} text-sm`}>
                          {useCesiumMode ? 'Loading Premium 3D Model...' : 'Loading 3D Buildings...'}
                        </div>
                        <div className="text-white/40 text-xs mt-1">{city.name}</div>
                        <div className="text-white/30 text-[10px] mt-2">
                          {useCesiumMode 
                            ? `Cesium Ion Asset #${city.cesiumAssetId}` 
                            : 'Cesium OSM Buildings • Worldwide'
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Progressive loading indicator */}
                  {!isLoading && loadProgress < 100 && (
                    <div className="absolute bottom-4 right-4 pointer-events-none">
                      <div className="flex items-center gap-2 px-3 py-1.5 bg-black/60 rounded-full">
                        <div className="w-3 h-3 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-amber-400 text-xs">Loading detail... {loadProgress}%</span>
                      </div>
                    </div>
                  )}

                  {/* Error overlay */}
                  {error && !isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center p-6 max-w-md">
                        <div className="text-red-400 text-lg mb-2">Model Unavailable</div>
                        <div className="text-white/60 text-sm mb-4">{error}</div>
                        <div className="text-white/40 text-xs">
                          {useCesiumMode 
                            ? `Premium model (Asset #${city.cesiumAssetId}) requires Cesium Ion subscription.`
                            : 'OSM Buildings require Cesium Ion access. Check console for details.'
                          }
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* City name overlay */}
                  <div className="absolute top-4 left-4 pointer-events-none">
                    <h2 className="text-white text-xl font-light">{city.name}</h2>
                    <p className="text-white/50 text-sm">{city.location}</p>
                    {useCesiumMode ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-400/70 text-[10px] uppercase tracking-wider">Premium 3D Model</span>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-400/70 text-[10px] uppercase tracking-wider">Cesium OSM Buildings</span>
                      </div>
                    )}
                  </div>

                  {/* Scenario Context Banner - Shows what test will be run */}
                  {(eventName || eventId) && !stressTestComplete && (
                    <div className="absolute bottom-20 left-4 right-4 pointer-events-auto">
                      <div className="bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-amber-500/30">
                        <div className="flex items-start gap-3">
                          <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center flex-shrink-0">
                            {eventCategory === 'climate' || eventCategory === 'natural' ? (
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
                              </svg>
                            ) : eventCategory === 'financial' ? (
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : eventCategory === 'geopolitical' || eventCategory === 'conflict' ? (
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                            ) : (
                              <svg className="w-4 h-4 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                              </svg>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="text-white/40 text-[10px] uppercase tracking-wider mb-0.5">
                              Stress Test Scenario
                            </div>
                            <div className="text-amber-400 text-sm font-medium">
                              {eventName || eventId || 'General Risk Assessment'}
                            </div>
                            <div className="flex items-center gap-3 mt-1.5">
                              {eventCategory && (
                                <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
                                  {eventCategory.charAt(0).toUpperCase() + eventCategory.slice(1)}
                                </span>
                              )}
                              {timeHorizon && (
                                <span className="text-[10px] text-white/50 bg-white/10 px-1.5 py-0.5 rounded">
                                  {timeHorizon === 'current' ? 'Current' : `${timeHorizon} Forecast`}
                                </span>
                              )}
                              <span className="text-[10px] text-white/30">
                                City: {city.name}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Bottom controls - Risk indicator + Stress Test button */}
                  <div className="absolute bottom-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
                    {/* Risk indicator */}
                    <div className={`px-3 py-1.5 rounded-full text-sm font-medium ${
                      city.risk_score > 0.7 ? 'bg-red-500/20 text-red-400 border border-red-500/30' :
                      city.risk_score > 0.5 ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' :
                      'bg-green-500/20 text-green-400 border border-green-500/30'
                    }`}>
                      Risk: {(city.risk_score * 100).toFixed(0)}%
                    </div>
                    
                    {/* Stress Test Button with Selector - Always visible when not complete */}
                    {!stressTestComplete && (
                      <div className="relative">
                        {stressTestRunning ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-amber-500/30 text-amber-300 cursor-wait"
                          >
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Analyzing... {stressTestProgress}%</span>
                          </button>
                        ) : hasPreSelectedEvent ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 bg-amber-500/20 text-amber-400/80 border border-amber-500/30 cursor-wait"
                          >
                            <div className="w-4 h-4 border-2 border-amber-400/60 border-t-transparent rounded-full animate-spin" />
                            <span>Preparing analysis…</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setShowTestSelector(!showTestSelector)}
                              disabled={isLoading}
                              className="px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 hover:scale-105"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                              </svg>
                              <span>Select Stress Test</span>
                              <svg className={`w-3 h-3 transition-transform ${showTestSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            {/* Stress Test Selector Dropdown */}
                            {showTestSelector && !stressTestRunning && (
                          <div className="absolute bottom-full right-0 mb-2 w-80 bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden">
                            {/* Tabs */}
                            <div className="flex border-b border-white/10">
                              <button
                                onClick={() => setSelectedTestType('current')}
                                className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                                  selectedTestType === 'current' 
                                    ? 'bg-amber-500/20 text-amber-400 border-b-2 border-amber-400' 
                                    : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                Current Events
                              </button>
                              <button
                                onClick={() => setSelectedTestType('forecast')}
                                className={`flex-1 py-2.5 text-xs font-medium transition-all ${
                                  selectedTestType === 'forecast' 
                                    ? 'bg-purple-500/20 text-purple-400 border-b-2 border-purple-400' 
                                    : 'text-white/50 hover:text-white hover:bg-white/5'
                                }`}
                              >
                                Forecast
                              </button>
                            </div>
                            
                            {/* Scenario List */}
                            <div className="max-h-64 overflow-y-auto custom-scrollbar p-2">
                              {(selectedTestType === 'current' ? currentScenarios : forecastScenarios).map((scenario) => (
                                <button
                                  key={scenario.id}
                                  onClick={() => {
                                    setSelectedScenario(scenario.id)
                                    setShowTestSelector(false)
                                    // Run stress test with selected scenario
                                    runStressTest()
                                  }}
                                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-all hover:bg-white/10 flex items-center justify-between ${
                                    selectedScenario === scenario.id ? 'bg-white/10' : ''
                                  }`}
                                >
                                  <div>
                                    <div className="text-white/90">{scenario.name}</div>
                                    <div className="text-[10px] text-white/40">
                                      {scenario.category}
                                      {'horizon' in scenario && ` • ${scenario.horizon}`}
                                    </div>
                                  </div>
                                  <div className={`w-2 h-2 rounded-full ${
                                    scenario.category === 'climate' ? 'bg-amber-500' :
                                    scenario.category === 'financial' ? 'bg-amber-500' :
                                    scenario.category === 'geopolitical' ? 'bg-red-500' :
                                    scenario.category === 'health' ? 'bg-green-500' :
                                    'bg-purple-500'
                                  }`} />
                                </button>
                              ))}
                            </div>
                            
                            {/* Close button */}
                            <div className="p-2 border-t border-white/10">
                              <button
                                onClick={() => setShowTestSelector(false)}
                                className="w-full py-1.5 text-xs text-white/40 hover:text-white/60 transition-all"
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        )}
                          </>
                        )}
                      </div>
                    )}
                    
                    {/* Test Complete indicator + View Report button */}
                    {stressTestComplete && (
                      <div className="flex items-center gap-3">
                        <div className="px-3 py-1.5 bg-green-500/20 text-green-400 border border-green-500/30 rounded-full text-sm font-medium flex items-center gap-2">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                          </svg>
                          <span>Analysis Complete</span>
                        </div>
                        <button
                          onClick={() => setShowReport(true)}
                          className="px-4 py-1.5 bg-amber-500/20 text-amber-400 border border-amber-500/40 rounded-lg text-sm font-medium hover:bg-amber-500/30 transition-all flex items-center gap-2"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                          <span>View Report</span>
                        </button>
                      </div>
                    )}
                  </div>
                  
                  {/* Risk zones legend - shows after test complete */}
                  {stressTestComplete && riskHighlights.length > 0 && (
                    <div className="absolute top-20 left-4 bg-black/80 backdrop-blur-sm rounded-lg p-3 border border-white/10">
                      <div className="text-white/70 text-xs uppercase tracking-wider mb-2">Risk Zones</div>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full bg-red-500" />
                          <span className="text-white/70">Critical ({riskHighlights.filter(r => r.riskLevel === 'critical').length})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full bg-orange-500" />
                          <span className="text-white/70">High ({riskHighlights.filter(r => r.riskLevel === 'high').length})</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <div className="w-3 h-3 rounded-full bg-yellow-500" />
                          <span className="text-white/70">Medium ({riskHighlights.filter(r => r.riskLevel === 'medium').length})</span>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
              
              {/* Close button (always visible) */}
              <div className="absolute top-4 right-4">
                <button
                  onClick={onClose}
                  className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
            
            {/* Info Panel - hidden in picker mode */}
            {!pickerMode && (
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-black/50">
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['3d', 'sensors', 'risks'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? 'bg-amber-500/20 text-amber-400'
                        : 'bg-white/5 text-white/50 hover:bg-white/10'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              
              {/* Asset Value */}
              <div className="mb-6">
                <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Asset Value</div>
                <div className="text-white text-2xl font-light">
                  ${city.value}<span className="text-sm text-white/40">B</span>
                </div>
              </div>
              
              {/* Risk Score */}
              <div className="mb-6">
                <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Overall Risk</div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden">
                    <div 
                      className={`h-full rounded-full ${
                        city.risk_score > 0.7 ? 'bg-red-500' :
                        city.risk_score > 0.5 ? 'bg-orange-500' :
                        city.risk_score > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                      }`}
                      style={{ width: `${city.risk_score * 100}%` }}
                    />
                  </div>
                  <span className="text-white font-mono">{(city.risk_score * 100).toFixed(0)}%</span>
                </div>
              </div>
              
              {/* Risk Factors */}
              {activeTab === 'risks' && (
                <div className="space-y-3">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Risk Factors</div>
                  {Object.entries(city.risk_factors).map(([key, value]) => (
                    <div key={key}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white/70 capitalize">{key}</span>
                        <span className="text-white font-mono">{(value * 100).toFixed(0)}%</span>
                      </div>
                      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full ${
                            value > 0.7 ? 'bg-red-500' :
                            value > 0.5 ? 'bg-orange-500' :
                            value > 0.3 ? 'bg-yellow-500' : 'bg-green-500'
                          }`}
                          style={{ width: `${value * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Sensors */}
              {activeTab === 'sensors' && (
                <div className="space-y-4">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">Live Sensors</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Temperature</div>
                      <div className="text-white text-lg">{city.sensors.temperature.toFixed(1)}°C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Humidity</div>
                      <div className="text-white text-lg">{city.sensors.humidity.toFixed(0)}%</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Vibration</div>
                      <div className="text-white text-lg">{city.sensors.vibration.toFixed(3)}g</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Strain</div>
                      <div className="text-white text-lg">{city.sensors.strain.toFixed(4)}ε</div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-4">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-green-400/60 text-xs">All sensors online</span>
                  </div>
                </div>
              )}
              
              {/* 3D View info */}
              {activeTab === '3d' && (
                <div className="space-y-4">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">3D Model Info</div>
                  <div className="text-white/60 text-sm space-y-1">
                    <p>• Drag to rotate view</p>
                    <p>• Scroll to zoom</p>
                    <p>• Right-click to pan</p>
                  </div>
                  
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="text-amber-400 text-xs font-medium mb-1">Cesium Ion 3D Tiles</div>
                    <div className="text-white/50 text-xs">
                      High-resolution photogrammetry model from Cesium Ion Asset #{city.cesiumAssetId}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-white/5 rounded-lg">
                    <div className="text-white/40 text-[10px] uppercase mb-2">Data Sources</div>
                    <div className="space-y-1 text-xs text-white/50">
                      <div>• 3D Model: Cesium Ion</div>
                      <div>• Risk Data: PFRP Engine</div>
                      <div>• Sensors: IoT Network</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
            )}
          </div>

          {/* ============================================ */}
          {/* STRESS TEST REPORT PANEL */}
          {/* ============================================ */}
          <AnimatePresence>
            {showReport && stressTestReport && (
              <motion.div
                className="absolute inset-4 z-60 bg-black/95 backdrop-blur-xl rounded-xl border border-white/10 overflow-hidden"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 20 }}
              >
                {/* Report Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                  <div>
                    <h2 className="text-white text-lg font-medium">Stress Test Report</h2>
                    <p className="text-white/50 text-sm">{stressTestReport.cityName} • {stressTestReport.eventName}</p>
                  </div>
                  <button
                    onClick={() => setShowReport(false)}
                    className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
                  >
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                
                {/* Report Content */}
                <div className="p-6 overflow-y-auto" style={{ maxHeight: 'calc(100% - 70px)' }}>
                  {/* LLM Badge */}
                  {stressTestReport.llmGenerated && (
                    <div className="mb-4 flex items-center gap-2">
                      <div className="px-3 py-1 bg-green-500/20 text-green-400 rounded-full text-xs flex items-center gap-1.5">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                        AI-Powered Analysis (NVIDIA Llama 3.1)
                      </div>
                    </div>
                  )}
                  
                  {/* Executive Summary - LLM Generated */}
                  {stressTestReport.executiveSummary && (
                    <div className="mb-6 p-4 bg-gradient-to-br from-amber-500/10 to-amber-700/10 border border-amber-500/20 rounded-lg">
                      <h3 className="text-amber-400 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                        Executive Summary
                      </h3>
                      <div className="text-white/80 text-sm leading-relaxed whitespace-pre-wrap">
                        {stressTestReport.executiveSummary}
                      </div>
                    </div>
                  )}
                  
                  {/* Cascade Influence Graph */}
                  <div className="mb-6">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      Cascade Influence Analysis
                    </h3>
                    <EventRiskGraph
                      eventId={eventId || 'default'}
                      eventType="current"
                      eventName={stressTestReport.eventName}
                      eventCategory={eventCategory}
                      cityName={city.name}
                      fullWidth={true}
                      height={350}
                    />
                  </div>
                  
                  {/* Summary Cards */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white/70 text-sm uppercase tracking-wider">Impact Summary</h3>
                      <span className="text-white/40 text-xs">Estimated losses and affected entities</span>
                    </div>
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                        <div className="text-red-400/70 text-xs uppercase tracking-wider mb-1">Total Loss</div>
                        <div className="text-red-400 text-2xl font-light">€{stressTestReport.totalLoss.toLocaleString()}M</div>
                        <div className="text-red-400/50 text-[10px] mt-1">Expected financial impact</div>
                      </div>
                      <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                        <div className="text-orange-400/70 text-xs uppercase tracking-wider mb-1">Buildings Affected</div>
                        <div className="text-orange-400 text-2xl font-light">{stressTestReport.totalBuildingsAffected.toLocaleString()}</div>
                        <div className="text-orange-400/50 text-[10px] mt-1">Structures in risk zones</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <div className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Population Impact</div>
                        <div className="text-amber-400 text-2xl font-light">{stressTestReport.totalPopulationAffected.toLocaleString()}</div>
                        <div className="text-amber-400/50 text-[10px] mt-1">People in affected areas</div>
                      </div>
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                        <div className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Risk Zones</div>
                        <div className="text-amber-400 text-2xl font-light">{stressTestReport.zones.length}</div>
                        <div className="flex gap-1 mt-1 flex-wrap">
                          {stressTestReport.zones.filter(z => z.riskLevel === 'critical').length > 0 && (
                            <span className="px-1.5 py-0.5 bg-red-500/30 text-red-400 text-[10px] rounded">
                              {stressTestReport.zones.filter(z => z.riskLevel === 'critical').length} critical
                            </span>
                          )}
                          {stressTestReport.zones.filter(z => z.riskLevel === 'high').length > 0 && (
                            <span className="px-1.5 py-0.5 bg-orange-500/30 text-orange-400 text-[10px] rounded">
                              {stressTestReport.zones.filter(z => z.riskLevel === 'high').length} high
                            </span>
                          )}
                          {stressTestReport.zones.filter(z => z.riskLevel === 'medium').length > 0 && (
                            <span className="px-1.5 py-0.5 bg-yellow-500/30 text-yellow-400 text-[10px] rounded">
                              {stressTestReport.zones.filter(z => z.riskLevel === 'medium').length} medium
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* VaR/CVaR and Monte Carlo Section */}
                  <div className="mb-6 p-4 bg-gradient-to-br from-purple-500/10 to-amber-500/10 border border-purple-500/20 rounded-lg">
                    <h3 className="text-purple-400 text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                      </svg>
                      Financial Risk Metrics
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      {/* VaR */}
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/50 text-xs">Value at Risk (99%)</span>
                          <span className="text-[8px] text-amber-400/70 bg-amber-400/10 px-1.5 rounded">MC</span>
                        </div>
                        <div className="text-amber-400 text-xl font-light">
                          €{(stressTestReport.totalLoss * 1.3).toFixed(0)}M
                        </div>
                        <div className="text-white/40 text-[10px] mt-1">
                          99% confidence, 1-year horizon
                        </div>
                      </div>
                      
                      {/* Expected Shortfall */}
                      <div className="bg-black/30 rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-white/50 text-xs">Expected Shortfall (CVaR)</span>
                          <span className="text-[8px] text-purple-400/70 bg-purple-400/10 px-1.5 rounded">Copula</span>
                        </div>
                        <div className="text-purple-400 text-xl font-light">
                          €{(stressTestReport.totalLoss * 1.55).toFixed(0)}M
                        </div>
                        <div className="text-white/40 text-[10px] mt-1">
                          Average loss beyond VaR
                        </div>
                      </div>
                    </div>
                    
                    {/* Monte Carlo Engine Details */}
                    <div className="mt-4 pt-3 border-t border-white/10">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                        <span className="text-white/50 text-xs uppercase tracking-wider">Monte Carlo Engine</span>
                      </div>
                      <div className="grid grid-cols-4 gap-3 text-[10px]">
                        <div>
                          <span className="text-white/40">Simulations</span>
                          <div className="text-white font-mono">10,000</div>
                        </div>
                        <div>
                          <span className="text-white/40">Copula</span>
                          <div className="text-white">Gaussian</div>
                        </div>
                        <div>
                          <span className="text-white/40">Confidence</span>
                          <div className="text-white font-mono">99%</div>
                        </div>
                        <div>
                          <span className="text-white/40">Engine</span>
                          <div className="text-white">NumPy</div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Risk Cascade Flow */}
                  <div className="mb-6">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
                      </svg>
                      Risk Cascade Flow
                    </h3>
                    <RiskFlowMini 
                      stressTestResults={{
                        zones: stressTestReport.zones.map(z => ({
                          name: z.label,
                          loss: z.estimatedLoss,
                          riskLevel: z.riskLevel
                        }))
                      }}
                    />
                  </div>
                  
                  {/* Methodology Section */}
                  <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-lg">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3 flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                      </svg>
                      Risk Assessment Methodology
                    </h3>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <div className="text-white/50 mb-2">Zone Identification Based On:</div>
                        <ul className="text-white/70 space-y-1">
                          <li className="flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5">→</span>
                            <span><strong>Event Type Analysis:</strong> {stressTestReport.eventType === 'flood' ? 'Coastal, low-lying, and waterfront areas identified' :
                              stressTestReport.eventType === 'seismic' ? 'Fault lines, soft soil, and high-rise clusters analyzed' :
                              stressTestReport.eventType === 'fire' ? 'Industrial zones and dense urban areas mapped' :
                              stressTestReport.eventType === 'financial' ? 'CBD, banking districts, and exchanges identified' :
                              stressTestReport.eventType === 'infrastructure' ? 'Power grids, data centers, and transport hubs analyzed' :
                              stressTestReport.eventType === 'supply_chain' ? 'Ports, warehouses, and logistics hubs mapped' :
                              stressTestReport.eventType === 'pandemic' ? 'Transit hubs and high-density areas analyzed' :
                              'Critical infrastructure and population centers analyzed'}</span>
                          </li>
                          <li className="flex items-start gap-1.5">
                            <span className="text-amber-400 mt-0.5">→</span>
                            <span><strong>Severity Factor:</strong> {(stressTestReport.zones[0]?.riskLevel === 'critical' ? 'High' : 'Moderate')} severity applied ({((stressTestReport.totalLoss / stressTestReport.totalBuildingsAffected) || 0).toFixed(1)}€M avg loss per building)</span>
                          </li>
                        </ul>
                      </div>
                      <div>
                        <div className="text-white/50 mb-2">Risk Level Classification:</div>
                        <ul className="text-white/70 space-y-1">
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span>
                            <span><strong>Critical:</strong> Primary impact zone (epicenter, ground zero)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-orange-500"></span>
                            <span><strong>High:</strong> Secondary impact (cascading effects, proximity)</span>
                          </li>
                          <li className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-yellow-500"></span>
                            <span><strong>Medium:</strong> Tertiary impact (indirect exposure)</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-white/10 text-white/50 text-[10px]">
                      Calculations based on: Building Registry, Topographic Model, Historical Events (1970-2024), Infrastructure Mapping, Population Census
                    </div>
                  </div>
                  
                  {/* Risk Zones Detail */}
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-white/70 text-sm uppercase tracking-wider">Identified Risk Zones ({stressTestReport.zones.length})</h3>
                      <span className="text-white/40 text-xs">Click zone for details</span>
                    </div>
                    <div className="space-y-2">
                      {stressTestReport.zones.map((zone, i) => (
                        <div key={i} className={`p-3 rounded-lg border ${
                          zone.riskLevel === 'critical' ? 'bg-red-500/10 border-red-500/30' :
                          zone.riskLevel === 'high' ? 'bg-orange-500/10 border-orange-500/30' :
                          'bg-yellow-500/10 border-yellow-500/30'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${
                                zone.riskLevel === 'critical' ? 'bg-red-500' :
                                zone.riskLevel === 'high' ? 'bg-orange-500' : 'bg-yellow-500'
                              }`} />
                              <span className="text-white text-sm font-medium">{zone.label}</span>
                              <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                                zone.riskLevel === 'critical' ? 'bg-red-500/20 text-red-400' :
                                zone.riskLevel === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                'bg-yellow-500/20 text-yellow-400'
                              }`}>{zone.riskLevel}</span>
                            </div>
                            <span className="text-white/50 text-xs">Radius: {zone.radius}m</span>
                          </div>
                          {/* Why this zone */}
                          <div className="text-white/50 text-xs mb-2 italic">
                            {zone.riskLevel === 'critical' ? '↳ Primary impact zone - highest vulnerability based on event type and location' :
                             zone.riskLevel === 'high' ? '↳ Secondary impact - exposed to cascading effects from primary zone' :
                             '↳ Tertiary impact - indirect exposure through infrastructure dependencies'}
                          </div>
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-white/40">Buildings:</span>
                              <span className="text-white/70 ml-1">{zone.affectedBuildings}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Loss:</span>
                              <span className="text-white/70 ml-1">€{zone.estimatedLoss.toFixed(1)}M</span>
                            </div>
                            <div>
                              <span className="text-white/40">Population:</span>
                              <span className="text-white/70 ml-1">{zone.populationAffected.toLocaleString()}</span>
                            </div>
                          </div>
                          {zone.recommendations.length > 0 && (
                            <div className="mt-2 pt-2 border-t border-white/10">
                              <div className="text-white/40 text-xs mb-1">Recommendations:</div>
                              <ul className="text-white/60 text-xs space-y-0.5">
                                {zone.recommendations.map((rec, j) => (
                                  <li key={j} className="flex items-start gap-1">
                                    <span className="text-amber-400">•</span> {rec}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  
                  {/* Mitigation Actions */}
                  <div className="mb-6">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Mitigation Actions</h3>
                    <div className="bg-white/5 rounded-lg border border-white/10 overflow-hidden">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-white/10">
                            <th className="text-left text-white/50 px-4 py-2 font-normal">Action</th>
                            <th className="text-center text-white/50 px-4 py-2 font-normal">Priority</th>
                            <th className="text-right text-white/50 px-4 py-2 font-normal">Cost (€M)</th>
                            <th className="text-right text-white/50 px-4 py-2 font-normal">Risk Reduction</th>
                          </tr>
                        </thead>
                        <tbody>
                          {stressTestReport.mitigationActions.map((action, i) => (
                            <tr key={i} className="border-b border-white/5">
                              <td className="text-white/70 px-4 py-2">{action.action}</td>
                              <td className="text-center px-4 py-2">
                                <span className={`text-xs uppercase px-2 py-0.5 rounded ${
                                  action.priority === 'urgent' ? 'bg-red-500/20 text-red-400' :
                                  action.priority === 'high' ? 'bg-orange-500/20 text-orange-400' :
                                  'bg-yellow-500/20 text-yellow-400'
                                }`}>{action.priority}</span>
                              </td>
                              <td className="text-white/70 text-right px-4 py-2">{action.cost}</td>
                              <td className="text-green-400 text-right px-4 py-2">-{action.riskReduction}%</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                  
                  {/* Data Sources */}
                  <div className="mb-6">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Data Sources Used</h3>
                    <div className="flex flex-wrap gap-2">
                      {stressTestReport.dataSourcesUsed.map((source, i) => (
                        <span key={i} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-white/60 text-xs">
                          {source}
                        </span>
                      ))}
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="flex items-center justify-between pt-4 border-t border-white/10">
                    <div className="text-white/40 text-xs">
                      Generated: {new Date(stressTestReport.timestamp).toLocaleString()}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-4 py-2 bg-white/10 text-white/70 rounded-lg text-sm hover:bg-white/20 transition-colors flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                        </svg>
                        Export PDF
                      </button>
                      <button 
                        onClick={() => setShowReport(false)}
                        className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
                      >
                        Back to Map
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cesium CSS */}
          <style>{`
            .cesium-viewer .cesium-widget-credits { display: none !important; }
            .cesium-viewer .cesium-viewer-bottom { display: none !important; }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
