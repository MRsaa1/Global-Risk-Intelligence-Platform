import { useState, useMemo, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CloudIcon,
  SunIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
  BeakerIcon,
  FireIcon,
  BoltIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'

// Professional SVG icons for risk indicators
const RiskIcons = {
  flood: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" />
    </svg>
  ),
  heat: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  ),
  storm: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  ),
  drought: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
    </svg>
  ),
}

interface ClimateIndicator {
  name: string
  value: number
  unit: string
  threshold: number | null
  risk_level: string
}

interface ClimateData {
  latitude: number
  longitude: number
  indicators: ClimateIndicator[]
  overall_risk: string
}

interface WeatherForecast {
  timestamp: string
  temperature_c: number
  precipitation_mm: number
  wind_speed_ms: number
  humidity_percent: number
}

// Hamburg coordinates (default fallback)
const DEFAULT_LAT = 53.55
const DEFAULT_LON = 9.99
const DEFAULT_NAME = 'Hamburg'

// Fallback cities (if API fails)
const FALLBACK_CITIES = [
  { lat: 53.55, lon: 9.99, name: 'Hamburg', risk: 0.52 },
  { lat: 52.52, lon: 13.40, name: 'Berlin', risk: 0.55 },
  { lat: 48.14, lon: 11.58, name: 'Munich', risk: 0.52 },
  { lat: 50.94, lon: 6.96, name: 'Cologne', risk: 0.72 },
  { lat: 50.11, lon: 8.68, name: 'Frankfurt', risk: 0.58 },
]

interface Hotspot {
  id: string
  lat: number
  lng: number
  name: string
  risk: number
}

// Load hotspots from API
async function loadHotspots(): Promise<Hotspot[]> {
  try {
    const response = await fetch('/api/v1/geodata/hotspots?min_risk=0.4')
    if (!response.ok) throw new Error('API error')
    
    const geojson = await response.json()
    return geojson.features.map((f: any) => ({
      id: f.id || f.properties.id,
      lat: f.geometry.coordinates[1],
      lng: f.geometry.coordinates[0],
      name: f.properties.name,
      risk: f.properties.risk_score || 0.5,
    }))
  } catch (e) {
    console.warn('Failed to load hotspots from API, using fallback:', e)
    return FALLBACK_CITIES.map(c => ({ id: c.name.toLowerCase(), ...c }))
  }
}

// Get risk level from risk score
function getRiskLevel(risk: number): 'critical' | 'high' | 'medium' | 'low' {
  if (risk >= 0.8) return 'critical'
  if (risk >= 0.6) return 'high'
  if (risk >= 0.4) return 'medium'
  return 'low'
}

// Get risk level badge style
function getRiskBadgeStyle(level: 'critical' | 'high' | 'medium' | 'low') {
  switch (level) {
    case 'critical':
      return 'bg-zinc-700 text-zinc-200 border-zinc-600'
    case 'high':
      return 'bg-zinc-800 text-zinc-300 border-zinc-700'
    case 'medium':
      return 'bg-zinc-800 text-zinc-400 border-zinc-700'
    default:
      return 'bg-zinc-800 text-zinc-400 border-zinc-700'
  }
}

// Fetch climate indicators
async function fetchClimateIndicators(lat: number, lon: number): Promise<ClimateData> {
  const response = await fetch(`/api/v1/climate/indicators?latitude=${lat}&longitude=${lon}`)
  if (!response.ok) throw new Error('Failed to fetch climate data')
  return response.json()
}

// Fetch weather forecast
async function fetchWeatherForecast(lat: number, lon: number): Promise<{ data: WeatherForecast[] }> {
  const response = await fetch(`/api/v1/climate/forecast?latitude=${lat}&longitude=${lon}&days=3`)
  if (!response.ok) throw new Error('Failed to fetch forecast')
  return response.json()
}

// Risk level colors - professional muted palette
function getRiskStyle(level: string) {
  switch (level) {
    case 'extreme':
      return { color: 'text-zinc-200', bg: 'bg-zinc-800', border: 'border-zinc-600' }
    case 'high':
      return { color: 'text-zinc-300', bg: 'bg-zinc-800', border: 'border-zinc-700' }
    case 'elevated':
      return { color: 'text-zinc-300', bg: 'bg-zinc-800/50', border: 'border-zinc-700/50' }
    case 'normal':
    default:
      return { color: 'text-zinc-400', bg: 'bg-zinc-800', border: 'border-zinc-700' }
  }
}

// Get icon for indicator
function getIndicatorIcon(name: string) {
  switch (name) {
    case 'flood_risk': return RiskIcons.flood
    case 'heat_stress': return RiskIcons.heat
    case 'storm_risk': return RiskIcons.storm
    case 'drought_risk': return RiskIcons.drought
    default: return <BeakerIcon className="w-4 h-4" />
  }
}

