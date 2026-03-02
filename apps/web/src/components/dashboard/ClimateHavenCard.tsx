/**
 * Climate Haven — "Your climate haven by 2040" for a given location.
 * Fetches GET /api/v1/climate/haven?lat=&lon= and shows recommended city.
 */
import { useQuery } from '@tanstack/react-query'
import { MapPinIcon } from '@heroicons/react/24/outline'

interface ClimateHavenResponse {
  city_id: string
  name: string
  country: string
  latitude: number
  longitude: number
  composite_score: number
  reason: string
}

async function fetchClimateHaven(lat: number, lon: number): Promise<ClimateHavenResponse> {
  const res = await fetch(`/api/v1/climate/haven?lat=${lat}&lon=${lon}`)
  if (!res.ok) throw new Error('Failed to fetch climate haven')
  return res.json()
}

interface ClimateHavenCardProps {
  latitude: number
  longitude: number
}

export default function ClimateHavenCard({ latitude, longitude }: ClimateHavenCardProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['climate-haven', latitude, longitude],
    queryFn: () => fetchClimateHaven(latitude, longitude),
    staleTime: 5 * 60 * 1000,
  })

  return (
    <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4 h-full">
      <h3 className="text-sm font-display font-semibold text-zinc-300 mb-0.5 flex items-center gap-1.5">
        <MapPinIcon className="w-4 h-4 text-emerald-400/80" />
        Your climate haven by 2040
      </h3>
      <p className="text-[10px] text-zinc-500 mb-2">Recommended city with lowest climate &amp; risk exposure in your region</p>
      {isLoading && (
        <div className="flex items-center gap-2 text-zinc-500 text-xs">
          <span className="w-4 h-4 border border-zinc-600 border-t-emerald-500 rounded-full animate-spin" />
          Loading…
        </div>
      )}
      {error && (
        <p className="text-xs text-red-400/80">Unable to load haven.</p>
      )}
      {data && !isLoading && (
        <div className="space-y-1.5 text-sm">
          <p className="font-medium text-zinc-200">
            {data.name}, {data.country}
          </p>
          <p className="text-xs text-zinc-500">{data.reason}</p>
          <p className="text-[10px] text-zinc-500">
            Composite risk (climate + seismic + political): {(data.composite_score * 100).toFixed(0)}% — lower is safer.
          </p>
        </div>
      )}
    </div>
  )
}
