/**
 * Geographic view: suppliers on world map. Color by risk; fallback to country centroid when no lat/lon.
 */
import 'mapbox-gl/dist/mapbox-gl.css'
import { useState, useMemo } from 'react'
import { Map as MapboxMap } from 'react-map-gl'
import DeckGL from '@deck.gl/react'
import { ScatterplotLayer } from '@deck.gl/layers'

const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN ?? ''
const hasValidMapboxToken = MAPBOX_TOKEN.length > 0 && !MAPBOX_TOKEN.endsWith('.example')

// Country centroids [lon, lat] for fallback when supplier has no coordinates
const COUNTRY_CENTROIDS: Record<string, [number, number]> = {
  DE: [10.45, 51.15], PL: [19.39, 52.07], SE: [15.0, 62.0], NL: [5.29, 52.13],
  IE: [-8.24, 53.41], FR: [2.21, 46.23], IT: [12.57, 41.87], ES: [-3.75, 40.46],
  GB: [-2.58, 54.0], UK: [-2.58, 54.0], US: [-95.71, 37.09], CA: [-106.35, 56.13],
  CN: [104.19, 35.86], JP: [138.25, 36.2], TW: [120.96, 23.7], KR: [127.77, 35.91],
  IN: [78.96, 22.59], AU: [133.78, -25.27], BR: [-55.78, -10.83], MX: [-102.55, 23.63],
  RU: [105.32, 61.52], UA: [31.17, 49.0], TR: [35.24, 38.96], CZ: [15.47, 49.82],
  AT: [14.55, 47.52], CH: [8.23, 46.82], BE: [4.47, 50.5], PT: [-8.22, 39.4],
  NO: [8.47, 60.47], FI: [26.27, 64.5], DK: [9.5, 56.26], GR: [21.82, 39.08],
  RO: [24.97, 45.94], HU: [19.5, 47.16], SK: [19.7, 48.67], SG: [103.85, 1.29],
  MY: [101.98, 4.21], TH: [100.99, 15.87], VN: [108.28, 14.06], ID: [113.92, -0.79],
  ZA: [25.08, -29.0], EG: [30.8, 26.82], NG: [8.68, 9.08], DZ: [2.63, 28.03],
  IL: [34.85, 31.05], SA: [45.08, 23.91], AE: [53.85, 23.42], CL: [-71.54, -35.68],
  AR: [-63.62, -38.42], CO: [-74.09, 4.57], PE: [-75.02, -9.19],
}

export interface ChainMapNode {
  id: string
  scss_id: string
  name: string
  tier: number
  supplier_type: string
  country_code?: string
  geopolitical_risk?: number
  is_critical: boolean
  latitude?: number
  longitude?: number
}

export interface SupplyChainMapProps {
  nodes: ChainMapNode[]
  width?: number
  height?: number
}

/** All points green, same as Cesium pins. */
function pointColor(): [number, number, number, number] {
  return [34, 197, 94, 220] // #22c55e
}

export default function SupplyChainMap({
  nodes,
  width = 800,
  height = 380,
}: SupplyChainMapProps) {
  const [viewState, setViewState] = useState({
    longitude: 10,
    latitude: 50,
    zoom: 3,
    pitch: 0,
    bearing: 0,
  })

  const mapData = useMemo(() => {
    return nodes.map((n) => {
      let lon: number
      let lat: number
      if (n.latitude != null && n.longitude != null) {
        lat = n.latitude
        lon = n.longitude
      } else {
        const code = (n.country_code ?? '').toUpperCase()
        const c = COUNTRY_CENTROIDS[code] ?? [10, 50]
        lon = c[0]
        lat = c[1]
      }
      return {
        id: n.id,
        name: n.name,
        country_code: n.country_code,
        longitude: lon,
        latitude: lat,
        geopolitical_risk: n.geopolitical_risk,
        is_critical: n.is_critical,
      }
    })
  }, [nodes])

  const layer = useMemo(() => {
    if (!mapData.length) return null
    return new ScatterplotLayer({
      id: 'suppliers',
      data: mapData,
      getPosition: (d: { longitude: number; latitude: number }) => [d.longitude, d.latitude],
      getRadius: (d: { is_critical: boolean }) => (d.is_critical ? 15000 : 10000),
      getFillColor: () => pointColor(),
      radiusMinPixels: 6,
      radiusMaxPixels: 24,
      pickable: true,
    })
  }, [mapData])

  if (!nodes.length) {
    return (
      <div
        className="rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400 text-sm"
        style={{ width, height }}
      >
        No suppliers to display
      </div>
    )
  }

  if (!hasValidMapboxToken) {
    return (
      <div
        className="rounded-md bg-zinc-800 border border-zinc-700 flex flex-col items-center justify-center text-zinc-300 p-6"
        style={{ width, height }}
      >
        <p className="text-sm font-medium mb-2">Geographic map</p>
        <p className="text-zinc-400 text-xs mb-3">
          Set <code className="bg-zinc-700 px-1 rounded">VITE_MAPBOX_TOKEN</code> in <code className="bg-zinc-700 px-1 rounded">.env</code> to show suppliers on the map.
        </p>
        <div className="text-left text-xs text-zinc-400 w-full max-w-xs">
          <p className="font-medium text-zinc-400 mb-1">Suppliers by country:</p>
          {Array.from(
            mapData.reduce((acc, d) => {
              const c = d.country_code ?? '—'
              acc.set(c, (acc.get(c) ?? 0) + 1)
              return acc
            }, new Map<string, number>())
          )
            .sort((a, b) => b[1] - a[1])
            .map(([code, count]) => (
              <div key={code}>{code}: {count}</div>
            ))}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-md overflow-hidden bg-zinc-900/80 border border-zinc-700 relative" style={{ width, height }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState: vs }) => setViewState(vs)}
        controller={true}
        layers={layer ? [layer] : []}
        width={width}
        height={height}
      >
        <MapboxMap
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          reuseMaps
        />
      </DeckGL>
      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-3 py-2 text-xs text-zinc-200 flex items-center gap-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500 mr-1" />High risk</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400 mr-1" />Medium</span>
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />Low risk</span>
      </div>
    </div>
  )
}
