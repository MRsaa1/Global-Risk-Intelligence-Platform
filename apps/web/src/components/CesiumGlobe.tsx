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

// Extend Window for Cesium
declare global {
  interface Window {
    CESIUM_BASE_URL: string
  }
}

// Configure Cesium - serve Workers/Assets from app origin to avoid 404 in production
window.CESIUM_BASE_URL = (import.meta.env.BASE_URL || '/') + 'cesium/'

// Cesium Ion token for NASA Black Marble
const CESIUM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIwYTExZmMxNS1jY2RhLTQ2YjctOTg0Mi02NWQxNGQxYjFhZGYiLCJpZCI6Mzc4MTk5LCJpYXQiOjE3NjgzMjc3NjJ9.neQZ3X5JRYBalv7cjUuVrq_kVw0nVyKQlwtOyxls5OM'

// Google Photorealistic 3D Tiles via Cesium Ion (fallback when createGooglePhotorealistic3DTileset unavailable)
const CESIUM_ION_GOOGLE_PHOTOREALISTIC = 2275207

// API for loading geo data
const API_BASE = '/api/v1'

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

// Default center for disaster layers when no zone/center is passed (so checkboxes always show something)
const DEFAULT_DISASTER_CENTER = { lat: 40.7128, lng: -74.0060 }

