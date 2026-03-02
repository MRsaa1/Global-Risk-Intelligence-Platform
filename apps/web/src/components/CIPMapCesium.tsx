/**
 * CIP Map 3D — отдельный глобус только для модуля CIP.
 * Показывает только координаты объектов инфраструктуры на глобусе.
 * Не использует логику Command Center (hotspots, zones, слои и т.д.).
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

// Google Photorealistic 3D Tiles (Cesium Ion)
const GOOGLE_PHOTOREALISTIC_ION_ID = 2275207

// Serialize Google 3D Tiles load to avoid "Resource is already being fetched" (React Strict Mode double-mount)
let google3dLoadQueue: Promise<Cesium.Cesium3DTileset | null> = Promise.resolve(null)

// Map pin (push pin) image as data URL — circle head + pointed bottom, like pins on a paper map
function pinDataUrl(fillHex: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 36" width="24" height="36">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="${fillHex}" stroke="#1a1a1a" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="6" fill="#fff" opacity="0.4"/>
  </svg>`
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)))
}

export interface CIPMapPoint {
  id: string
  name: string
  latitude: number
  longitude: number
  climate_risk_score?: number
}

export interface CIPMapLink {
  source_id: string
  target_id: string
}

interface CIPMapCesiumProps {
  points: CIPMapPoint[]
  links?: CIPMapLink[]
  onPointClick?: (id: string) => void
  /** Camera height in meters when flying to an object (50–100) */
  focusHeightMeters?: number
  className?: string
}

