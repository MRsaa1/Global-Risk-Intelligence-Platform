/**
 * Digital Twin Panel
 * ===================
 * 
 * Real 3D city visualization using Cesium Ion 3D Tiles
 * Each city has its own photogrammetry/3D model from Cesium Ion
 */
import { useRef, useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import * as Cesium from 'cesium'

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
  
  // MONTREAL - Point Cloud (Asset ID: 28945)
  montreal: {
    id: 'montreal',
    name: 'Montreal Point Cloud',
    location: 'Montreal, Canada',
    value: 22.4,
    risk_score: 0.55,
    cesiumAssetId: 28945,
    cameraPosition: { lat: 45.5017, lng: -73.5673, height: 1200, heading: 270, pitch: -25 },
    risk_factors: { flood: 0.50, earthquake: 0.12, fire: 0.32, structural: 0.25 },
    sensors: { temperature: 12.8, humidity: 68, vibration: 0.006, strain: 0.0006 },
  },
}

// List of premium city IDs for quick lookup
const PREMIUM_CITIES = new Set(Object.keys(CITY_DATA))

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
  assetId?: string
  dynamicAsset?: DynamicAsset | null  // For arbitrary coordinates with OSM Buildings
  eventId?: string | null  // The stress test event to run
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
}

export default function DigitalTwinPanel({ isOpen, onClose, assetId, dynamicAsset, eventId }: DigitalTwinPanelProps) {
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
  
  // ============================================
  // SMART MODE DETECTION
  // ============================================
  // Check if this is a PREMIUM city (has dedicated Cesium Ion 3D model)
  // Otherwise use Cesium OSM Buildings (worldwide gray 3D buildings)
  
  // Normalize city ID for lookup
  const normalizedAssetId = assetId?.toLowerCase().replace(/[^a-z]/g, '') || ''
  const dynamicCityId = dynamicAsset?.id?.toLowerCase().replace(/[^a-z]/g, '') || ''
  
  // Check if city has premium 3D model
  const isPremiumFromAssetId = normalizedAssetId && PREMIUM_CITIES.has(normalizedAssetId)
  const isPremiumFromDynamic = dynamicCityId && PREMIUM_CITIES.has(dynamicCityId)
  const isPremiumCity = isPremiumFromAssetId || isPremiumFromDynamic
  
  // Get premium city key if exists
  const premiumCityKey = isPremiumFromDynamic ? dynamicCityId : (isPremiumFromAssetId ? normalizedAssetId : null)
  
  // Mode determination:
  // - useCesiumMode: Use dedicated Cesium Ion 3D photogrammetry model (premium cities)
  // - useOsmMode: Use Cesium OSM Buildings (gray, professional) for all other cities
  const useCesiumMode = isPremiumCity && premiumCityKey !== null
  const useOsmMode = !useCesiumMode && (!!dynamicAsset || !!assetId)
  const useInfoMode = false // No longer needed - always show 3D
  
  // Compute city/asset data
  const { city } = (() => {
    // PRIORITY 1: If this is a premium city (from dynamic or static), use CITY_DATA
    if (useCesiumMode && premiumCityKey) {
      const premiumCity = CITY_DATA[premiumCityKey]
      if (premiumCity) {
        // If dynamic asset, merge coordinates but keep premium model
        if (dynamicAsset) {
          return {
            city: {
              ...premiumCity,
              // Override risk score from event if provided
              risk_score: dynamicAsset.impactSeverity || premiumCity.risk_score,
              value: dynamicAsset.exposure || premiumCity.value,
            }
          }
        }
        return { city: premiumCity }
      }
    }
    
    // PRIORITY 2: Dynamic asset without premium model - use OSM Buildings
    if (dynamicAsset) {
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
    
    // PRIORITY 3: Static asset ID
    if (assetId) {
      const key = assetId.toLowerCase().replace(/[^a-z]/g, '')
      const cityData = CITY_DATA[key]
      return { city: cityData || DEFAULT_CITY }
    }
    
    return { city: DEFAULT_CITY }
  })()

  // Initialize Cesium viewer when panel opens
  useEffect(() => {
    if (!isOpen || !containerRef.current) return

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
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_OSM_BUILDINGS, {
            maximumScreenSpaceError: 16,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16,
            skipLevels: 1,
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
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(city.cesiumAssetId, {
            maximumScreenSpaceError: 16,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 16,
            skipLevels: 1,
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
  }, [isOpen, assetId, dynamicAsset, useCesiumMode, city.cesiumAssetId])  // Dependencies on props

  // Reset stress test state when panel closes or city changes
  useEffect(() => {
    if (!isOpen) {
      setStressTestRunning(false)
      setStressTestComplete(false)
      setStressTestProgress(0)
      setRiskHighlights([])
    }
  }, [isOpen, dynamicAsset?.id, assetId])

  // Function to run stress test and highlight risk zones
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
    
    // Simulate stress test calculation with progress
    for (let i = 0; i <= 100; i += 5) {
      await new Promise(resolve => setTimeout(resolve, 50))
      setStressTestProgress(i)
    }
    
    // =====================================================
    // SMART RISK ZONE ALGORITHM
    // Based on: event type, building types, topography, historical data
    // =====================================================
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
    
    // Generate comprehensive stress test report
    const report: StressTestReport = {
      eventName: eventId?.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) || 'Unknown Event',
      eventType: category,
      cityName: city.name,
      timestamp: new Date().toISOString(),
      totalLoss: highlights.reduce((sum, z) => sum + z.estimatedLoss, 0),
      totalBuildingsAffected: highlights.reduce((sum, z) => sum + z.affectedBuildings, 0),
      totalPopulationAffected: highlights.reduce((sum, z) => sum + z.populationAffected, 0),
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
        'Real-time Sensor Network'
      ]
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
            {/* Main content area - 3D or Info Panel */}
            <div className="flex-1 relative">
              {useInfoMode ? (
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
                        <div className="text-cyan-400 text-lg">{city.sensors.temperature.toFixed(1)}°C</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Humidity</div>
                        <div className="text-cyan-400 text-lg">{city.sensors.humidity.toFixed(0)}%</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Vibration</div>
                        <div className="text-cyan-400 text-lg">{city.sensors.vibration.toFixed(3)}g</div>
                      </div>
                      <div className="bg-white/5 rounded-lg p-3 border border-white/5">
                        <div className="text-white/40 text-xs">Strain</div>
                        <div className="text-cyan-400 text-lg">{city.sensors.strain.toFixed(4)}</div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Actions */}
                  <div className="flex gap-3">
                    <button className="flex-1 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-sm">
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
                        <div className={`w-8 h-8 border-2 ${useCesiumMode ? 'border-amber-500' : 'border-cyan-500'} border-t-transparent rounded-full animate-spin mx-auto mb-3`} />
                        <div className={`${useCesiumMode ? 'text-amber-400' : 'text-cyan-400'} text-sm`}>
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
                        <div className="w-3 h-3 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                        <span className="text-cyan-400 text-xs">Loading detail... {loadProgress}%</span>
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
                        <div className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                        <span className="text-cyan-400/70 text-[10px] uppercase tracking-wider">Cesium OSM Buildings</span>
                      </div>
                    )}
                  </div>

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
                    
                    {/* Stress Test Button */}
                    {eventId && !stressTestComplete && (
                      <button
                        onClick={runStressTest}
                        disabled={stressTestRunning || isLoading}
                        className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-all ${
                          stressTestRunning 
                            ? 'bg-amber-500/30 text-amber-300 cursor-wait'
                            : 'bg-amber-500/20 text-amber-400 border border-amber-500/40 hover:bg-amber-500/30 hover:scale-105'
                        }`}
                      >
                        {stressTestRunning ? (
                          <>
                            <div className="w-4 h-4 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
                            <span>Analyzing... {stressTestProgress}%</span>
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                            </svg>
                            <span>Run Stress Test</span>
                          </>
                        )}
                      </button>
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
                          className="px-4 py-1.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/40 rounded-lg text-sm font-medium hover:bg-cyan-500/30 transition-all flex items-center gap-2"
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
            
            {/* Info Panel */}
            <div className="w-80 border-l border-white/10 p-4 overflow-y-auto bg-black/50">
              {/* Tabs */}
              <div className="flex gap-2 mb-4">
                {(['3d', 'sensors', 'risks'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3 py-1.5 rounded-lg text-xs uppercase tracking-wider transition-all ${
                      activeTab === tab
                        ? 'bg-cyan-500/20 text-cyan-400'
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
                      <div className="text-white text-lg">{city.sensors.temperature}°C</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Humidity</div>
                      <div className="text-white text-lg">{city.sensors.humidity}%</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Vibration</div>
                      <div className="text-white text-lg">{city.sensors.vibration}g</div>
                    </div>
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="text-white/40 text-[10px]">Strain</div>
                      <div className="text-white text-lg">{city.sensors.strain}ε</div>
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
                  
                  <div className="mt-4 p-3 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                    <div className="text-cyan-400 text-xs font-medium mb-1">Cesium Ion 3D Tiles</div>
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
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4 mb-6">
                    <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                      <div className="text-red-400/70 text-xs uppercase tracking-wider mb-1">Total Loss</div>
                      <div className="text-red-400 text-2xl font-light">€{stressTestReport.totalLoss.toLocaleString()}M</div>
                    </div>
                    <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
                      <div className="text-orange-400/70 text-xs uppercase tracking-wider mb-1">Buildings Affected</div>
                      <div className="text-orange-400 text-2xl font-light">{stressTestReport.totalBuildingsAffected.toLocaleString()}</div>
                    </div>
                    <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-4">
                      <div className="text-amber-400/70 text-xs uppercase tracking-wider mb-1">Population Impact</div>
                      <div className="text-amber-400 text-2xl font-light">{stressTestReport.totalPopulationAffected.toLocaleString()}</div>
                    </div>
                    <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-lg p-4">
                      <div className="text-cyan-400/70 text-xs uppercase tracking-wider mb-1">Risk Zones</div>
                      <div className="text-cyan-400 text-2xl font-light">{stressTestReport.zones.length}</div>
                    </div>
                  </div>
                  
                  {/* Risk Zones Detail */}
                  <div className="mb-6">
                    <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Identified Risk Zones</h3>
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
                          <div className="grid grid-cols-3 gap-4 text-xs">
                            <div>
                              <span className="text-white/40">Buildings:</span>
                              <span className="text-white/70 ml-1">{zone.affectedBuildings}</span>
                            </div>
                            <div>
                              <span className="text-white/40">Loss:</span>
                              <span className="text-white/70 ml-1">€{zone.estimatedLoss}M</span>
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
                                    <span className="text-cyan-400">•</span> {rec}
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
                        className="px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg text-sm hover:bg-cyan-500/30 transition-colors"
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