// Cities most at risk per hazard type — all cities that appear when checkboxes are selected (full list per layer)
export type DisasterHotspot = { lat: number; lng: number; name: string }
const DISASTER_LAYER_HOTSPOTS: Record<string, DisasterHotspot[]> = {
  flood: [
    { lat: 25.7617, lng: -80.1918, name: 'Miami' },
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
  ],
  heat: [
    { lat: 25.2048, lng: 55.2708, name: 'Dubai' },
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
  ],
  drought: [
    { lat: 30.0444, lng: 31.2357, name: 'Cairo' },
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
    const url = scenario 
      ? `${API_BASE}/geodata/hotspots?scenario=${scenario}`
      : `${API_BASE}/geodata/hotspots`
    
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
      return geojson.features.map((f: any) => {
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

// Create small sparkle canvas for particle effects
function createSparkCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!

  const centerX = width / 2
  const centerY = height / 2

  const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, width / 2)
  gradient.addColorStop(0, 'rgba(255, 255, 200, 1)')
  gradient.addColorStop(0.3, 'rgba(255, 200, 100, 0.8)')
  gradient.addColorStop(0.6, 'rgba(255, 150, 50, 0.4)')
  gradient.addColorStop(1, 'rgba(255, 100, 0, 0)')

  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  return canvas
}

// Sparkle entity with animation phase
interface SparkleEntity {
  entity: Cesium.Entity
  phase: number
}

// Add sparkle particles around a hotspot
function addSparkles(
  viewer: Cesium.Viewer,
  longitude: number,
  latitude: number,
  spotId: string,
  count: number = 20
): SparkleEntity[] {
  const sparkles: SparkleEntity[] = []

  for (let i = 0; i < count; i++) {
    // Random offset around center
    const angle = Math.random() * Math.PI * 2
    const distance = 20000 + Math.random() * 100000 // 20-120 km
    
    const offsetLon = longitude + (Math.cos(angle) * distance) / 111320
    const offsetLat = latitude + (Math.sin(angle) * distance) / 110540
    
    const sparkCanvas = createSparkCanvas(16, 16)
    
    const sparkle = viewer.entities.add({
      id: `hotspot-sparkle-${spotId}-${i}`,
      position: Cesium.Cartesian3.fromDegrees(offsetLon, offsetLat, Math.random() * 30000),
      billboard: {
        image: sparkCanvas,
        scale: 0.5 + Math.random() * 1.0,
        color: Cesium.Color.WHITE,
        heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
      }
    })
    
    sparkles.push({ entity: sparkle, phase: Math.random() * Math.PI * 2 })
  }

  return sparkles
}

// Fire marker structure for animation
interface FireMarker {
  spotId: string
  core: Cesium.Entity
  innerGlow: Cesium.Entity
  outerGlow: Cesium.Entity
  halos: Cesium.Entity[]
  sparkles: SparkleEntity[]
}

// Animate fire halos with flicker and pulse
function animateEnhancedFireHalo(viewer: Cesium.Viewer, markers: FireMarker[]) {
  const startTime = Date.now()

  const animationCallback = () => {
    if (viewer.isDestroyed()) return
    
    const elapsed = (Date.now() - startTime) / 1000

    markers.forEach((marker, index) => {
      const offset = index * 0.4
      
      // Main pulse (slow breathing)
      const pulse = Math.sin(elapsed * 1.2 + offset) * 0.25 + 0.75 // 0.5 to 1.0
      
      // Fast flicker (fire-like)
      const flicker = Math.sin(elapsed * 8 + offset * 3) * 0.1 + 0.9 // 0.8 to 1.0
      
      // Combined intensity
      const combinedIntensity = pulse * flicker

      // Animate core (small scale: 0.3 base)
      if (marker.core?.billboard) {
        marker.core.billboard.scale = new Cesium.ConstantProperty(0.3 * combinedIntensity)
      }

      // Animate inner glow (small scale: 0.8 base)
      if (marker.innerGlow?.billboard) {
        marker.innerGlow.billboard.scale = new Cesium.ConstantProperty(0.8 * pulse)
        const alpha = 0.5 * combinedIntensity
        marker.innerGlow.billboard.color = new Cesium.ConstantProperty(
          new Cesium.Color(1.0, 0.5, 0.1, alpha)
        )
      }

      // Animate halo rings (wave expansion) - smaller radii only; do not reassign material (avoids Cesium DeveloperError)
      marker.halos?.forEach((halo, i) => {
        if (halo?.ellipse) {
          const baseRadius = 50000 + (i * 40000)
          const wave = Math.sin(elapsed * 1.5 - i * 0.8 + offset) * 0.2 + 0.8
          halo.ellipse.semiMajorAxis = new Cesium.ConstantProperty(baseRadius * wave)
          halo.ellipse.semiMinorAxis = new Cesium.ConstantProperty(baseRadius * wave)
        }
      })

      // Animate outer glow (small scale: 2.0 base)
      if (marker.outerGlow?.billboard) {
        const slowPulse = Math.sin(elapsed * 0.8 + offset) * 0.15 + 0.85
        marker.outerGlow.billboard.scale = new Cesium.ConstantProperty(2.0 * slowPulse)
        marker.outerGlow.billboard.color = new Cesium.ConstantProperty(
          new Cesium.Color(1.0, 0.3, 0.0, 0.15 * pulse)
        )
      }

      // Animate sparkles
      marker.sparkles?.forEach((sparkle) => {
        const sparkPulse = Math.sin(elapsed * 5 + sparkle.phase) * 0.5 + 0.5
        if (sparkle.entity?.billboard) {
          sparkle.entity.billboard.color = new Cesium.ConstantProperty(
            new Cesium.Color(1.0, 0.8, 0.4, sparkPulse)
          )
        }
      })
    })
  }

  // Register animation on preRender
  viewer.scene.preRender.addEventListener(animationCallback)
  
  return animationCallback // Return for potential cleanup
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
  anomalyCenter?: { lat: number; lng: number }  // Center for heat/rain/drought/uv fetch
  /** Double-click on a climate risk zone (blue marker) opens Digital Twin for that city */
  onClimateZoneDoubleClick?: (info: { cityName: string; lat: number; lng: number }) => void
  /** When set, globe flies to this position (e.g. from Assets → View on Globe) */
  focusCoordinates?: { lat: number; lng: number } | null
  /** When true, show Google Photorealistic 3D Tiles on the globe instead of OSM buildings */
  showGoogle3dLayer?: boolean
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
  highFidelityFloodScenarioId = null,
  showWindLayer = false,
  windCenter,
  highFidelityWindScenarioId = null,
  showMetroFloodLayer = false,
  metroCenter,
  showHeatLayer = false,
  showHeavyRainLayer = false,
  showDroughtLayer = false,
  showUvLayer = false,
  anomalyCenter,
  onClimateZoneDoubleClick,
  focusCoordinates = null,
  showGoogle3dLayer = false,
}: CesiumGlobeProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const osmBuildingsRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const google3dTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const climateRiskMarkersRef = useRef<Cesium.Entity[]>([])
  const onClimateZoneDoubleClickRef = useRef(onClimateZoneDoubleClick)
  onClimateZoneDoubleClickRef.current = onClimateZoneDoubleClick
  const floodEntitiesRef = useRef<Cesium.Entity[]>([])
  const windEntitiesRef = useRef<Cesium.Entity[]>([])
  const metroEntitiesRef = useRef<Cesium.Entity[]>([])
  const heatEntitiesRef = useRef<Cesium.Entity[]>([])
  const heavyRainEntitiesRef = useRef<Cesium.Entity[]>([])
  const droughtEntitiesRef = useRef<Cesium.Entity[]>([])
  const uvEntitiesRef = useRef<Cesium.Entity[]>([])
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
  
  // Refs for callback access in click handler (avoids stale closure)
  const riskZonesRef = useRef(riskZones)
  const onZoneClickRef = useRef(onZoneClick)
  const onZoneAssetClickRef = useRef(onZoneAssetClick)
  const selectedZoneRef = useRef(selectedZone)
  const rotationEnabledRef = useRef(true) // Control rotation
  const onHotspotsLoadedRef = useRef(onHotspotsLoaded)
  
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
        color: new Cesium.Color(glowColor.r, glowColor.g, glowColor.b, 0.85),
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
      },
    })
    entities.push(core)

    // Ellipse halo rings at 5km altitude so they are never occluded by terrain
    const HALO_ALTITUDE_M = 5000
    const haloPosition = Cesium.Cartesian3.fromDegrees(spot.lng, spot.lat, HALO_ALTITUDE_M)
    const haloRadii = [104000, 182000, 260000, 338000, 416000]
    const haloAlphas = [0.28, 0.22, 0.16, 0.11, 0.06]
    for (let i = 0; i < haloRadii.length; i++) {
      const radius = haloRadii[i]
      const alpha = (haloAlphas[i] ?? 0.06) * riskMultiplier
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
        color: colors.center.withAlpha(0.5),
        outlineColor: colors.ring.withAlpha(0.6),
        outlineWidth: 1.5,
        scaleByDistance: new Cesium.NearFarScalar(1e6, 1.2, 1e8, 0.4),
      },
      label: {
        text: spot.name,
        font: '13px "Space Grotesk", system-ui, sans-serif',
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
      } catch {}
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
        onHotspotsLoadedRef.current?.(updated)
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
        
        // Cesium World Terrain
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          setLoadingProgress('Loading terrain...')
          viewer.scene.setTerrain(
            new Cesium.Terrain(
              Cesium.CesiumTerrainProvider.fromIonAssetId(1)
            )
          )
          console.log('✅ Cesium World Terrain loaded')
        } catch (e) {
          console.warn('Cesium World Terrain failed:', e)
          console.log('ℹ️ Using ellipsoid terrain as fallback')
        }
        
        // OSM Buildings - 3D buildings worldwide (default); Google 3D can be toggled via showGoogle3dLayer
        try {
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          setLoadingProgress('Loading 3D buildings...')
          const osmBuildings = await Cesium.Cesium3DTileset.fromIonAssetId(96188, {
            maximumScreenSpaceError: 24,
            skipLevelOfDetail: true,
            baseScreenSpaceError: 512,
            skipScreenSpaceErrorFactor: 12,
            skipLevels: 1,
            immediatelyLoadDesiredLevelOfDetail: true,
            cullWithChildrenBounds: true,
            maximumMemoryUsage: 512,
            dynamicScreenSpaceError: true,
            dynamicScreenSpaceErrorDensity: 0.0018,
            dynamicScreenSpaceErrorFactor: 3.5,
            dynamicScreenSpaceErrorHeightFalloff: 0.15,
          })
          if (!isMounted || !viewer || viewer.isDestroyed()) return
          viewer.scene.primitives.add(osmBuildings)
          osmBuildingsRef.current = osmBuildings
          console.log('✅ OSM Buildings loaded')
        } catch (e) {
          console.warn('OSM Buildings failed:', e)
        }
        
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
        
        scene.backgroundColor = Cesium.Color.fromCssColorString('#000011')
        globe.baseColor = Cesium.Color.fromCssColorString('#0a1628')
        globe.depthTestAgainstTerrain = true
        
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
        
        // Create glowing hotspot entities
        const entityMap = new Map<string, Cesium.Entity[]>()
        loadedHotspots.forEach((spot) => {
          const entities = buildHotspotEntities(viewer!, spot)
          entityMap.set(spot.id, entities)
        })
        
        hotspotEntitiesRef.current = entityMap
        if (onHotspotsLoaded) {
          onHotspotsLoaded(loadedHotspots)
        }
        
        // Default: only critical risk visible; others on click
        applyVisibility(viewer, entityMap, loadedHotspots, 'critical')
        console.log(`✅ Created glow hotspots for ${loadedHotspots.length} cities`)
        
        // Initial camera position (overview of Earth)
        viewer.camera.setView({
          destination: Cesium.Cartesian3.fromDegrees(100, 20, 20000000),
          orientation: {
            heading: Cesium.Math.toRadians(0),
            pitch: Cesium.Math.toRadians(-90),
            roll: 0,
          },
        })

        // Smooth rotation animation (only when no zone selected)
        let lastTime = Date.now()
        const rotationSpeed = 0.5 // degrees per second
        
        viewer.scene.preRender.addEventListener(() => {
          const now = Date.now()
          const delta = (now - lastTime) / 1000
          lastTime = now
          
          // Only rotate if:
          // 1. Rotation is enabled (no zone selected)
          // 2. Not user-interacting (flying, dragging)
          // 3. Camera is not transforming
          if (rotationEnabledRef.current && viewer && !viewer.scene.camera.isTransforming) {
            viewer.scene.camera.rotate(
              Cesium.Cartesian3.UNIT_Z,
              Cesium.Math.toRadians(rotationSpeed * delta)
            )
          }
        })

        // Mark as ready after everything is loaded
        setIsReady(true)
        setLoadingProgress('Globe Ready')
        viewer.scene.requestRender()

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
          if (!isClimateMarker && !isClimateLayer) return

          let cityName = typeof entity.name === 'string' ? entity.name : ''
          if (isClimateMarker && entityId.startsWith('climate-risk-')) {
            cityName = (entityId as string).replace('climate-risk-', '').replace(/_/g, ' ')
          } else if (isClimateLayer && cityName) {
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
          onClimateZoneDoubleClickRef.current?.({ cityName, lat, lng })
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK)
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

  // Fly to coordinates when set (e.g. from Assets → View on Globe / Run Stress Test)
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed() || !focusCoordinates) return
    const { lat, lng } = focusCoordinates
    if (typeof lat !== 'number' || typeof lng !== 'number') return
    const height = 8000
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, height),
      orientation: {
        heading: Cesium.Math.toRadians(0),
        pitch: Cesium.Math.toRadians(-50),
        roll: 0,
      },
      duration: 1.5,
    })
  }, [focusCoordinates?.lat, focusCoordinates?.lng])

  // Notify parent when hotspots are loaded (only once when hotspots change)
  useEffect(() => {
    if (hotspots.length > 0) {
      onHotspotsLoaded?.(hotspots)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hotspots])

  // Handle activeRiskFilter - show/hide hotspots based on risk level
  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer || viewer.isDestroyed()) return
    applyVisibility(viewer, hotspotEntitiesRef.current, hotspots, activeRiskFilter)
  }, [activeRiskFilter, hotspots])

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
      selectedZone.assets.forEach((asset, index) => {
        const color = getAssetTypeColor(asset.type)
        
        // Asset marker
        const assetEntity = viewer.entities.add({
          id: `zone-asset-${asset.id}`,
          name: asset.name,
          position: Cesium.Cartesian3.fromDegrees(
            asset.longitude,
            asset.latitude,
            2000
          ),
          point: {
            pixelSize: 14 + asset.impactSeverity * 10,
            color: color,
            outlineColor: Cesium.Color.WHITE.withAlpha(0.9),
            outlineWidth: 2,
            scaleByDistance: new Cesium.NearFarScalar(1e4, 1.5, 1e6, 0.5),
          },
          label: {
            text: asset.name,
            font: '11px sans-serif',
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

    // Add new zone entities
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

      // Multiple concentric halos: good visibility (alpha), lower contrast (desaturated color)
      const haloScales = [1.0, 1.5, 2.0, 2.5]
      const haloAlphas = [0.22, 0.16, 0.10, 0.06]
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
          font: '13px sans-serif',
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
  }, [riskZones])

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

    // Concentric halo radii and alphas (like red hotspot halos)
    const haloRadii = [85000, 130000, 180000, 230000]
    const haloAlphas = [0.35, 0.25, 0.15, 0.08]

    const seen = new Set<string>()
    activeKeys.forEach((key) => {
      const hotspots = DISASTER_LAYER_HOTSPOTS[key as keyof typeof DISASTER_LAYER_HOTSPOTS]
      if (!Array.isArray(hotspots)) return
      hotspots.forEach(({ lat, lng, name }) => {
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
            font: '12px sans-serif',
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

    const riskColors: Record<string, { fill: string; outline: string }> = {
      normal: { fill: 'rgba(34, 197, 94, 0.45)', outline: 'rgba(34, 197, 94, 0.8)' },
      elevated: { fill: 'rgba(234, 179, 8, 0.5)', outline: 'rgba(234, 179, 8, 0.9)' },
      high: { fill: 'rgba(249, 115, 22, 0.55)', outline: 'rgba(249, 115, 22, 0.9)' },
      critical: { fill: 'rgba(239, 68, 68, 0.6)', outline: 'rgba(239, 68, 68, 0.95)' },
    }

    if (highFidelityFloodScenarioId) {
      const url = `${API_BASE}/climate/high-fidelity/flood?scenario_id=${encodeURIComponent(highFidelityFloodScenarioId)}`
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
          const entity = v.entities.add({
            id: 'flood-forecast-layer-hf',
            name: `Flood (high-fidelity)`,
            polygon: {
              hierarchy,
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
      const url = `${API_BASE}/climate/flood-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`
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
            polygon: {
              hierarchy,
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
  }, [showFloodLayer, floodDepthOverride, highFidelityFloodScenarioId, floodCenter?.lat, floodCenter?.lng])

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
      const url = `${API_BASE}/climate/high-fidelity/wind?scenario_id=${encodeURIComponent(highFidelityWindScenarioId)}`
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
          const entity = v.entities.add({
            id: 'wind-forecast-layer-hf',
            name: 'Wind (high-fidelity)',
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
      const url = `${API_BASE}/climate/wind-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`
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
      const url = `${API_BASE}/climate/metro-flood?latitude=${lat}&longitude=${lng}&radius_km=15`
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
                text: `${name}: ${ent.name}\n${depthM > 0 ? `${depthM}m flooded` : 'Dry'}`,
                font: '12pt sans-serif',
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

  // Heat stress layer: show at multiple risk cities
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
    const hotspots = DISASTER_LAYER_HOTSPOTS.heat
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${API_BASE}/climate/heat-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
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
  }, [showHeatLayer])

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
      fetch(`${API_BASE}/climate/heavy-rain-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
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

  // Drought layer: show at multiple risk cities
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
    const hotspots = DISASTER_LAYER_HOTSPOTS.drought
    let completed = 0
    hotspots.forEach(({ lat, lng, name }, i) => {
      fetch(`${API_BASE}/climate/drought-forecast?latitude=${lat}&longitude=${lng}&include_polygon=true`)
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
  }, [showDroughtLayer])

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
      fetch(`${API_BASE}/climate/uv-forecast?latitude=${lat}&longitude=${lng}&days=7&include_polygon=true`)
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
        
        // Clear existing lines
        dependencyLinesRef.current.forEach(line => {
          if (viewer.entities.contains(line)) {
            viewer.entities.remove(line)
          }
        })
        dependencyLinesRef.current = []

        // Clear existing endpoint markers
        dependencyEndpointMarkersRef.current.forEach(marker => {
          if (viewer.entities.contains(marker)) {
            viewer.entities.remove(marker)
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
            zone1.lng, zone1.lat, 100000,  // Start point (100km altitude)
            zone2.lng, zone2.lat, 100000,  // End point
          ])

          const line = viewer.entities.add({
            id: `dependency-${dep.zone1_id}-${dep.zone2_id}`,
            polyline: {
              positions: positions,
              width: dep.dependency_type === 'direct' ? 2 : 1,
              material: dep.dependency_type === 'direct' 
                ? Cesium.Color.WHITE.withAlpha(0.6)
                : Cesium.Color.WHITE.withAlpha(0.3),
              clampToGround: false,
              arcType: Cesium.ArcType.GEODESIC,
              followSurface: false,
            },
          })
          dependencyLinesRef.current.push(line)

          // Add subtle endpoint markers so lines never appear to end "in empty space"
          ;[zone1, zone2].forEach((z: any) => {
            if (!z || endpointIds.has(z.id)) return
            endpointIds.add(z.id)
            const marker = viewer.entities.add({
              id: `dependency-node-${z.id}`,
              position: Cesium.Cartesian3.fromDegrees(z.lng, z.lat, 100000),
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

        viewer.scene.requestRender()
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
        <div className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="text-amber-400 text-sm animate-pulse mb-2">
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
        <div className="absolute top-4 right-4 bg-black/60 backdrop-blur-sm px-3 py-2 rounded-lg border border-amber-400/30 z-20">
          <div className="text-amber-400 text-xs animate-pulse">
            {loadingProgress}
          </div>
        </div>
      )}
      
      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-black">
          <div className="text-red-400 text-sm text-center p-4">
            <div className="mb-2">⚠️ Globe Error</div>
            <div className="text-xs text-gray-400">{error}</div>
          </div>
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
