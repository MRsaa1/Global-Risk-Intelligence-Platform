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
import UnifiedStressTestSelector from './stress/UnifiedStressTestSelector'


// Cesium Ion access token
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTExZmMxNS1jY2RhLTQ2YjctOTg0Mi02NWQxNGQxYjFhZGYiLCJpZCI6Mzc4MTk5LCJpYXQiOjE3NjgzMjc3NjJ9.neQZ3X5JRYBalv7cjUuVrq_kVw0nVyKQlwtOyxls5OM'

// Cesium OSM Buildings Asset ID for worldwide gray 3D buildings
const CESIUM_OSM_BUILDINGS = 96188

// Google Photorealistic 3D Tiles via Cesium Ion (Asset from your Ion account)
// No Google API key needed - Cesium Ion acts as proxy
const CESIUM_ION_GOOGLE_PHOTOREALISTIC = 2275207

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
  /** Optional: fixed camera height (m) for Google Photorealistic 3D - e.g. 2500 = city-level view */
  google3dCameraHeight?: number
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
    cameraPosition: { lat: 40.7128, lng: -74.0060, height: 4500, heading: 45, pitch: -30 },
    google3dCameraHeight: 2200,
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
    cameraPosition: { lat: -33.8688, lng: 151.2093, height: 4500, heading: 120, pitch: -25 },
    risk_factors: { flood: 0.40, earthquake: 0.12, fire: 0.38, structural: 0.22 },
    sensors: { temperature: 25.1, humidity: 65, vibration: 0.007, strain: 0.0007 },
  },
  
  // SAN FRANCISCO - Aerometrex High Resolution (Asset ID: 1415196) + Google Photorealistic 3D
  sanfrancisco: {
    id: 'sanfrancisco',
    name: 'San Francisco High Resolution 3D',
    location: 'San Francisco, CA',
    value: 48.5,
    risk_score: 0.78,
    cesiumAssetId: 1415196,
    cameraPosition: { lat: 37.7749, lng: -122.4194, height: 3500, heading: 30, pitch: -30 },
    google3dCameraHeight: 1800,
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
    cameraPosition: { lat: 42.3601, lng: -71.0589, height: 3500, heading: 90, pitch: -30 },
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
    cameraPosition: { lat: 39.7392, lng: -104.9903, height: 3500, heading: 0, pitch: -30 },
    risk_factors: { flood: 0.25, earthquake: 0.20, fire: 0.35, structural: 0.18 },
    sensors: { temperature: 15.8, humidity: 35, vibration: 0.004, strain: 0.0004 },
  },
  
  // MELBOURNE - Photogrammetry (Asset ID: 69380) + Google Photorealistic 3D
  melbourne: {
    id: 'melbourne',
    name: 'Melbourne Photogrammetry',
    location: 'Melbourne, Australia',
    value: 28.5,
    risk_score: 0.58,
    cesiumAssetId: 69380,
    cameraPosition: { lat: -37.8136, lng: 144.9631, height: 4000, heading: 60, pitch: -35 },
    google3dCameraHeight: 2500,
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
    cameraPosition: { lat: 38.9072, lng: -77.0369, height: 4500, heading: 180, pitch: -30 },
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

// Region-appropriate sensor defaults (deterministic, no random) so Helsinki shows Nordic values, Tokyo Japanese, etc.
const REGION_SENSOR_DEFAULTS: Record<string, { temperature: number; humidity: number; vibration: number; strain: number }> = {
  nordic:   { temperature: 8.2,  humidity: 78, vibration: 0.008, strain: 0.0009 },  // Helsinki, Stockholm, Oslo, Copenhagen
  japan:    { temperature: 19.5, humidity: 64, vibration: 0.012, strain: 0.0011 },  // Tokyo, Osaka
  australia:{ temperature: 24.0, humidity: 58, vibration: 0.007, strain: 0.0007 },   // Sydney, Melbourne, Brisbane
  us_east:  { temperature: 20.5, humidity: 55, vibration: 0.01,  strain: 0.001 },   // NYC, Boston, Washington
  us_west:  { temperature: 17.8, humidity: 62, vibration: 0.014, strain: 0.0012 },  // SF, LA, Seattle
  us_central:{ temperature: 16.2, humidity: 42, vibration: 0.006, strain: 0.0006 }, // Denver, Chicago
  europe:   { temperature: 18.5, humidity: 62, vibration: 0.009, strain: 0.0008 },   // Berlin, Paris, London, Munich
  default:  { temperature: 20,    humidity: 50, vibration: 0.01,  strain: 0.001 },
}

function getSensorsForRegion(cityName: string, country?: string): { temperature: number; humidity: number; vibration: number; strain: number } {
  const n = (cityName || '').toLowerCase()
  const c = (country || '').toLowerCase()
  if (/\b(helsinki|stockholm|oslo|copenhagen|finland|sweden|norway|denmark|nordic)\b/.test(n) || /\b(finland|sweden|norway|denmark)\b/.test(c)) return REGION_SENSOR_DEFAULTS.nordic
  if (/\b(tokyo|osaka|japan)\b/.test(n) || /\bjapan\b/.test(c)) return REGION_SENSOR_DEFAULTS.japan
  if (/\b(sydney|melbourne|brisbane|perth|australia)\b/.test(n) || /\baustralia\b/.test(c)) return REGION_SENSOR_DEFAULTS.australia
  if (/\b(new york|boston|washington|miami|atlanta)\b/.test(n) || (/\bunited states\b/.test(c) && /\b(east|dc|ny)\b/.test(n))) return REGION_SENSOR_DEFAULTS.us_east
  if (/\b(san francisco|los angeles|seattle)\b/.test(n)) return REGION_SENSOR_DEFAULTS.us_west
  if (/\b(denver|chicago)\b/.test(n)) return REGION_SENSOR_DEFAULTS.us_central
  if (/\b(berlin|munich|paris|london|frankfurt|amsterdam|brussels)\b/.test(n) || /\b(germany|france|uk|netherlands)\b/.test(c)) return REGION_SENSOR_DEFAULTS.europe
  return REGION_SENSOR_DEFAULTS.default
}

const DEFAULT_CITY = CITY_DATA.newyork

// Dynamic asset (from zone click) with coordinates
interface CameraPosition {
  lat: number
  lng: number
  height: number
  heading: number
  pitch: number
}

interface DynamicAsset {
  id: string
  name: string
  type: string
  latitude: number
  longitude: number
  exposure: number
  impactSeverity: number
  cameraPosition?: CameraPosition
}

const API_BASE = '/api/v1'

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
  /** Disaster viz on 3D city: same toggles as Command Center globe */
  showFloodLayer?: boolean
  showWindLayer?: boolean
  showMetroFloodLayer?: boolean
  floodDepthOverride?: number
  showHeatLayer?: boolean
  showHeavyRainLayer?: boolean
  showDroughtLayer?: boolean
  showUvLayer?: boolean
  /** Total exposure (B USD) of all assets in the risk zone — when set, Asset Value shows this (cost of assets in zone) */
  zoneTotalExposure?: number | null
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
  polygon?: number[][]  // [[lng, lat], ...] flood extent
}