export default function CIPMapCesium({
  points,
  links = [],
  onPointClick,
  focusHeightMeters = 75,
  className = '',
}: CIPMapCesiumProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const viewerRef = useRef<Cesium.Viewer | null>(null)
  const google3dTilesetRef = useRef<Cesium.Cesium3DTileset | null>(null)
  const entitiesRef = useRef<Cesium.Entity[]>([])
  const linkEntitiesRef = useRef<Cesium.Entity[]>([])
  const focusHeightMetersRef = useRef(focusHeightMeters)
  focusHeightMetersRef.current = focusHeightMeters
  const pointsRef = useRef(points)
  pointsRef.current = points
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const onPointClickRef = useRef(onPointClick)
  onPointClickRef.current = onPointClick

  // Height for "object view" — ~1 km area visible (3D tiles of the place)
  const OBJECT_VIEW_HEIGHT_M = 450
  // Pin visible only when camera is farther than this (meters); hide when zoomed in to building
  const MARKER_VISIBLE_FROM_DISTANCE_M = 850

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
        if (ctrl && ctrl.zoomEventTypes) {
          ctrl.zoomEventTypes = [Cesium.CameraEventType.WHEEL, Cesium.CameraEventType.PINCH]
        }

        Cesium.Ion.defaultAccessToken = CESIUM_TOKEN
        const v = viewerRef.current
        if (!v || !isMounted || v.isDestroyed() || !v.scene) return
        if (v.scene.globe) {
          v.scene.globe.enableLighting = true
          v.scene.globe.depthTestAgainstTerrain = false
        }

        // Google Photorealistic 3D Tiles — single in-flight request to avoid "Resource is already being fetched" (Strict Mode)
        try {
          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return
          const scene = viewerRef.current.scene
          if (scene) scene.highDynamicRange = true
          const createGoogle = (Cesium as any).createGooglePhotorealistic3DTileset
          const apiOpts = { onlyUsingWithGoogleGeocoder: true }
          const tilesetOpts = { showCreditsOnScreen: true, maximumScreenSpaceError: 4 }
          google3dLoadQueue = google3dLoadQueue.then(async () => {
            if (typeof createGoogle === 'function') {
              return createGoogle(apiOpts, tilesetOpts)
            }
            return Cesium.Cesium3DTileset.fromIonAssetId(GOOGLE_PHOTOREALISTIC_ION_ID, tilesetOpts)
          })
          const tileset = await google3dLoadQueue
          if (!isMounted || !viewerRef.current || viewerRef.current.isDestroyed()) return
          if (!tileset || (typeof (tileset as any).isDestroyed === 'function' && (tileset as any).isDestroyed())) return
          google3dTilesetRef.current = tileset
          viewerRef.current.scene.primitives.add(tileset)
          if (viewerRef.current.scene.globe) viewerRef.current.scene.globe.show = false
        } catch (e) {
          console.warn('Google Photorealistic 3D Tiles failed, using OSM imagery:', e)
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
          if (!v || v.isDestroyed() || !v.scene || !v.camera) return
          const picked = v.scene.pick(click.position)
          let lng: number
          let lat: number
          let id: string | undefined
          if (Cesium.defined(picked) && picked.id && typeof picked.id.id === 'string' && picked.id.id.startsWith('cip-point-')) {
            id = picked.id.id.replace('cip-point-', '')
            const pos = picked.id.position?.getValue?.(Cesium.JulianDate.now())
            if (pos) {
              const carto = Cesium.Cartographic.fromCartesian(pos)
              lng = Cesium.Math.toDegrees(carto.longitude)
              lat = Cesium.Math.toDegrees(carto.latitude)
            } else {
              const pt = pointsRef.current.find((p) => p.id === id)
              if (!pt) return
              lng = pt.longitude
              lat = pt.latitude
            }
          } else {
            const pts = pointsRef.current
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
              const d = (p.longitude - clng) ** 2 + (p.latitude - clat) ** 2
              if (d < bestD) {
                bestD = d
                best = p
              }
            }
            id = best.id
            lng = best.longitude
            lat = best.latitude
          }
          if (id != null) onPointClickRef.current?.(id)
          v.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(lng, lat, OBJECT_VIEW_HEIGHT_M),
            orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 },
            duration: 1.2,
          })
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

  // Points + dependency links (polylines) on globe
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

    links.forEach((link) => {
      const src = pointById.get(link.source_id)
      const tgt = pointById.get(link.target_id)
      if (!src || !tgt) return
      const positions = [
        Cesium.Cartesian3.fromDegrees(src.longitude, src.latitude, 0),
        Cesium.Cartesian3.fromDegrees(tgt.longitude, tgt.latitude, 0),
      ]
      const entity = viewer.entities.add({
        polyline: {
          positions,
          width: 2,
          material: Cesium.Color.CYAN.withAlpha(0.7),
          clampToGround: true,
          arcType: Cesium.ArcType.GEODESIC,
          distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15_000_000),
        },
      })
      linkEntitiesRef.current.push(entity)
    })

    points.forEach((p) => {
      const risk = p.climate_risk_score ?? 0
      const fillHex =
        risk >= 70
          ? '#ef4444'
          : risk >= 40
            ? '#f59e0b'
            : '#22c55e'
      const entity = viewer.entities.add({
        id: `cip-point-${p.id}`,
        name: p.name,
        position: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, 0),
        billboard: {
          image: pinDataUrl(fillHex),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          horizontalOrigin: Cesium.HorizontalOrigin.CENTER,
          scale: 0.9,
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

    if (points.length === 1 && viewer.camera) {
      const p = points[0]
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(p.longitude, p.latitude, OBJECT_VIEW_HEIGHT_M),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-60), roll: 0 },
        duration: 0.8,
      })
    } else if (points.length > 1 && viewer.camera) {
      const lats = points.map((x) => x.latitude)
      const lngs = points.map((x) => x.longitude)
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2
      const spanDeg = Math.max(
        Math.abs(Math.max(...lngs) - Math.min(...lngs)),
        Math.abs(Math.max(...lats) - Math.min(...lats))
      )
      const spanM = spanDeg * 111000
      const height = Math.max(spanM * 2.5, 3_500_000)
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLng, centerLat, height),
        orientation: { heading: 0, pitch: Cesium.Math.toRadians(-90), roll: 0 },
        duration: 0.8,
      })
    }
  }, [points, links, focusHeightMeters])

  return (
    <div className={`relative w-full h-full ${className}`}>
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
      <style>{`
        .cesium-viewer .cesium-widget-credits { display: none !important; }
        .cesium-viewer .cesium-viewer-bottom { display: none !important; }
      `}</style>
    </div>
  )
}