// Indicator display names
const indicatorNames: Record<string, string> = {
  flood_risk: 'Flood Risk',
  heat_stress: 'Heat Stress',
  storm_risk: 'Storm Risk',
  drought_risk: 'Drought Risk',
}

export default function ClimateWidget() {
  const [searchQuery, setSearchQuery] = useState('')
  
  // Load hotspots from API
  const { data: hotspots = [], isLoading: hotspotsLoading } = useQuery({
    queryKey: ['geodata-hotspots'],
    queryFn: loadHotspots,
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // 10 minutes
  })
  
  // Sort hotspots by risk (highest first) and filter by search
  const sortedHotspots = useMemo(() => {
    const filtered = hotspots.filter(h => 
      h.name.toLowerCase().includes(searchQuery.toLowerCase())
    )
    return filtered.sort((a, b) => b.risk - a.risk)
  }, [hotspots, searchQuery])
  
  // Top 15 cities for main display
  const topHotspots = useMemo(() => sortedHotspots.slice(0, 15), [sortedHotspots])
  
  // Initialize location with first hotspot or fallback
  const defaultLocation = useMemo(() => {
    if (sortedHotspots.length > 0) {
      const first = sortedHotspots[0]
      return { lat: first.lat, lon: first.lng, name: first.name }
    }
    return { lat: DEFAULT_LAT, lon: DEFAULT_LON, name: DEFAULT_NAME }
  }, [sortedHotspots])
  
  const [location, setLocation] = useState(defaultLocation)
  
  // Update location when default changes (only on initial load)
  useEffect(() => {
    if (defaultLocation.name !== DEFAULT_NAME && location.name === DEFAULT_NAME && sortedHotspots.length > 0) {
      setLocation(defaultLocation)
    }
  }, [defaultLocation.name, sortedHotspots.length])
  
  // Fetch climate indicators
  const { data: climateData, isLoading: climateLoading, error: climateError, refetch } = useQuery({
    queryKey: ['climate-indicators', location.lat, location.lon],
    queryFn: () => fetchClimateIndicators(location.lat, location.lon),
    staleTime: 300000, // 5 minutes
    refetchInterval: 600000, // 10 minutes
    enabled: !!location.lat && !!location.lon,
  })
  
  // Fetch weather forecast
  const { data: forecastData, isLoading: forecastLoading } = useQuery({
    queryKey: ['weather-forecast', location.lat, location.lon],
    queryFn: () => fetchWeatherForecast(location.lat, location.lon),
    staleTime: 300000,
    refetchInterval: 600000,
    enabled: !!location.lat && !!location.lon,
  })
  
  const overallRiskStyle = climateData ? getRiskStyle(climateData.overall_risk) : getRiskStyle('normal')
  
  // Get current weather from first forecast point
  const currentWeather = forecastData?.data?.[0]
  
  // Risk level -> gradient (same map as PieChart hero)
  const riskBarGradient = (level: string) => {
    const map: Record<string, [string, string]> = {
      extreme: ['#ef4444', '#b91c1c'],
      high: ['#f97316', '#c2410c'],
      elevated: ['#eab308', '#a16207'],
      normal: ['#22c55e', '#15803d'],
    }
    const [start, end] = map[level] ?? map.normal
    return `linear-gradient(90deg, ${start}, ${end})`
  }
  const overallRiskGradient = (level: string) => {
    const map: Record<string, string> = {
      extreme: 'bg-gradient-to-r from-red-600 to-red-500',
      high: 'bg-gradient-to-r from-orange-600 to-orange-500',
      elevated: 'bg-gradient-to-r from-amber-600 to-amber-500',
      normal: 'bg-gradient-to-r from-emerald-600 to-emerald-500',
    }
    return map[level] ?? map.normal
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-md bg-zinc-900 border border-zinc-800 hover-glow"
      >
      <div className="rounded-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-zinc-800 rounded-md">
            <CloudIcon className="w-4 h-4 text-zinc-400" />
          </div>
          <h2 className="text-sm font-display font-semibold text-zinc-100">Climate Risk Monitor</h2>
          <span className="text-[10px] px-1.5 py-0.5 bg-zinc-800 text-zinc-400 rounded border border-zinc-700">LIVE</span>
        </div>
        <button 
          onClick={() => refetch()}
          className="p-1.5 hover:bg-zinc-800 rounded-md transition-colors"
          title="Refresh data"
        >
          <ArrowPathIcon className={`w-4 h-4 text-zinc-500 ${climateLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>
      
      {/* Location selector with search */}
      <div className="mb-4 space-y-2">
        {/* Search input */}
        <div className="relative">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search cities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-zinc-800 border border-zinc-700 rounded-md text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-zinc-600"
          />
        </div>
        
        {/* City buttons */}
        {hotspotsLoading ? (
          <div className="flex items-center justify-center py-4">
            <div className="w-4 h-4 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
          </div>
        ) : (
          <div className="flex gap-2 overflow-x-auto pb-2">
            {topHotspots.map((hotspot) => {
              const riskLevel = getRiskLevel(hotspot.risk)
              const isSelected = location.name === hotspot.name
              return (
                <button
                  key={hotspot.id}
                  onClick={() => setLocation({ lat: hotspot.lat, lon: hotspot.lng, name: hotspot.name })}
                  className={`px-3 py-1.5 rounded-md text-xs whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-zinc-700 text-zinc-100 border border-zinc-600 ring-1 ring-white/20 shadow-[0_0_8px_rgba(255,255,255,0.1)]'
                      : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 border border-zinc-700'
                  }`}
                >
                  <span>{hotspot.name}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] border ${getRiskBadgeStyle(riskLevel)}`}>
                    {riskLevel === 'critical' ? 'CRIT' : riskLevel === 'high' ? 'HIGH' : 'MED'}
                  </span>
                </button>
              )
            })}
            {searchQuery && sortedHotspots.length > 15 && (
              <div className="px-3 py-1.5 text-xs text-zinc-500 whitespace-nowrap">
                +{sortedHotspots.length - 15} more
              </div>
            )}
          </div>
        )}
      </div>
      
      {/* Current Weather */}
      {currentWeather && (
        <div className="mb-4 p-3 bg-dark-panel/50 rounded-md border border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-zinc-800 rounded-md">
              <SunIcon className="w-6 h-6 text-zinc-400" />
            </div>
            <div>
              <div className="text-3xl font-display font-bold gradient-text">{currentWeather.temperature_c.toFixed(1)}°C</div>
              <div className="text-xs text-zinc-400">{location.name}</div>
            </div>
          </div>
          <div className="text-right text-xs text-zinc-400 space-y-1">
            <div className="flex items-center justify-end gap-1.5">
              <span>Humidity</span>
              <span className="text-zinc-200">{currentWeather.humidity_percent}%</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span>Wind</span>
              <span className="text-zinc-200">{(currentWeather.wind_speed_ms * 3.6).toFixed(0)} km/h</span>
            </div>
            <div className="flex items-center justify-end gap-1.5">
              <span>Precip</span>
              <span className="text-zinc-200">{currentWeather.precipitation_mm} mm</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Overall Risk */}
      <div className={`mb-4 p-3 rounded-md border ${overallRiskStyle.border} flex items-center justify-between ${climateData?.overall_risk ? overallRiskGradient(climateData.overall_risk) : 'bg-zinc-800'} text-zinc-100`}>
        <div className="flex items-center gap-2">
          <ExclamationTriangleIcon className="w-4 h-4 opacity-90" />
          <span className="text-xs font-medium">Overall Risk Level</span>
        </div>
        <span className="text-sm font-display font-semibold uppercase">
          {climateData?.overall_risk || 'Loading...'}
        </span>
      </div>
      
      {/* Risk Indicators */}
      {climateLoading ? (
        <div className="flex items-center justify-center py-8">
          <div className="w-6 h-6 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
        </div>
      ) : climateError ? (
        <div className="text-center py-8 text-zinc-400">
          Failed to load climate data
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {climateData?.indicators.map((indicator) => {
            const style = getRiskStyle(indicator.risk_level)
            return (
              <div 
                key={indicator.name}
                className={`p-3 rounded-md border ${style.bg} ${style.border}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-zinc-400">
                    {indicatorNames[indicator.name] || indicator.name}
                  </span>
                  <span className={style.color}>{getIndicatorIcon(indicator.name)}</span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className={`text-lg font-display font-bold ${style.color}`}>
                    {indicator.value.toFixed(1)}
                  </span>
                  <span className="text-xs text-zinc-500">{indicator.unit}</span>
                </div>
                <div className="mt-2">
                  <div className="h-1 bg-zinc-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full rounded-full transition-all"
                      style={{ 
                        width: `${Math.min(100, (indicator.value / (indicator.threshold || 100)) * 100)}%`,
                        background: riskBarGradient(indicator.risk_level),
                      }}
                    />
                  </div>
                  {indicator.threshold && (
                    <div className="text-[10px] text-zinc-500 mt-1">
                      Threshold: {indicator.threshold.toFixed(1)} {indicator.unit}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
      
      {/* Data source */}
      <div className="mt-4 pt-3 border-t border-zinc-800 text-xs text-zinc-500 flex items-center justify-between">
        <span>Source: Open-Meteo API</span>
        <span>Updated: {new Date().toLocaleTimeString()}</span>
      </div>
      </div>
    </motion.div>
  )
}