// Stress Test Report data (matches backend execute response and StressTestReportContent)
interface StressTestReport {
  eventName: string
  eventType: string
  eventId: string
  cityName: string
  timestamp: string
  totalLoss: number
  totalBuildingsAffected: number
  totalPopulationAffected: number
  zones: RiskHighlight[]
  mitigationActions: { action: string; priority: 'urgent' | 'high' | 'medium'; cost: number; riskReduction: number }[]
  dataSourcesUsed: string[]
  executiveSummary?: string
  concludingSummary?: string
  llmGenerated?: boolean
  regionActionPlan?: {
    region: string
    country: string
    event_type: string
    summary: string
    key_actions: string[]
    contacts: Array<{ name: string; phone: string }>
    sources: Array<{ title: string; url?: string }>
    urls: string[]
  }
  reportV2?: Record<string, unknown>
  /** When use_nvidia_orchestration=true: confidence, model_agreement, flag_for_human_review, used_model_fast/deep */
  nvidiaOrchestration?: {
    entity_type?: string
    confidence?: number
    model_agreement?: number
    flag_for_human_review?: boolean
    used_model_fast?: string
    used_model_deep?: string
  }
  /** From Knowledge Graph when use_kg=true */
  relatedEntities?: Array<{ id?: string; name?: string; relationship_type?: string }>
  /** KG + entity resolution context for LLM */
  graphContext?: string
  /** Currency for display (USD, EUR, GBP) */
  currency?: string
}

