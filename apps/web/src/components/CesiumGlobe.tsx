/**
 * CesiumJS Globe Component
 * =========================
 * 
 * Production-level 3D globe using CesiumJS:
 * - Real WGS84 ellipsoid
 * - Level of Detail (LOD)
 * - Smooth camera transitions
 * - Risk hotspots as entities
 * 
 * Used by NASA, Lockheed Martin, NVIDIA Digital Twins
 */
import { useEffect, useRef, useState, useCallback } from 'react'
import * as Cesium from 'cesium'
import { useWebSocket } from '../lib/useWebSocket'
import { getApiBase } from '../config/env'

// Extend Window for Cesium
declare global {
  interface Window {
    CESIUM_BASE_URL: string
  }
}

// Configure Cesium - serve Workers/Assets from app origin to avoid 404 in production
window.CESIUM_BASE_URL = (import.meta.env.BASE_URL || '/') + 'cesium/'

// Cesium Ion token for NASA Black Marble
const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || ''

// Google Photorealistic 3D Tiles via Cesium Ion (fallback when createGooglePhotorealistic3DTileset unavailable)
const CESIUM_ION_GOOGLE_PHOTOREALISTIC = 2275207

// API for loading geo data (runtime ?api= or VITE_API_URL for tunnel/different origin)
function apiPrefix(): string {
  const b = getApiBase()
  return b ? b + '/api/v1' : '/api/v1'
}

interface Hotspot {
  id: string
  lat: number
  lng: number
  risk: number
  name: string
  value: number
  assets_count?: number
  pd_1y?: number
  lgd?: number
}

