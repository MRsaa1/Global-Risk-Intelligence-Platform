/**
 * CityOS Module - City Operating System
 *
 * City twins, migration routes, capacity planning, forecasts (pilot).
 */
import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import {
  ArrowLeftIcon,
  PlusIcon,
  XMarkIcon,
  ArrowPathIcon,
  BuildingLibraryIcon,
  PlayIcon,
} from '@heroicons/react/24/outline'
import { getModuleById } from '../../lib/modules'
import AccessGate from '../../components/modules/AccessGate'
import AlertFeedPanel from '../../components/AlertFeedPanel'
import {
  listCities,
  createCity,
  listMigrationRoutes,
  createMigrationRoute,
  getForecast,
  getCityOSStatus,
  seedCityOS,
} from '../../services/cityosApi'
import type { CityTwin, MigrationRoute, CityOSStatus, ForecastResult } from '../../services/cityosApi'

export default function CityOSModule() {
  const navigate = useNavigate()
  const module = getModuleById('cityos')
  const [cities, setCities] = useState<CityTwin[]>([])
  const [routes, setRoutes] = useState<MigrationRoute[]>([])
  const [status, setStatus] = useState<CityOSStatus | null>(null)
  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cityModalOpen, setCityModalOpen] = useState(false)
  const [routeModalOpen, setRouteModalOpen] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'cities' | 'routes' | 'forecast'>('cities')
  const [seeding, setSeeding] = useState(false)
  const [loadingDemoRoutes, setLoadingDemoRoutes] = useState(false)

  const DEMO_ROUTES: Array<{ name: string; driver_type?: string; estimated_flow_per_year?: number }> = [
    { name: 'EU Southern Corridor', driver_type: 'climate', estimated_flow_per_year: 120_000 },
    { name: 'Mediterranean–Central Europe', driver_type: 'economic', estimated_flow_per_year: 85_000 },
    { name: 'Balkan Transit Route', driver_type: 'conflict', estimated_flow_per_year: 45_000 },
    { name: 'North Africa–Italy', driver_type: 'climate', estimated_flow_per_year: 65_000 },
    { name: 'Eastern Europe–Germany', driver_type: 'economic', estimated_flow_per_year: 95_000 },
    { name: 'Turkey–EU Gateway', driver_type: 'conflict', estimated_flow_per_year: 180_000 },
    { name: 'Sahel–Maghreb', driver_type: 'climate', estimated_flow_per_year: 32_000 },
    { name: 'Latin America–US Southern', driver_type: 'economic', estimated_flow_per_year: 250_000 },
    { name: 'Southeast Asia–Australia', driver_type: 'climate', estimated_flow_per_year: 18_000 },
    { name: 'Middle East–Europe', driver_type: 'conflict', estimated_flow_per_year: 72_000 },
  ]

  const loadAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [citiesRes, routesRes, statusRes] = await Promise.all([
        listCities({ limit: 200 }),
        listMigrationRoutes({ limit: 200 }),
        getCityOSStatus(),
      ])
      setCities(citiesRes)
      setRoutes(routesRes)
      setStatus(statusRes)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load CityOS data')
      setCities([])
      setRoutes([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAll()
  }, [loadAll])

  const handleCreateCity = async (data: {
    name: string
    country_code: string
    region?: string
    latitude?: number
    longitude?: number
    population?: number
    description?: string
    capacity_notes?: string
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await createCity(data)
      setCityModalOpen(false)
      await loadAll()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create city')
    } finally {
      setSubmitting(false)
    }
  }

  const handleCreateRoute = async (data: {
    name: string
    origin_city_id?: string
    destination_city_id?: string
    estimated_flow_per_year?: number
    driver_type?: string
    description?: string
  }) => {
    setSubmitting(true)
    setFormError(null)
    try {
      await createMigrationRoute(data)
      setRouteModalOpen(false)
      await loadAll()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Failed to create route')
    } finally {
      setSubmitting(false)
    }
  }

  const handleLoadDemoData = async () => {
    setSeeding(true)
    setError(null)
    try {
      await seedCityOS()
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load demo data')
    } finally {
      setSeeding(false)
    }
  }

  const handleLoadDemoRoutes = async () => {
    setLoadingDemoRoutes(true)
    setError(null)
    try {
      const originId = cities[0]?.id
      const destId = cities[1]?.id ?? cities[0]?.id
      for (const r of DEMO_ROUTES) {
        await createMigrationRoute({
          name: r.name,
          driver_type: r.driver_type,
          estimated_flow_per_year: r.estimated_flow_per_year,
          ...(originId && destId ? { origin_city_id: originId, destination_city_id: destId } : {}),
        })
      }
      await loadAll()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create demo routes')
    } finally {
      setLoadingDemoRoutes(false)
    }
  }

  const handleRunForecast = async () => {
    setForecastResult(null)
    try {
      const res = await getForecast(cities[0]?.id, 'capacity_planning')
      setForecastResult(res)
    } catch (e) {
      setForecastResult({
        scenario: 'capacity_planning',
        status: 'error',
        forecast: { message: e instanceof Error ? e.message : 'Forecast failed' },
        run_at: new Date().toISOString(),
      })
    }
  }

  if (!module) return null
  return (
    <AccessGate module={module}>
      <div className="min-h-screen bg-zinc-950 text-zinc-100">
        <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-900/95 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button onClick={() => navigate('/modules')} className="p-2 rounded-md hover:bg-zinc-800 transition-colors" title="Back to Strategic Modules">
                <ArrowLeftIcon className="w-5 h-5" />
              </button>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center">
                  <BuildingLibraryIcon className="w-6 h-6 text-zinc-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-zinc-100">{module.fullName}</h1>
                    <span className="text-zinc-500 text-xs">Phase {module.phase}</span>
                    <span className="px-1.5 py-0.5 bg-zinc-800 text-zinc-400 text-[10px] rounded border border-zinc-700">{module.priority}</span>
                  </div>
                  <p className="text-xs text-zinc-400 mt-0.5">{module.description}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={handleLoadDemoData} disabled={seeding || loading} className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm disabled:opacity-50" title="Load demo cities and routes">
                {seeding ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : null}
                {seeding ? 'Loading…' : 'Load demo data'}
              </button>
              <button onClick={() => loadAll()} disabled={loading} className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-sm disabled:opacity-50">
                <ArrowPathIcon className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              {status && (
                <span className="text-xs text-zinc-500">
                  {status.cities_count} cities · {status.migration_routes_count} routes
                </span>
              )}
            </div>
          </div>
        </header>

        <div className="border-b border-zinc-800 px-6">
          <nav className="flex gap-1">
            {(['cities', 'routes', 'forecast'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-sm font-medium rounded-t-md transition-colors ${activeTab === tab ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <main className="p-6 w-full max-w-full">
          <AlertFeedPanel moduleFilter="cityos" title="CityOS Monitor Alerts" compact />

          {error && (
            <div className="mb-4 p-4 rounded-md bg-red-500/10 border border-red-500/30 text-red-400/80 text-sm">{error}</div>
          )}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <ArrowPathIcon className="w-8 h-8 text-zinc-500 animate-spin" />
            </div>
          )}

          {!loading && activeTab === 'cities' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-zinc-200">City twins</h2>
                <button onClick={() => setCityModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm">
                  <PlusIcon className="w-4 h-4" />
                  Add city
                </button>
              </div>
              {cities.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8">No cities yet. Create one to get started.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">CityOS ID</th>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Country</th>
                        <th className="text-left py-3 px-4">Region</th>
                        <th className="text-left py-3 px-4">Population</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cities.map((c) => (
                        <tr key={c.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="py-3 px-4 font-mono text-zinc-400">{c.cityos_id}</td>
                          <td className="py-3 px-4">{c.name}</td>
                          <td className="py-3 px-4">{c.country_code}</td>
                          <td className="py-3 px-4">{c.region ?? '—'}</td>
                          <td className="py-3 px-4">{c.population != null ? c.population.toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {!loading && activeTab === 'routes' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-base font-semibold text-zinc-200">Migration routes</h2>
                <div className="flex items-center gap-2">
                  {routes.length === 0 && (
                    <button
                      onClick={handleLoadDemoRoutes}
                      disabled={loadingDemoRoutes}
                      className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-600 text-zinc-200 border border-zinc-500 hover:bg-zinc-500 text-sm disabled:opacity-50"
                    >
                      {loadingDemoRoutes ? 'Creating…' : 'Load 10 demo routes'}
                    </button>
                  )}
                  <button onClick={() => setRouteModalOpen(true)} className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 text-sm">
                    <PlusIcon className="w-4 h-4" />
                    Add route
                  </button>
                </div>
              </div>
              {routes.length === 0 ? (
                <p className="text-zinc-500 text-sm py-8">No migration routes yet. Add one or load 10 demo routes for testing.</p>
              ) : (
                <div className="rounded-md border border-zinc-800 overflow-x-auto">
                  <table className="w-full min-w-full text-sm">
                    <thead className="bg-zinc-800/50">
                      <tr>
                        <th className="text-left py-3 px-4">Name</th>
                        <th className="text-left py-3 px-4">Driver</th>
                        <th className="text-left py-3 px-4">Est. flow/year</th>
                      </tr>
                    </thead>
                    <tbody>
                      {routes.map((r) => (
                        <tr key={r.id} className="border-t border-zinc-800 hover:bg-zinc-800/30">
                          <td className="py-3 px-4">{r.name}</td>
                          <td className="py-3 px-4">{r.driver_type ?? '—'}</td>
                          <td className="py-3 px-4">{r.estimated_flow_per_year != null ? r.estimated_flow_per_year.toLocaleString() : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          )}

          {!loading && activeTab === 'forecast' && (
            <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
              <h2 className="text-base font-semibold text-zinc-200">Capacity / forecast</h2>
              <p className="text-zinc-500 text-sm">Pilot: capacity planning and migration forecasts.</p>
              <button onClick={handleRunForecast} className="flex items-center gap-2 px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600">
                <PlayIcon className="w-4 h-4" />
                Run capacity_planning forecast
              </button>
              {forecastResult && (
                <div className="mt-4 p-4 rounded-md border border-zinc-700 bg-zinc-800/50 text-sm">
                  <p className="text-zinc-500 text-xs mb-2">Pilot forecast — full migration dynamics and capacity planning to be integrated.</p>
                  <pre className="whitespace-pre-wrap text-zinc-300">{JSON.stringify(forecastResult, null, 2)}</pre>
                </div>
              )}
            </motion.div>
          )}
        </main>

        {cityModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl w-full w-[90vw] max-w-6xl p-6 my-8 text-zinc-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Add city twin</h3>
                <button onClick={() => setCityModalOpen(false)} className="p-2 rounded-md hover:bg-zinc-800"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  handleCreateCity({
                    name: (form.querySelector('[name=name]') as HTMLInputElement).value,
                    country_code: (form.querySelector('[name=country_code]') as HTMLInputElement).value.toUpperCase().slice(0, 2),
                    region: (form.querySelector('[name=region]') as HTMLInputElement).value || undefined,
                    population: parseInt((form.querySelector('[name=population]') as HTMLInputElement).value, 10) || undefined,
                    description: (form.querySelector('[name=description]') as HTMLInputElement).value || undefined,
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input name="name" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="e.g. Hamburg" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Country code *</label>
                  <input name="country_code" required maxLength={2} className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 uppercase" placeholder="DE" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Region</label>
                  <input name="region" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="e.g. North" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Population</label>
                  <input name="population" type="number" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="1800000" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Description</label>
                  <textarea name="description" rows={2} className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" />
                </div>
                {formError && <p className="text-red-400/80 text-sm">{formError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setCityModalOpen(false)} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50">{submitting ? 'Creating…' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}

        {routeModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 overflow-y-auto">
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="bg-zinc-900 border border-zinc-700 rounded-md shadow-xl w-full w-[90vw] max-w-6xl p-6 my-8 text-zinc-100">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold text-zinc-100">Add migration route</h3>
                <button onClick={() => setRouteModalOpen(false)} className="p-2 rounded-md hover:bg-zinc-800"><XMarkIcon className="w-5 h-5" /></button>
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  const form = e.target as HTMLFormElement
                  handleCreateRoute({
                    name: (form.querySelector('[name=name]') as HTMLInputElement).value,
                    origin_city_id: (form.querySelector('[name=origin_city_id]') as HTMLSelectElement).value || undefined,
                    destination_city_id: (form.querySelector('[name=destination_city_id]') as HTMLSelectElement).value || undefined,
                    estimated_flow_per_year: parseInt((form.querySelector('[name=estimated_flow_per_year]') as HTMLInputElement).value, 10) || undefined,
                    driver_type: (form.querySelector('[name=driver_type]') as HTMLSelectElement).value || undefined,
                    description: (form.querySelector('[name=description]') as HTMLInputElement).value || undefined,
                  })
                }}
                className="space-y-4"
              >
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Name *</label>
                  <input name="name" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="e.g. South to North" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Origin city</label>
                  <select name="origin_city_id" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100">
                    <option value="">— None —</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Destination city</label>
                  <select name="destination_city_id" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100">
                    <option value="">— None —</option>
                    {cities.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Driver type</label>
                  <select name="driver_type" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100">
                    <option value="">— None —</option>
                    <option value="climate">climate</option>
                    <option value="conflict">conflict</option>
                    <option value="economic">economic</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Est. flow per year</label>
                  <input name="estimated_flow_per_year" type="number" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" placeholder="10000" />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Description</label>
                  <input name="description" className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100" />
                </div>
                {formError && <p className="text-red-400/80 text-sm">{formError}</p>}
                <div className="flex gap-2 justify-end">
                  <button type="button" onClick={() => setRouteModalOpen(false)} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 hover:bg-zinc-600">Cancel</button>
                  <button type="submit" disabled={submitting} className="px-4 py-2 rounded-md bg-zinc-700 text-zinc-200 border border-zinc-600 hover:bg-zinc-600 disabled:opacity-50">{submitting ? 'Creating…' : 'Create'}</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </div>
    </AccessGate>
  )
}
