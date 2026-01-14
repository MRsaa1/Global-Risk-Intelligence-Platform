/**
 * Deck.gl Overlay for Command Center
 * ====================================
 * 
 * Renders data visualization layers on top of CesiumJS:
 * - HeatmapLayer: Risk density
 * - ArcLayer: Risk connections/flows
 * - ScatterplotLayer: Individual assets
 * - PolygonLayer: Risk zones from stress tests
 * 
 * Uses Deck.gl's MapboxOverlay-style rendering
 */
import { useEffect, useState, useMemo } from 'react'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer, ArcLayer, PolygonLayer, PathLayer } from '@deck.gl/layers'
import { HeatmapLayer } from '@deck.gl/aggregation-layers'
import { COORDINATE_SYSTEM } from '@deck.gl/core'

const API_BASE = '/api/v1'

interface Hotspot {
  id: string
  name: string
  coordinates: [number, number]
  risk: number
  exposure: number
}

interface Connection {
  source: [number, number]
  target: [number, number]
  weight: number
  sourceRisk: number
  targetRisk: number
}

interface HeatmapPoint {
  coordinates: [number, number]
  weight: number
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
}

// Risk to color mapping
function getRiskColor(risk: number): [number, number, number, number] {
  if (risk > 0.8) return [255, 50, 50, 200]    // Red
  if (risk > 0.6) return [255, 150, 50, 200]   // Orange
  if (risk > 0.4) return [255, 220, 50, 200]   // Yellow
  return [50, 255, 100, 200]                    // Green
}

// Zone level to color mapping
function getZoneLevelColor(level: string, alpha = 80): [number, number, number, number] {
  switch (level) {
    case 'critical': return [255, 50, 50, alpha]     // Red
    case 'high':     return [255, 150, 50, alpha]    // Orange  
    case 'medium':   return [255, 220, 50, alpha]    // Yellow
    default:         return [50, 255, 100, alpha]    // Green
  }
}

// Generate circle polygon from center + radius
function generateCirclePolygon(
  centerLng: number, 
  centerLat: number, 
  radiusKm: number, 
  segments = 64
): [number, number][] {
  const coordinates: [number, number][] = []
  const earthRadius = 6371 // km
  
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * 2 * Math.PI
    // Calculate offset in degrees
    const latOffset = (radiusKm / earthRadius) * (180 / Math.PI) * Math.cos(angle)
    const lngOffset = (radiusKm / earthRadius) * (180 / Math.PI) * Math.sin(angle) / 
                      Math.cos(centerLat * Math.PI / 180)
    
    coordinates.push([centerLng + lngOffset, centerLat + latOffset])
  }
  
  return coordinates
}

interface DeckOverlayProps {
  viewState: {
    longitude: number
    latitude: number
    zoom: number
    pitch: number
    bearing: number
  }
  showHeatmap?: boolean
  showArcs?: boolean
  showPoints?: boolean
  showZones?: boolean
  selectedScenario?: string
  riskZones?: RiskZone[]
  onHotspotClick?: (hotspot: Hotspot | null) => void
  onZoneClick?: (zone: RiskZone | null) => void
}

