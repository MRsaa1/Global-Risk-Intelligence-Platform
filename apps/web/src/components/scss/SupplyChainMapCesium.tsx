/**
 * SCSS geographic map — Cesium globe (same stack as CIP).
 * Suppliers as pins by risk; routes as polylines. No Mapbox token required.
 */
import { useEffect, useRef, useState } from 'react'
import * as Cesium from 'cesium'

declare global {
  interface Window {
    CESIUM_BASE_URL: string
  }
}

window.CESIUM_BASE_URL = (import.meta.env.BASE_URL || '/') + 'cesium/'

const CESIUM_TOKEN = import.meta.env.VITE_CESIUM_ION_TOKEN || ''

const GOOGLE_PHOTOREALISTIC_ION_ID = 2275207
let google3dLoadQueue: Promise<Cesium.Cesium3DTileset | null> = Promise.resolve(null)

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

function pinDataUrl(fillHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${fillHex}" stroke="#1a1a1a" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="6" fill="#fff" opacity="0.4"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

/** All pins use the same green; user can zoom in as needed. */
const PIN_COLOR = '#22c55e'

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

export interface ChainMapEdge {
  source_id: string
  target_id: string
}

interface SupplyChainMapCesiumProps {
  nodes: ChainMapNode[]
  edges?: ChainMapEdge[]
  /** When set, this pin is green and camera flies to it on the map (focus on map, not sidebar) */
  selectedSupplierId?: string | null
  /** Supplier IDs affected by simulation (sanctions, trade_war, disaster). Edges touching these are drawn in red. */
  affectedSupplierIds?: string[]
  onSupplierClick?: (supplierId: string) => void
  width?: number
  height?: number
  className?: string
}

/** Minimum camera height so chains are shown "from space", not zoomed into city. */
const FROM_SPACE_MIN_HEIGHT_M = 8_000_000
const MARKER_VISIBLE_FROM_DISTANCE_M = 850

export default function SupplyChainMapCesium({
  nodes,
  edges = [],
  selectedSupplierId = null,
  affectedSupplierIds = [],
  onSupplierClick,
  width = 800,
  height = 380,
  className = '',
}: SupplyChainMapCesiumProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const google3dTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const entitiesRef = useRef<Cesium.Entity[]>([])
  const linkEntitiesRef = useRef<Cesium.Entity[]>([])
  const nodesRef = useRef(nodes)
  nodesRef.current = nodes
  const pointsRef = useRef<Array<{ id: string; name: string; latitude: number; longitude: number; geopolitical_risk?: number; is_critical: boolean }>>([])
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onSupplierClickRef = useRef(onSupplierClick)
  onSupplierClickRef.current = onSupplierClick

  // Resolve lat/lon for each node (use centroid when missing)
  const points = nodes.map((n) => {
    let lat: number
    let lon: number
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
      latitude: lat,
      longitude: lon,
      geopolitical_risk: n.geopolitical_risk,
      is_critical: n.is_critical,
    }
  })
  pointsRef.current = points

  useEffect(() => {
    if (!containerRef.current) return
    let viewer: Cesium.Viewer | null = null
    let handler: Cesium.ScreenSpaceEventHandler | null = null
    let isMounted = true

    const init = async () => {
      try {
        if (!containerRef.current || !isMounted) return
        viewer = new Cesium.Viewer(containerRef.current, {
          animation: false,
          baseLayerPicker: false,
          fullscreenButton: false,
          vrButton: false,
          geocoder: Cesium.IonGeocodeProviderType.GOOGLE,
          homeButton: true,
          infoBox: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          navigationHelpButton: false,
          baseLayer: false,
          requestRenderMode: false,
          skyBox: false,
          skyAtmosphere: new Cesium.SkyAtmosphere(),
          terrainProvider: undefined,
        })
        viewerRef.current = viewer
        if (!viewer.scene) {
          setError('Cesium scene not available')
          return
        }
        const ctrl = viewer.scene.screenSpaceCameraController
        if (ctrl?.zoomEventTypes) {
          ctrl.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]
        }

        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN
        const v = viewerRef.current
        if (!v || !isMounted || v.isDestroyed() || !v.scene) return
        if (v.scene.globe) {
          v.scene.globe.enableLighting = true
          v.scene.globe.depthTestAgainstTerrain = false
        }

        try {
          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return
          const scene = viewerRef.current.scene
          if (scene) scene.highDynamicRange = true
          const createGoogle = (Cesium as any).createGooglePhotorealistic3DTileset
          const apiOpts = { onlyUsingWithGoogleGeocoder: true }
          const tilesetOpts = { showCreditsOnScreen: true, maximumScreenSpaceError: 4 }
          google3dLoadQueue = google3dLoadQueue.then(async () => {
            if (typeof createGoogle === 'function') return createGoogle(apiOpts, tilesetOpts)
            return Cesium.Cesium3DTileset.fromIonAssetId(GOOGLE_PHOTOREALISTIC_ION_ID, tilesetOpts)
          })
          const tileset = await google3dLoadQueue
          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return
          if (!tileset || (typeof (tileset as any).isDestroyed === 'function' && (tileset as any).isDestroyed())) return
          google3dTilesetRef.current = tileset
          viewerRef.current.scene.primitives.add(tileset)
          if (viewerRef.current.scene.globe) viewerRef.current.scene.globe.show = false
        } catch (e) {
          console.warn('Google Photorealistic 3D Tiles failed, using OSM:', e)
          if (isMounted && viewerRef.current && !viewerRef.current.isDestroyed()) {
            try {
              const osm = new Cesium.OpenStreetMapImageryProvider({ url: 'https://tile.openstreetmap.org/' })
              viewerRef.current.imageryLayers.addImageryProvider(osm)
            } catch (_) {}
            if (viewerRef.current.scene?.globe) viewerRef.current.scene.globe.show = true
          }
        }

        const canvas = v.scene.canvas
        if (!canvas) {
          setError('Cesium scene not ready')
          return
        }
        handler = new Cesium.ScreenSpaceEventHandler(canvas)
        handler.setInputAction((click: { position: Cesium.Cartesian2 }) => {
          const v = viewerRef.current
          if (!v || v.isDestroyed() || !v.scene?.camera) return
          const picked = v.scene.pick(click.position)
          let id: string | undefined
          if (Cesium.defined(picked) && picked.id && typeof picked.id.id === 'string' && picked.id.id.startsWith('scss-point-')) {
            id = picked.id.id.replace('scss-point-', '')
          } else {
            const pts = nodesRef.current
            if (pts.length === 0) return
            const ray = v.camera.getPickRay(click.position)
            if (!ray) return
            let pos = v.scene.globe.pick(ray, v.scene)
            if (!Cesium.defined(pos)) {
              const inter = Cesium.IntersectionTests.rayEllipsoid(ray, Cesium.Ellipsoid.WGS84)
              if (inter) pos = Cesium.Ray.getPoint(ray, inter.start)
            }
            if (!Cesium.defined(pos)) return
            const carto = Cesium.Cartographic.fromCartesian(pos)
            const clng = Cesium.Math.toDegrees(carto.longitude)
            const clat = Cesium.Math.toDegrees(carto.latitude)
            let best = pts[0]
            let bestD = 1e9
            for (const p of pts) {
              const lat = p.latitude != null ? p.latitude : (COUNTRY_CENTROIDS[(p.country_code ?? '').toUpperCase()] ?? [50])[1]
              const lon = p.longitude != null ? p.longitude : (COUNTRY_CENTROIDS[(p.country_code ?? '').toUpperCase()] ?? [10, 50])[0]
              const d = (lon - clng) ** 2 + (lat - clat) ** 2
              if (d < bestD) {
                bestD = d
                best = p
              }
            }
            id = best.id
          }
          if (id != null) onSupplierClickRef.current?.(id)
          // Do not zoom into city — keep "from space" view; selection is reflected in sidebar only
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK)

        if (isMounted) setReady(true)
      } catch (e) {
        if (isMounted) setError(e instanceof Error ? e.message : 'Failed to init Cesium')
      }
    }
    init()

    return () => {
      isMounted = false
      handler?.destroy()
      handler = null
      const v = viewerRef.current
      const tileset = google3dTilesetRef.current
      if (v && !v.isDestroyed() && tileset && v.scene?.primitives?.contains(tileset)) {
        try {
          v.scene.primitives.remove(tileset)
        } catch (_) {}
      }
      google3dTilesetRef.current = null
      entitiesRef.current = []
      linkEntitiesRef.current = []
      if (v && typeof v.isDestroyed === 'function' && !v.isDestroyed()) v.destroy()
      viewerRef.current = null
    }
  }, [])

  useEffect(() => {
    const viewer = viewerRef.current
    if (!viewer?.scene || (typeof viewer.isDestroyed === 'function' && viewer.isDestroyed())) return

    linkEntitiesRef.current.forEach((e) => {
      try {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      } catch (_) {}
    })
    linkEntitiesRef.current = []

    entitiesRef.current.forEach((e) => {
      try {
        if (viewer.entities.contains(e)) viewer.entities.remove(e)
      } catch (_) {}
    })
    entitiesRef.current = []

    const pointById = new Map(points.map((p) => [p.id, p]))
    const affectedSet = new Set((affectedSupplierIds ?? []).map((id) => String(id)))

    // Draw normal links first, then affected (red) on top
    const normalLinks: typeof edges = []
    const affectedLinks: typeof edges = []
    edges.forEach((link) => {
      const src = pointById.get(link.source_id)
      const tgt = pointById.get(link.target_id)
      if (!src || !tgt) return
      const isAffected = affectedSet.has(String(link.source_id)) || affectedSet.has(String(link.target_id))
      if (isAffected) affectedLinks.push(link)
      else normalLinks.push(link)
    })
    ;[...normalLinks, ...affectedLinks].forEach((link) => {
      const src = pointById.get(link.source_id)!
      const tgt = pointById.get(link.target_id)!
      const isAffected = affectedSet.has(String(link.source_id)) || affectedSet.has(String(link.target_id))
      // Small height (m) so lines stay visible above 3D Tiles when globe is hidden
      const lineHeightM = 1800
      const positions = [
        Cesium.Cartesian3.fromDegrees(src.longitude, src.latitude, lineHeightM),
        Cesium.Cartesian3.fromDegrees(tgt.longitude, tgt.latitude, lineHeightM),
      ]
      const entity = viewer.entities.add({
        polyline: {
          positions,
          width: isAffected ? 5 : 2.5,
          material: isAffected ? Cesium.Color.RED.withAlpha(0.95) : Cesium.Color.CYAN.withAlpha(0.85),
          arcType: Cesium.ArcType.GEODESIC,
          // Show at all zoom levels (no max distance) so supply chain links are always visible on server
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, Number.POSITIVE_INFINITY),
        },
      })
      linkEntitiesRef.current.push(entity)
    })

    points.forEach((p) => {
      const fillHex = PIN_COLOR
      const entity = viewer.entities.add({
        id: `scss-point-${p.id}`,
        name: p.name,
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 0),
        billboard: {
          image: pinDataUrl(fillHex),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scale: p.is_critical ? 1.1 : 0.9,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          scaleByDistance: new Cesium.NearFarScalar(MARKER_VISIBLE_FROM_DISTANCE_M, 1.2, 1e7, 0.5),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(MARKER_VISIBLE_FROM_DISTANCE_M, Number.POSITIVE_INFINITY),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: p.name,
          font: '12px "JetBrains Mono", monospace',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.WHITE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -42),
          showBackground: true,
          backgroundColor: Cesium.Color.BLACK.withAlpha(0.65),
          backgroundPadding: new Cesium.Cartesian2(5, 2),
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(MARKER_VISIBLE_FROM_DISTANCE_M, Number.POSITIVE_INFINITY),
        },
      })
      entitiesRef.current.push(entity)
    })

    // Always show chains "from space" — do not zoom into city/zone
    if (viewer.camera) {
      if (points.length === 0) {
        // No chain: show one default view (globe from space)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(10, 50, FROM_SPACE_MIN_HEIGHT_M),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
          duration: 0.8,
        })
      } else if (points.length === 1) {
        const p = points[0]
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, FROM_SPACE_MIN_HEIGHT_M),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
          duration: 0.8,
        })
      } else {
        const lats = points.map((x) => x.latitude)
        const lngs = points.map((x) => x.longitude)
        const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
        const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
        const spanDeg = Math.max(
          Math.abs(Math.max(...lngs) - Math.min(...lngs)),
          Math.abs(Math.max(...lats) - Math.min(...lats))
        )
        const spanM = spanDeg * 111000
        const heightM = Math.max(spanM * 2.5, FROM_SPACE_MIN_HEIGHT_M)
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, heightM),
          orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
          duration: 0.8,
        })
      }
    }
  }, [points, edges, selectedSupplierId, affectedSupplierIds])

  // Even with no nodes, show the globe "from space" (one default view)
  return (
    <div className={`relative rounded-md overflow-hidden bg-zinc-900/80 border border-zinc-700 ${className}`} style={{ width, height }}>
      <div ref={containerRef} className="w-full h-full" style={{ background: '#030812' }} />
      {!ready && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030812]/90">
          <span className="text-zinc-400 text-sm">Loading globe…</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#030812]/90">
          <span className="text-red-400 text-sm">{error}</span>
        </div>
      )}
      <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-3 py-2 text-xs text-zinc-200 flex flex-wrap items-center gap-3">
        <span><span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 mr-1" />Suppliers</span>
        {affectedSupplierIds && affectedSupplierIds.length > 0 && (
          <span><span className="inline-block w-4 h-0.5 bg-red-500 mr-1 align-middle" />Affected by scenario</span>
        )}
      </div>
      <style>{`
        .cesium-viewer .cesium-widget-credits { display: none !important; }
        .cesium-viewer .cesium-viewer-bottom { display: none !important; }
      `}</style>
    </div>
  )
}
