/**
 * Portfolio 3D Globe View - full-screen globe focused on portfolio assets by location.
 * Uses GET /portfolios/:id/map-data (assets with lat/lng); flies to first asset or centroid.
 */
import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import CesiumGlobe from '../components/CesiumGlobe'
import { portfoliosApi } from '../lib/api'

interface MapDataPoint {
  id: string
  name: string
  latitude: number
  longitude: number
  type?: string
  value?: number
  share_pct?: number
  climate_risk?: number
}

export default function PortfolioGlobePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [portfolioName, setPortfolioName] = useState<string>('')
  const [mapData, setMapData] = useState<MapDataPoint[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [globeReady, setGlobeReady] = useState(false)

  useEffect(() => {
    if (!id) return
    setGlobeReady(false)
    let cancelled = false
    setLoading(true)
    setError(null)
    Promise.all([portfoliosApi.get(id), portfoliosApi.getMapData(id)])
      .then(([portfolio, data]) => {
        if (cancelled) return
        setPortfolioName(portfolio?.name ?? 'Portfolio')
        setMapData(Array.isArray(data) ? data : [])
      })
      .catch((e) => {
        if (!cancelled) setError(e?.message ?? 'Failed to load portfolio or map data')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [id])

  // Camera distance from the building (~20% closer than 1800m for better view)
  const FOCUS_HEIGHT_M = 1440
  const focusCoordinates = useMemo(() => {
    if (!mapData.length) return null
    const first = mapData[0]
    return {
      lat: Number(first.latitude),
      lng: Number(first.longitude),
      height: FOCUS_HEIGHT_M,
    }
  }, [mapData])

  if (loading) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-3">
        <div className="w-8 h-8 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
        <p className="text-zinc-400">Загружаем…</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-red-400/80">{error}</p>
        <button
          onClick={() => navigate(`/portfolios/${id}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to portfolio
        </button>
      </div>
    )
  }

  if (!mapData.length) {
    return (
      <div className="fixed inset-0 bg-zinc-950 flex flex-col items-center justify-center gap-4 p-4">
        <p className="text-zinc-300 text-center max-w-md">
          No assets with location data. Add latitude and longitude to portfolio assets to view them on the globe.
        </p>
        <button
          onClick={() => navigate(`/portfolios/${id}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600"
        >
          <ArrowLeftIcon className="w-5 h-5" />
          Back to portfolio
        </button>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 flex flex-col bg-zinc-950">
      {globeReady && (
        <div className="absolute top-4 left-4 z-10 flex items-center gap-2">
          <button
            onClick={() => navigate(`/portfolios/${id}`)}
            className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800/90 border border-zinc-600 text-zinc-200 hover:bg-zinc-700"
            title="Back to portfolio"
          >
            <ArrowLeftIcon className="w-5 h-5" />
            Back
          </button>
          <span className="px-3 py-1.5 rounded-md bg-zinc-800/80 text-zinc-300 text-sm">
            {portfolioName} · {mapData.length} asset{mapData.length !== 1 ? 's' : ''} on globe
          </span>
        </div>
      )}
      <div className="flex-1 min-h-0 relative">
        <CesiumGlobe
          focusCoordinates={focusCoordinates}
          riskZones={[]}
          showGoogle3dLayer
          city3DView
          focusCoordinatesImmediate
          onReady={() => setGlobeReady(true)}
        />
        {!globeReady && (
          <div className="absolute inset-0 z-20 bg-zinc-950 flex flex-col items-center justify-center gap-3 pointer-events-none">
            <div className="w-8 h-8 border-2 border-zinc-500 border-t-zinc-200 rounded-full animate-spin" />
            <p className="text-zinc-400">Загружаем…</p>
          </div>
        )}
      </div>
    </div>
  )
}