export default function DeckOverlay({
  viewState,
  showHeatmap = true,
  showArcs = true,
  showPoints = true,
  showZones = false,
  selectedScenario,
  riskZones = [],
  onHotspotClick,
  onZoneClick,
}: DeckOverlayProps) {
  const [hotspots, setHotspots] = useState<Hotspot[]>([])
  const [connections, setConnections] = useState<Connection[]>([])
  const [heatmapData, setHeatmapData] = useState<HeatmapPoint[]>([])
  const [hoveredZoneId, setHoveredZoneId] = useState<string | null>(null)

  // Load data from API
  useEffect(() => {
    async function loadData() {
      try {
        // Load hotspots
        const hotspotsUrl = selectedScenario
          ? `${API_BASE}/geodata/hotspots?scenario=${selectedScenario}`
          : `${API_BASE}/geodata/hotspots`
        
        const [hotspotsRes, networkRes, heatmapRes] = await Promise.all([
          fetch(hotspotsUrl),
          fetch(`${API_BASE}/geodata/network`),
          fetch(`${API_BASE}/geodata/heatmap`),
        ])

        if (hotspotsRes.ok) {
          const geojson = await hotspotsRes.json()
          const spots = geojson.features.map((f: any) => ({
            id: f.id,
            name: f.properties.name,
            coordinates: f.geometry.coordinates as [number, number],
            risk: f.properties.risk_score,
            exposure: f.properties.exposure,
          }))
          setHotspots(spots)
        }

        if (networkRes.ok) {
          const network = await networkRes.json()
          // Create connections from network edges
          const conns: Connection[] = []
          const nodeMap = new Map(network.nodes.map((n: any) => [n.id, n]))
          
          network.edges.forEach((edge: any) => {
            const sourceNode = nodeMap.get(edge.source)
            const targetNode = nodeMap.get(edge.target)
            if (sourceNode && targetNode) {
              // Find actual coordinates from hotspots
              const sourceHotspot = hotspots.find(h => h.id === edge.source)
              const targetHotspot = hotspots.find(h => h.id === edge.target)
              
              if (sourceHotspot && targetHotspot) {
                conns.push({
                  source: sourceHotspot.coordinates,
                  target: targetHotspot.coordinates,
                  weight: edge.weight,
                  sourceRisk: sourceNode.risk,
                  targetRisk: targetNode.risk,
                })
              }
            }
          })
          setConnections(conns)
        }

        if (heatmapRes.ok) {
          const heatmap = await heatmapRes.json()
          setHeatmapData(heatmap.data.map((d: any) => ({
            coordinates: d.coordinates,
            weight: d.weight,
          })))
        }
      } catch (e) {
        console.warn('Failed to load Deck.gl data:', e)
      }
    }

    loadData()
  }, [selectedScenario])

  // Build connections after hotspots are loaded
  useEffect(() => {
    if (hotspots.length === 0) return

    // Create arc connections between nearby high-risk hotspots
    const conns: Connection[] = []
    for (let i = 0; i < hotspots.length; i++) {
      for (let j = i + 1; j < hotspots.length; j++) {
        const h1 = hotspots[i]
        const h2 = hotspots[j]
        
        // Connect if both have significant risk
        if (h1.risk > 0.5 && h2.risk > 0.5) {
          const weight = (h1.risk + h2.risk) / 2
          conns.push({
            source: h1.coordinates,
            target: h2.coordinates,
            weight,
            sourceRisk: h1.risk,
            targetRisk: h2.risk,
          })
        }
      }
    }
    setConnections(conns)
  }, [hotspots])

  // Prepare zone polygons data
  const zonePolygons = useMemo(() => {
    return riskZones.map(zone => ({
      ...zone,
      polygon: generateCirclePolygon(
        zone.center_longitude,
        zone.center_latitude,
        zone.radius_km
      ),
    }))
  }, [riskZones])

  // Create layers
  const layers = useMemo(() => {
    const result = []

    // Risk Zones Layer - Stress Test polygons (render first, behind everything)
    if (showZones && zonePolygons.length > 0) {
      // Zone fill
      result.push(
        new PolygonLayer({
          id: 'risk-zone-fill',
          data: zonePolygons,
          getPolygon: (d: typeof zonePolygons[0]) => d.polygon,
          getFillColor: (d: typeof zonePolygons[0]) => {
            const alpha = hoveredZoneId === d.id ? 100 : 50
            return getZoneLevelColor(d.zone_level, alpha)
          },
          getLineColor: (d: typeof zonePolygons[0]) => getZoneLevelColor(d.zone_level, 180),
          getLineWidth: (d: typeof zonePolygons[0]) => hoveredZoneId === d.id ? 3 : 1,
          lineWidthMinPixels: 1,
          lineWidthMaxPixels: 4,
          pickable: true,
          stroked: true,
          filled: true,
          extruded: false,
          wireframe: false,
          updateTriggers: {
            getFillColor: [hoveredZoneId],
            getLineWidth: [hoveredZoneId],
          },
          onHover: (info) => {
            if (info.object) {
              setHoveredZoneId(info.object.id)
            } else {
              setHoveredZoneId(null)
            }
          },
          onClick: (info) => {
            if (info.object) {
              onZoneClick?.(info.object as RiskZone)
            }
          },
        })
      )

      // Zone pulse rings (animated feel via multiple layers)
      result.push(
        new PathLayer({
          id: 'risk-zone-pulse',
          data: zonePolygons.filter(z => z.zone_level === 'critical'),
          getPath: (d: typeof zonePolygons[0]) => d.polygon,
          getColor: [255, 50, 50, 100],
          getWidth: 50000,
          widthMinPixels: 2,
          widthMaxPixels: 8,
          jointRounded: true,
          capRounded: true,
        })
      )
    }

    // Heatmap Layer - risk density
    if (showHeatmap && heatmapData.length > 0) {
      result.push(
        new HeatmapLayer({
          id: 'risk-heatmap',
          data: heatmapData,
          getPosition: (d: HeatmapPoint) => d.coordinates,
          getWeight: (d: HeatmapPoint) => d.weight,
          radiusPixels: 60,
          intensity: 1.5,
          threshold: 0.1,
          colorRange: [
            [0, 100, 0, 0],      // Transparent green
            [50, 150, 50, 50],   // Light green
            [255, 255, 0, 100],  // Yellow
            [255, 150, 0, 150],  // Orange
            [255, 50, 0, 200],   // Red
            [200, 0, 0, 255],    // Dark red
          ],
        })
      )
    }

    // Arc Layer - risk connections
    if (showArcs && connections.length > 0) {
      result.push(
        new ArcLayer({
          id: 'risk-arcs',
          data: connections,
          getSourcePosition: (d: Connection) => d.source,
          getTargetPosition: (d: Connection) => d.target,
          getSourceColor: (d: Connection) => getRiskColor(d.sourceRisk),
          getTargetColor: (d: Connection) => getRiskColor(d.targetRisk),
          getWidth: (d: Connection) => 2 + d.weight * 4,
          greatCircle: true,
          numSegments: 50,
          opacity: 0.6,
        })
      )
    }

    // Scatterplot Layer - hotspot points
    if (showPoints && hotspots.length > 0) {
      result.push(
        new ScatterplotLayer({
          id: 'hotspot-points',
          data: hotspots,
          getPosition: (d: Hotspot) => d.coordinates,
          getFillColor: (d: Hotspot) => getRiskColor(d.risk),
          getRadius: (d: Hotspot) => 50000 + d.exposure * 5000,
          radiusMinPixels: 8,
          radiusMaxPixels: 40,
          pickable: true,
          opacity: 0.8,
          stroked: true,
          lineWidthMinPixels: 2,
          getLineColor: [255, 255, 255, 150],
          onClick: (info) => {
            if (info.object) {
              onHotspotClick?.(info.object as Hotspot)
            }
          },
        })
      )
    }

    return result
  }, [hotspots, connections, heatmapData, zonePolygons, showHeatmap, showArcs, showPoints, showZones, hoveredZoneId, onHotspotClick, onZoneClick])

  return (
    <DeckGL
      viewState={viewState}
      layers={layers}
      controller={false}
      style={{ 
        position: 'absolute', 
        top: 0, 
        left: 0, 
        width: '100%', 
        height: '100%',
        pointerEvents: 'none',
      }}
      getCursor={() => 'default'}
    />
  )
}
