/**
 * Earth Engine — view Google Earth Engine data by point (climate, flood, elevation, land use).
 * Location: country + city selectors with auto-filled coordinates (from /data/countries.json and /data/cities-by-country.json).
 */
import { useState, useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
import { CloudIcon, MapPinIcon, ArrowPathIcon, ChevronDownIcon } from '@heroicons/react/24/outline'

interface EEStatus {
  enabled: boolean
  initialized?: boolean
  project_id: string | null
  message: string
}

interface CountryItem {
  code: string
  name: string
  lat?: number
  lng?: number
}

interface CityItem {
  id: string
  name: string
  lat: number
  lng: number
  population?: number
}

const API = '/api/v1/earth-engine'
const COUNTRIES_URL = '/data/countries.json'
const CITIES_URL = '/data/cities-by-country.json'

function roundCoord(n: number) {
  return Math.round(n * 100) / 100
}

function formatPop(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (n >= 1e3) return `${(n / 1e3).toFixed(0)}k`
  return String(n)
}

interface HistoricalClimateData {
  source?: string
  period?: { start_year?: number; end_year?: number }
  years?: Array<{
    year: number
    precipitation_mm?: number
    temp_max_c?: number
    temp_min_c?: number
    pdsi_mean?: number
    drought_months?: number
    drought_duration_months?: number
    drought_start_month?: number
    drought_end_month?: number
    event_duration_note?: string
  }>
  summary?: {
    wettest_year?: number | null
    driest_year?: number | null
    hottest_year?: number | null
    coldest_year?: number | null
    years_with_drought?: number
  }
  note_damage?: string
}

const MONTH_NAMES = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function HistoricalEventsBlock({ data }: { data: Record<string, unknown> }) {
  const typed = data as HistoricalClimateData
  const period = typed.period
  const years = Array.isArray(typed.years) ? typed.years : []
  const summary = typed.summary || {}
  const startYear = period?.start_year ?? 1990
  const endYear = period?.end_year ?? new Date().getFullYear() - 1

  const events: { year: number; label: string; duration?: string; type: 'drought' | 'wettest' | 'driest' | 'hottest' | 'coldest' }[] = []
  years.forEach((y) => {
    if ((y.drought_months ?? 0) >= 1) {
      const dur = y.drought_duration_months != null
        ? ` — lasted ${y.drought_duration_months} month(s)`
        + (y.drought_start_month != null && y.drought_end_month != null
          ? ` (${MONTH_NAMES[y.drought_start_month - 1]}–${MONTH_NAMES[y.drought_end_month - 1]})`
          : '')
        : ` (${y.drought_months} months with PDSI < -2)`
      events.push({ year: y.year, label: `${y.year}: Drought${dur}`, duration: y.event_duration_note, type: 'drought' })
    }
  })
  if (summary.wettest_year != null) {
    const y = years.find((r) => r.year === summary.wettest_year)
    const mm = y?.precipitation_mm != null ? ` — ${y.precipitation_mm} mm` : ''
    events.push({ year: summary.wettest_year, label: `${summary.wettest_year}: Wettest year${mm}`, duration: '12 months', type: 'wettest' })
  }
  if (summary.driest_year != null) {
    const y = years.find((r) => r.year === summary.driest_year)
    const mm = y?.precipitation_mm != null ? ` — ${y.precipitation_mm} mm` : ''
    events.push({ year: summary.driest_year, label: `${summary.driest_year}: Driest year${mm}`, duration: '12 months', type: 'driest' })
  }
  if (summary.hottest_year != null) {
    const y = years.find((r) => r.year === summary.hottest_year)
    const c = y?.temp_max_c != null ? ` — ${y.temp_max_c}°C avg max` : ''
    events.push({ year: summary.hottest_year, label: `${summary.hottest_year}: Hottest year${c}`, duration: '12 months', type: 'hottest' })
  }
  if (summary.coldest_year != null) {
    const y = years.find((r) => r.year === summary.coldest_year)
    const c = y?.temp_min_c != null ? ` — ${y.temp_min_c}°C avg min` : ''
    events.push({ year: summary.coldest_year, label: `${summary.coldest_year}: Coldest year${c}`, duration: '12 months', type: 'coldest' })
  }
  events.sort((a, b) => b.year - a.year)

  const isMock = String(typed.source || '').startsWith('mock')

  return (
    <div className="font-sans text-sm" style={{ fontFamily: 'inherit' }}>
      <div className="mb-3 text-zinc-400">
        Period: {startYear}–{endYear}
        {summary.years_with_drought != null && (
          <span className="ml-3">Years with drought (≥1 month PDSI &lt; -2): {summary.years_with_drought}</span>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-4">
        {summary.wettest_year != null && (
          <span className="text-zinc-300">Wettest year: <strong>{summary.wettest_year}</strong></span>
        )}
        {summary.driest_year != null && (
          <span className="text-zinc-300">Driest year: <strong>{summary.driest_year}</strong></span>
        )}
        {summary.hottest_year != null && (
          <span className="text-zinc-300">Hottest year: <strong>{summary.hottest_year}</strong></span>
        )}
        {summary.coldest_year != null && (
          <span className="text-zinc-300">Coldest year: <strong>{summary.coldest_year}</strong></span>
        )}
      </div>
      <h3 className="text-xs font-medium text-zinc-500 mb-2 uppercase tracking-wide">Events (EE TerraClimate) — duration</h3>
      <ul className="space-y-1.5 max-h-64 overflow-y-auto pr-2">
        {events.length === 0 && (
          <li className="text-zinc-500">No notable events in this period.</li>
        )}
        {events.map((ev) => (
          <li key={`${ev.year}-${ev.type}`} className="flex flex-col gap-0.5 text-zinc-300">
            <span className="flex items-baseline gap-2">
              <span className="text-zinc-500 tabular-nums shrink-0">{ev.year}</span>
              <span className={
                ev.type === 'drought' ? 'text-amber-400' :
                ev.type === 'wettest' ? 'text-sky-400' :
                ev.type === 'driest' ? 'text-orange-400' :
                ev.type === 'hottest' ? 'text-red-400' :
                ev.type === 'coldest' ? 'text-blue-400' : ''
              }>
                {ev.label}
              </span>
            </span>
            {ev.duration && <span className="text-xs text-zinc-500 pl-6">Duration: {ev.duration}</span>}
          </li>
        ))}
      </ul>
      {typed.note_damage && (
        <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-800 pt-2">{typed.note_damage}</p>
      )}
      {isMock && (
        <p className="mt-2 text-xs text-zinc-500">Data is mock. Configure Earth Engine for real historical events.</p>
      )}
    </div>
  )
}

export default function EarthEnginePage() {
  const [status, setStatus] = useState<EEStatus | null>(null)
  const [countriesList, setCountriesList] = useState<CountryItem[]>([])
  const [citiesByCountry, setCitiesByCountry] = useState<Record<string, CityItem[]>>({})
  const [countryCode, setCountryCode] = useState('')
  const [cityId, setCityId] = useState('')
  const [lat, setLat] = useState('40.71')
  const [lng, setLng] = useState('-74.00')
  const [countrySearchOpen, setCountrySearchOpen] = useState(false)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')
  const [citySearchOpen, setCitySearchOpen] = useState(false)
  const [citySearchQuery, setCitySearchQuery] = useState('')
  const [loading, setLoading] = useState<string | null>(null)
  const [climate, setClimate] = useState<Record<string, unknown> | null>(null)
  const [flood, setFlood] = useState<Record<string, unknown> | null>(null)
  const [elevation, setElevation] = useState<Record<string, unknown> | null>(null)
  const [landUse, setLandUse] = useState<Record<string, unknown> | null>(null)
  const [precipitation, setPrecipitation] = useState<Record<string, unknown> | null>(null)
  const [drought, setDrought] = useState<Record<string, unknown> | null>(null)
  const [wildfire, setWildfire] = useState<Record<string, unknown> | null>(null)
  const [historicalClimate, setHistoricalClimate] = useState<Record<string, unknown> | null>(null)
  const [waterIndex, setWaterIndex] = useState<Record<string, unknown> | null>(null)
  const [floodExtent, setFloodExtent] = useState<Record<string, unknown> | null>(null)
  const [waterStress, setWaterStress] = useState<Record<string, unknown> | null>(null)
  const [temperatureAnomaly, setTemperatureAnomaly] = useState<Record<string, unknown> | null>(null)
  const [wind, setWind] = useState<Record<string, unknown> | null>(null)
  const [autoHistoricalEvents, setAutoHistoricalEvents] = useState<Record<string, unknown> | null>(null)
  const [autoHistoricalEventsLoading, setAutoHistoricalEventsLoading] = useState(false)

  useEffect(() => {
    fetch(`${API}/status`)
      .then((r) => r.json())
      .then(setStatus)
      .catch(() => setStatus({ enabled: false, project_id: null, message: 'API error' }))
  }, [])

  useEffect(() => {
    fetch(COUNTRIES_URL)
      .then((r) => r.ok ? r.json() : [])
      .then((data: CountryItem[]) => setCountriesList(Array.isArray(data) ? data.sort((a, b) => a.name.localeCompare(b.name)) : []))
      .catch(() => setCountriesList([]))
  }, [])

  useEffect(() => {
    fetch(CITIES_URL)
      .then((r) => r.ok ? r.json() : {})
      .then((data: Record<string, CityItem[]>) => setCitiesByCountry(typeof data === 'object' && data !== null ? data : {}))
      .catch(() => setCitiesByCountry({}))
  }, [])

  const citiesForCountry = useMemo(() => {
    if (!countryCode || !citiesByCountry[countryCode]) return []
    const list = [...citiesByCountry[countryCode]]
    list.sort((a, b) => (b.population ?? 0) - (a.population ?? 0))
    return list
  }, [countryCode, citiesByCountry])

  const countrySearchFiltered = useMemo(() => {
    if (!countrySearchQuery.trim()) return countriesList
    const q = countrySearchQuery.toLowerCase()
    return countriesList.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q))
  }, [countriesList, countrySearchQuery])

  const citySearchFiltered = useMemo(() => {
    if (!citySearchQuery.trim()) return citiesForCountry
    const q = citySearchQuery.toLowerCase()
    return citiesForCountry.filter(c => c.name.toLowerCase().includes(q))
  }, [citiesForCountry, citySearchQuery])

  const selectedCountryName = countryCode ? (countriesList.find(c => c.code === countryCode)?.name ?? countryCode) : ''
  const selectedCity = cityId ? citiesForCountry.find(c => c.id === cityId) : null

  const onSelectCountry = (code: string, name: string) => {
    setCountryCode(code)
    setCountrySearchQuery('')
    setCountrySearchOpen(false)
    setCityId('')
    setCitySearchQuery('')
    setCitySearchOpen(false)
    const list = citiesByCountry[code]
    const sorted = list ? [...list].sort((a, b) => (b.population ?? 0) - (a.population ?? 0)) : []
    const firstCity = sorted[0]
    if (firstCity) {
      setCityId(firstCity.id)
      setLat(String(roundCoord(firstCity.lat)))
      setLng(String(roundCoord(firstCity.lng)))
    } else {
      const c = countriesList.find(x => x.code === code)
      if (c?.lat != null && c?.lng != null) {
        setLat(String(roundCoord(c.lat)))
        setLng(String(roundCoord(c.lng)))
      }
    }
  }

  const onSelectCity = (city: CityItem) => {
    setCityId(city.id)
    setLat(String(roundCoord(city.lat)))
    setLng(String(roundCoord(city.lng)))
    setCitySearchQuery('')
    setCitySearchOpen(false)
  }

  useEffect(() => {
    if (selectedCity) {
      setLat(String(roundCoord(selectedCity.lat)))
      setLng(String(roundCoord(selectedCity.lng)))
    }
  }, [selectedCity?.id])

  // Auto-load historical climate events when country or city is selected (with valid coords)
  useEffect(() => {
    if (!countryCode && !cityId) {
      setAutoHistoricalEvents(null)
      return
    }
    const la = parseFloat(lat)
    const lo = parseFloat(lng)
    if (isNaN(la) || isNaN(lo)) return
    let cancelled = false
    setAutoHistoricalEventsLoading(true)
    setAutoHistoricalEvents(null)
    fetch(`${API}/historical-climate?lat=${la}&lng=${lo}&start_year=1990`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) {
          setAutoHistoricalEvents(data)
        }
      })
      .catch(() => {
        if (!cancelled) setAutoHistoricalEvents(null)
      })
      .finally(() => {
        if (!cancelled) setAutoHistoricalEventsLoading(false)
      })
    return () => { cancelled = true }
  }, [countryCode, cityId, lat, lng])

  const fetchData = async (type: 'climate' | 'flood-risk' | 'elevation' | 'land-use' | 'precipitation' | 'drought' | 'wildfire' | 'historical-climate' | 'water-index' | 'flood-extent' | 'water-stress' | 'temperature-anomaly' | 'wind') => {
    const la = parseFloat(lat)
    const lo = parseFloat(lng)
    if (isNaN(la) || isNaN(lo)) return
    setLoading(type)
    try {
      let path = type === 'flood-risk' ? 'flood-risk' : type
      let url = `${API}/${path}?lat=${la}&lng=${lo}`
      if (['water-index', 'flood-extent', 'water-stress', 'temperature-anomaly', 'wind'].includes(type)) {
        url += '&radius_m=5000'
        if (type === 'flood-extent') url += '&start_date=&end_date='
        if (type === 'temperature-anomaly') url += '&baseline_start_year=1990&baseline_end_year=2020'
      }
      const res = await fetch(url)
      const data = await res.json()
      if (type === 'climate') setClimate(data)
      if (type === 'flood-risk') setFlood(data)
      if (type === 'elevation') setElevation(data)
      if (type === 'land-use') setLandUse(data)
      if (type === 'precipitation') setPrecipitation(data)
      if (type === 'drought') setDrought(data)
      if (type === 'wildfire') setWildfire(data)
      if (type === 'historical-climate') setHistoricalClimate(data)
      if (type === 'water-index') setWaterIndex(data)
      if (type === 'flood-extent') setFloodExtent(data)
      if (type === 'water-stress') setWaterStress(data)
      if (type === 'temperature-anomaly') setTemperatureAnomaly(data)
      if (type === 'wind') setWind(data)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="min-h-full p-6 bg-zinc-950 font-sans text-zinc-100" style={{ fontFamily: "'JetBrains Mono', monospace" }}>
      <div className="w-full max-w-[1920px] mx-auto">
        <h1 className="text-2xl font-display font-semibold text-zinc-100 mb-2 flex items-center gap-2">
          <CloudIcon className="w-8 h-8 text-zinc-400" />
          Earth Engine
        </h1>
        <p className="text-zinc-400 text-sm mb-6">
          Point data from Google Earth Engine: climate (ERA5, MODIS), flood (JRC), elevation (SRTM), land use (Dynamic World), precipitation (CHIRPS), drought (TerraClimate PDSI), wildfire (MODIS), historical climate (TerraClimate by year).
        </p>

        {/* Status */}
        <div className="glass rounded-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-2 font-display">Connection</h2>
          {status ? (
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-sm ${
                  status.initialized ? 'bg-emerald-500/20 text-emerald-400' : status.enabled ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-600 text-zinc-400'
                }`}
              >
                {status.initialized ? 'Ready (real data)' : status.enabled ? 'Mock — EE not initialized' : 'Not configured'}
              </span>
              {status.project_id && <span className="text-zinc-500 text-sm">Project: {status.project_id}</span>}
              {(!status.enabled || !status.initialized) && <span className="text-zinc-500 text-sm">{status.message}</span>}
            </div>
          ) : (
            <span className="text-zinc-500">Loading...</span>
          )}
        </div>

        {/* Location: Country + City (coordinates auto-filled) */}
        <div className="glass rounded-lg p-4 mb-6">
          <h2 className="text-sm font-medium text-zinc-300 mb-3 flex items-center gap-2 font-display">
            <MapPinIcon className="w-4 h-4" />
            Location
          </h2>
          <div className="flex flex-wrap gap-6 items-end">
            <div className="relative min-w-[200px]">
              <label className="block text-xs text-zinc-500 mb-1">Country</label>
              <div className="relative">
                <input
                  type="text"
                  value={countrySearchOpen ? countrySearchQuery : selectedCountryName}
                  onChange={(e) => {
                    setCountrySearchQuery(e.target.value)
                    setCountrySearchOpen(true)
                  }}
                  onFocus={() => { if (countriesList.length) setCountrySearchOpen(true) }}
                  onBlur={() => setTimeout(() => setCountrySearchOpen(false), 200)}
                  placeholder="Search country…"
                  className="w-full px-3 py-2 pr-8 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans"
                  style={{ fontFamily: 'inherit' }}
                />
                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
              {countrySearchOpen && (
                <ul className="absolute z-20 mt-1 max-h-56 overflow-auto rounded border border-zinc-700 bg-zinc-900 py-1 shadow-xl w-full">
                  {countrySearchFiltered.slice(0, 200).map((c) => (
                    <li key={c.code}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 font-sans"
                        style={{ fontFamily: 'inherit' }}
                        onClick={() => onSelectCountry(c.code, c.name)}
                      >
                        {c.name}
                      </button>
                    </li>
                  ))}
                  {countrySearchFiltered.length === 0 && (
                    <li className="px-3 py-2 text-xs text-zinc-500">No countries found</li>
                  )}
                </ul>
              )}
            </div>
            <div className="relative min-w-[220px]">
              <label className="block text-xs text-zinc-500 mb-1">City</label>
              <div className="relative">
                <input
                  type="text"
                  value={citySearchOpen ? citySearchQuery : (selectedCity?.name ?? '')}
                  onChange={(e) => {
                    setCitySearchQuery(e.target.value)
                    setCitySearchOpen(true)
                  }}
                  onFocus={() => { if (citiesForCountry.length) setCitySearchOpen(true) }}
                  onBlur={() => setTimeout(() => setCitySearchOpen(false), 200)}
                  placeholder={countryCode ? 'Search city…' : 'Select country first'}
                  disabled={!countryCode}
                  className="w-full px-3 py-2 pr-8 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans disabled:opacity-50"
                  style={{ fontFamily: 'inherit' }}
                />
                <ChevronDownIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500 pointer-events-none" />
              </div>
              {citySearchOpen && countryCode && (
                <ul className="absolute z-20 mt-1 max-h-56 overflow-auto rounded border border-zinc-700 bg-zinc-900 py-1 shadow-xl w-full">
                  {citySearchFiltered.slice(0, 150).map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm text-zinc-200 hover:bg-zinc-700 font-sans flex justify-between"
                        style={{ fontFamily: 'inherit' }}
                        onClick={() => onSelectCity(c)}
                      >
                        <span>{c.name}</span>
                        {c.population != null && <span className="text-zinc-500 text-xs">{formatPop(c.population)}</span>}
                      </button>
                    </li>
                  ))}
                  {citySearchFiltered.length === 0 && (
                    <li className="px-3 py-2 text-xs text-zinc-500">No cities found</li>
                  )}
                </ul>
              )}
            </div>
            <div className="flex gap-4">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Latitude</label>
                <input
                  type="text"
                  value={lat}
                  onChange={(e) => setLat(e.target.value)}
                  className="w-24 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Longitude</label>
                <input
                  type="text"
                  value={lng}
                  onChange={(e) => setLng(e.target.value)}
                  className="w-24 px-3 py-2 rounded bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm font-sans"
                  style={{ fontFamily: 'inherit' }}
                />
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(['climate', 'flood-risk', 'elevation', 'land-use', 'precipitation', 'drought', 'wildfire', 'historical-climate', 'water-index', 'flood-extent', 'water-stress', 'temperature-anomaly', 'wind'] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => fetchData(type)}
                  disabled={loading !== null}
                  className="px-4 py-2 rounded bg-zinc-700 hover:bg-zinc-600 disabled:opacity-50 text-zinc-200 text-sm flex items-center gap-2 font-sans"
                  style={{ fontFamily: 'inherit' }}
                >
                  {loading === type ? (
                    <ArrowPathIcon className="w-4 h-4 animate-spin" />
                  ) : null}
                  {type === 'climate' && 'Climate'}
                  {type === 'flood-risk' && 'Flood risk'}
                  {type === 'elevation' && 'Elevation'}
                  {type === 'land-use' && 'Land use'}
                  {type === 'precipitation' && 'Precipitation'}
                  {type === 'drought' && 'Drought'}
                  {type === 'wildfire' && 'Wildfire'}
                  {type === 'historical-climate' && 'Historical climate'}
                  {type === 'water-index' && 'Water index'}
                  {type === 'flood-extent' && 'Flood extent'}
                  {type === 'water-stress' && 'Water stress'}
                  {type === 'temperature-anomaly' && 'Temp anomaly'}
                  {type === 'wind' && 'Wind'}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Historical climate events (auto when country/city selected) */}
        {(countryCode || cityId) && (
          <div className="glass rounded-lg p-4 mb-6">
            <h2 className="text-sm font-medium text-zinc-300 mb-2 font-display flex items-center gap-2">
              <MapPinIcon className="w-4 h-4" />
              Historical climate events at {selectedCity?.name || selectedCountryName || 'location'}
            </h2>
            {autoHistoricalEventsLoading && (
              <div className="flex items-center gap-2 text-zinc-500 text-sm py-4">
                <ArrowPathIcon className="w-5 h-5 animate-spin" />
                Loading events from Earth Engine…
              </div>
            )}
            {!autoHistoricalEventsLoading && autoHistoricalEvents && (
              <HistoricalEventsBlock data={autoHistoricalEvents} />
            )}
            {!autoHistoricalEventsLoading && !autoHistoricalEvents && (countryCode || cityId) && (
              <p className="text-zinc-500 text-sm py-2">No historical climate data for this location.</p>
            )}
          </div>
        )}

        {/* Results */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {climate && (
            <ResultCard title="Climate" source={climate.source} data={climate} />
          )}
          {flood && (
            <ResultCard title="Flood risk" source={flood.source} data={flood} />
          )}
          {elevation && (
            <ResultCard title="Elevation" source={elevation.source} data={elevation} />
          )}
          {landUse && (
            <ResultCard title="Land use" source={landUse.source} data={landUse} />
          )}
          {precipitation && (
            <ResultCard title="Precipitation" source={precipitation.source} data={precipitation} />
          )}
          {drought && (
            <ResultCard
              title="Drought"
              source={drought.source as string}
              data={drought}
              extra={
                (drought.drought_severity_class != null || drought.soil_moisture_percentile != null) ? (
                  <div className="flex flex-wrap gap-3 text-xs mb-2">
                    {drought.drought_severity_class != null && (
                      <span className="text-zinc-300">Severity: <strong className="text-amber-400">{String(drought.drought_severity_class)}</strong></span>
                    )}
                    {drought.soil_moisture_percentile != null && (
                      <span className="text-zinc-300">Soil moisture percentile: <strong>{String(drought.soil_moisture_percentile)}</strong></span>
                    )}
                  </div>
                ) : undefined
              }
            />
          )}
          {wildfire && (
            <ResultCard title="Wildfire" source={wildfire.source} data={wildfire} />
          )}
          {historicalClimate && (
            <ResultCard title="Historical climate" source={historicalClimate.source as string} data={historicalClimate} />
          )}
          {waterIndex && (
            <ResultCard title="Water index (MNDWI/NDWI)" source={waterIndex.source as string} data={waterIndex} />
          )}
          {floodExtent && (
            <ResultCard title="Flood extent" source={floodExtent.source as string} data={floodExtent} />
          )}
          {waterStress && (
            <ResultCard title="Water stress" source={waterStress.source as string} data={waterStress} />
          )}
          {temperatureAnomaly && (
            <ResultCard title="Temperature anomaly" source={temperatureAnomaly.source as string} data={temperatureAnomaly} />
          )}
          {wind && (
            <ResultCard title="Wind" source={wind.source as string} data={wind} />
          )}
        </div>

        {(!status?.enabled || !status?.initialized) && (
          <p className="mt-6 text-zinc-500 text-sm font-sans" style={{ fontFamily: 'inherit' }}>
            {status?.message || 'Set GCLOUD_PROJECT_ID and run gcloud auth application-default login (or set GCLOUD_SERVICE_ACCOUNT_JSON). See docs/EARTH_ENGINE_SETUP.md.'}
          </p>
        )}
      </div>
    </div>
  )
}

function ResultCard({
  title,
  source,
  data,
  extra,
}: {
  title: string
  source: string
  data: Record<string, unknown>
  extra?: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-lg p-4 font-sans"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
    >
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-medium text-zinc-200 font-display">{title}</h3>
        <span
          className={`text-xs px-2 py-0.5 rounded ${
            source === 'google_earth_engine' || (source && !String(source).startsWith('mock'))
              ? 'bg-emerald-500/20 text-emerald-400'
              : 'bg-zinc-600 text-zinc-400'
          }`}
        >
          {String(source)}
        </span>
      </div>
      {extra}
      <pre className="text-xs text-zinc-400 overflow-auto max-h-40 bg-zinc-900/50 rounded p-2 font-mono" style={{ fontFamily: 'inherit' }}>
        {JSON.stringify(data, null, 2)}
      </pre>
    </motion.div>
  )
}