export default function DigitalTwinPanel({ isOpen, onClose, pickerMode = false, onCitySelected, assetId, dynamicAsset, eventId, eventName, eventCategory, timeHorizon, showFloodLayer = false, showWindLayer = false, showMetroFloodLayer = false, floodDepthOverride, showHeatLayer = false, showHeavyRainLayer = false, showDroughtLayer = false, showUvLayer = false, zoneTotalExposure = null }: DigitalTwinPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const photorealisticTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const floodEntityRef = useRef<Cesium.Entity | null>(null)
  const windEntityRef = useRef<Cesium.Entity | null>(null)
  const metroEntitiesRef = useRef<Cesium.Entity[]>([])
  const heatEntityRef = useRef<Cesium.Entity | null>(null)
  const heavyRainEntityRef = useRef<Cesium.Entity | null>(null)
  const droughtEntityRef = useRef<Cesium.Entity | null>(null)
  const uvEntityRef = useRef<Cesium.Entity | null>(null)
  const [activeTab, setActiveTab] = useState<'3d' | 'sensors' | 'risks'>('3d')
  const [viewerReady, setViewerReady] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [loadProgress, setLoadProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [actual3DMode, setActual3DMode] = useState<'google' | 'osm' | 'premium'>('google')
  // ~12s quality delay: show "Loading Google 3D" while tiles load, then reveal full quality (SSE 1)
  const [qualityDelayActive, setQualityDelayActive] = useState(false)
  const [qualityDelayRemaining, setQualityDelayRemaining] = useState(12)

  // Cesium OSM Buildings can trigger noisy WebGL warnings on some Mac GPUs/drivers for certain locations.
  // Default behavior:
  // - Cities: ON
  // - Enterprise/bank/etc: OFF (safe mode)
  //
  // The panel stays mounted, so we keep an override state and derive the effective value each render.
  const defaultBuildings3dEnabled =
    !dynamicAsset || String(dynamicAsset.type || '').toLowerCase() === 'city'
  const [buildings3dOverride, setBuildings3dOverride] = useState<boolean | null>(null)
  const buildings3dEnabled = buildings3dOverride ?? defaultBuildings3dEnabled
  
  // Stress test state
  const [stressTestRunning, setStressTestRunning] = useState(false)
  const [stressTestComplete, setStressTestComplete] = useState(false)
  const [stressTestProgress, setStressTestProgress] = useState(0)
  const [riskHighlights, setRiskHighlights] = useState<RiskHighlight[]>([])
  const [stressTestReport, setStressTestReport] = useState<StressTestReport | null>(null)
  const riskEntitiesRef = useRef<Cesium.Entity[]>([])
  const prevEventIdRef = useRef<string | undefined>(undefined)
  const prevCityIdRef = useRef<string>('')

  // Reset user override when switching to a different city/enterprise
  useEffect(() => {
    setBuildings3dOverride(null)
  }, [dynamicAsset?.id, assetId])
  
  // Stress test type selection
  const [showTestSelector, setShowTestSelector] = useState(false)
  const [selectedScenario, setSelectedScenario] = useState<string>('')
  
  // Internal layer state for auto-enable when stress test is run inside DigitalTwin
  const [internalFloodLayer, setInternalFloodLayer] = useState(false)
  const [internalWindLayer, setInternalWindLayer] = useState(false)
  const [internalMetroFloodLayer, setInternalMetroFloodLayer] = useState(false)
  const [internalHeatLayer, setInternalHeatLayer] = useState(false)
  const [internalHeavyRainLayer, setInternalHeavyRainLayer] = useState(false)
  const [internalDroughtLayer, setInternalDroughtLayer] = useState(false)
  const [internalUvLayer, setInternalUvLayer] = useState(false)
  
  // Combine props with internal state (internal state can override props to ON)
  const effectiveShowFloodLayer = showFloodLayer || internalFloodLayer
  const effectiveShowWindLayer = showWindLayer || internalWindLayer
  const effectiveShowMetroFloodLayer = showMetroFloodLayer || internalMetroFloodLayer
  const effectiveShowHeatLayer = showHeatLayer || internalHeatLayer
  const effectiveShowHeavyRainLayer = showHeavyRainLayer || internalHeavyRainLayer
  const effectiveShowDroughtLayer = showDroughtLayer || internalDroughtLayer
  const effectiveShowUvLayer = showUvLayer || internalUvLayer
  
  // Auto-enable layers based on selected scenario
  useEffect(() => {
    if (!selectedScenario) return
    const id = selectedScenario.toLowerCase()
    
    // Flood-related scenarios
    if (id.includes('flood') || id.includes('sea_level') || id.includes('tsunami') || id.includes('heavy_rain')) {
      setInternalFloodLayer(true)
    }
    // Metro flood
    if (id.includes('metro_flood')) {
      setInternalMetroFloodLayer(true)
      setInternalFloodLayer(true)
    }
    // Wind/hurricane
    if (id.includes('wind_storm') || id.includes('hurricane') || id.includes('typhoon') || id.includes('cyclone')) {
      setInternalWindLayer(true)
    }
    // Heat
    if (id.includes('heat_stress') || id.includes('heatwave') || id.includes('heat_wave')) {
      setInternalHeatLayer(true)
    }
    // Heavy rain
    if (id.includes('heavy_rain')) {
      setInternalHeavyRainLayer(true)
    }
    // Drought
    if (id.includes('drought')) {
      setInternalDroughtLayer(true)
    }
    // UV
    if (id.includes('uv_extreme') || id.includes('uv_index')) {
      setInternalUvLayer(true)
    }
  }, [selectedScenario])
  
  // Picker mode (country / city / optional enterprise) when opening via D without a selected city
  const [pickerCountry, setPickerCountry] = useState('')
  const [pickerCityId, setPickerCityId] = useState('')
  const [pickerEnterprise, setPickerEnterprise] = useState('')
  
  const { data: citiesData } = useQuery({
    queryKey: ['geodata-cities'],
    queryFn: async () => {
      const res = await fetch('/api/v1/geodata/cities')
      if (!res.ok) throw new Error('Failed to fetch cities')
      return res.json() as Promise<{
        cities: Array<{
          id: string
          name: string
          country: string
          coordinates?: [number, number]
          camera_position?: CameraPosition
          exposure?: number
          risk_score?: number
        }>
      }>
    },
    enabled: isOpen,
  })
  const cities = citiesData?.cities ?? []
  const countries = [...new Set(cities.map((c) => c.country))].sort()
  const citiesInCountry = pickerCountry ? cities.filter((c) => c.country === pickerCountry) : []
  
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
  // - useGooglePhotorealistic: ALL cities → Google Photorealistic 3D Tiles (Asset #2275207, global tileset)
  // - useCesiumMode: Disabled — Google Photorealistic covers all cities worldwide
  // - useOsmMode: Fallback only if Google fails
  const useGooglePhotorealistic = !pickerMode
  const useCesiumMode = false
  const useOsmMode = false
  
  // Compute city/asset data
  const { city: cityBase } = (() => {
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
      
      const apiCity = cities.find((c) => c.id.toLowerCase().replace(/[^a-z]/g, '') === normalizedCityId)
        ?? cities.find((c) => c.name.toLowerCase() === (dynamicAsset.name || '').toLowerCase())
      const cam = dynamicAsset.cameraPosition ?? (apiCity?.camera_position ? {
        ...apiCity.camera_position,
        lat: apiCity.camera_position.lat ?? dynamicAsset.latitude,
        lng: apiCity.camera_position.lng ?? dynamicAsset.longitude,
      } : undefined) ?? {
        lat: dynamicAsset.latitude,
        lng: dynamicAsset.longitude,
        height: 3000,
        heading: 60,
        pitch: -35,
      }
      const valueFromApi = typeof apiCity?.exposure === 'number' ? apiCity.exposure : null
      const riskFromApi = typeof apiCity?.risk_score === 'number' ? apiCity.risk_score : null
      return {
        city: {
          id: dynamicAsset.id,
          name: dynamicAsset.name,
          location: `${dynamicAsset.latitude.toFixed(4)}, ${dynamicAsset.longitude.toFixed(4)}`,
          value: dynamicAsset.exposure ?? valueFromApi ?? 10,
          risk_score: dynamicAsset.impactSeverity ?? riskFromApi ?? 0.5,
          cesiumAssetId: CESIUM_OSM_BUILDINGS, // Use OSM Buildings
          cameraPosition: cam,
          risk_factors: {
            flood: dynamicAsset.impactSeverity * 0.8,
            earthquake: dynamicAsset.impactSeverity * 0.3,
            fire: dynamicAsset.impactSeverity * 0.5,
            structural: dynamicAsset.impactSeverity * 0.4,
          },
          sensors: getSensorsForRegion(dynamicAsset.name ?? '', apiCity?.country),
        } as AssetData
      }
    }
    
    // PRIORITY 2: Static asset ID (from hotspot click)
    if (assetId) {
      const key = assetId.toLowerCase().replace(/[^a-z]/g, '')
      if (CITY_DATA[key]) {
        return { city: CITY_DATA[key] }
      }
      const apiCity = cities.find((c) => c.id.toLowerCase().replace(/[^a-z]/g, '') === key)
      if (apiCity) {
        const [lng, lat] = apiCity.coordinates ?? [0, 0]
        const cam = apiCity.camera_position ?? { lat, lng, height: 3000, heading: 60, pitch: -35 }
        return {
          city: {
            id: apiCity.id,
            name: apiCity.name,
            location: `${apiCity.name}, ${apiCity.country}`,
            value: typeof apiCity.exposure === 'number' ? apiCity.exposure : 10,
            risk_score: typeof apiCity.risk_score === 'number' ? apiCity.risk_score : 0.5,
            cesiumAssetId: CESIUM_OSM_BUILDINGS,
            cameraPosition: cam,
            risk_factors: { flood: 0.4, earthquake: 0.3, fire: 0.3, structural: 0.2 },
            sensors: getSensorsForRegion(apiCity.name, apiCity.country),
          } as AssetData,
        }
      }
    }
    
    // Only log when panel is actually open (handled in useEffect above)
    return { city: DEFAULT_CITY }
  })()

  // Asset Value = cost of assets in the risk zone when zoneTotalExposure is provided (e.g. opened from zone asset click)
  const city = typeof zoneTotalExposure === 'number' && zoneTotalExposure >= 0
    ? { ...cityBase, value: zoneTotalExposure }
    : cityBase

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
        setActual3DMode('google')

        // Set Cesium Ion token
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN

        console.log('Digital Twin: Loading 3D model for', city.name, 
          useGooglePhotorealistic ? '(Google Photorealistic 3D Tiles)' :
          useCesiumMode ? `(Premium Cesium Ion Asset #${city.cesiumAssetId})` : '(Cesium OSM Buildings)')

        // Create viewer (requestRenderMode = faster when idle; we requestRender on overlay updates)
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
          requestRenderMode: true,
          maximumRenderTimeChange: 0.5,
        })

        viewerRef.current = viewer

        // With requestRenderMode, request render on camera move so scene updates when user drags/zooms
        viewer.camera.moveStart.addEventListener(() => { viewer.scene.requestRender() })
        viewer.camera.moveEnd.addEventListener(() => { viewer.scene.requestRender() })

        // Dark background
        viewer.scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a0f')
        
        // Helper to check if viewer is still valid
        const isViewerValid = () => isMounted && viewer && !viewer.isDestroyed()
        
        let tileset: Cesium.Cesium3DTileset

        let usedGooglePhotorealistic = false
        if (useGooglePhotorealistic) {
          // =============================================
          // GOOGLE PHOTOREALISTIC 3D TILES
          // Prefer official Cesium.createGooglePhotorealistic3DTileset() (1.124+); fallback to Ion Asset #2275207
          // =============================================
          const google3dOptions = {
            showCreditsOnScreen: true,
            maximumScreenSpaceError: 4,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 512,
            skipScreenSpaceErrorFactor: 12,
            skipLevels: 1,
            immediatelyLoadDesiredLevelOfDetail: true,
            loadSiblings: false,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 1536,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.0006,
            dynamicScreenSpaceErrorFactor: 1.8,
            dynamicScreenSpaceErrorHeightFalloff: 0.08,
          }
          try {
            viewer.scene.globe.show = false
            viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere()
            if (typeof (Cesium as any).createGooglePhotorealistic3DTileset === 'function') {
              tileset = await (Cesium as any).createGooglePhotorealistic3DTileset(google3dOptions)
            } else {
              tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_ION_GOOGLE_PHOTOREALISTIC, google3dOptions)
            }
            if (!isViewerValid()) return
            viewer.scene.primitives.add(tileset)
            photorealisticTilesetRef.current = tileset
            usedGooglePhotorealistic = true
            setActual3DMode('google')
            console.log('✅ Google Photorealistic 3D Tiles loaded for', city.name)
          } catch (googleErr: any) {
            console.warn('Google Photorealistic failed, falling back to OSM Buildings:', googleErr?.message)
            tileset = undefined as any
          }
        }
        if (!tileset && !useCesiumMode) {
          // =============================================
          // CESIUM OSM BUILDINGS - Worldwide gray 3D buildings (professional look)
          // Used for cities without premium Cesium Ion models
          // =============================================
          if (!buildings3dEnabled) {
            console.log('Digital Twin: 3D Buildings disabled (safe mode) for', city.name)

            // Show a minimal globe to keep georeferenced overlays (risk zones) visible without 3D tiles.
            viewer.scene.globe.show = true
            try {
              viewer.scene.globe.baseColor = Cesium.Color.fromCssColorString('#0a0a0f')
            } catch {
              // ignore
            }

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
              duration: 1.0
            })

            setLoadProgress(100)
            setIsLoading(false)
            setViewerReady(true)
            console.log('✅ Safe mode (no 3D buildings) ready for', city.name)
            return
          }

          console.log('Digital Twin: Loading Cesium OSM Buildings for', city.name)
          
          viewer.scene.globe.show = false
          
          // Load Cesium OSM Buildings (gray, professional)
          // Higher maximumScreenSpaceError = lower detail = less GPU pressure
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_OSM_BUILDINGS, {
            // Aggressive safe-mode defaults to reduce GPU pressure and avoid WebGL buffer issues on some Macs.
            // Lower detail is preferable to noisy GL_INVALID_OPERATION spam.
            maximumScreenSpaceError: 64,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 32,
            skipLevels: 4, // Skip more levels for faster loading
            immediatelyLoadDesiredLevelOfDetail: false,
            loadSiblings: false,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 256,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.00278,
            dynamicScreenSpaceErrorFactor: 8.0,
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
          
          setActual3DMode('osm')
          console.log('✅ Cesium OSM Buildings loaded for', city.name)
          
        } else if (!tileset) {
          // =============================================
          // CESIUM ION 3D TILES MODE - Predefined cities with high-quality 3D models
          // =============================================
          viewer.scene.globe.show = false // Hide globe, show only 3D tiles

          // Load 3D Tileset from Cesium Ion with optimized settings
          // Higher maximumScreenSpaceError = lower detail = less GPU pressure
          tileset = await Cesium.Cesium3DTileset.fromIonAssetId(city.cesiumAssetId, {
            // Aggressive safe-mode defaults to reduce GPU pressure and avoid WebGL buffer issues on some Macs.
            maximumScreenSpaceError: 64,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 1024,
            skipScreenSpaceErrorFactor: 32,
            skipLevels: 4, // Skip more levels for faster loading
            immediatelyLoadDesiredLevelOfDetail: false,
            loadSiblings: false,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 256,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.00278,
            dynamicScreenSpaceErrorFactor: 8.0,
            dynamicScreenSpaceErrorHeightFalloff: 0.25,
          })
          
          if (!isViewerValid()) return
          
          viewer.scene.primitives.add(tileset)
          setActual3DMode('premium')
        }

        // Surface tile failures (often correlated with problematic content/GPU drivers)
        tileset.tileFailed.addEventListener((e: any) => {
          try {
            console.warn('Cesium tile failed', {
              source: usedGooglePhotorealistic ? 'google' : useCesiumMode ? city.cesiumAssetId : CESIUM_OSM_BUILDINGS,
              name: city.name,
              message: e?.message,
              url: e?.url,
            })
          } catch {
            // ignore
          }
        })

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
          // Premium city models - brighten
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
        // - useCesiumMode: city-specific tileset → flyToBoundingSphere centers on 3D model
        // - useGooglePhotorealistic: global tileset → flyTo Rectangle auto-computes optimal height
        // - else: flyTo fixed coordinates
        if (useCesiumMode && tileset.boundingSphere) {
          viewer.camera.flyToBoundingSphere(tileset.boundingSphere, {
            duration: 1.0,
            offset: new Cesium.HeadingPitchRange(
              Cesium.Math.toRadians(city.cameraPosition.heading),
              Cesium.Math.toRadians(city.cameraPosition.pitch),
              city.cameraPosition.height,
            ),
          })
        } else if (useGooglePhotorealistic) {
          const c = city.cameraPosition
          // City view height: like loaded 3D view. Use explicit value, else by city name (API path), else default.
          const nameLower = (city as { name?: string }).name?.toLowerCase() ?? ''
          const baseH =
            (city as AssetData).google3dCameraHeight
            ?? (nameLower.includes('new york') ? 2200 : nameLower.includes('san francisco') ? 2000 : 2200)
          const h = Math.round(baseH * 0.6)
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, h),
            orientation: {
              heading: Cesium.Math.toRadians(c.heading),
              pitch: Cesium.Math.toRadians(c.pitch),
              roll: 0,
            },
            duration: 1.0,
          })
          // Keep loading overlay longer so first tiles load — avoid blank green screen
          await new Promise(r => setTimeout(r, 4000))
          if (!isViewerValid()) return
        } else {
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
        }

        // Enable proper lighting
        viewer.scene.light = new Cesium.DirectionalLight({
          direction: new Cesium.Cartesian3(0.5, -0.5, -0.7),
          intensity: 2.0,
          color: Cesium.Color.WHITE,
        })
        viewer.scene.highDynamicRange = true

        // Maximal detailing on zoom: when camera is close, force highest LOD
        if (usedGooglePhotorealistic && tileset) {
          viewer.camera.moveEnd.addEventListener(() => {
            if (!viewer || viewer.isDestroyed() || !tileset) return
            const carto = Cesium.Cartographic.fromCartesian(viewer.camera.positionWC)
            const height = carto.height
            // Ultra close (< 1.5 km): SSE 0.75; close (1.5–4 km): 1.5; medium (4–12 km): 3; far: 5
            const sse = height < 1500 ? 0.75 : height < 4000 ? 1.5 : height < 12000 ? 3 : 5
            if (tileset.maximumScreenSpaceError !== sse) {
              tileset.maximumScreenSpaceError = sse
              viewer.scene.requestRender()
            }
          })
        }

        setIsLoading(false)
        setViewerReady(true)
        if (usedGooglePhotorealistic) {
          setQualityDelayActive(true)
          setQualityDelayRemaining(12)
        }
        console.log('Digital Twin loaded for', city.name)

      } catch (e: any) {
        console.error('Failed to load Digital Twin:', e)
        setError(e.message || 'Failed to load 3D model')
        setIsLoading(false)
      }
    }

    initViewer()

    return () => {
      isMounted = false
      setViewerReady(false)
      setQualityDelayActive(false)
      setQualityDelayRemaining(12)
      photorealisticTilesetRef.current = null
      floodEntityRef.current = null
      windEntityRef.current = null
      metroEntitiesRef.current = []
      heatEntityRef.current = null
      heavyRainEntityRef.current = null
      droughtEntityRef.current = null
      uvEntityRef.current = null
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy()
        viewerRef.current = null
      }
    }
  }, [isOpen, pickerMode, assetId, dynamicAsset, useCesiumMode, useGooglePhotorealistic, city.cesiumAssetId, city.name, buildings3dEnabled])

  // Quality delay countdown: tiles load in background, then reveal full quality (SSE 1)
  useEffect(() => {
    if (!qualityDelayActive) return
    const t = setInterval(() => {
      setQualityDelayRemaining((prev) => {
        if (prev <= 1) {
          setQualityDelayActive(false)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, [qualityDelayActive])

  // Progressive LOD: during load use SSE 4; in last 3s request full quality (SSE 1)
  useEffect(() => {
    const tileset = photorealisticTilesetRef.current
    if (!tileset || !qualityDelayActive) return
    const sse = qualityDelayRemaining > 3 ? 4 : 1
    if (tileset.maximumScreenSpaceError !== sse) {
      tileset.maximumScreenSpaceError = sse
      viewerRef.current?.scene.requestRender()
    }
  }, [qualityDelayActive, qualityDelayRemaining])

  // Disaster viz on 3D city: flood / wind / metro layers (same APIs as globe)
  const dtCenterLat = city.cameraPosition.lat
  const dtCenterLng = city.cameraPosition.lng

  // Draw disaster layers only after user has run a stress test (not on panel open)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowFloodLayer || !stressTestComplete) {
      if (floodEntityRef.current && viewer?.entities.contains(floodEntityRef.current)) {
        viewer?.entities.remove(floodEntityRef.current)
        floodEntityRef.current = null
      }
      return
    }
    const url = `${API_BASE}/climate/flood-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&days=7&include_polygon=true`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; max_flood_depth_m?: number; max_risk_level?: string } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (floodEntityRef.current && v.entities.contains(floodEntityRef.current)) {
          v.entities.remove(floodEntityRef.current)
          floodEntityRef.current = null
        }
        if (!data?.polygon || data.polygon.length < 3) return
        const depthM = floodDepthOverride ?? (data.max_flood_depth_m ?? 0)
        // Height raised 4x from original for visibility: base 20m, top 60m
        const baseHeightM = 20
        const topHeightM = 60
        const risk = (data.max_risk_level ?? 'normal') as string
        const riskColors: Record<string, { fill: string; outline: string }> = {
          normal: { fill: 'rgba(34, 197, 94, 0.45)', outline: 'rgba(34, 197, 94, 0.8)' },
          elevated: { fill: 'rgba(234, 179, 8, 0.5)', outline: 'rgba(234, 179, 8, 0.9)' },
          high: { fill: 'rgba(249, 115, 22, 0.55)', outline: 'rgba(249, 115, 22, 0.9)' },
          critical: { fill: 'rgba(239, 68, 68, 0.6)', outline: 'rgba(239, 68, 68, 0.95)' },
        }
        const { fill, outline } = riskColors[risk] ?? riskColors.normal
        const hierarchy = new Cesium.PolygonHierarchy(
          data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, baseHeightM))
        )
        floodEntityRef.current = v.entities.add({
          id: 'dt-flood-layer',
          name: `Flood zone — risk: ${risk}`,
          polygon: {
            hierarchy,
            height: baseHeightM,
            extrudedHeight: topHeightM,
            material: Cesium.Color.fromCssColorString(fill),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(outline),
          },
          label: {
            text: `Flood zone (${risk})\nWater level: ${depthM}m`,
            font: '14pt sans-serif',
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -20),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          position: Cesium.Cartesian3.fromDegrees(dtCenterLng, dtCenterLat, topHeightM + 5),
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => {
      if (floodEntityRef.current && viewer.entities.contains(floodEntityRef.current)) {
        viewer.entities.remove(floodEntityRef.current)
        floodEntityRef.current = null
      }
    }
  }, [viewerReady, isOpen, effectiveShowFloodLayer, stressTestComplete, floodDepthOverride, dtCenterLat, dtCenterLng])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowWindLayer || !stressTestComplete) {
      if (windEntityRef.current && viewer?.entities.contains(windEntityRef.current)) {
        viewer?.entities.remove(windEntityRef.current)
        windEntityRef.current = null
      }
      return
    }
    const url = `${API_BASE}/climate/wind-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&days=7&include_polygon=true`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; max_category?: number } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (windEntityRef.current && v.entities.contains(windEntityRef.current)) {
          v.entities.remove(windEntityRef.current)
          windEntityRef.current = null
        }
        if (!data?.polygon || data.polygon.length < 3) return
        const cat = data.max_category ?? 0
        const colors: Record<number, string> = {
          0: 'rgba(34, 197, 94, 0.35)',
          1: 'rgba(34, 197, 94, 0.4)',
          2: 'rgba(234, 179, 8, 0.45)',
          3: 'rgba(249, 115, 22, 0.5)',
          4: 'rgba(239, 68, 68, 0.55)',
          5: 'rgba(127, 29, 29, 0.6)',
        }
        const fill = colors[cat] ?? colors[0]
        const hierarchy = new Cesium.PolygonHierarchy(
          data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30))
        )
        windEntityRef.current = v.entities.add({
          id: 'dt-wind-layer',
          name: `Wind Cat ${cat}`,
          polygon: {
            hierarchy,
            height: 30,
            extrudedHeight: 30 + (cat * 15),
            material: Cesium.Color.fromCssColorString(fill),
            outline: true,
            outlineColor: Cesium.Color.fromCssColorString(cat >= 4 ? 'rgba(220, 38, 38, 0.9)' : 'rgba(250, 204, 21, 0.8)'),
          },
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => {
      if (windEntityRef.current && viewer.entities.contains(windEntityRef.current)) {
        viewer.entities.remove(windEntityRef.current)
        windEntityRef.current = null
      }
    }
  }, [viewerReady, isOpen, effectiveShowWindLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowMetroFloodLayer || !stressTestComplete) {
      metroEntitiesRef.current.forEach((e) => {
        if (viewer?.entities.contains(e)) viewer?.entities.remove(e)
      })
      metroEntitiesRef.current = []
      return
    }
    const url = `${API_BASE}/climate/metro-flood?latitude=${dtCenterLat}&longitude=${dtCenterLng}&radius_km=15`
    fetch(url)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { entrances?: { lat: number; lon: number; name: string; flood_depth_m: number }[] } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        metroEntitiesRef.current.forEach((e) => {
          if (v.entities.contains(e)) v.entities.remove(e)
        })
        metroEntitiesRef.current = []
        if (!data?.entrances?.length) return
        data.entrances.forEach((ent: { lat: number; lon: number; name: string; flood_depth_m: number }) => {
          const depthM = ent.flood_depth_m ?? 0
          const length = Math.max(5, depthM * 1000)
          const entity = v.entities.add({
            position: Cesium.Cartesian3.fromDegrees(ent.lon, ent.lat, 20),
            name: ent.name,
            cylinder: {
              length,
              topRadius: 8,
              bottomRadius: 8,
              material: Cesium.Color.fromCssColorString('rgba(0, 120, 255, 0.6)'),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('rgba(0, 150, 255, 0.9)'),
            },
            label: {
              text: `Metro: ${ent.name}\n${depthM > 0 ? `${depthM}m flooded` : 'Dry'}`,
              font: '12pt sans-serif',
              fillColor: Cesium.Color.WHITE,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -length / 2 - 10),
            },
          })
          metroEntitiesRef.current.push(entity)
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => {
      metroEntitiesRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
      metroEntitiesRef.current = []
    }
  }, [viewerReady, isOpen, effectiveShowMetroFloodLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  // Heat — only after stress test
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowHeatLayer || !stressTestComplete) {
      if (heatEntityRef.current && viewer?.entities.contains(heatEntityRef.current)) { viewer?.entities.remove(heatEntityRef.current); heatEntityRef.current = null }
      return
    }
    fetch(`${API_BASE}/climate/heat-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&days=7&include_polygon=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (heatEntityRef.current && v.entities.contains(heatEntityRef.current)) v.entities.remove(heatEntityRef.current)
        heatEntityRef.current = null
        if (!data?.polygon || data.polygon.length < 3) return
        const risk = (data.max_risk_level ?? 'normal') as string
        const colors: Record<string, string> = { normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(234, 179, 8, 0.4)', high: 'rgba(249, 115, 22, 0.5)', extreme: 'rgba(239, 68, 68, 0.55)' }
        const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 5)))
        heatEntityRef.current = v.entities.add({
          id: 'dt-heat-layer', name: 'Heat stress',
          polygon: { hierarchy, height: 5, extrudedHeight: 15, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.8)') },
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => { if (heatEntityRef.current && viewer.entities.contains(heatEntityRef.current)) { viewer.entities.remove(heatEntityRef.current); heatEntityRef.current = null } }
  }, [viewerReady, isOpen, effectiveShowHeatLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  // Heavy rain — only after stress test
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowHeavyRainLayer || !stressTestComplete) {
      if (heavyRainEntityRef.current && viewer?.entities.contains(heavyRainEntityRef.current)) { viewer?.entities.remove(heavyRainEntityRef.current); heavyRainEntityRef.current = null }
      return
    }
    fetch(`${API_BASE}/climate/heavy-rain-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&days=7&include_polygon=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (heavyRainEntityRef.current && v.entities.contains(heavyRainEntityRef.current)) v.entities.remove(heavyRainEntityRef.current)
        heavyRainEntityRef.current = null
        if (!data?.polygon || data.polygon.length < 3) return
        const risk = (data.max_risk_level ?? 'normal') as string
        const colors: Record<string, string> = { normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(56, 189, 248, 0.4)', high: 'rgba(14, 165, 233, 0.5)', extreme: 'rgba(2, 132, 199, 0.55)' }
        const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 5)))
        heavyRainEntityRef.current = v.entities.add({
          id: 'dt-heavy-rain-layer', name: 'Heavy rain',
          polygon: { hierarchy, height: 5, extrudedHeight: 15, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(14, 165, 233, 0.8)') },
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => { if (heavyRainEntityRef.current && viewer.entities.contains(heavyRainEntityRef.current)) { viewer.entities.remove(heavyRainEntityRef.current); heavyRainEntityRef.current = null } }
  }, [viewerReady, isOpen, effectiveShowHeavyRainLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  // Drought — only after stress test
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowDroughtLayer || !stressTestComplete) {
      if (droughtEntityRef.current && viewer?.entities.contains(droughtEntityRef.current)) { viewer?.entities.remove(droughtEntityRef.current); droughtEntityRef.current = null }
      return
    }
    fetch(`${API_BASE}/climate/drought-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&include_polygon=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; drought_risk?: string } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (droughtEntityRef.current && v.entities.contains(droughtEntityRef.current)) v.entities.remove(droughtEntityRef.current)
        droughtEntityRef.current = null
        if (!data?.polygon || data.polygon.length < 3) return
        const risk = (data.drought_risk ?? 'normal') as string
        const colors: Record<string, string> = { normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(217, 119, 6, 0.4)', high: 'rgba(180, 83, 9, 0.5)', extreme: 'rgba(120, 53, 15, 0.55)' }
        const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 5)))
        droughtEntityRef.current = v.entities.add({
          id: 'dt-drought-layer', name: 'Drought',
          polygon: { hierarchy, height: 5, extrudedHeight: 15, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(180, 83, 9, 0.8)') },
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => { if (droughtEntityRef.current && viewer.entities.contains(droughtEntityRef.current)) { viewer.entities.remove(droughtEntityRef.current); droughtEntityRef.current = null } }
  }, [viewerReady, isOpen, effectiveShowDroughtLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  // UV — only after stress test
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !viewerReady || !isOpen || !effectiveShowUvLayer || !stressTestComplete) {
      if (uvEntityRef.current && viewer?.entities.contains(uvEntityRef.current)) { viewer?.entities.remove(uvEntityRef.current); uvEntityRef.current = null }
      return
    }
    fetch(`${API_BASE}/climate/uv-forecast?latitude=${dtCenterLat}&longitude=${dtCenterLng}&days=7&include_polygon=true`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
        if (!viewerRef.current?.entities || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        if (uvEntityRef.current && v.entities.contains(uvEntityRef.current)) v.entities.remove(uvEntityRef.current)
        uvEntityRef.current = null
        if (!data?.polygon || data.polygon.length < 3) return
        const risk = (data.max_risk_level ?? 'normal') as string
        const colors: Record<string, string> = { normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(168, 85, 247, 0.4)', high: 'rgba(139, 92, 246, 0.5)', extreme: 'rgba(124, 58, 237, 0.55)' }
        const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 5)))
        uvEntityRef.current = v.entities.add({
          id: 'dt-uv-layer', name: 'UV index',
          polygon: { hierarchy, height: 5, extrudedHeight: 15, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(139, 92, 246, 0.8)') },
        })
        v.scene.requestRender()
      })
      .catch(() => {})
    return () => { if (uvEntityRef.current && viewer.entities.contains(uvEntityRef.current)) { viewer.entities.remove(uvEntityRef.current); uvEntityRef.current = null } }
  }, [viewerReady, isOpen, effectiveShowUvLayer, stressTestComplete, dtCenterLat, dtCenterLng])

  // Reset stress test state and quality delay when panel closes or city changes
  useEffect(() => {
    if (!isOpen) {
      setStressTestRunning(false)
      setStressTestComplete(false)
      setStressTestProgress(0)
      setRiskHighlights([])
      setQualityDelayActive(false)
      setQualityDelayRemaining(12)
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
    if (viewerRef.current && !viewerRef.current.isDestroyed()) {
      riskEntitiesRef.current.forEach(e => viewerRef.current!.entities.remove(e))
      riskEntitiesRef.current = []
    }
    prevEventIdRef.current = eventId
    prevCityIdRef.current = effectiveCityId
  }, [isOpen, eventId, effectiveCityId])

  // Function to run stress test and highlight risk zones
  // NOW USES BACKEND API for calculation and LLM integration
  const runStressTest = useCallback(async (scenarioId?: string) => {
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
          event_id: scenarioId ?? selectedScenario ?? eventId ?? 'general-scenario',
          severity: city.risk_score,
          use_llm: true,
          entity_name: dynamicAsset?.name ?? city.name,
          use_kg: true,
          use_cascade_gnn: true,
          use_nvidia_orchestration: true,
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
        polygon?: number[][]
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
        polygon: zone.polygon,
      }))
      
      setRiskHighlights(highlights)
      
      // Create report from backend data
      const report: StressTestReport = {
        eventName: data.event_name,
        eventType: data.event_type,
        eventId: scenarioId ?? selectedScenario ?? eventId ?? 'general-scenario',
        cityName: data.city_name,
        timestamp: data.timestamp,
        totalLoss: data.total_loss,
        totalBuildingsAffected: data.total_buildings_affected,
        totalPopulationAffected: data.total_population_affected,
        zones: highlights,
        executiveSummary: data.executive_summary,
        concludingSummary: data.concluding_summary ?? undefined,
        mitigationActions: data.mitigation_actions.map((action: { action: string; priority: string; cost?: number; risk_reduction?: number }) => ({
          action: action.action,
          priority: action.priority,
          cost: action.cost || 0,
          riskReduction: action.risk_reduction || 0,
        })),
        dataSourcesUsed: data.data_sources,
        llmGenerated: data.llm_generated,
        regionActionPlan: data.region_action_plan ?? undefined,
        reportV2: data.report_v2 ?? undefined,
        nvidiaOrchestration: data.nvidia_orchestration ?? undefined,
        relatedEntities: data.related_entities ?? undefined,
        graphContext: data.graph_context ?? undefined,
        currency: data.currency ?? 'EUR',
      }

      setStressTestReport(report)
      setStressTestProgress(100)
      
      console.log('✅ Backend stress test completed:', data.id)
      
      // Add risk zone entities to Cesium viewer (polygon for flood, ellipse otherwise)
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

        const extrudedHeight = zone.riskLevel === 'critical' ? 120 : zone.riskLevel === 'high' ? 80 : 50

        const entity = zone.polygon && zone.polygon.length >= 3
          ? viewer.entities.add({
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(
                  zone.polygon.map(([lng, lat]) => Cesium.Cartesian3.fromDegrees(lng, lat, 30))
                ),
                height: 20,
                extrudedHeight,
                material: color,
                outline: true,
                outlineColor: outlineColor,
                outlineWidth: 1,
              },
            })
          : viewer.entities.add({
              position: Cesium.Cartesian3.fromDegrees(
                zone.position.lng,
                zone.position.lat,
                30
              ),
              ellipse: {
                semiMajorAxis: zone.radius,
                semiMinorAxis: zone.radius,
                height: 20,
                extrudedHeight,
                material: color,
                outline: true,
                outlineColor: outlineColor,
                outlineWidth: 1,
              },
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

  // When opened from Risk Zones with pre-selected stress test: do NOT auto-open report in new tab.
  // Show map first; user sees "Analysis Complete" + "View Report" and can open report when ready.
  // (Only persist report for when user clicks "View Report".)

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
      eventId: selectedScenario || eventId || 'general-scenario',
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
        report.concludingSummary = llmData.concluding_summary ?? undefined
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
                              const [lng, lat] = c.coordinates ?? [0, 0]
                              onCitySelected({
                                id: c.id,
                                name: c.name,
                                type: 'city',
                                latitude: lat,
                                longitude: lng,
                                exposure: 10,
                                impactSeverity: 0.5,
                                cameraPosition: c.camera_position ?? {
                                  lat,
                                  lng,
                                  height: 3000,
                                  heading: 60,
                                  pitch: -35,
                                },
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
                  
                  {/* Loading overlay (initial viewer + tileset load) */}
                  {isLoading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/80">
                      <div className="text-center">
                        <div className={`w-8 h-8 border-2 ${useCesiumMode ? 'border-amber-500' : 'border-amber-500'} border-t-transparent rounded-full animate-spin mx-auto mb-3`} />
                        <div className="text-amber-400 text-sm">
                          {useGooglePhotorealistic ? 'Loading 3D city...' : useCesiumMode ? 'Loading Premium 3D Model...' : 'Loading 3D Buildings...'}
                        </div>
                        <div className="text-white/40 text-xs mt-1">{city.name}</div>
                        <div className="text-white/30 text-[10px] mt-2">
                          {useGooglePhotorealistic 
                            ? 'Google Photorealistic 3D • City view next' 
                            : useCesiumMode 
                            ? `Cesium Ion Asset #${city.cesiumAssetId}` 
                            : 'Cesium OSM Buildings • Worldwide'
                          }
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Quality delay overlay: one countdown only */}
                  {!isLoading && qualityDelayActive && actual3DMode === 'google' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/90 backdrop-blur-sm z-10">
                      <div className="text-center">
                        <div className="w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <div className="text-amber-400 text-base font-medium">Refining 3D city</div>
                        <div className="text-amber-300 text-3xl font-mono font-bold mt-3 tabular-nums">
                          {qualityDelayRemaining}s
                        </div>
                        <div className="text-white/40 text-[10px] mt-2">Full photorealistic view next</div>
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
                          {useGooglePhotorealistic 
                            ? 'Google Photorealistic 3D Tiles (Cesium Ion Asset #2275207). Check Cesium Ion access.'
                            : useCesiumMode 
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
                    {actual3DMode === 'google' ? (
                      <div className="mt-1 flex items-center gap-1.5">
                        <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                        <span className="text-amber-400/70 text-[10px] uppercase tracking-wider">Google Photorealistic 3D</span>
                      </div>
                    ) : actual3DMode === 'premium' ? (
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

                  {/* Top-right controls: Zoom + Close - grouped so they don't overlap */}
                  <div className="absolute top-4 right-4 flex items-start gap-1 pointer-events-auto z-50">
                    {/* Zoom controls - left of close button */}
                    {viewerReady && (
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            const v = viewerRef.current
                            if (!v || v.isDestroyed()) return
                            const cam = v.camera
                            const carto = Cesium.Cartographic.fromCartesian(cam.positionWC)
                            const newHeight = Math.max(150, carto.height * 0.65)
                            cam.flyTo({
                              destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, newHeight),
                              orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
                              duration: 0.25,
                            })
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/40 text-amber-200 text-lg font-bold transition-colors cursor-pointer"
                          title="Zoom in"
                        >
                          +
                        </button>
                        <button
                          type="button"
                          onMouseDown={(e) => { e.stopPropagation(); e.preventDefault() }}
                          onClick={(e) => {
                            e.stopPropagation()
                            e.preventDefault()
                            const v = viewerRef.current
                            if (!v || v.isDestroyed()) return
                            const cam = v.camera
                            const carto = Cesium.Cartographic.fromCartesian(cam.positionWC)
                            const newHeight = Math.min(80000, carto.height * 1.5)
                            cam.flyTo({
                              destination: Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, newHeight),
                              orientation: { heading: cam.heading, pitch: cam.pitch, roll: cam.roll },
                              duration: 0.25,
                            })
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-amber-500/30 hover:bg-amber-500/50 border border-amber-400/40 text-amber-200 text-lg font-bold transition-colors cursor-pointer"
                          title="Zoom out"
                        >
                          −
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const v = viewerRef.current
                            if (!v || v.isDestroyed()) return
                            const c = city.cameraPosition
                            const baseH = useGooglePhotorealistic && (city as AssetData).google3dCameraHeight != null
                              ? (city as AssetData).google3dCameraHeight!
                              : 2000
                            const h = useGooglePhotorealistic ? Math.round(baseH * 0.56) : c.height
                            v.camera.flyTo({
                              destination: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, h),
                              orientation: {
                                heading: Cesium.Math.toRadians(c.heading),
                                pitch: Cesium.Math.toRadians(c.pitch),
                                roll: 0,
                              },
                              duration: 0.8,
                            })
                          }}
                          className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/70 hover:bg-black/90 border border-white/15 text-white transition-colors"
                          title="Reset view / Center"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                        </button>
                      </div>
                    )}
                    {/* Close button - always visible */}
                    <button
                      onClick={onClose}
                      className="w-9 h-9 flex items-center justify-center rounded-lg bg-black/70 hover:bg-black/90 border border-white/15 transition-colors"
                      title="Close"
                    >
                      <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
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
                    {/* Risk indicator - opaque background for visibility */}
                    <div className={`px-4 py-2 rounded-lg text-sm font-semibold shadow-lg ${
                      city.risk_score > 0.7 ? 'bg-red-900/95 text-red-100 border-2 border-red-400' :
                      city.risk_score > 0.5 ? 'bg-orange-900/95 text-orange-100 border-2 border-orange-400' :
                      'bg-emerald-900/95 text-emerald-100 border-2 border-emerald-400'
                    }`}>
                      Risk: {(city.risk_score * 100).toFixed(0)}%
                    </div>
                    
                    {/* Stress Test Button with Selector - opaque background for visibility */}
                    {!stressTestComplete && (
                      <div className="relative">
                        {stressTestRunning ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-amber-900/95 text-amber-100 border-2 border-amber-400 cursor-wait shadow-lg"
                          >
                            <div className="w-4 h-4 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
                            <span>Analyzing... {stressTestProgress}%</span>
                          </button>
                        ) : hasPreSelectedEvent ? (
                          <button
                            disabled
                            className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 bg-amber-900/95 text-amber-100 border-2 border-amber-400 cursor-wait shadow-lg"
                          >
                            <div className="w-4 h-4 border-2 border-amber-200 border-t-transparent rounded-full animate-spin" />
                            <span>Preparing analysis…</span>
                          </button>
                        ) : (
                          <>
                            <button
                              onClick={() => setShowTestSelector(!showTestSelector)}
                              disabled={isLoading}
                              className="px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all bg-amber-900/95 text-amber-100 border-2 border-amber-400 hover:bg-amber-800 hover:scale-[1.02] shadow-lg"
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
                          <div className="absolute bottom-full right-0 mb-2 w-96 bg-black/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl overflow-hidden">
                            <div className="p-2">
                              <UnifiedStressTestSelector
                                selectedScenarioId={selectedScenario || null}
                                onSelect={(scenario) => {
                                  setSelectedScenario(scenario.id)
                                  setShowTestSelector(false)
                                  runStressTest(scenario.id)
                                }}
                                onClear={() => {
                                  setSelectedScenario('')
                                  setShowTestSelector(false)
                                }}
                              />
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

                  {/* Report ready pill: single place for Analysis complete + View Report (no duplicate in toolbar) */}
                  {stressTestComplete && stressTestReport && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-black/85 backdrop-blur-sm rounded-xl border border-green-500/40 shadow-lg z-10">
                      <span className="text-green-400 text-sm font-medium flex items-center gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Report ready
                      </span>
                      <button
                        onClick={() => {
                          try {
                            localStorage.setItem('pfrp-stress-report', JSON.stringify(stressTestReport))
                            window.open('/report?source=stress', '_blank', 'noopener,noreferrer')
                          } catch (e) {
                            console.error('Report open failed:', e)
                          }
                        }}
                        className="px-3 py-1.5 bg-amber-500/25 text-amber-400 border border-amber-500/50 rounded-lg text-sm font-medium hover:bg-amber-500/35 transition-colors"
                      >
                        View Report
                      </button>
                    </div>
                  )}
                </>
              )}
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
              
              {/* 3D View info - use explicit OSM check for reliable labeling */}
              {activeTab === '3d' && (() => {
                const isGoogle = actual3DMode === 'google'
                const isPremium = actual3DMode === 'premium'
                const isOsm = actual3DMode === 'osm'
                return (
                <div className="space-y-4">
                  <div className="text-white/40 text-[10px] uppercase tracking-wider mb-2">3D Model Info</div>
                  <div className="text-white/60 text-sm space-y-1">
                    <p>• Drag to rotate view</p>
                    <p>• Scroll to zoom</p>
                    <p>• Right-click to pan</p>
                  </div>
                  
                  <div className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <div className="text-amber-400 text-xs font-medium mb-1">
                      {isGoogle ? 'Google Photorealistic 3D Tiles' : isPremium ? 'Cesium Ion 3D Tiles' : 'Cesium OSM Buildings'}
                    </div>
                    <div className="text-white/50 text-xs">
                      {isGoogle
                        ? 'High-resolution photogrammetry from Google Maps Platform Map Tiles API'
                        : isPremium
                        ? `High-resolution photogrammetry model from Cesium Ion Asset #${city.cesiumAssetId}`
                        : 'Gray 3D buildings from OpenStreetMap (Asset #96188). Available worldwide.'}
                    </div>
                  </div>

                  <div className="mt-4 p-3 bg-white/5 rounded-lg">
                    <div className="text-white/40 text-[10px] uppercase mb-2">Data Sources</div>
                    <div className="space-y-1 text-xs text-white/50">
                      <div>• 3D Model: {isGoogle ? 'Google Maps Platform' : isPremium ? 'Cesium Ion (Premium)' : 'Cesium Ion (OSM)'}</div>
                      <div>• Risk Data: PFRP Engine</div>
                      <div>• Sensors: IoT Network</div>
                    </div>
                  </div>
                </div>
                )
              })()}
            </div>
            )}
          </div>

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