// Cities most at risk per hazard type — all cities that appear when checkboxes are selected (full list per layer)
export type DisasterHotspot = { lat: number; lng: number; name: string }
const DISASTER_LAYER_HOTSPOTS: Record<string, DisasterHotspot[]> = {
  flood: [
    { lat: 25.7617, lng: -80.1918, name: 'Miami' },
    { lat: 32.8872, lng: 13.1913, name: 'Tripoli' },
    { lat: 23.8103, lng: 90.4125, name: 'Dhaka' },
    { lat: -6.2088, lng: 106.8456, name: 'Jakarta' },
    { lat: 13.7563, lng: 100.5018, name: 'Bangkok' },
    { lat: 29.7604, lng: -95.3698, name: 'Houston' },
    { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' },
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 37.7749, lng: -122.4194, name: 'San Francisco' },
    { lat: 6.5244, lng: 3.3792, name: 'Lagos' },
    { lat: 50.9375, lng: 6.9603, name: 'Cologne' },
    { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 45.4215, lng: -75.6972, name: 'Ottawa' },
    { lat: 19.4326, lng: -99.1332, name: 'Mexico City' },
    { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
    { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    { lat: 14.5995, lng: 120.9842, name: 'Manila' },
    { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    { lat: -23.5505, lng: -46.6333, name: 'São Paulo' },
    { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
    { lat: 37.5665, lng: 126.9780, name: 'Seoul' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: -33.0472, lng: -71.6127, name: 'Valparaíso' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
    { lat: 6.2476, lng: -75.5658, name: 'Medellín' },
    { lat: 10.3910, lng: -75.4794, name: 'Cartagena' },
  ],
  wind: [
    { lat: 25.7617, lng: -80.1918, name: 'Miami' },
    { lat: 29.7604, lng: -95.3698, name: 'Houston' },
    { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    { lat: 14.5995, lng: 120.9842, name: 'Manila' },
    { lat: 25.0330, lng: 121.5654, name: 'Taipei' },
    { lat: 29.9511, lng: -90.0715, name: 'New Orleans' },
    { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
    { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
    { lat: 37.5665, lng: 126.9780, name: 'Seoul' },
    { lat: 21.3069, lng: -157.8583, name: 'Honolulu' },
    { lat: -33.0472, lng: -71.6127, name: 'Valparaíso' },
    { lat: 10.3910, lng: -75.4794, name: 'Cartagena' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  ],
  heat: [
    { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
    { lat: 32.8872, lng: 13.1913, name: 'Tripoli' },
    { lat: 28.7041, lng: 77.1025, name: 'Delhi' },
    { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
    { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
    { lat: 33.3152, lng: 44.3661, name: 'Baghdad' },
    { lat: 24.8607, lng: 67.0011, name: 'Karachi' },
    { lat: 25.7617, lng: -80.1918, name: 'Miami' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
    { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv' },
    { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
    { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    { lat: 15.5007, lng: 32.5599, name: 'Khartoum' },
    { lat: 15.3694, lng: 44.1910, name: 'Sanaa' },
    { lat: 34.5553, lng: 69.2075, name: 'Kabul' },
    { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  ],
  heavy_rain: [
    { lat: 23.8103, lng: 90.4125, name: 'Dhaka' },
    { lat: 13.7563, lng: 100.5018, name: 'Bangkok' },
    { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
    { lat: -6.2088, lng: 106.8456, name: 'Jakarta' },
    { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    { lat: 50.9375, lng: 6.9603, name: 'Cologne' },
    { lat: 48.8566, lng: 2.3522, name: 'Paris' },
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 25.0330, lng: 121.5654, name: 'Taipei' },
    { lat: 14.5995, lng: 120.9842, name: 'Manila' },
    { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
    { lat: 37.5665, lng: 126.9780, name: 'Seoul' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
    { lat: 6.2476, lng: -75.5658, name: 'Medellín' },
    { lat: 3.4372, lng: -76.5225, name: 'Cali' },
  ],
  drought: [
    { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
    { lat: 32.8872, lng: 13.1913, name: 'Tripoli' },
    { lat: -1.2921, lng: 36.8219, name: 'Nairobi' },
    { lat: -12.0464, lng: -77.0428, name: 'Lima' },
    { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
    { lat: 33.3152, lng: 44.3661, name: 'Baghdad' },
    { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    { lat: 28.7041, lng: 77.1025, name: 'Delhi' },
    { lat: -15.3875, lng: 28.3228, name: 'Lusaka' },
    { lat: -26.2041, lng: 28.0473, name: 'Johannesburg' },
    { lat: 34.0522, lng: -118.2437, name: 'Los Angeles' },
    { lat: 32.0853, lng: 34.7818, name: 'Tel Aviv' },
    { lat: 15.3694, lng: 44.1910, name: 'Sanaa' },
    { lat: 15.5007, lng: 32.5599, name: 'Khartoum' },
    { lat: -35.2809, lng: 149.1300, name: 'Canberra' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  ],
  uv: [
    { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
    { lat: 33.4484, lng: -112.0740, name: 'Phoenix' },
    { lat: -33.8688, lng: 151.2093, name: 'Sydney' },
    { lat: -27.4698, lng: 153.0251, name: 'Brisbane' },
    { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
    { lat: 25.7617, lng: -80.1918, name: 'Miami' },
    { lat: -33.9249, lng: 18.4241, name: 'Cape Town' },
    { lat: -16.5004, lng: -68.1631, name: 'La Paz' },
    { lat: 31.7683, lng: 35.2137, name: 'Jerusalem' },
    { lat: 34.5553, lng: 69.2075, name: 'Kabul' },
    { lat: -37.8136, lng: 144.9631, name: 'Melbourne' },
    { lat: 25.0330, lng: 121.5654, name: 'Taipei' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  ],
  metro: [
    { lat: 40.7128, lng: -74.0060, name: 'New York' },
    { lat: 51.5074, lng: -0.1278, name: 'London' },
    { lat: 48.8566, lng: 2.3522, name: 'Paris' },
    { lat: 35.6762, lng: 139.6503, name: 'Tokyo' },
    { lat: 31.2304, lng: 121.4737, name: 'Shanghai' },
    { lat: 52.5200, lng: 13.4050, name: 'Berlin' },
    { lat: 55.7558, lng: 37.6173, name: 'Moscow' },
    { lat: 41.9028, lng: 12.4964, name: 'Rome' },
    { lat: 40.4168, lng: -3.7038, name: 'Madrid' },
    { lat: 50.8503, lng: 4.3517, name: 'Brussels' },
    { lat: 52.3676, lng: 4.9041, name: 'Amsterdam' },
    { lat: 39.9042, lng: 116.4074, name: 'Beijing' },
    { lat: 37.5665, lng: 126.9780, name: 'Seoul' },
    { lat: 22.3193, lng: 114.1694, name: 'Hong Kong' },
    { lat: 1.3521, lng: 103.8198, name: 'Singapore' },
    { lat: 19.0760, lng: 72.8777, name: 'Mumbai' },
    { lat: 41.0082, lng: 28.9784, name: 'Istanbul' },
    { lat: -33.4489, lng: -70.6693, name: 'Santiago' },
    { lat: 4.7110, lng: -74.0721, name: 'Bogotá' },
  ],
}

// Hotspots for cities with 3D Tiles in Cesium Ion
const FALLBACK_HOTSPOTS: Hotspot[] = [
  { id: 'newyork', lat: 40.7128, lng: -74.0060, risk: 0.75, name: 'New York', value: 52.3 },
  { id: 'tokyo', lat: 35.6762, lng: 139.6503, risk: 0.92, name: 'Tokyo', value: 45.2 },
  { id: 'melbourne', lat: -37.8136, lng: 144.9631, risk: 0.58, name: 'Melbourne', value: 28.5 },
  { id: 'boston', lat: 42.3601, lng: -71.0589, risk: 0.62, name: 'Boston', value: 31.2 },
  { id: 'sydney', lat: -33.8688, lng: 151.2093, risk: 0.52, name: 'Sydney', value: 38.7 },
  { id: 'denver', lat: 39.7392, lng: -104.9903, risk: 0.45, name: 'Denver', value: 18.9 },
  { id: 'washington', lat: 38.9072, lng: -77.0369, risk: 0.48, name: 'Washington DC', value: 42.1 },
  { id: 'montreal', lat: 45.5017, lng: -73.5673, risk: 0.55, name: 'Montreal', value: 22.4 },
]

async function loadHotspots(scenario?: string): Promise<Hotspot[]> {
  try {
    const base = apiPrefix()
    const url = scenario 
      ? `${base}/geodata/hotspots?scenario=${scenario}`
      : `${base}/geodata/hotspots`
    
    // Add timeout to prevent hanging (increased for slower connections and risk calculation)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 second timeout (risk calculation can be slow)
    
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'Accept': 'application/json',
        },
      })
      clearTimeout(timeoutId)
      
      if (!response.ok) throw new Error(`API error: ${response.status}`)
      
      const geojson = await response.json()
      const MAX_LAT = 84 // исключить маркеры над полюсом (визуальный артефакт)
      return geojson.features
        .filter((f: any) => {
          const lat = f.geometry?.coordinates?.[1]
          const lng = f.geometry?.coordinates?.[0]
          return lat != null && lng != null && Math.abs(lat) <= MAX_LAT && Math.abs(lng) <= 180
        })
        .map((f: any) => {
        // Normalize risk_score: API returns 0-100, we need 0-1
        const rawRisk = f.properties.risk_score || 0
        const normalizedRisk = rawRisk > 1 ? rawRisk / 100 : rawRisk
        
        return {
          id: f.id,
          lat: f.geometry.coordinates[1],
          lng: f.geometry.coordinates[0],
          risk: Math.max(0, Math.min(1, normalizedRisk)), // Clamp to 0-1 range
          name: f.properties.name,
          value: f.properties.exposure,
          assets_count: f.properties.assets_count,
          pd_1y: f.properties.pd_1y,
          lgd: f.properties.lgd,
        }
      })
    } catch (fetchError) {
      clearTimeout(timeoutId)
      if (fetchError instanceof Error && fetchError.name === 'AbortError') {
        throw new Error('Request timeout')
      }
      throw fetchError
    }
  } catch (e) {
    console.warn('Failed to load hotspots from API, using fallback:', e)
    return FALLBACK_HOTSPOTS
  }
}

/** Load OSM 3D buildings in background (softer LOD). When skipAddIf() is true (e.g. Google 3D requested), do not add to scene — only one 3D layer (Google Photorealistic) for flood/city view. */
async function loadOsmBuildingsInBackground(
  viewer: Cesium.Viewer,
  osmBuildingsRef: { current: Cesium.Cesium3DTileset | null },
  isMounted: boolean,
  setLoadingProgress: (s: string) => void,
  skipAddIf: () => boolean
) {
  try {
    if (!isMounted || viewer.isDestroyed()) return
    setLoadingProgress('Loading 3D buildings...')
    const osmBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188, {
      maximumScreenSpaceError: 48,
      skipLevelOfDetail: true,
      baseScreenSpaceError: 768,
      skipScreenSpaceErrorFactor: 16,
      skipLevels: 2,
      immediatelyLoadDesiredLevelOfDetail: false,
      cullWithChildrenBounds: true,
      dynamicScreenSpaceError: true,
      dynamicScreenSpaceErrorDensity: 0.002,
      dynamicScreenSpaceErrorFactor: 4,
      dynamicScreenSpaceErrorHeightFalloff: 0.2,
    })
    if (!isMounted || viewer.isDestroyed()) return
    osmBuildingsRef.current = osmBuildings
    if (!skipAddIf()) {
      viewer.scene.primitives.add(osmBuildings)
      console.log('✅ OSM Buildings loaded (background)')
    } else {
      console.log('✅ OSM Buildings loaded (not shown — Google 3D layer active)')
    }
    setLoadingProgress('Globe Ready')
  } catch (e) {
    console.warn('OSM Buildings failed:', e)
    setLoadingProgress('Globe Ready')
  }
}

// ===========================================
// FIERY GLOW COLOR SYSTEM - Gradient from center to edges
// ===========================================

// Fiery gradient colors for 6-layer hotspot structure
interface FireGlowColors {
  center: Cesium.Color       // White/bright yellow (innermost)
  coreInner: Cesium.Color    // Bright yellow
  coreOuter: Cesium.Color    // Yellow-orange
  glowInner: Cesium.Color    // Bright orange
  glowMiddle: Cesium.Color   // Orange
  glowOuter: Cesium.Color    // Red-orange (outermost glow)
  ring: Cesium.Color         // Red for zone rings
}

function getFireGlowColors(risk: number): FireGlowColors {
  if (risk > 0.8) {
    // CRITICAL - PURE RED
    return {
      center: Cesium.Color.fromCssColorString('#ff0000'),      // Bright red center
      coreInner: Cesium.Color.fromCssColorString('#ff1a1a'),   // Red
      coreOuter: Cesium.Color.fromCssColorString('#ff3333'),   // Light red
      glowInner: Cesium.Color.fromCssColorString('#cc0000'),   // Dark red
      glowMiddle: Cesium.Color.fromCssColorString('#990000'),  // Darker red
      glowOuter: Cesium.Color.fromCssColorString('#660000'),   // Deep red
      ring: Cesium.Color.fromCssColorString('#ff0000'),        // Pure red for rings
    }
  }
  if (risk > 0.6) {
    // HIGH - PURE ORANGE
    return {
      center: Cesium.Color.fromCssColorString('#ff6600'),      // Bright orange center
      coreInner: Cesium.Color.fromCssColorString('#ff7722'),   // Orange
      coreOuter: Cesium.Color.fromCssColorString('#ff8833'),   // Light orange
      glowInner: Cesium.Color.fromCssColorString('#cc5200'),   // Dark orange
      glowMiddle: Cesium.Color.fromCssColorString('#993d00'),  // Darker orange
      glowOuter: Cesium.Color.fromCssColorString('#662900'),   // Deep orange
      ring: Cesium.Color.fromCssColorString('#ff6600'),        // Pure orange for rings
    }
  }
  if (risk > 0.4) {
    // MEDIUM - PURE YELLOW
    return {
      center: Cesium.Color.fromCssColorString('#ffcc00'),      // Bright yellow center
      coreInner: Cesium.Color.fromCssColorString('#ffd633'),   // Yellow
      coreOuter: Cesium.Color.fromCssColorString('#ffe066'),   // Light yellow
      glowInner: Cesium.Color.fromCssColorString('#cca300'),   // Dark yellow
      glowMiddle: Cesium.Color.fromCssColorString('#997a00'),  // Darker yellow
      glowOuter: Cesium.Color.fromCssColorString('#665200'),   // Deep yellow
      ring: Cesium.Color.fromCssColorString('#ffcc00'),        // Pure yellow for rings
    }
  }
  // LOW - PURE GREEN
  return {
    center: Cesium.Color.fromCssColorString('#00cc00'),        // Bright green center
    coreInner: Cesium.Color.fromCssColorString('#33cc33'),     // Green
    coreOuter: Cesium.Color.fromCssColorString('#66cc66'),     // Light green
    glowInner: Cesium.Color.fromCssColorString('#009900'),     // Dark green
    glowMiddle: Cesium.Color.fromCssColorString('#006600'),    // Darker green
    glowOuter: Cesium.Color.fromCssColorString('#003300'),     // Deep green
    ring: Cesium.Color.fromCssColorString('#00cc00'),          // Pure green for rings
  }
}

// Zone level to color
function getZoneLevelColor(level: string): Cesium.Color {
  switch (level) {
    case 'critical': return Cesium.Color.fromCssColorString('#ff2222')
    case 'high':     return Cesium.Color.fromCssColorString('#ff8822')
    case 'medium':   return Cesium.Color.fromCssColorString('#ffcc22')
    default:         return Cesium.Color.fromCssColorString('#22ff66')
  }
}

function extractHotspotIdFromEntityId(entityId: string): string | null {
  if (!entityId.startsWith('hotspot-')) return null

  if (entityId.startsWith('hotspot-center-')) return entityId.replace('hotspot-center-', '')
  if (entityId.startsWith('hotspot-core-bb-')) return entityId.replace('hotspot-core-bb-', '')

  // hotspot-halo-{index}-{spotId}
  const haloMatch = entityId.match(/^hotspot-halo-\d+-(.+)$/)
  if (haloMatch?.[1]) return haloMatch[1]

  // hotspot-sparkle-{spotId}-{index}
  const sparkleMatch = entityId.match(/^hotspot-sparkle-(.+)-\d+$/)
  if (sparkleMatch?.[1]) return sparkleMatch[1]

  // Fallback: last segment
  const parts = entityId.split('-')
  const last = parts[parts.length - 1]
  return last || null
}

// ===========================================
// ENHANCED FIRE GLOW CANVAS SYSTEM
// ===========================================

// Create enhanced fire glow canvas with bright white core and smooth gradient
function createEnhancedFireGlow(
  width: number,
  height: number,
  intensity: number
): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const centerX = width / 2
  const centerY = height / 2
  const radius = Math.min(centerX, centerY)

  // Main radial gradient with 10 color stops for smooth transition
  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius)
  
  // BRIGHT WHITE CORE - like reference image
  gradient.addColorStop(0, `rgba(255, 255, 255, ${intensity})`)
  gradient.addColorStop(0.05, `rgba(255, 255, 240, ${intensity})`)
  
  // BRIGHT YELLOW-ORANGE
  gradient.addColorStop(0.15, `rgba(255, 220, 100, ${intensity * 0.95})`)
  gradient.addColorStop(0.25, `rgba(255, 180, 60, ${intensity * 0.9})`)
  
  // SATURATED ORANGE
  gradient.addColorStop(0.4, `rgba(255, 130, 30, ${intensity * 0.8})`)
  gradient.addColorStop(0.55, `rgba(255, 90, 20, ${intensity * 0.65})`)
  
  // DEEP RED-ORANGE
  gradient.addColorStop(0.7, `rgba(220, 50, 10, ${intensity * 0.45})`)
  gradient.addColorStop(0.82, `rgba(180, 30, 5, ${intensity * 0.25})`)
  
  // DARK RED FADE TO TRANSPARENT
  gradient.addColorStop(0.92, `rgba(120, 15, 0, ${intensity * 0.1})`)
  gradient.addColorStop(1, 'rgba(80, 10, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  // Add "spark" overlays - bright points using screen blend mode
  ctx.globalCompositeOperation = 'screen'
  
  for (let i = 0; i < 3; i++) {
    const angle = (i * Math.PI * 2) / 3
    const distance = radius * 0.2
    const x = centerX + Math.cos(angle) * distance
    const y = centerY + Math.sin(angle) * distance
    
    const sparkGradient = ctx.createRadialGradient(x, y, 0, x, y, radius * 0.3)
    sparkGradient.addColorStop(0, `rgba(255, 255, 200, ${intensity * 0.4})`)
    sparkGradient.addColorStop(0.5, `rgba(255, 150, 50, ${intensity * 0.2})`)
    sparkGradient.addColorStop(1, 'rgba(255, 100, 0, 0)')
    
    ctx.fillStyle = sparkGradient
    ctx.fillRect(0, 0, width, height)
  }

  return canvas
}

// Apply hotspot visibility from risk filter; reusable from init and useEffect
function applyVisibility(
  viewer: Cesium.Viewer | null,
  entityMap: Map<string, Cesium.Entity[]>,
  spots: Hotspot[],
  filter: 'critical' | 'high' | 'medium' | 'low' | null
): void {
  if (!viewer || viewer.isDestroyed()) return
  if (entityMap.size === 0) return
  try {
    const shouldShow = (risk: number): boolean => {
      if (!filter) return true
      switch (filter) {
        case 'critical': return risk > 0.8
        case 'high': return risk > 0.6 && risk <= 0.8
        case 'medium': return risk > 0.4 && risk <= 0.6
        case 'low': return risk <= 0.4
        default: return false
      }
    }
    spots.forEach((spot) => {
      const entities = entityMap.get(spot.id)
      if (!entities) return
      const visible = shouldShow(spot.risk)
      entities.forEach((e) => { e.show = visible })
    })
    if (!viewer.isDestroyed()) viewer.scene.requestRender()
  } catch (_) {
    // Viewer may have been destroyed (e.g. navigated away from globe)
  }
}

// Risk Zone from Stress Test
export interface RiskZone {
  id: string
  name?: string
  zone_level: 'critical' | 'high' | 'medium' | 'low'
  center_latitude: number
  center_longitude: number
  radius_km: number
  risk_score: number
  affected_assets_count?: number
  total_exposure?: number
  assets?: ZoneAsset[]  // Assets within this zone
}

// Asset within a risk zone
export interface ZoneAsset {
  id: string
  name: string
  type: 'bank' | 'enterprise' | 'developer' | 'insurer' | 'infrastructure' | 'military' | 'government' | 'hospital' | 'school' | 'city'
  latitude: number
  longitude: number
  exposure: number
  impactSeverity: number
}

interface CesiumGlobeProps {
  onAssetSelect?: (assetId: string | null) => void
  selectedAsset?: string | null
  /** Hotspot id that has the "observation" focus (cyan glow accent). When null, no accent. */
  focusedHotspotId?: string | null
  scenario?: string  // Stress scenario to apply
  resetViewTrigger?: number  // Increment to trigger reset view
  onHotspotsLoaded?: (hotspots: Hotspot[]) => void  // Callback when hotspots are loaded
  riskZones?: RiskZone[]  // Risk zones from stress tests
  selectedZone?: RiskZone | null  // Currently selected zone (for zoom)
  onZoneClick?: (zone: RiskZone | null) => void  // Callback when zone is clicked
  onZoneAssetClick?: (asset: ZoneAsset | null) => void  // Callback when asset in zone is clicked
  paused?: boolean  // Pause rendering (when Digital Twin is open)
  activeRiskFilter?: 'critical' | 'high' | 'medium' | 'low' | null  // Filter hotspots by risk level
  showDependencies?: boolean  // Show dependency lines between zones
  selectedZoneForDependencies?: string | null  // Show dependencies only for selected zone (smart mode)
  showFloodLayer?: boolean  // Show flood forecast from Open-Meteo (no GPU)
  floodCenter?: { lat: number; lng: number }  // Center for flood-forecast fetch
  floodDepthOverride?: number  // Optional water level in meters (e.g. 0.5, 1, 3, 6, 9) for slider; overrides API max depth
  /** Per-cell depth grid from flood-risk-product (include_grid: true); when set, rendered as depth heatmap instead of single polygon */
  floodGrid?: Array<{ lat: number; lon: number; depth_m: number }>
  /** Per-building flood risk from POST /cadapt/flood-buildings; rendered as colored points with tooltips */
  floodBuildings?: Array<{ id: string; name: string; lat: number; lon: number; depth_m: number; return_period_years?: number; annual_probability: number; damage_ratio: number }>
  highFidelityFloodScenarioId?: string | null  // When set, fetch flood from /climate/high-fidelity/flood?scenario_id=...
  showWindLayer?: boolean  // Show wind damage zones (Cat 1-5) from Open-Meteo
  windCenter?: { lat: number; lng: number }  // Center for wind-forecast fetch
  highFidelityWindScenarioId?: string | null  // When set, fetch wind from /climate/high-fidelity/wind?scenario_id=...
  showMetroFloodLayer?: boolean  // Show metro entrances as cylinders with flood depth
  metroCenter?: { lat: number; lng: number }  // Center for metro-flood fetch
  showHeatLayer?: boolean
  showHeavyRainLayer?: boolean
  showDroughtLayer?: boolean
  showUvLayer?: boolean
  showEarthquakeLayer?: boolean  // Show earthquake impact zones M5+ from USGS
  earthquakeMinMagnitude?: number  // Filter: 5,6,7,8,9
  anomalyCenter?: { lat: number; lng: number }  // Center for heat/rain/drought/uv fetch
  /** Double-click on a climate risk zone (blue marker) opens Digital Twin for that city */
  onClimateZoneDoubleClick?: (info: { cityName: string; lat: number; lng: number; riskType?: string }) => void
  /** When set, globe flies to this position (e.g. from Assets → View on Globe). Optional height (meters) for zoom level. */
  focusCoordinates?: { lat: number; lng: number; height?: number } | null
  /** When true, set camera to focusCoordinates immediately (no fly animation). Use for Portfolio Globe: show asset at once. */
  focusCoordinatesImmediate?: boolean
  /** When true, show Google Photorealistic 3D Tiles on the globe instead of OSM buildings */
  showGoogle3dLayer?: boolean
  /** H3 Hexagonal Grid: show risk heatmap hexagons on globe */
  showH3Layer?: boolean
  /** H3 resolution: 3=global, 5=country, 7=city, 9=asset */
  h3Resolution?: number
  /** When set, color each hexagon by this risk vector component (p_agi, p_bio, p_nuclear, p_climate, p_financial) instead of aggregate */
  h3VectorDimension?: string | null
  /** Time slider value (ISO datetime) for temporal replay */
  timeSliderValue?: string | null
  /** Callback when time slider changes */
  onTimeSliderChange?: (isoDatetime: string) => void
  /** Drill-down level for Globe→Country→City→Asset UX */
  drillDownLevel?: 'globe' | 'country' | 'city' | 'asset'
  /** Callback when drill-down level changes */
  onDrillDownChange?: (level: 'globe' | 'country' | 'city' | 'asset', context?: { name: string; lat: number; lng: number }) => void
  /** View mode: global (3D globe), country (Columbus View), city (zoom) */
  viewMode?: 'global' | 'country' | 'city'
  /** ISO 3166-1 alpha-2 country code for Country Mode */
  selectedCountryCode?: string | null
  /** Country composite risk (0-1) for coloring city markers in Country Mode */
  countryCompositeRisk?: number
  /** Callback when a country polygon is clicked on the globe */
  onCountryClick?: (country: { code: string; name: string; lat: number; lng: number }) => void
  /** Callback when a city marker is clicked in Country Mode */
  onCityClick?: (city: { id: string; name: string; lat: number; lng: number; countryCode: string }) => void
  /** When set, load this CZML URL into the globe (e.g. cascade animation from Replay) */
  czmlUrl?: string | null
  /** When set, load stress test 4D timeline CZML and enable play/pause/scrub controls */
  stressTestCzmlUrl?: string | null
  /** When true, fly to focusCoordinates at street-level height (~800m) and stop rotation (3D city in same view, no modal) */
  city3DView?: boolean
  /** Show real-time active incidents layer (earthquakes, fires, weather alerts) with 60s polling */
  showActiveIncidentsLayer?: boolean
  /** Called when the globe has finished initializing and the first frame is ready (e.g. to hide loading overlay) */
  onReady?: () => void
}

// Asset type to icon color mapping
function getAssetTypeColor(type: string): Cesium.Color {
  switch (type) {
    case 'bank': return Cesium.Color.fromCssColorString('#3b82f6') // blue
    case 'enterprise': return Cesium.Color.fromCssColorString('#8b5cf6') // purple
    case 'developer': return Cesium.Color.fromCssColorString('#C9A962') // gold
    case 'insurer': return Cesium.Color.fromCssColorString('#10b981') // emerald
    case 'infrastructure': return Cesium.Color.fromCssColorString('#f59e0b') // amber
    case 'military': return Cesium.Color.fromCssColorString('#64748b') // slate
    case 'government': return Cesium.Color.fromCssColorString('#6366f1') // indigo
    case 'hospital': return Cesium.Color.fromCssColorString('#ef4444') // red
    case 'school': return Cesium.Color.fromCssColorString('#22c55e') // green
    default: return Cesium.Color.WHITE
  }
}

export default function CesiumGlobe({ 
  onAssetSelect, 
  selectedAsset, 
  focusedHotspotId = null,
  scenario, 
  resetViewTrigger, 
  onHotspotsLoaded,
  riskZones = [],
  selectedZone = null,
  onZoneClick,
  onZoneAssetClick,
  paused = false,
  activeRiskFilter = null,
  showDependencies = false,
  selectedZoneForDependencies = null,
  showFloodLayer = false,
  floodCenter,
  floodDepthOverride,
  floodGrid,
  floodBuildings,
  highFidelityFloodScenarioId = null,
  showWindLayer = false,
  windCenter: _windCenter,
  highFidelityWindScenarioId = null,
  showMetroFloodLayer = false,
  metroCenter: _metroCenter,
  showHeatLayer = false,
  showHeavyRainLayer = false,
  showDroughtLayer = false,
  showUvLayer = false,
  showEarthquakeLayer = false,
  earthquakeMinMagnitude = 5,
  anomalyCenter,
  showH3Layer = false,
  h3Resolution = 5,
  h3VectorDimension = null,
  timeSliderValue = null,
  onTimeSliderChange: _onTimeSliderChange,
  drillDownLevel: _drillDownLevel = 'globe',
  onDrillDownChange,
  onClimateZoneDoubleClick,
  focusCoordinates = null,
  focusCoordinatesImmediate = false,
  showGoogle3dLayer = false,
  viewMode = 'global',
  selectedCountryCode = null,
  countryCompositeRisk,
  onCountryClick,
  onCityClick,
  czmlUrl = null,
  stressTestCzmlUrl = null,
  city3DView = false,
  showActiveIncidentsLayer = false,
  onReady,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const czmlDataSourceRef = useRef<Cesium.CzmlDataSource | null>(null)
  const stressTestCzmlDataSourceRef = useRef<Cesium.CzmlDataSource | null>(null)
  const [stressTestClockPlaying, setStressTestClockPlaying] = useState(false)
  const [stressTestClockMultiplier, setStressTestClockMultiplier] = useState(3600)
  const [stressTestClockTime, setStressTestClockTime] = useState<string | null>(null)
  const [stressTestClockRange, setStressTestClockRange] = useState<{ start: number; end: number } | null>(null)
  const [stressTestScrubPct, setStressTestScrubPct] = useState(0)
  const stressTestClockRAFRef = useRef<number | null>(null)
  const stressTestScrubDraggingRef = useRef(false)
  const stressTestClockRangeRef = useRef<{ start: number; end: number } | null>(null)
  const osmBuildingsRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const google3dTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const climateRiskMarkersRef = useRef<Cesium.Entity[]>([])
  const onClimateZoneDoubleClickRef = useRef(onClimateZoneDoubleClick)
  onClimateZoneDoubleClickRef.current = onClimateZoneDoubleClick
  const floodEntitiesRef = useRef<Cesium.Entity[]>([])
  const floodGridEntitiesRef = useRef<Cesium.Entity[]>([])
  const floodBuildingEntitiesRef = useRef<Cesium.Entity[]>([])
  const windEntitiesRef = useRef<Cesium.Entity[]>([])
  const metroEntitiesRef = useRef<Cesium.Entity[]>([])
  const heatEntitiesRef = useRef<Cesium.Entity[]>([])
  const heavyRainEntitiesRef = useRef<Cesium.Entity[]>([])
  const droughtEntitiesRef = useRef<Cesium.Entity[]>([])
  const uvEntitiesRef = useRef<Cesium.Entity[]>([])
  const earthquakeEntitiesRef = useRef<Cesium.Entity[]>([])
  const activeIncidentEntitiesRef = useRef<Cesium.Entity[]>([])
  const h3EntitiesRef = useRef<Cesium.Entity[]>([])
  const h3RequestIdRef = useRef(0)
  const countryBoundaryDataSourceRef = useRef<Cesium.GeoJsonDataSource | null>(null)
  const countryCityMarkersRef = useRef<Cesium.Entity[]>([])
  const countryGeoJsonCacheRef = useRef<unknown>(null)
  const onCountryClickRef = useRef(onCountryClick)
  onCountryClickRef.current = onCountryClick
  const onCityClickRef = useRef(onCityClick)
  onCityClickRef.current = onCityClick
  const lastViewModeRef = useRef<string>('global')
  const showGoogle3dLayerRef = useRef(showGoogle3dLayer)
  showGoogle3dLayerRef.current = showGoogle3dLayer
  /** When true: we used Columbus View morph for country. When false: we used 3D zoom (Google mode). */
  const usedColumbusMorphRef = useRef(false)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const hotspotsRef = useRef<Hotspot[]>([])
  const [loadingProgress, setLoadingProgress] = useState<string>('Initializing Globe...')
  const hotspotEntitiesRef = useRef<Map<string, Cesium.Entity[]>>(new Map())
  const zoneEntitiesRef = useRef<Cesium.Entity[]>([])
  const assetEntitiesRef = useRef<Cesium.Entity[]>([])
  const dependencyLinesRef = useRef<Cesium.Entity[]>([])
  const dependencyEndpointMarkersRef = useRef<Cesium.Entity[]>([])
  const dependencyRenderTokenRef = useRef(0)
  const selectedAccentRef = useRef<Cesium.Entity[]>([])
  
  // Refs for callback access in click handler (avoids stale closure)
  const riskZonesRef = useRef(riskZones)
  const onZoneClickRef = useRef(onZoneClick)
  const onZoneAssetClickRef = useRef(onZoneAssetClick)
  const selectedZoneRef = useRef(selectedZone)
  const rotationEnabledRef = useRef(true) // Control rotation
  const onHotspotsLoadedRef = useRef(onHotspotsLoaded)
  const focusFlownKeyRef = useRef<string | null>(null)
  const focusCoordinatesRef = useRef(focusCoordinates)
  const focusCoordinatesImmediateRef = useRef(focusCoordinatesImmediate)
  const onReadyRef = useRef(onReady)
  useEffect(() => {
    focusCoordinatesRef.current = focusCoordinates
    focusCoordinatesImmediateRef.current = focusCoordinatesImmediate
    onReadyRef.current = onReady
  }, [focusCoordinates, focusCoordinatesImmediate, onReady])
  
  // Ref for countryCompositeRisk — used inside viewMode effect without triggering re-run
  const countryCompositeRiskRef = useRef(countryCompositeRisk)
  useEffect(() => { countryCompositeRiskRef.current = countryCompositeRisk }, [countryCompositeRisk])

  // Keep refs updated
  useEffect(() => {
    riskZonesRef.current = riskZones
    onZoneClickRef.current = onZoneClick
    onZoneAssetClickRef.current = onZoneAssetClick
  }, [riskZones, onZoneClick, onZoneAssetClick])

  useEffect(() => {
    onHotspotsLoadedRef.current = onHotspotsLoaded
  }, [onHotspotsLoaded])

  useEffect(() => {
    hotspotsRef.current = hotspots
  }, [hotspots])

  const buildHotspotEntities = useCallback((viewer: Cesium.Viewer, spot: Hotspot): Cesium.Entity[] => {
    const entities: Cesium.Entity[] = []

    const position = Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, 0)
    const colors = getFireGlowColors(spot.risk)

    // Get glow color based on risk level
    const glowColor = spot.risk > 0.8
      ? { r: 1.0, g: 0.2, b: 0.0 }   // Critical - Red
      : spot.risk > 0.6
        ? { r: 1.0, g: 0.5, b: 0.0 } // High - Orange
        : spot.risk > 0.4
          ? { r: 1.0, g: 0.8, b: 0.0 } // Medium - Yellow
          : { r: 0.2, g: 0.9, b: 0.3 } // Low - Green

    const riskMultiplier = 0.7 + spot.risk * 0.3

    // Core billboard
    const coreCanvas = createEnhancedFireGlow(64, 64, 0.25 * riskMultiplier)
    const core = viewer.entities.add({
      id: `hotspot-core-bb-${spot.id}`,
      position,
      billboard: {
        image: coreCanvas,
        scale: 0.1,
        color: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, 0.25),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })
    entities.push(core)

    // Ellipse halo rings at 5km altitude so they are never occluded by terrain
    const HALO_ALTITUDE_M = 5000
    const haloPosition = Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, HALO_ALTITUDE_M)
    const haloRadii = [104000, 182000, 260000, 338000, 416000]
    const haloAlphas = [0.08, 0.06, 0.05, 0.04, 0.02]
    for (let i = 0; i < haloRadii.length; i++) {
      const radius = haloRadii[i]
      // Slightly more opacity for outer rings at higher risk (cloud/superposition effect)
      const alpha = (haloAlphas[i] ?? 0.06) * (0.75 + spot.risk * 0.35)
      const halo = viewer.entities.add({
        id: `hotspot-halo-${i}-${spot.id}`,
        position: haloPosition,
        ellipse: {
          semiMinorAxis: radius,
          semiMajorAxis: radius,
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, alpha)),
          height: HALO_ALTITUDE_M,
          outline: false,
        },
      })
      entities.push(halo)
    }

    // Center point
    const centerPointSize = spot.risk > 0.8 ? 8 : spot.risk > 0.6 ? 7 : spot.risk > 0.4 ? 6 : 5
    const center = viewer.entities.add({
      id: `hotspot-center-${spot.id}`,
      position,
      point: {
        pixelSize: centerPointSize,
        color: colors.center.withAlpha(0.15),
        outlineColor: colors.ring.withAlpha(0.18),
        outlineWidth: 1.5,
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 1e8, 0.4),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
      label: {
        text: spot.name,
        font: '13px "JetBrains Mono", monospace',
        fillColor: Cesium.Color.WHITE.withAlpha(0.9),
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1, 1e8, 0.25),
        showBackground: true,
        backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
        backgroundPadding: new Cesium.Cartesian2(6, 4),
      },
    })
    entities.push(center)

    return entities
  }, [])

  const rebuildHotspot = useCallback((spot: Hotspot) => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const entityMap = hotspotEntitiesRef.current
    const existing = entityMap.get(spot.id) ?? []
    existing.forEach((e) => {
      try {
        viewer.entities.remove(e)
      } catch { /* ignore Cesium remove */ }
    })

    const entities = buildHotspotEntities(viewer, spot)
    entityMap.set(spot.id, entities)
    hotspotEntitiesRef.current = entityMap

    applyVisibility(viewer, entityMap, hotspotsRef.current, activeRiskFilter)
    viewer.scene.requestRender()
  }, [activeRiskFilter, buildHotspotEntities])

  // Real-time risk updates stream (server-side)
  useWebSocket({
    url: '/api/v1/streaming/ws/stream',
    onMessage: (msg: any) => {
      if (msg?.type !== 'risk_update') return
      const hotspotId = String(msg.hotspot_id || '')
      const riskScore = Number(msg.risk_score)
      if (!hotspotId || !Number.isFinite(riskScore)) return

      const clamped = Math.max(0, Math.min(1, riskScore))
      const current = hotspotsRef.current.find((h) => h.id === hotspotId)
      if (!current) return

      const next: Hotspot = { ...current, risk: clamped }
      // Update Cesium entities immediately
      rebuildHotspot(next)
      // Update React state (for filters / UI state)
      setHotspots((prev) => {
        const updated = prev.map((h) => (h.id === hotspotId ? next : h))
        hotspotsRef.current = updated
        queueMicrotask(() => { onHotspotsLoadedRef.current?.(updated) })
        return updated
      })
    },
  })
  
  // Update selectedZone ref and control rotation
  useEffect(() => {
    selectedZoneRef.current = selectedZone
    // Stop rotation when zone is selected, resume when deselected
    rotationEnabledRef.current = !selectedZone
    console.log('Rotation enabled:', rotationEnabledRef.current)
  }, [selectedZone])
  
  // Pause/resume rendering when Digital Twin is open
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    
    if (paused) {
      // Stop rendering to prevent WebGL context conflicts
      viewer.useDefaultRenderLoop = false
      console.log('CesiumGlobe: Rendering paused')
    } else {
      // Resume rendering
      viewer.useDefaultRenderLoop = true
      viewer.scene.requestRender()
      console.log('CesiumGlobe: Rendering resumed')
    }
  }, [paused])

  useEffect(() => {
    if (!containerRef.current) return

    let viewer: Cesium.Viewer | null = null
    let handler: Cesium.ScreenSpaceEventHandler | null = null
    let contextLostHandler: (() => void) | null = null
    let isMounted = true

    async function initCesium() {
      try {
        // Check if container still exists and no viewer yet
        if (!containerRef.current || !isMounted || viewerRef.current) return

        // Initialize Cesium Viewer without base layer first
        viewer = new Cesium.Viewer(containerRef.current, {
          // Minimal UI - we'll add our own
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
          // Silence "Only the Google geocoder can be used with Google Photorealistic 3D Tiles" (we use Google 3D optionally, no geocoder)
          additionalOptions: { onlyUsingWithGoogleGeocoder: true },
          // No base layer initially - we'll add async
          baseLayer: false,
          // Continuous render loop (requestRenderMode:true broke entity rendering)
          requestRenderMode: false,
          maximumRenderTimeChange: Infinity,
          // Globe settings
          skyBox: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          // No terrain initially - load async
          terrainProvider: undefined,
        })

        viewerRef.current = viewer

        // Render at device pixel ratio so first frame is sharp (avoids blurry spot until mouse move)
        viewer.resolutionScale = Math.min(2, typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)

        // Verify viewer initialized correctly
        if (!viewer.scene || !viewer.entities) {
          throw new Error('Cesium Viewer failed to initialize properly')
        }

        // On WebGL context lost, remove Google 3D tileset from primitives so Cesium stops rendering the destroyed object
        const canvas = viewer.scene.canvas
        contextLostHandler = () => {
          const g = google3dTilesetRef.current
          try {
            if (g && viewer && !viewer.isDestroyed() && viewer.scene.primitives.contains(g)) viewer.scene.primitives.remove(g)
          } catch (_) { /* ignore */ }
          google3dTilesetRef.current = null
          osmBuildingsRef.current = null
        }
        canvas.addEventListener('webglcontextlost', contextLostHandler)

        // Don't mark as ready yet - wait for all resources to load
        setLoadingProgress('Initializing Globe...')
        console.log('✅ Cesium Globe initialized - loading all resources...')

        // =============================================
        // GLOBE IMAGERY - Google Earth or NASA Black Marble
        // =============================================
        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN
        
        // =============================================
        // SEQUENTIAL LOADING - Load all resources sequentially for complete initialization
        // =============================================
        
        // NASA Black Marble - Earth at Night
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          setLoadingProgress('Loading imagery...')
          const nasaBlackMarble = await Cesium.IonImageryProvider.fromAssetId(3812)
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          viewer.imageryLayers.addImageryProvider(nasaBlackMarble)
          console.log('✅ NASA Black Marble loaded')
        } catch (e) {
          console.warn('NASA imagery failed:', e)
        }
        
        // Cesium Ion streaming terrain (World Terrain asset 1) + vertex normals for lighting
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          setLoadingProgress('Loading terrain...')
          const terrainProvider = await Cesium.CesiumTerrainProvider.fromIonAssetId(1, {
            requestVertexNormals: true,
          })
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          viewer.scene.setTerrain(new Cesium.Terrain(terrainProvider))
          console.log('✅ Cesium Ion World Terrain (3D Tiles streaming) loaded')
        } catch (e) {
          console.warn('Cesium World Terrain failed:', e)
          console.log('ℹ️ Using ellipsoid terrain as fallback')
        }
        
        // OSM Buildings: loaded in background after globe is ready (see below) to avoid blocking city/hotspot display
        // =============================================
        // MINIMAL GLOBE CONFIG
        // =============================================
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        
        const globe = viewer.scene?.globe
        if (!globe) {
          throw new Error('Globe not available')
        }
        
        const scene = viewer.scene
        
        // HDR on for better quality in NASA night and Google 3D modes
        scene.highDynamicRange = true
        
        if (scene.postProcessStages?.bloom) {
          scene.postProcessStages.bloom.enabled = false
        }
        
        // =============================================
        // STARRY SKY (no geo atmosphere, no halo)
        // =============================================
        
        try {
          scene.skyBox = Cesium.SkyBox.createEarthSkyBox()
        } catch (_) {
          scene.skyBox = undefined as any
        }
        
        if (scene.sun) scene.sun.show = false
        if (scene.moon) scene.moon.show = false
        globe.enableLighting = false
        
        if (scene.skyAtmosphere) scene.skyAtmosphere.show = false
        globe.showGroundAtmosphere = false
        
        scene.backgroundColor = Cesium.Color.fromCssColorString('#0a0a0f')
        globe.baseColor = Cesium.Color.fromCssColorString('#0a0a0f')
        globe.depthTestAgainstTerrain = true

        // Prevent default double-click zoom so our climate-zone handler opens Digital Twin
        const ctrl = scene.screenSpaceCameraController
        if (ctrl?.zoomEventTypes) {
          ctrl.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]
        }
        
        console.log('✅ Stars configured')

        // =============================================
        // HOTSPOTS - HALO GLOW SYSTEM
        // Load hotspots with timeout to prevent hanging (load in background)
        // =============================================
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        
        // Load hotspots - wait for them before marking as ready
        setLoadingProgress('Loading hotspots (this may take up to 30 seconds)...')
        const loadedHotspots = await loadHotspots(scenario)
        if (!isMounted || !viewer || viewer.isDestroyed()) return
        
        setHotspots(loadedHotspots)
        
        // Create glowing hotspot entities in batches to keep UI responsive (avoids long freeze with 70+ cities)
        const entityMap = new Map<string, Cesium.Entity[]>()
        const BATCH_SIZE = 12
        let batchIndex = 0
        
        const addHotspotBatch = () => {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          const start = batchIndex
          const end = Math.min(batchIndex + BATCH_SIZE, loadedHotspots.length)
          for (let i = start; i < end; i++) {
            const spot = loadedHotspots[i]
            const entities = buildHotspotEntities(viewer!, spot)
            entityMap.set(spot.id, entities)
          }
          batchIndex = end
          if (batchIndex < loadedHotspots.length) {
            setLoadingProgress(`Loading cities ${batchIndex}/${loadedHotspots.length}...`)
            requestAnimationFrame(addHotspotBatch)
            return
          }
          hotspotEntitiesRef.current = entityMap
          queueMicrotask(() => { onHotspotsLoaded?.(loadedHotspots) })
          applyVisibility(viewer, entityMap, loadedHotspots, 'critical')
          console.log(`✅ Created glow hotspots for ${loadedHotspots.length} cities`)
          setIsReady(true)
          setLoadingProgress('Globe Ready')

          // Initial camera BEFORE onReady so the first revealed frame is already at the right position
          const focus = focusCoordinatesRef.current
          const immediate = focusCoordinatesImmediateRef.current
          if (immediate && focus && typeof focus.lat === 'number' && typeof focus.lng === 'number') {
            const range = typeof focus.height === 'number' ? focus.height : 450
            const pitchRad = Cesium.Math.toRadians(-40)
            const center = Cesium.Cartesian3.fromDegrees(focus.lng, focus.lat, 0)
            const sphere = new Cesium.BoundingSphere(center, 1)
            viewer.camera.flyToBoundingSphere(sphere, { duration: 0, offset: new Cesium.HeadingPitchRange(0, pitchRad, range) })
            rotationEnabledRef.current = false
            viewer.resolutionScale = Math.min(2, typeof window !== 'undefined' ? (window.devicePixelRatio || 1) : 1)
            if (viewer.scene.postProcessStages?.fxaa?.enabled !== undefined) viewer.scene.postProcessStages.fxaa.enabled = false
          } else {
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
              orientation: {
                heading: Cesium.Math.toRadians(0),
                pitch: Cesium.Math.toRadians(-90),
                roll: 0,
              },
            })
          }
          viewer.scene.requestRender()

          // Delay onReady until scene has rendered at full resolution and 3D tiles have refined — avoids blurry first frame
          const notifyReady = () => {
            onReadyRef.current?.()
          }
          const minDelayMs = immediate ? 1200 : 0
          if (minDelayMs > 0) {
            const v = viewer
            setTimeout(() => {
              if (!v || v.isDestroyed()) { notifyReady(); return }
              let framesLeft = 72
              const driveFrames = () => {
                const current = viewerRef.current
                if (!current || current.isDestroyed()) { notifyReady(); return }
                current.scene.requestRender()
                framesLeft--
                if (framesLeft > 0) requestAnimationFrame(driveFrames)
                else notifyReady()
              }
              requestAnimationFrame(driveFrames)
            }, minDelayMs)
          } else {
            requestAnimationFrame(() => {
              viewer.scene.requestRender()
              requestAnimationFrame(notifyReady)
            })
          }

          // Load OSM Buildings in background; do not add to scene if Google 3D is requested (one 3D layer only)
          loadOsmBuildingsInBackground(viewer, osmBuildingsRef, isMounted, setLoadingProgress, () => showGoogle3dLayerRef.current)

          // H3 layer is loaded via useEffect when showH3Layer is true

          // Smooth rotation animation (only when no zone selected)
          // + Drill-down level detection via camera height (Globe→Country→City→Asset)
          let lastTime = Date.now()
          let lastDrillLevel = 'globe'
          const rotationSpeed = 0.5
          viewer.scene.preRender.addEventListener(() => {
            const now = Date.now()
            const delta = (now - lastTime) / 1000
            lastTime = now
            if (rotationEnabledRef.current && viewer && !viewer.scene.camera.isTransforming) {
              viewer.scene.camera.rotate(
                Cesium.Cartesian3.UNIT_Z,
                Cesium.Math.toRadians(rotationSpeed * delta)
              )
            }
            // Detect drill-down level changes via camera height
            if (onDrillDownChange && viewer && !viewer.isDestroyed()) {
              const carto = viewer.camera.positionCartographic
              const height = carto.height
              let level: 'globe' | 'country' | 'city' | 'asset' = 'globe'
              if (height < 5000) level = 'asset'
              else if (height < 100000) level = 'city'
              else if (height < 3000000) level = 'country'
              if (level !== lastDrillLevel) {
                lastDrillLevel = level
                const lat = Cesium.Math.toDegrees(carto.latitude)
                const lng = Cesium.Math.toDegrees(carto.longitude)
                onDrillDownChange(level, { name: '', lat, lng })
              }
            }
          })

          // Click handler for hotspots, zones and zone assets
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas)
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          if (!viewer || viewer.isDestroyed()) return
          const pickedObject = viewer.scene.pick(click.position)
          
          if (Cesium.defined(pickedObject) && pickedObject.id) {
            const entityId = pickedObject.id.id
            const entity = pickedObject.id
            
            // Check if clicked on a zone asset
            if (entityId && entityId.startsWith('zone-asset-') && !entityId.includes('-ring')) {
              console.log('Zone asset clicked:', entityId)
              // Get asset data from entity properties
              if (entity.properties && entity.properties.assetData) {
                const assetData = entity.properties.assetData.getValue()
                console.log('Asset data:', assetData)
                onZoneAssetClickRef.current?.(assetData)
              }
              return
            }

            // Check if clicked on a risk zone (main ellipse or center marker)
            if (entityId && (entityId.startsWith('zone-') || entityId.startsWith('zone-center-'))) {
              if (entityId.includes('-pulse') || entityId.includes('-ring')) {
                return // Ignore pulse/ring elements
              }
              
              // Extract zone id
              let zoneId = entityId
              if (entityId.startsWith('zone-center-')) {
                zoneId = entityId.replace('zone-center-', '')
              } else if (entityId.startsWith('zone-')) {
                zoneId = entityId.replace('zone-', '')
              }
              
              console.log('Zone clicked:', zoneId)
              
              // Find the zone in riskZones array (use ref for current value)
              const clickedZone = riskZonesRef.current.find(z => z.id === zoneId)
              if (clickedZone) {
                onZoneClickRef.current?.(clickedZone)
              }
              return
            }
            
            // Dependency endpoint marker click (treat as hotspot selection)
            if (entityId && entityId.startsWith('dependency-node-')) {
              const cityId = entityId.replace('dependency-node-', '')
              onAssetSelect?.(cityId)
              return
            }

            // Hotspot click (including rings/pulses) - extract city ID from entity ID
            // Entity IDs have format: hotspot-center-{city_id}, hotspot-core-bb-{city_id}, hotspot-halo-{i}-{city_id}, etc.
            if (entityId && entityId.startsWith('hotspot-')) {
              const cityId = extractHotspotIdFromEntityId(entityId)
              if (!cityId) return

              console.log('Hotspot clicked, entity:', entityId, '-> city:', cityId)
              onAssetSelect?.(cityId)

              // Fly to the hotspot center if available
              const centerEntityId = `hotspot-center-${cityId}`
              const targetEntity = viewer.entities.getById(centerEntityId) || viewer.entities.getById(entityId)
              if (targetEntity && targetEntity.position) {
                viewer.flyTo(targetEntity, {
                  duration: 2,
                  offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000),
                })
              }
              return
            }

            // Country-mode city marker click (from cities-by-country.json)
            if (entityId && typeof entityId === 'string' && entityId.startsWith('country-city-')) {
              const cityId = entityId.replace('country-city-', '')
              const name = typeof entity.name === 'string' ? entity.name : ''
              const countryCode = cityId.length >= 2 ? cityId.slice(0, 2) : ''
              const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
              if (pos && onCityClickRef.current) {
                const carto = Cesium.Cartographic.fromCartesian(pos)
                const lat = Cesium.Math.toDegrees(carto.latitude)
                const lng = Cesium.Math.toDegrees(carto.longitude)
                onCityClickRef.current({
                  id: cityId,
                  name: name || cityId,
                  lat,
                  lng,
                  countryCode: countryCode || selectedCountryCode || '',
                })
              }
              return
            }

            // Country boundary polygon click (from GeoJSON DataSource)
            if (entity.properties) {
              const isoA2 = entity.properties['ISO3166-1-Alpha-2']?.getValue?.()
              const countryName = entity.properties['name']?.getValue?.()
              if (isoA2 && countryName && onCountryClickRef.current) {
                // Get position from entity
                const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
                let lat = 0, lng = 0
                if (pos) {
                  const carto = Cesium.Cartographic.fromCartesian(pos)
                  lat = Cesium.Math.toDegrees(carto.latitude)
                  lng = Cesium.Math.toDegrees(carto.longitude)
                }
                onCountryClickRef.current({ code: isoA2, name: countryName, lat, lng })
                return
              }
            }
          } else {
            onAssetSelect?.(null)
          }
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        // Double-click on climate risk zone (blue marker) or on climate layer polygon -> open Digital Twin for that city
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          if (!viewer || viewer.isDestroyed()) return
          const pickedObject = viewer.scene.pick(click.position)
          if (!Cesium.defined(pickedObject) || !pickedObject.id) return
          const entity = pickedObject.id
          const entityId = entity.id

          const isClimateMarker = typeof entityId === 'string' && entityId.startsWith('climate-risk-')
          const isClimateLayer = typeof entityId === 'string' && (
            entityId.startsWith('flood-forecast-') ||
            entityId.startsWith('wind-forecast-') ||
            entityId.startsWith('heat-forecast-') ||
            entityId.startsWith('heavy-rain-forecast-') ||
            entityId.startsWith('drought-forecast-') ||
            entityId.startsWith('uv-forecast-')
          )
          const isH3Cell = typeof entityId === 'string' && entityId.startsWith('h3-cell-')
          const isEarthquakeZone = typeof entityId === 'string' && entityId.startsWith('earthquake-zone-')

          if (isEarthquakeZone) {
            const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
            const name = typeof entity.name === 'string' ? entity.name : ''
            const cityName = name.replace(/^Earthquake M[\d.]+:\s*/i, '').trim() || 'Earthquake zone'
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              const lat = Cesium.Math.toDegrees(carto.latitude)
              const lng = Cesium.Math.toDegrees(carto.longitude)
              onClimateZoneDoubleClickRef.current?.({ cityName, lat, lng, riskType: 'earthquake' })
            }
            return
          }

          if (isH3Cell) {
            const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              const lat = Cesium.Math.toDegrees(carto.latitude)
              const lng = Cesium.Math.toDegrees(carto.longitude)
              viewer.camera.flyTo({
                destination: Cesium.Cartesian3.fromDegrees(lng, lat, 80000),
                orientation: {
                  heading: 0,
                  pitch: Cesium.Math.toRadians(-60),
                  roll: 0,
                },
                duration: 1.2,
              })
            }
            return
          }

          const isClimateHalo = typeof entityId === 'string' && entityId.startsWith('climate-halo-')
          if (isClimateHalo) {
            const parts = (entityId as string).split('-')
            const cityPart = parts.slice(3).join('-')
            const cityName = cityPart.replace(/_/g, ' ')
            const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
            if (pos && cityName) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              const lat = Cesium.Math.toDegrees(carto.latitude)
              const lng = Cesium.Math.toDegrees(carto.longitude)
              onClimateZoneDoubleClickRef.current?.({ cityName, lat, lng })
            }
            return
          }

          const isMetroFlood = typeof entityId === 'string' && entityId.startsWith('metro-flood-')
          if (isMetroFlood) {
            const rest = (entityId as string).replace('metro-flood-', '')
            const cityPart = rest.includes('::') ? rest.split('::')[0] : rest.split('-')[0]
            const cityName = (cityPart || rest).replace(/_/g, ' ')
            const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              const lat = Cesium.Math.toDegrees(carto.latitude)
              const lng = Cesium.Math.toDegrees(carto.longitude)
              onClimateZoneDoubleClickRef.current?.({ cityName, lat, lng, riskType: 'metro' })
            }
            return
          }

          if (!isClimateMarker && !isClimateLayer) return

          let cityName = typeof entity.name === 'string' ? entity.name : ''
          let riskType: string | undefined
          if (isClimateMarker && entityId.startsWith('climate-risk-')) {
            cityName = (entityId as string).replace('climate-risk-', '').replace(/_/g, ' ')
            riskType = undefined
          } else if (isClimateLayer && cityName) {
            if (entityId.startsWith('flood-forecast-')) riskType = 'flood'
            else if (entityId.startsWith('wind-forecast-')) riskType = 'wind'
            else if (entityId.startsWith('heat-forecast-')) riskType = 'heat'
            else if (entityId.startsWith('heavy-rain-forecast-')) riskType = 'heavy_rain'
            else if (entityId.startsWith('drought-forecast-')) riskType = 'drought'
            else if (entityId.startsWith('uv-forecast-')) riskType = 'uv'
            else riskType = undefined
            cityName = cityName.replace(/^(Flood|Wind|Heat|Heavy rain|Drought|UV):\s*/i, '').trim()
          }
          if (!cityName) return

          let lat = 0
          let lng = 0
          const pos = entity.position?.getValue?.(Cesium.JulianDate.now())
          if (pos) {
            const carto = Cesium.Cartographic.fromCartesian(pos)
            lat = Cesium.Math.toDegrees(carto.latitude)
            lng = Cesium.Math.toDegrees(carto.longitude)
          } else {
            for (const arr of Object.values(DISASTER_LAYER_HOTSPOTS)) {
              if (!Array.isArray(arr)) continue
              const found = arr.find((h) => h.name === cityName || h.name.replace(/\s+/g, '_') === cityName.replace(/\s+/g, '_'))
              if (found) {
                lat = found.lat
                lng = found.lng
                break
              }
            }
          }
          onClimateZoneDoubleClickRef.current?.({ cityName, lat, lng, riskType })
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
        }
        requestAnimationFrame(addHotspotBatch)
      } catch (err) {
        console.error('Cesium initialization error:', err)
        setError(err instanceof Error ? err.message : 'Failed to initialize globe')
      }
    }

    initCesium()

    // Cleanup: clear tileset refs and remove context-lost listener
    return () => {
      isMounted = false
      if (viewer && !viewer.isDestroyed() && viewer.scene?.canvas && contextLostHandler) {
        viewer.scene.canvas.removeEventListener('webglcontextlost', contextLostHandler)
      }
      if (handler) handler.destroy()
      if (viewer && !viewer.isDestroyed()) viewer.destroy()
      viewerRef.current = null
      google3dTilesetRef.current = null
      osmBuildingsRef.current = null
    }
  }, [scenario]) // Reinit when scenario changes

  // Handle selected asset changes
  useEffect(() => {
    if (!viewerRef.current || !selectedAsset) return
    
    const centerEntityId = `hotspot-center-${selectedAsset}`
    const entity =
      viewerRef.current.entities.getById(centerEntityId) ||
      viewerRef.current.entities.getById(`hotspot-core-bb-${selectedAsset}`)
    if (entity) {
      viewerRef.current.flyTo(entity, {
        duration: 2,
        offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), 2000000),
      })
    }
  }, [selectedAsset])

  // Quantum aesthetics: one cyan glow accent on the selected hotspot only
  const QUANTUM_GLOW_CYAN = { r: 6 / 255, g: 182 / 255, b: 212 / 255 }
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    selectedAccentRef.current.forEach((e) => {
      try { viewer.entities.remove(e) } catch (_) { /* ignore */ }
    })
    selectedAccentRef.current = []
    const idToShow = focusedHotspotId ?? selectedAsset
    if (!idToShow || viewMode === 'country') {
      viewer.scene.requestRender()
      return
    }
    const spot = hotspotsRef.current.find((h) => h.id === idToShow)
    if (!spot) {
      viewer.scene.requestRender()
      return
    }
    const shouldShow = (risk: number): boolean => {
      if (!activeRiskFilter) return true
      switch (activeRiskFilter) {
        case 'critical': return risk > 0.8
        case 'high': return risk > 0.6 && risk <= 0.8
        case 'medium': return risk > 0.4 && risk <= 0.6
        case 'low': return risk <= 0.4
        default: return false
      }
    }
    const visible = shouldShow(spot.risk)
    const HALO_ALTITUDE_M = 5000
    const pos = Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, HALO_ALTITUDE_M)
    const radii = [70000, 140000]
    const alphas = [0.18, 0.08]
    for (let i = 0; i < radii.length; i++) {
      const e = viewer.entities.add({
        id: `hotspot-accent-${i}-${idToShow}`,
        position: pos,
        ellipse: {
          semiMinorAxis: radii[i],
          semiMajorAxis: radii[i],
          material: new Cesium.ColorMaterialProperty(new Cesium.Color(QUANTUM_GLOW_CYAN.r, QUANTUM_GLOW_CYAN.g, QUANTUM_GLOW_CYAN.b, alphas[i])),
          height: HALO_ALTITUDE_M,
          outline: false,
        },
      })
      e.show = visible
      selectedAccentRef.current.push(e)
    }
    viewer.scene.requestRender()
  }, [selectedAsset, focusedHotspotId, activeRiskFilter, viewMode])

  // Handle reset view trigger - zoom out to global view
  useEffect(() => {
    if (!viewerRef.current || resetViewTrigger === undefined || resetViewTrigger === 0) return
    
    console.log('CesiumGlobe: Resetting to global view')
    viewerRef.current.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(20, 20, 25000000),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-90),
        roll: 0,
      },
      duration: 1.5,
    })
  }, [resetViewTrigger])

  // Map risk score 0–1 to hex color (green → yellow → red)
  const riskScoreToCssColor = useCallback((score: number): string => {
    if (score <= 0) return '#22c55e'
    if (score >= 1) return '#ef4444'
    if (score <= 0.33) return '#22c55e'
    if (score <= 0.66) return '#eab308'
    return '#f97316'
  }, [])

  // H3 Hex Grid layer - load when showH3Layer is true, remove when false
  // When h3VectorDimension is set, color by that probability (p_agi, p_bio, etc.); else aggregate risk_score
  // When timeSliderValue is set, use risk-at-time API for temporal replay
  // Hide in country mode to avoid stray markers (e.g. at pole)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    if (!showH3Layer || viewMode === 'country') {
      h3EntitiesRef.current.forEach((e) => { try { viewer.entities.remove(e) } catch (_) { /* ignore */ } })
      h3EntitiesRef.current = []
      viewer.scene.requestRender()
      return
    }

    const vecKey = h3VectorDimension && ['p_agi', 'p_bio', 'p_nuclear', 'p_climate', 'p_financial'].includes(h3VectorDimension) ? h3VectorDimension : null
    const url = (timeSliderValue
      ? `${apiPrefix()}/h3/risk-at-time?timestamp=${encodeURIComponent(timeSliderValue)}&tolerance_hours=1`
      : `${apiPrefix()}/h3/hexgrid?resolution=${h3Resolution}`) + (vecKey ? `&dim=${encodeURIComponent(vecKey)}` : '')
    const requestId = ++h3RequestIdRef.current
    fetch(url, { cache: 'no-store' })
      .then((res) => (res.ok ? res.json() : null))
      .then((h3Data) => {
        if (requestId !== h3RequestIdRef.current) return
        if (!h3Data || !viewerRef.current || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        const applyVecKey = vecKey
        h3EntitiesRef.current.forEach((e) => { try { v.entities.remove(e) } catch (_) { /* ignore */ } })
        h3EntitiesRef.current = []
        const cells = h3Data.cells || []
        for (const cell of cells) {
          if (!cell.boundary || cell.boundary.length < 3) continue
          const positions = cell.boundary.flatMap((pt: number[]) => [pt[1], pt[0]])
          const lngs = cell.boundary.map((pt: number[]) => pt[0])
          const lats = cell.boundary.map((pt: number[]) => pt[1])
          const cenLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length
          const cenLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length
          let fillColor = cell.color || '#22c55e'
          let scoreForHeight = cell.risk_score ?? 0
          const rv = cell.risk_vector ?? (cell as Record<string, unknown>).riskVector ?? (cell as Record<string, unknown>).risk_vector
          const pVal = rv != null && applyVecKey ? (rv as Record<string, number>)[applyVecKey] : undefined
          if (applyVecKey) {
            if (typeof pVal === 'number') {
              fillColor = riskScoreToCssColor(pVal)
              scoreForHeight = pVal
            } else {
              const dimTint: Record<string, string> = { p_agi: '#6366f1', p_bio: '#ec4899', p_nuclear: '#f59e0b', p_climate: '#22c55e', p_financial: '#eab308' }
              fillColor = dimTint[applyVecKey] ?? fillColor
            }
          }
          const entity = v.entities.add({
            id: `h3-cell-${cell.h3_index}-${requestId}`,
            name: `H3: ${cell.h3_index}`,
            position: Cesium.Cartesian3.fromDegrees(cenLng, cenLat, 0),
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(positions),
              material: Cesium.Color.fromCssColorString(fillColor).withAlpha(0.35),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(fillColor).withAlpha(0.6),
              outlineWidth: 1,
              height: 0,
              extrudedHeight: Math.max(1000, scoreForHeight * 50000),
            },
            properties: new Cesium.PropertyBag({
              h3_index: cell.h3_index,
              risk_score: cell.risk_score,
              risk_level: cell.risk_level,
              risk_vector: cell.risk_vector,
              type: 'h3_cell',
            }),
          })
          h3EntitiesRef.current.push(entity)
        }
        const sampleColor = cells.length ? (() => {
          const c = cells[0]
          const rv = c?.risk_vector ?? (c as Record<string, unknown>)?.riskVector
          const p = rv && applyVecKey ? (rv as Record<string, number>)[applyVecKey] : undefined
          return { applyVecKey, sampleP: p, cells: cells.length }
        })() : null
        console.log(`H3 hex layer loaded: ${cells.length} cells at resolution ${h3Resolution}${applyVecKey ? ` (vector: ${applyVecKey})` : ''}`, sampleColor)
        v.scene.requestRender()
        requestAnimationFrame(() => { if (!viewerRef.current?.isDestroyed()) viewerRef.current?.scene.requestRender() })
      })
      .catch((e) => console.warn('H3 hex layer load failed:', e))
  }, [showH3Layer, h3Resolution, h3VectorDimension, isReady, riskScoreToCssColor, timeSliderValue, viewMode])

  // CZML: load cascade animation (or other time-dynamic data) on the globe
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    if (!czmlUrl || !czmlUrl.trim()) {
      const ds = czmlDataSourceRef.current
      if (ds && viewer.dataSources.contains(ds)) {
        viewer.dataSources.remove(ds)
        czmlDataSourceRef.current = null
        viewer.scene.requestRender()
      }
      return
    }

    const url = czmlUrl.trim()
    Cesium.CzmlDataSource.load(url, { clampToGround: false })
      .then((dataSource) => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return
        const prev = czmlDataSourceRef.current
        if (prev && viewer.dataSources.contains(prev)) viewer.dataSources.remove(prev)
        viewer.dataSources.add(dataSource)
        czmlDataSourceRef.current = dataSource
        viewer.scene.requestRender()
        console.log('✅ CZML loaded on globe:', url)
      })
      .catch((e) => console.warn('CZML load failed:', e))

    return () => {
      const v = viewerRef.current
      if (!v || v.isDestroyed()) return
      const ds = czmlDataSourceRef.current
      if (ds) {
        try {
          if (v.dataSources.contains(ds)) v.dataSources.remove(ds)
        } catch (_) { /* viewer may be tearing down */ }
        czmlDataSourceRef.current = null
      }
    }
  }, [czmlUrl, isReady])

  // Stress test 4D CZML: load and enable clock playback
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    if (!stressTestCzmlUrl || !stressTestCzmlUrl.trim()) {
      const ds = stressTestCzmlDataSourceRef.current
      if (ds && viewer.dataSources.contains(ds)) {
        viewer.dataSources.remove(ds)
        stressTestCzmlDataSourceRef.current = null
      }
      stressTestClockRangeRef.current = null
      setStressTestClockRange(null)
      setStressTestClockTime(null)
      setStressTestScrubPct(0)
      if (stressTestClockRAFRef.current != null) {
        cancelAnimationFrame(stressTestClockRAFRef.current)
        stressTestClockRAFRef.current = null
      }
      return
    }

    const url = stressTestCzmlUrl.trim()
    Cesium.CzmlDataSource.load(url, { clampToGround: false })
      .then((dataSource: Cesium.CzmlDataSource) => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return
        const prev = stressTestCzmlDataSourceRef.current
        if (prev && viewer.dataSources.contains(prev)) viewer.dataSources.remove(prev)
        viewer.dataSources.add(dataSource)
        stressTestCzmlDataSourceRef.current = dataSource
        // Apply CZML document clock so 4D timeline runs in T0→T+12m (time-varying zones)
        const dsClock = (dataSource as any).clock
        if (dsClock && dsClock.startTime && dsClock.stopTime) {
          viewer.clock.startTime = dsClock.startTime.clone()
          viewer.clock.stopTime = dsClock.stopTime.clone()
          viewer.clock.currentTime = (dsClock.currentTime && dsClock.currentTime.clone) ? dsClock.currentTime.clone() : dsClock.startTime.clone()
          if (dsClock.clockRange != null) viewer.clock.clockRange = dsClock.clockRange
          if (dsClock.multiplier != null) viewer.clock.multiplier = dsClock.multiplier
        }
        viewer.clock.shouldAnimate = true
        viewer.clock.multiplier = 3600
        viewer.clock.clockRange = (Cesium as any).ClockRange.CLAMPED
        setStressTestClockPlaying(true)
        setStressTestClockMultiplier(3600)
        const start = Cesium.JulianDate.toDate(viewer.clock.startTime).getTime()
        const end = Cesium.JulianDate.toDate(viewer.clock.stopTime).getTime()
        const range = { start, end }
        stressTestClockRangeRef.current = range
        setStressTestClockRange(range)
        viewer.scene.requestRender()
        console.log('✅ Stress test 4D CZML loaded:', url)
      })
      .catch((e) => console.warn('Stress test CZML load failed:', e))

    return () => {
      const v = viewerRef.current
      if (!v || v.isDestroyed()) return
      const ds = stressTestCzmlDataSourceRef.current
      if (ds) {
        try {
          if (v.dataSources.contains(ds)) v.dataSources.remove(ds)
        } catch (_) { /* ignore */ }
        stressTestCzmlDataSourceRef.current = null
      }
      setStressTestClockTime(null)
      if (stressTestClockRAFRef.current != null) {
        cancelAnimationFrame(stressTestClockRAFRef.current)
        stressTestClockRAFRef.current = null
      }
    }
  }, [stressTestCzmlUrl, isReady])

  // Update displayed clock time when stress test CZML is active
  useEffect(() => {
    if (!stressTestCzmlUrl?.trim() || !isReady) return
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const tick = () => {
      const v = viewerRef.current
      if (!v || v.isDestroyed()) return
      const stopTime = v.clock.stopTime
      let current = v.clock.currentTime
      if (current && stopTime && Cesium.JulianDate.compare(current, stopTime) >= 0) {
        current = stopTime
        v.clock.currentTime = stopTime
        v.clock.shouldAnimate = false
        setStressTestClockPlaying(false)
      }
      if (current) {
        const d = Cesium.JulianDate.toGregorianDate(current)
        setStressTestClockTime(
          `${String(d.year).padStart(4, '0')}-${String(d.month).padStart(2, '0')}-${String(d.day).padStart(2, '0')} ${String(d.hour).padStart(2, '0')}:${String(d.minute).padStart(2, '0')}`
        )
        if (!stressTestScrubDraggingRef.current && stressTestClockRangeRef.current) {
          const start = stressTestClockRangeRef.current.start
          const end = stressTestClockRangeRef.current.end
          const t = Cesium.JulianDate.toDate(current).getTime()
          const pct = end > start ? Math.max(0, Math.min(100, ((t - start) / (end - start)) * 100)) : 0
          setStressTestScrubPct(pct)
        }
      }
      stressTestClockRAFRef.current = requestAnimationFrame(tick)
    }
    stressTestClockRAFRef.current = requestAnimationFrame(tick)
    return () => {
      if (stressTestClockRAFRef.current != null) {
        cancelAnimationFrame(stressTestClockRAFRef.current)
        stressTestClockRAFRef.current = null
      }
    }
  }, [stressTestCzmlUrl, isReady])

  // Toggle Google Photorealistic 3D layer vs OSM buildings. When paused (Digital Twin open), remove Google 3D to avoid two WebGL-heavy viewers and "object does not belong to this context" errors.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    const primitives = viewer.scene.primitives
    const safeRemove = (t: Cesium.Cesium3DTileset | null) => {
      if (!t) return
      if (typeof (t as any).isDestroyed === 'function' && (t as any).isDestroyed()) {
        try { if (primitives.contains(t)) primitives.remove(t) } catch (_) { /* ignore */ }
        if (t === google3dTilesetRef.current) google3dTilesetRef.current = null
        if (t === osmBuildingsRef.current) osmBuildingsRef.current = null
      }
    }

    // Remove any destroyed tileset from primitives first (e.g. after WebGL context lost)
    safeRemove(google3dTilesetRef.current)
    safeRemove(osmBuildingsRef.current)

    const osm = osmBuildingsRef.current
    const googleTileset = google3dTilesetRef.current

    // When globe is paused (e.g. Digital Twin open), show only OSM to avoid WebGL context conflicts
    const wantGoogle = showGoogle3dLayer && !paused

    // When Google 3D is on, hide the night globe so only photorealistic 3D Tiles are visible (no pixelated mix)
    try {
      viewer.scene.globe.show = !wantGoogle
    } catch (_) { /* ignore */ }

    if (wantGoogle) {
      // Only Google 3D Photorealistic for flood/city — remove OSM so they are not both visible
      if (osm && typeof (osm as any).isDestroyed === 'function' && !(osm as any).isDestroyed() && primitives.contains(osm)) {
        primitives.remove(osm)
      }
      const addGoogle = async () => {
        const current = google3dTilesetRef.current
        if (current && typeof (current as any).isDestroyed === 'function' && !(current as any).isDestroyed()) {
          if (!primitives.contains(current)) primitives.add(current)
          if (osm && typeof (osm as any).isDestroyed === 'function' && !(osm as any).isDestroyed() && primitives.contains(osm)) primitives.remove(osm)
          return
        }
        if (current && (typeof (current as any).isDestroyed === 'function' && (current as any).isDestroyed())) google3dTilesetRef.current = null
        try {
          const createGoogle = (Cesium as any).createGooglePhotorealistic3DTileset
          const apiOpts = { onlyUsingWithGoogleGeocoder: true }
          const tilesetOpts = {
            showCreditsOnScreen: true,
            maximumScreenSpaceError: 4,
            maximumMemoryUsage: 1024,
          }
          if (viewerRef.current && !viewerRef.current.isDestroyed()) {
            viewerRef.current.scene.highDynamicRange = true
          }
          const tileset = typeof createGoogle === 'function'
            ? await createGoogle(apiOpts, tilesetOpts)
            : await Cesium.Cesium3DTileset.fromIonAssetId(CESIUM_ION_GOOGLE_PHOTOREALISTIC, tilesetOpts)
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          if (typeof (tileset as any).isDestroyed === 'function' && (tileset as any).isDestroyed()) return
          google3dTilesetRef.current = tileset
          primitives.add(tileset)
          if (osm && typeof (osm as any).isDestroyed === 'function' && !(osm as any).isDestroyed() && primitives.contains(osm)) primitives.remove(osm)
          console.log('✅ Google Photorealistic 3D Tiles enabled on globe')
        } catch (e) {
          console.warn('Google Photorealistic 3D failed:', e)
        }
      }
      addGoogle()
    } else {
      if (googleTileset && typeof (googleTileset as any).isDestroyed === 'function' && !(googleTileset as any).isDestroyed() && primitives.contains(googleTileset)) primitives.remove(googleTileset)
      if (osm && typeof (osm as any).isDestroyed === 'function' && !(osm as any).isDestroyed() && !primitives.contains(osm)) primitives.add(osm)
    }
  }, [showGoogle3dLayer, isReady, paused])

  // Fly to coordinates when set; center view on exact city coords so city stays in screen center.
  // Fly only once per focus key to avoid double zoom (e.g. Portfolio Globe: one smooth fly to asset).
  useEffect(() => {
    if (!focusCoordinates) {
      focusFlownKeyRef.current = null
      return
    }
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    const { lat, lng } = focusCoordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const key = `${lat.toFixed(6)},${lng.toFixed(6)},${city3DView}`
    if (focusFlownKeyRef.current === key) return
    focusFlownKeyRef.current = key
    const explicitHeight = typeof (focusCoordinates as { height?: number }).height === 'number' ? (focusCoordinates as { height: number }).height : undefined
    const range = explicitHeight ?? (city3DView ? 2500 : 35000)
    if (city3DView) rotationEnabledRef.current = false
    const pitchRad = Cesium.Math.toRadians(city3DView ? -40 : -50)
    const center = Cesium.Cartesian3.fromDegrees(lng, lat, 0)
    const sphere = new Cesium.BoundingSphere(center, 1)
    const duration = focusCoordinatesImmediate ? 0 : 1.5
    const doFly = () => {
      const v = viewerRef.current
      if (!v || v.isDestroyed()) return
      v.camera.flyToBoundingSphere(sphere, {
        duration,
        offset: new Cesium.HeadingPitchRange(0, pitchRad, range),
      })
    }
    const id = requestAnimationFrame(() => {
      doFly()
    })
    return () => cancelAnimationFrame(id)
  }, [isReady, focusCoordinates?.lat, focusCoordinates?.lng, (focusCoordinates as { height?: number })?.height, city3DView, focusCoordinatesImmediate])

  // Notify parent when hotspots are loaded (defer to avoid "Cannot update component while rendering" in React)
  useEffect(() => {
    if (hotspots.length > 0) {
      const cb = onHotspotsLoaded
      if (cb) queueMicrotask(() => cb(hotspots))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots])

  // Handle activeRiskFilter - show/hide hotspots based on risk level. Hide global hotspots in country mode.
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (viewMode === 'country') {
      hotspots.forEach((spot) => {
        const entities = hotspotEntitiesRef.current.get(spot.id)
        entities?.forEach((e) => { e.show = false })
      })
      if (!viewer.isDestroyed()) viewer.scene.requestRender()
    } else {
      applyVisibility(viewer, hotspotEntitiesRef.current, hotspots, activeRiskFilter)
    }
  }, [activeRiskFilter, hotspots, viewMode])

  // Handle selected zone - zoom to zone and show assets
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Remove previous asset entities
    assetEntitiesRef.current.forEach(entity => {
      try {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity)
        }
      } catch (e) {
        // Entity may already be removed
      }
    })
    assetEntitiesRef.current = []

    if (!selectedZone) {
      // Just return without flying - let camera stay where it is
      // User can manually navigate or select another zone
      return
    }

    console.log('CesiumGlobe: Zooming to zone', selectedZone.name)

    // Calculate camera height based on zone radius
    const zoomHeight = Math.max(selectedZone.radius_km * 1000 * 4, 100000)

    // Fly to zone center
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        selectedZone.center_longitude,
        selectedZone.center_latitude,
        zoomHeight
      ),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-60), // Angled view to see terrain
        roll: 0,
      },
      duration: 2,
    })

    // Add assets within this zone as markers
    if (selectedZone.assets && selectedZone.assets.length > 0) {
      selectedZone.assets.forEach((asset, _index) => {
        const color = getAssetTypeColor(asset.type)
        
        // Asset marker
        const assetEntity = viewer.entities.add({
          id: `zone-asset-${asset.id}`,
          name: asset.name,
          position: Cesium.Cartesian3.fromDegrees(
            asset.longitude,
            asset.latitude,
            0
          ),
          point: {
            pixelSize: 14 + asset.impactSeverity * 10,
            color: color,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.5, 1e6, 0.5),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
          label: {
            text: asset.name,
            font: '11px "JetBrains Mono", monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            fillColor: Cesium.Color.WHITE,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -18),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, zoomHeight * 2),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
            backgroundPadding: new Cesium.Cartesian2(4, 2),
          },
          // Store asset data for click handling
          properties: {
            assetData: asset,
          },
        })
        assetEntitiesRef.current.push(assetEntity)
        
        // No extra rings - keep it simple
      })
    }

    // Force render update
    viewer.scene.requestRender()

  }, [selectedZone])

  // Handle risk zones from stress tests
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    // Remove previous zone entities
    zoneEntitiesRef.current.forEach(entity => {
      try {
        if (viewer.entities.contains(entity)) {
          viewer.entities.remove(entity)
        }
      } catch (e) {
        // Entity may already be removed
      }
    })
    zoneEntitiesRef.current = []

    // Add new zone entities (drawn in all view modes so climate stress test zones are visible in country/city view)
    if (riskZones.length === 0) return

    // Low altitude to avoid crescent effect on globe curvature
    const ZONE_ALTITUDE_M = 500

    riskZones.forEach((zone, index) => {
      const color = getZoneLevelColor(zone.zone_level ?? 'medium')
      const c1 = color && typeof color.clone === 'function' ? color : Cesium.Color.fromCssColorString('#22ff66')
      // Desaturate toward gray (avoid Color.lerp to prevent Cesium DeveloperError when result/args are undefined)
      const t = 0.4
      const g = 0.5
      const softColor = new Cesium.Color(
        c1.red * (1 - t) + g * t,
        c1.green * (1 - t) + g * t,
        c1.blue * (1 - t) + g * t,
        c1.alpha
      )
      const baseRadius = zone.radius_km * 1000
      const position = Cesium.Cartesian3.fromDegrees(zone.center_longitude, zone.center_latitude, ZONE_ALTITUDE_M)

      // Multiple concentric halos: reduced brightness ~40% for comfort
      const haloScales = [1.0, 1.5, 2.0, 2.5]
      const haloAlphas = [0.06, 0.05, 0.03, 0.02]
      for (let i = 0; i < haloScales.length; i++) {
        const halo = viewer.entities.add({
          id: `zone-halo-${i}-${zone.id}`,
          position,
          ellipse: {
            semiMajorAxis: baseRadius * haloScales[i],
            semiMinorAxis: baseRadius * haloScales[i],
            height: ZONE_ALTITUDE_M,
            material: new Cesium.ColorMaterialProperty(softColor.withAlpha(haloAlphas[i])),
            outline: false,
          },
        })
        zoneEntitiesRef.current.push(halo)
      }

      // Center point marker with label
      const zoneEntity = viewer.entities.add({
        id: `zone-${zone.id}`,
        name: zone.name || `Risk Zone ${index + 1}`,
        position,
        point: {
          pixelSize: 12,
          color: c1,
          outlineColor: Cesium.Color.WHITE,
          outlineWidth: 2,
        },
        label: {
          text: zone.name || `Zone ${index + 1}`,
          font: '13px "JetBrains Mono", monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -12),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
        },
      })
      zoneEntitiesRef.current.push(zoneEntity)
    })

    // Force render update
    viewer.scene.requestRender()

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        zoneEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      zoneEntitiesRef.current = []
    }
  }, [riskZones, viewMode])

  // Blue climate-risk markers: concentric halo rings like red hotspots (glow effect, not flat disc)
  const CLIMATE_HALO_ALTITUDE_M = 500 // Low altitude to avoid crescent effect
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    try {
      climateRiskMarkersRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
    } catch (_) {}
    climateRiskMarkersRef.current = []

    const layers: { on: boolean; key: string }[] = [
      { on: !!showFloodLayer, key: 'flood' },
      { on: !!showWindLayer, key: 'wind' },
      { on: !!showMetroFloodLayer, key: 'metro' },
      { on: !!showHeatLayer, key: 'heat' },
      { on: !!showHeavyRainLayer, key: 'heavy_rain' },
      { on: !!showDroughtLayer, key: 'drought' },
      { on: !!showUvLayer, key: 'uv' },
    ]
    const activeKeys = layers.filter((l) => l.on).map((l) => l.key)
    if (activeKeys.length === 0) {
      viewer.scene.requestRender()
      return
    }

    // Blue glow color
    const blueR = 0.15
    const blueG = 0.39
    const blueB = 0.92

    // Concentric halo radii and alphas (reduced ~40% for comfort)
    const haloRadii = [85000, 130000, 180000, 230000]
    const haloAlphas = [0.11, 0.08, 0.04, 0.03]

    const seen = new Set<string>()
    const MAX_LAT = 84 // исключить маркеры над полюсом
    activeKeys.forEach((key) => {
      const hotspots = DISASTER_LAYER_HOTSPOTS[key as keyof typeof DISASTER_LAYER_HOTSPOTS]
      if (!Array.isArray(hotspots)) return
      hotspots.forEach(({ lat, lng, name }) => {
        if (Math.abs(lat) > MAX_LAT) return
        const key2 = `${lat.toFixed(4)}-${lng.toFixed(4)}`
        if (seen.has(key2)) return
        seen.add(key2)
        const safeId = name.replace(/\s+/g, '_').replace(/,/g, '')
        const position = Cesium.Cartesian3.fromDegrees(lng, lat, CLIMATE_HALO_ALTITUDE_M)

        // Multiple concentric halo rings (glow effect)
        for (let i = 0; i < haloRadii.length; i++) {
          const halo = viewer.entities.add({
            id: `climate-halo-${i}-${safeId}`,
            position,
            ellipse: {
              semiMajorAxis: haloRadii[i],
              semiMinorAxis: haloRadii[i],
              height: CLIMATE_HALO_ALTITUDE_M,
              material: new Cesium.Color(blueR, blueG, blueB, haloAlphas[i]),
              outline: false,
            },
          })
          climateRiskMarkersRef.current.push(halo)
        }

        // Label only (no center point)
        const center = viewer.entities.add({
          id: `climate-risk-${safeId}`,
          name,
          position,
          label: {
            text: name,
            font: '12px "JetBrains Mono", monospace',
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            fillColor: Cesium.Color.WHITE,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            pixelOffset: new Cesium.Cartesian2(0, 0),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12000000),
            showBackground: true,
            backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
            backgroundPadding: new Cesium.Cartesian2(4, 2),
          },
        })
        climateRiskMarkersRef.current.push(center)
      })
    })
    if (climateRiskMarkersRef.current.length > 0) {
      console.log('[CesiumGlobe] Climate markers: %d entities (concentric halos)', climateRiskMarkersRef.current.length)
    }
    viewer.scene.requestRender()
    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        climateRiskMarkersRef.current.forEach((e) => {
          try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {}
        })
      }
      climateRiskMarkersRef.current = []
    }
  }, [showFloodLayer, showWindLayer, showMetroFloodLayer, showHeatLayer, showHeavyRainLayer, showDroughtLayer, showUvLayer])

  // Flood layer: show at multiple risk cities (not just NYC)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!showFloodLayer) {
      floodEntitiesRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
      floodEntitiesRef.current = []
      return
    }
    // When flood grid is provided (e.g. Municipal Dashboard risk product), skip polygon layer — grid + buildings only
    if (floodGrid?.length) {
      return
    }

    const riskColors: Record<string, { fill: string; outline: string }> = {
      normal: { fill: 'rgba(34, 197, 94, 0.45)', outline: 'rgba(34, 197, 94, 0.8)' },
      elevated: { fill: 'rgba(234, 179, 8, 0.5)', outline: 'rgba(234, 179, 8, 0.9)' },
      high: { fill: 'rgba(249, 115, 22, 0.55)', outline: 'rgba(249, 115, 22, 0.9)' },
      critical: { fill: 'rgba(239, 68, 68, 0.6)', outline: 'rgba(239, 68, 68, 0.95)' },
    }

    if (highFidelityFloodScenarioId) {
      const url = `${apiPrefix()}/climate/high-fidelity/flood?scenario_id=${encodeURIComponent(highFidelityFloodScenarioId)}`
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_flood_depth_m?: number; max_risk_level?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          floodEntitiesRef.current.forEach((e) => { if (v.entities.contains(e)) v.entities.remove(e) })
          floodEntitiesRef.current = []
          if (!data?.polygon || data.polygon.length < 3) return
          const depthM = floodDepthOverride ?? (data.max_flood_depth_m ?? 0)
          const risk = (data.max_risk_level ?? 'normal') as string
          const { fill, outline } = riskColors[risk] ?? riskColors.normal
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0)))
          const extrusionM = Math.max(60, 40 + depthM * 30)
          const cenLng = data.polygon.reduce((s: number, p: number[]) => s + p[0], 0) / data.polygon.length
          const cenLat = data.polygon.reduce((s: number, p: number[]) => s + p[1], 0) / data.polygon.length
          const entity = v.entities.add({
            id: 'flood-forecast-layer-hf',
            name: `Flood (high-fidelity)`,
            position: Cesium.Cartesian3.fromDegrees(cenLng, cenLat, 0),
            polygon: {
              hierarchy,
              height: 0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeight: extrusionM,
              material: Cesium.Color.fromCssColorString(fill),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(outline),
            },
          })
          floodEntitiesRef.current.push(entity)
          v.scene.requestRender()
        })
        .catch(() => {})
      return () => {
        const v = viewerRef.current
        if (v && !v.isDestroyed()) {
          floodEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
        }
        floodEntitiesRef.current = []
      }
    }

    // When floodCenter is provided (e.g. from stress test city), fetch flood only for that point so zone shows at the right city
    const hotspotsToUse =
      floodCenter != null && typeof floodCenter.lat === 'number' && typeof floodCenter.lng === 'number'
        ? [{ lat: floodCenter.lat, lng: floodCenter.lng, name: 'Stress test' }]
        : DISASTER_LAYER_HOTSPOTS.flood
    const hotspots = hotspotsToUse
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      const url = `${apiPrefix()}/climate/flood-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_flood_depth_m?: number; max_risk_level?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const depthM = floodDepthOverride ?? (data.max_flood_depth_m ?? 0)
          const risk = (data.max_risk_level ?? 'normal') as string
          const { fill, outline } = riskColors[risk] ?? riskColors.normal
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0)))
          const extrusionM = Math.max(60, 40 + depthM * 30)
          const entity = v.entities.add({
            id: `flood-forecast-${i}-${name}`,
            name: `Flood: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: {
              hierarchy,
              height: 0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeight: extrusionM,
              material: Cesium.Color.fromCssColorString(fill),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString(outline),
            },
          })
          floodEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        floodEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      floodEntitiesRef.current = []
    }
  }, [showFloodLayer, floodDepthOverride, highFidelityFloodScenarioId, floodCenter?.lat, floodCenter?.lng, floodGrid])

  // Flood grid layer: render per-cell depth from flood-risk-product (include_grid: true) as colored rectangles
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!showFloodLayer || !floodGrid?.length) {
      floodGridEntitiesRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
      floodGridEntitiesRef.current = []
      return
    }

    const cellSizeDeg = 0.005
    // Green scale: general zone = light green, more flooded = clearly dark green (good contrast)
    const depthToColor = (depth_m: number): string => {
      if (depth_m <= 0.3) return 'rgba(187, 247, 208, 0.7)'  // light green (general zone)
      if (depth_m <= 1.0) return 'rgba(34, 197, 94, 0.7)'   // green
      if (depth_m <= 2.0) return 'rgba(22, 101, 52, 0.85)'   // dark green (#166534)
      return 'rgba(20, 83, 45, 0.95)'                        // very dark green (#14532d) — clearly visible
    }

    floodGridEntitiesRef.current.forEach((e) => {
      if (viewer.entities.contains(e)) viewer.entities.remove(e)
    })
    floodGridEntitiesRef.current = []

    for (const cell of floodGrid) {
      const { lat, lon, depth_m } = cell
      const hierarchy = new Cesium.PolygonHierarchy([
        Cesium.Cartesian3.fromDegrees(lon, lat, 0),
        Cesium.Cartesian3.fromDegrees(lon + cellSizeDeg, lat, 0),
        Cesium.Cartesian3.fromDegrees(lon + cellSizeDeg, lat + cellSizeDeg, 0),
        Cesium.Cartesian3.fromDegrees(lon, lat + cellSizeDeg, 0),
      ])
      const extrusionM = Math.max(5, depth_m * 30)
      const entity = viewer.entities.add({
        id: `flood-grid-cell-${lat}-${lon}`,
        name: `Flood ${depth_m}m`,
        polygon: {
          hierarchy,
          height: 0,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          extrudedHeight: extrusionM,
          material: Cesium.Color.fromCssColorString(depthToColor(depth_m)),
          outline: false,
        },
      })
      floodGridEntitiesRef.current.push(entity)
    }
    viewer.scene.requestRender()

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        floodGridEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      floodGridEntitiesRef.current = []
    }
  }, [showFloodLayer, floodGrid])

  // Flood buildings layer: per-building depth/probability from POST /cadapt/flood-buildings
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!showFloodLayer || !floodBuildings?.length) {
      floodBuildingEntitiesRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
      floodBuildingEntitiesRef.current = []
      return
    }

    // Green scale for building points: light = low depth, clearly dark green = high (matches grid)
    const depthToColor = (depth_m: number): string => {
      if (depth_m <= 0.3) return '#bbf7d0'
      if (depth_m <= 1.0) return '#22c55e'
      if (depth_m <= 2.0) return '#166534'
      return '#14532d'
    }

    floodBuildingEntitiesRef.current.forEach((e) => {
      if (viewer.entities.contains(e)) viewer.entities.remove(e)
    })
    floodBuildingEntitiesRef.current = []

    for (const b of floodBuildings) {
      const returnPeriod = b.return_period_years ?? 100
      const probPct = (b.annual_probability * 100).toFixed(1)
      const damagePct = (b.damage_ratio * 100).toFixed(0)
      const entity = viewer.entities.add({
        id: `flood-building-${b.id}`,
        name: b.name || 'Building',
        position: Cesium.Cartesian3.fromDegrees(b.lon, b.lat, 0),
        point: {
          pixelSize: Math.min(12, Math.max(8, 8 + b.damage_ratio * 4)),
          color: Cesium.Color.fromCssColorString(depthToColor(b.depth_m)).withAlpha(0.85),
          outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
          outlineWidth: 1.5,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(1e4, 1.2, 1e7, 0.4),
        },
        description: `Building: ${b.name || 'Building'}<br/>Depth: ${b.depth_m.toFixed(2)} m<br/>${returnPeriod}-yr probability: ${probPct}%<br/>Damage: ${damagePct}%`,
      })
      floodBuildingEntitiesRef.current.push(entity)
    }
    viewer.scene.requestRender()

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        floodBuildingEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      floodBuildingEntitiesRef.current = []
    }
  }, [showFloodLayer, floodBuildings])

  // Wind layer: show at multiple risk cities (hurricane/typhoon prone)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!showWindLayer) {
      windEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      windEntitiesRef.current = []
      return
    }

    const colors: Record<number, string> = {
      0: 'rgba(34, 197, 94, 0.35)', 1: 'rgba(34, 197, 94, 0.4)', 2: 'rgba(234, 179, 8, 0.45)',
      3: 'rgba(249, 115, 22, 0.5)', 4: 'rgba(239, 68, 68, 0.55)', 5: 'rgba(127, 29, 29, 0.6)',
    }

    if (highFidelityWindScenarioId) {
      const url = `${apiPrefix()}/climate/high-fidelity/wind?scenario_id=${encodeURIComponent(highFidelityWindScenarioId)}`
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_category?: number } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          windEntitiesRef.current.forEach((e) => { if (v.entities.contains(e)) v.entities.remove(e) })
          windEntitiesRef.current = []
          if (!data?.polygon || data.polygon.length < 3) return
          const cat = data.max_category ?? 0
          const fill = colors[cat] ?? colors[0]
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const cenLng = data.polygon.reduce((s: number, p: number[]) => s + p[0], 0) / data.polygon.length
          const cenLat = data.polygon.reduce((s: number, p: number[]) => s + p[1], 0) / data.polygon.length
          const entity = v.entities.add({
            id: 'wind-forecast-layer-hf',
            name: 'Wind (high-fidelity)',
            position: Cesium.Cartesian3.fromDegrees(cenLng, cenLat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 30 + (cat * 15), material: Cesium.Color.fromCssColorString(fill), outline: true, outlineColor: Cesium.Color.fromCssColorString(cat >= 4 ? 'rgba(220, 38, 38, 0.9)' : 'rgba(250, 204, 21, 0.8)') },
          })
          windEntitiesRef.current.push(entity)
          v.scene.requestRender()
        })
        .catch(() => {})
      return () => {
        const v = viewerRef.current
        if (v && !v.isDestroyed()) {
          windEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
        }
        windEntitiesRef.current = []
      }
    }

    const hotspots = DISASTER_LAYER_HOTSPOTS.wind
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      const url = `${apiPrefix()}/climate/wind-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_category?: number } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const cat = data.max_category ?? 0
          const fill = colors[cat] ?? colors[0]
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const entity = v.entities.add({
            id: `wind-forecast-${i}-${name}`,
            name: `Wind: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 30 + (cat * 15), material: Cesium.Color.fromCssColorString(fill), outline: true, outlineColor: Cesium.Color.fromCssColorString(cat >= 4 ? 'rgba(220, 38, 38, 0.9)' : 'rgba(250, 204, 21, 0.8)') },
          })
          windEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        windEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      windEntitiesRef.current = []
    }
  }, [showWindLayer, highFidelityWindScenarioId])

  // Metro flood layer: show at multiple cities with metro (cylinders at subway entrances)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    if (!showMetroFloodLayer) {
      metroEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      metroEntitiesRef.current = []
      return
    }

    const hotspots = DISASTER_LAYER_HOTSPOTS.metro ?? [{ lat: 40.7128, lng: -74.0060, name: 'New York' }]
    let completed = 0
    const allEntities: Cesium.Entity[] = []

    hotspots.forEach(({ lat, lng, name }) => {
      const url = `${apiPrefix()}/climate/metro-flood?latitude=${lat}&longitude=${lng}&radius_km=15`
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { entrances?: { lat: number; lon: number; name: string; flood_depth_m: number }[] } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.entrances?.length) {
            completed += 1
            if (completed === hotspots.length) { metroEntitiesRef.current = [...allEntities]; v.scene.requestRender() }
            return
          }
          data.entrances.forEach((ent: { lat: number; lon: number; name: string; flood_depth_m: number }, entIdx: number) => {
            const depthM = ent.flood_depth_m ?? 0
            const length = Math.max(5, depthM * 1000)
            const citySafe = name.replace(/\s+/g, '_')
            const entSafe = ent.name.replace(/\s+/g, '_')
            const entity = v.entities.add({
              id: `metro-flood-${citySafe}::${entSafe}-${entIdx}`,
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
                text: `${name}: ${ent.name}\n${depthM > 0 ? `${depthM}m flooded` : 'Dry'}`,
                font: '12pt "JetBrains Mono", monospace',
                fillColor: Cesium.Color.WHITE,
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                pixelOffset: new Cesium.Cartesian2(0, -length / 2 - 10),
              },
            })
            allEntities.push(entity)
          })
          completed += 1
          if (completed === hotspots.length) {
            metroEntitiesRef.current = [...allEntities]
            v.scene.requestRender()
          }
        })
        .catch(() => { completed += 1 })
    })

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        metroEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      metroEntitiesRef.current = []
    }
  }, [showMetroFloodLayer])

  // Heat stress layer: show at selected city when anomalyCenter provided (e.g. Municipal Dashboard), else default hotspots
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (!showHeatLayer) {
      heatEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      heatEntitiesRef.current = []
      return
    }
    const colors: Record<string, string> = {
      normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(234, 179, 8, 0.4)', high: 'rgba(249, 115, 22, 0.5)', extreme: 'rgba(239, 68, 68, 0.55)',
    }
    const hotspots =
      anomalyCenter != null && typeof anomalyCenter.lat === 'number' && typeof anomalyCenter.lng === 'number'
        ? [{ lat: anomalyCenter.lat, lng: anomalyCenter.lng, name: 'Selected city' }]
        : DISASTER_LAYER_HOTSPOTS.heat
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${apiPrefix()}/climate/heat-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const risk = (data.max_risk_level ?? 'normal') as string
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const entity = v.entities.add({
            id: `heat-forecast-${i}-${name}`,
            name: `Heat: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 45, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(239, 68, 68, 0.8)') },
          })
          heatEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })
    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        heatEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      heatEntitiesRef.current = []
    }
  }, [showHeatLayer, anomalyCenter?.lat, anomalyCenter?.lng])

  // Heavy rain layer: show at multiple risk cities
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (!showHeavyRainLayer) {
      heavyRainEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      heavyRainEntitiesRef.current = []
      return
    }
    const colors: Record<string, string> = {
      normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(56, 189, 248, 0.4)', high: 'rgba(14, 165, 233, 0.5)', extreme: 'rgba(2, 132, 199, 0.55)',
    }
    const hotspots = DISASTER_LAYER_HOTSPOTS.heavy_rain
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${apiPrefix()}/climate/heavy-rain-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const risk = (data.max_risk_level ?? 'normal') as string
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const entity = v.entities.add({
            id: `heavy-rain-forecast-${i}-${name}`,
            name: `Heavy rain: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 45, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(14, 165, 233, 0.8)') },
          })
          heavyRainEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })
    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        heavyRainEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      heavyRainEntitiesRef.current = []
    }
  }, [showHeavyRainLayer])

  // Drought layer: show at selected city when anomalyCenter provided (e.g. Municipal Dashboard), else default hotspots
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (!showDroughtLayer) {
      droughtEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      droughtEntitiesRef.current = []
      return
    }
    const colors: Record<string, string> = {
      normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(217, 119, 6, 0.4)', high: 'rgba(180, 83, 9, 0.5)', extreme: 'rgba(120, 53, 15, 0.55)',
    }
    const hotspots =
      anomalyCenter != null && typeof anomalyCenter.lat === 'number' && typeof anomalyCenter.lng === 'number'
        ? [{ lat: anomalyCenter.lat, lng: anomalyCenter.lng, name: 'Selected city' }]
        : DISASTER_LAYER_HOTSPOTS.drought
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${apiPrefix()}/climate/drought-forecast?latitude=${lat}&longitude=${lng}&include_polygon=true`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; drought_risk?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const risk = (data.drought_risk ?? 'normal') as string
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const entity = v.entities.add({
            id: `drought-forecast-${i}-${name}`,
            name: `Drought: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 45, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(180, 83, 9, 0.8)') },
          })
          droughtEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })
    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        droughtEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      droughtEntitiesRef.current = []
    }
  }, [showDroughtLayer, anomalyCenter?.lat, anomalyCenter?.lng])

  // UV layer: show at multiple risk cities
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    if (!showUvLayer) {
      uvEntitiesRef.current.forEach((e) => { if (viewer.entities.contains(e)) viewer.entities.remove(e) })
      uvEntitiesRef.current = []
      return
    }
    const colors: Record<string, string> = {
      normal: 'rgba(34, 197, 94, 0.3)', elevated: 'rgba(168, 85, 247, 0.4)', high: 'rgba(139, 92, 246, 0.5)', extreme: 'rgba(124, 58, 237, 0.55)',
    }
    const hotspots = DISASTER_LAYER_HOTSPOTS.uv
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${apiPrefix()}/climate/uv-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
        .then((res) => (res.ok ? res.json() : null))
        .then((data: { polygon?: number[][]; max_risk_level?: string } | null) => {
          if (!viewerRef.current || viewerRef.current.isDestroyed()) return
          const v = viewerRef.current
          if (!data?.polygon || data.polygon.length < 3) return
          const risk = (data.max_risk_level ?? 'normal') as string
          const hierarchy = new Cesium.PolygonHierarchy(data.polygon.map(([lon, lat]) => Cesium.Cartesian3.fromDegrees(lon, lat, 30)))
          const entity = v.entities.add({
            id: `uv-forecast-${i}-${name}`,
            name: `UV: ${name}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            polygon: { hierarchy, height: 30, extrudedHeight: 45, material: Cesium.Color.fromCssColorString(colors[risk] ?? colors.normal), outline: true, outlineColor: Cesium.Color.fromCssColorString('rgba(139, 92, 246, 0.8)') },
          })
          uvEntitiesRef.current.push(entity)
          completed += 1
          if (completed === hotspots.length) v.scene.requestRender()
        })
        .catch(() => { completed += 1 })
    })
    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        uvEntitiesRef.current.forEach((e) => { try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {} })
      }
      uvEntitiesRef.current = []
    }
  }, [showUvLayer])

  // Earthquake layer: M5+ zones from USGS with 3D impact polygons (like flood stress tests)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    if (!showEarthquakeLayer) {
      earthquakeEntitiesRef.current.forEach((e) => {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      })
      earthquakeEntitiesRef.current = []
      return
    }

    const colors: Record<number, string> = {
      5: 'rgba(234, 179, 8, 0.45)',
      6: 'rgba(249, 115, 22, 0.5)',
      7: 'rgba(239, 68, 68, 0.55)',
      8: 'rgba(127, 29, 29, 0.6)',
    }

    const minMag = Math.max(5, Math.min(9, earthquakeMinMagnitude ?? 5))
    fetch(`${apiPrefix()}/climate/earthquake-zones?days=365&min_magnitude=${minMag}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { earthquakes?: { id: string; lat: number; lng: number; magnitude: number; place: string; polygon: number[][] }[] } | null) => {
        if (!viewerRef.current || viewerRef.current.isDestroyed()) return
        const v = viewerRef.current
        earthquakeEntitiesRef.current.forEach((e) => {
          if (v.entities.contains(e)) v.entities.remove(e)
        })
        earthquakeEntitiesRef.current = []
        const eqs = data?.earthquakes ?? []
        eqs.forEach((eq, i) => {
          if (!eq.polygon || eq.polygon.length < 3) return
          const mag = eq.magnitude ?? 5
          const magFloor = Math.min(8, Math.floor(mag))
          const fill = colors[magFloor] ?? colors[5]
          const hierarchy = new Cesium.PolygonHierarchy(
            eq.polygon.map(([lon, lat]: number[]) => Cesium.Cartesian3.fromDegrees(lon, lat, 0))
          )
          const extrusionM = Math.max(30000, 20000 + mag * 15000)
          const entity = v.entities.add({
            id: `earthquake-zone-${eq.id ?? i}`,
            name: `Earthquake M${mag.toFixed(1)}: ${eq.place}`,
            position: Cesium.Cartesian3.fromDegrees(eq.lng, eq.lat, 0),
            polygon: {
              hierarchy,
              height: 0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              extrudedHeightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              extrudedHeight: extrusionM,
              material: Cesium.Color.fromCssColorString(fill),
              outline: true,
              outlineColor: Cesium.Color.fromCssColorString('rgba(220, 38, 38, 0.9)'),
            },
          })
          earthquakeEntitiesRef.current.push(entity)
        })
        v.scene.requestRender()
      })
      .catch(() => {})

    return () => {
      const v = viewerRef.current
      if (v && !v.isDestroyed()) {
        earthquakeEntitiesRef.current.forEach((e) => {
          try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {}
        })
      }
      earthquakeEntitiesRef.current = []
    }
  }, [showEarthquakeLayer, earthquakeMinMagnitude, isReady])

  // ── Active Incidents layer: live earthquakes, fires, weather alerts (60s polling) ──
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !isReady) return

    // Cleanup helper
    const clearEntities = () => {
      const v = viewerRef.current
      if (!v || v.isDestroyed()) return
      activeIncidentEntitiesRef.current.forEach((e) => {
        try { if (v.entities.contains(e)) v.entities.remove(e) } catch (_) {}
      })
      activeIncidentEntitiesRef.current = []
    }

    if (!showActiveIncidentsLayer) {
      clearEntities()
      return
    }

    let cancelled = false

    const fetchAndRender = async () => {
      try {
        const res = await fetch(`${apiPrefix()}/climate/active-incidents`)
        if (cancelled || !res.ok) return
        const data = await res.json()
        const features: Array<{
          type: string
          geometry: { type: string; coordinates: number[] | number[][] | number[][][] }
          properties: { type: string; severity: string; title: string; magnitude?: number; confidence?: number; updated_at?: string }
        }> = data?.features ?? []

        const v = viewerRef.current
        if (!v || v.isDestroyed() || cancelled) return

        // Remove old entities
        clearEntities()

        let count = 0
        for (const feature of features) {
          if (cancelled) break
          const props = feature.properties
          const geom = feature.geometry
          if (!geom || !props) continue

          const incidentType = props.type

          if (incidentType === 'earthquake' && geom.type === 'Point') {
            const [lng, lat] = geom.coordinates as number[]
            const mag = props.magnitude ?? 3
            const severity = props.severity

            // Orange/red ellipse scaled by magnitude
            const radiusM = Math.max(15000, mag * 15000)
            const color = severity === 'extreme'
              ? Cesium.Color.RED.withAlpha(0.55)
              : severity === 'severe'
                ? Cesium.Color.ORANGERED.withAlpha(0.5)
                : Cesium.Color.ORANGE.withAlpha(0.4)

            const entity = v.entities.add({
              id: `active-eq-${count}`,
              name: props.title,
              position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
              ellipse: {
                semiMajorAxis: radiusM,
                semiMinorAxis: radiusM,
                height: 200,
                material: color,
                outline: true,
                outlineColor: Cesium.Color.ORANGE.withAlpha(0.8),
                outlineWidth: 1.5,
              },
              label: {
                text: `M${mag.toFixed(1)}`,
                font: '11px "JetBrains Mono", monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                fillColor: Cesium.Color.WHITE,
                verticalOrigin: Cesium.VerticalOrigin.CENTER,
                pixelOffset: new Cesium.Cartesian2(0, 0),
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8000000),
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.6),
                backgroundPadding: new Cesium.Cartesian2(3, 2),
              },
            })
            activeIncidentEntitiesRef.current.push(entity)
          } else if (incidentType === 'fire' && geom.type === 'Point') {
            const [lng, lat] = geom.coordinates as number[]

            // Red pulsing point for fire
            const entity = v.entities.add({
              id: `active-fire-${count}`,
              name: props.title,
              position: Cesium.Cartesian3.fromDegrees(lng, lat, 300),
              point: {
                pixelSize: 7,
                color: Cesium.Color.RED.withAlpha(0.9),
                outlineColor: Cesium.Color.YELLOW.withAlpha(0.7),
                outlineWidth: 2,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 12000000),
                scaleByDistance: new Cesium.NearFarScalar(1e3, 1.5, 1e7, 0.5),
              },
            })
            activeIncidentEntitiesRef.current.push(entity)
          } else if (incidentType === 'weather_alert' && geom.type === 'Polygon') {
            const rings = geom.coordinates as number[][][]
            if (!rings || rings.length === 0) continue
            const outerRing = rings[0]
            if (!outerRing || outerRing.length < 3) continue

            const severity = props.severity
            const color = severity === 'extreme'
              ? Cesium.Color.RED.withAlpha(0.3)
              : Cesium.Color.YELLOW.withAlpha(0.25)
            const outlineClr = severity === 'extreme'
              ? Cesium.Color.RED.withAlpha(0.8)
              : Cesium.Color.YELLOW.withAlpha(0.7)

            const positions = outerRing.map(([lng, lat]: number[]) => Cesium.Cartesian3.fromDegrees(lng, lat, 0))
            const entity = v.entities.add({
              id: `active-alert-${count}`,
              name: props.title,
              polygon: {
                hierarchy: new Cesium.PolygonHierarchy(positions),
                height: 0,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                material: color,
                outline: true,
                outlineColor: outlineClr,
              },
            })
            activeIncidentEntitiesRef.current.push(entity)
          }
          count++
        }

        if (count > 0) {
          console.log('[CesiumGlobe] Active incidents: %d entities rendered', count)
          v.scene.requestRender()
        }
      } catch (err) {
        console.warn('[CesiumGlobe] Active incidents fetch error:', err)
      }
    }

    // Initial fetch
    fetchAndRender()

    // Poll every 60 seconds
    const interval = setInterval(fetchAndRender, 60_000)

    return () => {
      cancelled = true
      clearInterval(interval)
      clearEntities()
    }
  }, [showActiveIncidentsLayer, isReady])

  // Render dependency lines between zones
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !showDependencies) {
      // Remove all dependency lines if disabled
      dependencyLinesRef.current.forEach(line => {
        if (viewer && !viewer.isDestroyed() && viewer.entities.contains(line)) {
          viewer.entities.remove(line)
        }
      })
      dependencyLinesRef.current = []

      // Remove dependency endpoint markers
      dependencyEndpointMarkersRef.current.forEach(marker => {
        if (viewer && !viewer.isDestroyed() && viewer.entities.contains(marker)) {
          viewer.entities.remove(marker)
        }
      })
      dependencyEndpointMarkersRef.current = []
      return
    }

    // Fetch dependencies from API
    async function loadAndRenderDependencies() {
      const token = ++dependencyRenderTokenRef.current
      try {
        const res = await fetch('/api/v1/risk-zones/dependencies')
        if (!res.ok) return
        const data = await res.json()
        // If selection changed while request was in-flight, ignore stale result
        if (token !== dependencyRenderTokenRef.current) return
        const v = viewerRef.current
        if (!v || v.isDestroyed()) return

        // Clear existing lines
        dependencyLinesRef.current.forEach(line => {
          if (v.entities.contains(line)) {
            v.entities.remove(line)
          }
        })
        dependencyLinesRef.current = []

        // Clear existing endpoint markers
        dependencyEndpointMarkersRef.current.forEach(marker => {
          if (v.entities.contains(marker)) {
            v.entities.remove(marker)
          }
        })
        dependencyEndpointMarkersRef.current = []

        // Filter dependencies if selectedZoneForDependencies is set (smart mode)
        let filteredDeps = data.dependencies
        const selected = (selectedZoneForDependencies || '').toString().trim().toLowerCase()
        if (selected) {
          filteredDeps = data.dependencies.filter((dep: any) => {
            const a = (dep.zone1_id || '').toString().trim().toLowerCase()
            const b = (dep.zone2_id || '').toString().trim().toLowerCase()
            return a === selected || b === selected
          })
        }

        // Create polylines for each dependency
        const endpointIds = new Set<string>()
        filteredDeps.forEach((dep: any) => {
          const zone1 = data.zones.find((z: any) => z.id === dep.zone1_id)
          const zone2 = data.zones.find((z: any) => z.id === dep.zone2_id)
          
          if (!zone1 || !zone2) {
            console.warn(`Zone not found for dependency: ${dep.zone1_id} -> ${dep.zone2_id}`)
            return
          }

          // Create polyline between zones with proper geodesic arc
          const positions = Cesium.Cartesian3.fromDegreesArrayHeights([
            zone1.lng, zone1.lat, 5000,  // Start point (5km — видимая дуга, не в космосе)
            zone2.lng, zone2.lat, 5000,  // End point
          ])

          const line = v.entities.add({
            id: `dependency-${dep.zone1_id}-${dep.zone2_id}`,
            polyline: {
              positions: positions,
              width: dep.dependency_type === 'direct' ? 2 : 1,
              material: dep.dependency_type === 'direct' 
                ? Cesium.Color.WHITE.withAlpha(0.6)
                : Cesium.Color.WHITE.withAlpha(0.3),
              clampToGround: false,
              arcType: Cesium.ArcType.GEODESIC,
            },
          })
          dependencyLinesRef.current.push(line)

          // Add subtle endpoint markers so lines never appear to end "in empty space"
          ;[zone1, zone2].forEach((z: any) => {
            if (!z || endpointIds.has(z.id)) return
            endpointIds.add(z.id)
            const marker = v.entities.add({
              id: `dependency-node-${z.id}`,
              position: Cesium.Cartesian3.fromDegrees(z.lng, z.lat, 5000), // совпадает с высотой линий
              point: {
                pixelSize: 6,
                color: Cesium.Color.WHITE.withAlpha(0.45),
                outlineColor: Cesium.Color.BLACK.withAlpha(0.4),
                outlineWidth: 1,
                scaleByDistance: new Cesium.NearFarScalar(1e5, 1.2, 2e7, 0.6),
              },
            })
            dependencyEndpointMarkersRef.current.push(marker)
          })
        })

        v.scene.requestRender()
      } catch (e) {
        console.warn('Failed to load dependencies:', e)
      }
    }

    loadAndRenderDependencies()
    return () => {
      // bump token so any in-flight request becomes stale
      dependencyRenderTokenRef.current += 1
    }
  }, [showDependencies, selectedZoneForDependencies])

  // =============================================
  // VIEW MODE: Global ↔ Country ↔ City transitions
  // Globe morphs to Columbus View on country select (Envato-style flattening)
  // =============================================
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return

    const prevMode = lastViewModeRef.current
    lastViewModeRef.current = viewMode

    // --- Enter/update Country mode (from Global or switching country) ---
    if (viewMode === 'country' && selectedCountryCode) {
      // 1) Stop rotation
      rotationEnabledRef.current = false

      // 2) Columbus View morph only for NASA night globe when entering from global. Google 3D stays in 3D.
      //    When switching countries we stay in current view (no re-morph).
      const isEnteringFromGlobal = prevMode !== 'country' && prevMode !== 'city'
      const useMorph = !showGoogle3dLayer && isEnteringFromGlobal
      if (isEnteringFromGlobal) usedColumbusMorphRef.current = useMorph
      if (useMorph) viewer.scene.morphToColumbusView(2.0)

      // 3) Fly to country — Rectangle for Columbus View; BoundingSphere for 3D (Google) to avoid wrong centering
      fetch('/data/countries.json')
        .then(res => res.json())
        .then((countries: { code: string; name: string; lat: number; lng: number; bbox: number[] }[]) => {
          if (!viewer || viewer.isDestroyed()) return
          const country = countries.find((c: { code: string }) => c.code === selectedCountryCode)
          if (!country) return

          const [west, south, east, north] = country.bbox
          const pad = 0.08
          const dLng = (east - west) * pad
          const dLat = (north - south) * pad
          const rect = Cesium.Rectangle.fromDegrees(
            west - dLng,
            south - dLat,
            east + dLng,
            north + dLat
          )

          const flyDelay = useMorph ? 500 : 0
          setTimeout(() => {
            if (!viewer || viewer.isDestroyed()) return
            if (useMorph) {
              viewer.camera.flyTo({
                destination: rect,
                orientation: {
                  heading: 0,
                  pitch: Cesium.Math.toRadians(-60),
                  roll: 0,
                },
                duration: 2.5,
              })
            } else {
              // Google 3D: flyTo with Rectangle can miscenter; use BoundingSphere for correct centering
              const sphere = (Cesium.BoundingSphere as any).fromRectangle3D(rect, Cesium.Ellipsoid.WGS84, 0)
              const range = sphere.radius * 2.5
              viewer.camera.flyToBoundingSphere(sphere, {
                duration: 2.0,
                offset: new Cesium.HeadingPitchRange(0, Cesium.Math.toRadians(-45), range),
              })
            }
          }, flyDelay)
        })
        .catch(e => console.warn('Failed to load countries.json:', e))

      // 4) Load and highlight country boundary
      const loadCountryBoundary = async () => {
        try {
          // Remove previous boundary
          if (countryBoundaryDataSourceRef.current) {
            viewer.dataSources.remove(countryBoundaryDataSourceRef.current)
            countryBoundaryDataSourceRef.current = null
          }

          // Load GeoJSON (cached)
          let geoJsonData = countryGeoJsonCacheRef.current
          if (!geoJsonData) {
            const res = await fetch('/data/countries-110m.geojson')
            geoJsonData = await res.json()
            countryGeoJsonCacheRef.current = geoJsonData
          }

          // Filter to selected country
          const fullData = geoJsonData as { type: string; features: { type: string; properties: Record<string, string>; geometry: unknown }[] }
          const filteredGeoJson = {
            type: 'FeatureCollection',
            features: fullData.features.filter((f: { properties: Record<string, string> }) =>
              f.properties['ISO3166-1-Alpha-2'] === selectedCountryCode
            ),
          }

          if (filteredGeoJson.features.length === 0) return

          // Clear, visible highlight in both NASA and Google modes
          const forGoogle3d = showGoogle3dLayer
          const dataSource = await Cesium.GeoJsonDataSource.load(filteredGeoJson, {
            stroke: Cesium.Color.fromCssColorString(forGoogle3d ? '#22d3ee' : '#38bdf8'),
            fill: Cesium.Color.fromCssColorString(forGoogle3d ? 'rgba(34, 211, 238, 0.35)' : 'rgba(56, 189, 248, 0.35)'),
            strokeWidth: forGoogle3d ? 5 : 4,
            clampToGround: true,
          })

          if (!viewer || viewer.isDestroyed()) return
          viewer.dataSources.add(dataSource)
          countryBoundaryDataSourceRef.current = dataSource

          // Selected country boundary is highlighted — other countries remain as globe base
        } catch (e) {
          console.warn('Failed to load country boundary:', e)
        }
      }

      // 5) Load city markers for selected country (top 20 by population) as pin icons
      const loadCountryCities = async () => {
        try {
          countryCityMarkersRef.current.forEach(e => {
            try { viewer.entities.remove(e) } catch (_) { /* ok */ }
          })
          countryCityMarkersRef.current = []

          if (!viewer || viewer.isDestroyed()) return

          const res = await fetch('/data/cities-by-country.json')
          const data = await res.json() as Record<string, Array<{ id: string; name: string; lat: number; lng: number; population?: number }>>
          const cities = data[selectedCountryCode]
          if (!cities || !Array.isArray(cities) || cities.length === 0) return
          if (!viewer || viewer.isDestroyed()) return

          // Fetch per-city risk scores from country-risk API for individual pin coloring
          const cityRiskMap = new Map<string, number>()
          try {
            const riskRes = await fetch(`${apiPrefix()}/country-risk/${selectedCountryCode}`)
            if (riskRes.ok) {
              const riskData = await riskRes.json()
              const topCities = riskData?.top_cities as Array<{ id: string; name: string; risk_score: number }> | undefined
              if (Array.isArray(topCities)) {
                topCities.forEach(c => {
                  cityRiskMap.set(c.name.toLowerCase(), c.risk_score)
                })
              }
            }
          } catch (_) { /* fallback to country-level risk */ }
          const baseRisk = typeof countryCompositeRiskRef.current === 'number' ? countryCompositeRiskRef.current : 0.5

          // Deterministic per-city risk variation based on city name hash
          const cityRiskVariation = (name: string, base: number): number => {
            let hash = 0
            for (let i = 0; i < name.length; i++) {
              hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0
            }
            // Spread +-0.20 around base, clamped to [0.05, 0.98]
            const offset = ((hash % 40) - 20) / 100
            return Math.max(0.05, Math.min(0.98, base + offset))
          }

          const riskToColor = (r: number): Cesium.Color =>
            r >= 0.75 ? Cesium.Color.fromCssColorString('#ef4444')
              : r >= 0.55 ? Cesium.Color.fromCssColorString('#f97316')
              : r >= 0.35 ? Cesium.Color.fromCssColorString('#eab308')
              : Cesium.Color.fromCssColorString('#22c55e')

          const pinBuilder = new Cesium.PinBuilder()

          if (!viewer || viewer.isDestroyed()) return

          cities.slice(0, 20).forEach((city) => {
            // Per-city risk: API data > deterministic variation from country composite
            const cityRisk = cityRiskMap.get(city.name.toLowerCase())
              ?? cityRiskVariation(city.name, baseRisk)
            const color = riskToColor(cityRisk)
            const pinCanvas = pinBuilder.fromColor(color, 36)

            // Always use fromDegrees — Cesium handles Columbus View projection internally.
            // Do NOT use mapProjection.project() as that double-projects.
            const position = Cesium.Cartesian3.fromDegrees(city.lng, city.lat, 0)

            const entity = viewer.entities.add({
              id: `country-city-${city.id}`,
              name: city.name,
              position,
              billboard: {
                image: pinCanvas.toDataURL(),
                verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                // NONE — no terrain sampling, prevents async repositioning to poles
                heightReference: Cesium.HeightReference.NONE,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scaleByDistance: new Cesium.NearFarScalar(1e5, 1.0, 5e6, 0.4),
              },
              label: {
                text: city.name,
                font: '12px "JetBrains Mono", monospace',
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                outlineWidth: 2,
                outlineColor: Cesium.Color.BLACK,
                fillColor: Cesium.Color.WHITE,
                verticalOrigin: Cesium.VerticalOrigin.TOP,
                pixelOffset: new Cesium.Cartesian2(0, 8),
                scaleByDistance: new Cesium.NearFarScalar(1e5, 1.0, 5e6, 0.3),
                showBackground: true,
                backgroundColor: Cesium.Color.BLACK.withAlpha(0.5),
                backgroundPadding: new Cesium.Cartesian2(4, 2),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
            })
            countryCityMarkersRef.current.push(entity)
          })
          if (!viewer.isDestroyed()) viewer.scene.requestRender()
        } catch (e) {
          console.warn('Failed to load country cities:', e)
        }
      }

      // Load boundary: sooner for 3D zoom (Google), after morph starts for Columbus View
      setTimeout(() => loadCountryBoundary(), useMorph ? 1500 : 400)
      // Load cities ONLY after morph fully completes — use morphComplete event for reliability
      if (useMorph) {
        const onMorphDone = viewer.scene.morphComplete.addEventListener(() => {
          onMorphDone()
          // Extra 500ms after morphComplete for scene to fully settle
          setTimeout(() => loadCountryCities(), 500)
        })
      } else {
        setTimeout(() => loadCountryCities(), 500)
      }
    }

    // --- Transition: Country → Global ---
    if (viewMode === 'global' && prevMode === 'country') {
      // 1) Remove country boundary
      if (countryBoundaryDataSourceRef.current) {
        viewer.dataSources.remove(countryBoundaryDataSourceRef.current)
        countryBoundaryDataSourceRef.current = null
      }

      // Remove city markers
      countryCityMarkersRef.current.forEach(e => {
        try { viewer.entities.remove(e) } catch (_) { /* already removed */ }
      })
      countryCityMarkersRef.current = []

      const didMorph = usedColumbusMorphRef.current
      if (didMorph) {
        viewer.scene.morphTo3D(2.0)
      }

      setTimeout(() => {
        if (!viewer || viewer.isDestroyed()) return
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 2.0,
        })
        setTimeout(() => { rotationEnabledRef.current = true }, didMorph ? 2500 : 2200)
      }, didMorph ? 500 : 0)
    }

    // --- City mode: remove country outline, stop rotation so city does not fly away; allow fly-to-focus to run ---
    if (viewMode === 'city') {
      rotationEnabledRef.current = false
      focusFlownKeyRef.current = null
      if (countryBoundaryDataSourceRef.current) {
        viewer.dataSources.remove(countryBoundaryDataSourceRef.current)
        countryBoundaryDataSourceRef.current = null
      }
      countryCityMarkersRef.current.forEach((e) => {
        try { viewer.entities.remove(e) } catch (_) { /* ok */ }
      })
      countryCityMarkersRef.current = []
    }

    // --- Transition: Country → City ---
    if (viewMode === 'city' && prevMode === 'country') {
      // Just zoom closer — keep Columbus View
      // The city coordinates are handled by focusCoordinates prop
    }

    // --- Transition: City → Country ---
    if (viewMode === 'country' && prevMode === 'city') {
      if (selectedCountryCode) {
        fetch('/data/countries.json')
          .then(res => res.json())
          .then((countries: { code: string; bbox: number[] }[]) => {
            if (!viewer || viewer.isDestroyed()) return
            const country = countries.find((c: { code: string }) => c.code === selectedCountryCode)
            if (!country) return
            const [west, south, east, north] = country.bbox
            const pad = 0.08
            const rect = Cesium.Rectangle.fromDegrees(
              west - (east - west) * pad,
              south - (north - south) * pad,
              east + (east - west) * pad,
              north + (north - south) * pad
            )
            viewer.camera.flyTo({
              destination: rect,
              orientation: {
                heading: 0,
                pitch: usedColumbusMorphRef.current ? Cesium.Math.toRadians(-60) : Cesium.Math.toRadians(-45),
                roll: 0,
              },
              duration: 1.5,
            })
          })
          .catch(() => {})
      }
    }

    // --- Transition: City → Global (skip country) ---
    if (viewMode === 'global' && prevMode === 'city') {
      if (countryBoundaryDataSourceRef.current) {
        viewer.dataSources.remove(countryBoundaryDataSourceRef.current)
        countryBoundaryDataSourceRef.current = null
      }
      countryCityMarkersRef.current.forEach(e => {
        try { viewer.entities.remove(e) } catch (_) { /* ok */ }
      })
      countryCityMarkersRef.current = []

      const didMorph = usedColumbusMorphRef.current
      if (didMorph) {
        viewer.scene.morphTo3D(2.0)
      }
      setTimeout(() => {
        if (!viewer || viewer.isDestroyed()) return
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
          duration: 2.0,
        })
        setTimeout(() => { rotationEnabledRef.current = true }, didMorph ? 2500 : 2200)
      }, didMorph ? 500 : 0)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- viewMode/selectedCountryCode/showGoogle3dLayer drive effect; deps intentionally minimal
  }, [viewMode, selectedCountryCode, showGoogle3dLayer])

  return (
    <div className="relative w-full h-full">
      {/* Cesium container */}
      <div 
        ref={containerRef} 
        className="w-full h-full"
        style={{ background: '#000000' }}
      />
      
      {/* Loading overlay - show only if not ready */}
      {!isReady && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-10">
          <div className="text-center">
            <div className="text-amber-400/80 text-sm animate-pulse mb-2">
              {loadingProgress}
            </div>
            <div className="w-48 h-1 bg-gray-800 rounded-full overflow-hidden">
              <div className="h-full bg-amber-400 animate-pulse" style={{ width: '60%' }} />
            </div>
          </div>
        </div>
      )}
      
      {/* Progress indicator when ready but still loading resources */}
      {isReady && loadingProgress !== 'Globe Ready' && !error && (
        <div className="absolute top-4 right-4 bg-black/60 px-3 py-2 rounded-md border border-amber-400/30 z-20">
          <div className="text-amber-400/80 text-xs animate-pulse">
            {loadingProgress}
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-red-400/80 text-sm text-center p-4">
            <div className="mb-2">⚠️ Globe Error</div>
            <div className="text-xs text-gray-400">{error}</div>
          </div>
        </div>
      )}

      {/* Stress test 4D timeline controls */}
      {stressTestCzmlUrl?.trim() && isReady && (
        <div className="absolute bottom-3 left-3 right-3 flex items-center gap-3 bg-black/70 rounded-md border border-zinc-700 px-3 py-2 z-20">
          <span className="text-zinc-400 text-xs max-w-[220px] shrink-0" title="Same stress test scenario; playback stops at T+12m">
            Impact (T0→T+12m). Stops at T+12m.
          </span>
          <button
            type="button"
            onClick={() => {
              const v = viewerRef.current
              if (!v || v.isDestroyed()) return
              v.clock.shouldAnimate = !v.clock.shouldAnimate
              setStressTestClockPlaying(v.clock.shouldAnimate)
            }}
            className="text-zinc-300 hover:text-white px-2 py-1 text-xs font-medium"
          >
            {stressTestClockPlaying ? 'Pause' : 'Play'}
          </button>
          <div className="flex gap-1">
            {[3600, 36000, 360000].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => {
                  const v = viewerRef.current
                  if (!v || v.isDestroyed()) return
                  v.clock.multiplier = m
                  setStressTestClockMultiplier(m)
                }}
                className={`px-2 py-1 text-xs rounded ${stressTestClockMultiplier === m ? 'bg-amber-600 text-black' : 'text-zinc-400 hover:text-white'}`}
              >
                {m === 3600 ? 'x1' : m === 36000 ? 'x10' : 'x100'}
              </button>
            ))}
          </div>
          <span className="text-zinc-500 text-xs tabular-nums min-w-[140px]">
            {stressTestClockTime ?? '—'}
          </span>
          {stressTestClockRange && (
            <input
              type="range"
              min={0}
              max={100}
              value={stressTestScrubPct}
              className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer"
              onMouseDown={() => { stressTestScrubDraggingRef.current = true }}
              onMouseUp={() => { stressTestScrubDraggingRef.current = false }}
              onTouchStart={() => { stressTestScrubDraggingRef.current = true }}
              onTouchEnd={() => { stressTestScrubDraggingRef.current = false }}
              onChange={(e) => {
                const v = viewerRef.current
                if (!v || v.isDestroyed() || !stressTestClockRange) return
                const pct = Number(e.target.value) / 100
                const t = stressTestClockRange.start + pct * (stressTestClockRange.end - stressTestClockRange.start)
                v.clock.currentTime = Cesium.JulianDate.fromDate(new Date(t))
                v.clock.shouldAnimate = false
                setStressTestClockPlaying(false)
                setStressTestScrubPct(pct)
              }}
            />
          )}
        </div>
      )}

      {/* Cesium CSS */}
      <style>{`
        .cesium-viewer .cesium-widget-credits {
          display: none !important;
        }
        .cesium-viewer .cesium-viewer-bottom {
          display: none !important;
        }
      `}</style>
    </div>
  )
}
