/**
 * Command Center top-right panel: layer toggles + collapsible nav icons (Dashboard, Assets, …).
 * By default only the Dashboard (home) icon is visible; expand to show all quick actions.
 */
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { BuildingLibraryIcon, ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline'
import { quickActionsCommandCenter, quickActionIconColors } from '../../config/quickActions'

const MONTHS_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

function DateTimePickerEn({ value, onChange, className = '' }: { value: string | null; onChange: (iso: string | null) => void; className?: string }) {
  const now = new Date()
  const d = value ? new Date(value) : now
  const valid = !isNaN(d.getTime())
  const y = valid ? d.getFullYear() : now.getFullYear()
  const m = valid ? d.getMonth() : now.getMonth()
  const day = valid ? d.getDate() : now.getDate()
  const h = valid ? d.getHours() : 12
  const min = valid ? d.getMinutes() : 0
  const years = Array.from({ length: 5 }, (_, i) => now.getFullYear() - 1 + i)
  const daysInMonth = new Date(y, m + 1, 0).getDate()
  return (
    <div className={`flex items-center gap-0.5 ${className}`}>
      <select value={m} onChange={(e) => { const v = new Date(y, +e.target.value, day, h, min); onChange(v.toISOString()) }} className="bg-transparent border-0 text-zinc-300 text-[10px] py-0.5 pr-0 focus:ring-0 cursor-pointer">
        {MONTHS_EN.map((name, i) => <option key={i} value={i}>{name}</option>)}
      </select>
      <select value={day} onChange={(e) => { const v = new Date(y, m, +e.target.value, h, min); onChange(v.toISOString()) }} className="bg-transparent border-0 text-zinc-300 text-[10px] py-0.5 pr-0 focus:ring-0 cursor-pointer w-7">
        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}</option>)}
      </select>
      <select value={y} onChange={(e) => { const v = new Date(+e.target.value, m, day, h, min); onChange(v.toISOString()) }} className="bg-transparent border-0 text-zinc-300 text-[10px] py-0.5 pr-0 focus:ring-0 cursor-pointer w-12">
        {years.map((yr) => <option key={yr} value={yr}>{yr}</option>)}
      </select>
      <span className="text-zinc-500 text-[10px] mx-0.5">at</span>
      <select value={h} onChange={(e) => { const v = new Date(y, m, day, +e.target.value, min); onChange(v.toISOString()) }} className="bg-transparent border-0 text-zinc-300 text-[10px] py-0.5 pr-0 focus:ring-0 cursor-pointer w-10">
        {Array.from({ length: 24 }, (_, i) => i).map((hr) => <option key={hr} value={hr}>{String(hr).padStart(2,'0')}</option>)}
      </select>
      <span className="text-zinc-500 text-[10px]">:</span>
      <select value={min} onChange={(e) => { const v = new Date(y, m, day, h, +e.target.value); onChange(v.toISOString()) }} className="bg-transparent border-0 text-zinc-300 text-[10px] py-0.5 pr-0 focus:ring-0 cursor-pointer w-10">
        {[0,15,30,45].map((mm) => <option key={mm} value={mm}>{String(mm).padStart(2,'0')}</option>)}
      </select>
    </div>
  )
}

const FLOOD_LEVELS_M = [0.5, 1, 2, 3, 6, 9] as const

export interface CommandCenterTopBarProps {
  commandMode: boolean
  topBarExpanded: boolean
  setTopBarExpanded: (v: boolean) => void
  highFidelityScenarioId: string | null
  setHighFidelityScenarioId: (v: string | null) => void
  highFidelityScenarioIds: string[]
  selectedCountryCode: string | null
  selectedCountryCity: { id: string; name: string; lat: number; lng: number } | null
  showGoogle3dLayer: boolean
  setShowGoogle3dLayer: (v: boolean) => void
  showZoneRiskVector: boolean
  showH3Layer: boolean
  setShowH3Layer: (v: boolean) => void
  setShowZoneRiskVector: (v: boolean) => void
  showZoneRiskVectorPanel: boolean
  setShowZoneRiskVectorPanel: (fn: (prev: boolean) => boolean) => void
  zoneRiskVectorDimension: string
  setZoneRiskVectorDimension: (v: string) => void
  zoneRiskVectorResolution: number
  setZoneRiskVectorResolution: (v: number) => void
  timeSliderValue: string | null
  setTimeSliderValue: (v: string | null) => void
  h3Resolution: number
  setH3Resolution: (v: number) => void
  showFloodLayer: boolean
  setShowFloodLayer: (v: boolean) => void
  showWindLayer: boolean
  setShowWindLayer: (v: boolean) => void
  showMetroFloodLayer: boolean
  setShowMetroFloodLayer: (v: boolean) => void
  showHeatLayer: boolean
  setShowHeatLayer: (v: boolean) => void
  showHeavyRainLayer: boolean
  setShowHeavyRainLayer: (v: boolean) => void
  showDroughtLayer: boolean
  setShowDroughtLayer: (v: boolean) => void
  showUvLayer: boolean
  setShowUvLayer: (v: boolean) => void
  showActiveIncidentsLayer: boolean
  setShowActiveIncidentsLayer: (v: boolean) => void
  showEarthquakeLayer: boolean
  setShowEarthquakeLayer: (v: boolean) => void
  earthquakeMinMagnitude: number
  setEarthquakeMinMagnitude: (v: number) => void
  floodDepthOverride: number
  setFloodDepthOverride: (v: number) => void
}

export default function CommandCenterTopBar(props: CommandCenterTopBarProps) {
  const navigate = useNavigate()
  const {
    commandMode,
    topBarExpanded,
    setTopBarExpanded,
    highFidelityScenarioId,
    setHighFidelityScenarioId,
    highFidelityScenarioIds,
    selectedCountryCode,
    selectedCountryCity,
    showGoogle3dLayer,
    setShowGoogle3dLayer,
    showZoneRiskVector,
    showH3Layer,
    setShowH3Layer,
    setShowZoneRiskVector,
    showZoneRiskVectorPanel,
    setShowZoneRiskVectorPanel,
    zoneRiskVectorDimension,
    setZoneRiskVectorDimension,
    zoneRiskVectorResolution,
    setZoneRiskVectorResolution,
    timeSliderValue,
    setTimeSliderValue,
    h3Resolution,
    setH3Resolution,
    showFloodLayer,
    setShowFloodLayer,
    showWindLayer,
    setShowWindLayer,
    showMetroFloodLayer,
    setShowMetroFloodLayer,
    showHeatLayer,
    setShowHeatLayer,
    showHeavyRainLayer,
    setShowHeavyRainLayer,
    showDroughtLayer,
    setShowDroughtLayer,
    showUvLayer,
    setShowUvLayer,
    showActiveIncidentsLayer,
    setShowActiveIncidentsLayer,
    showEarthquakeLayer,
    setShowEarthquakeLayer,
    earthquakeMinMagnitude,
    setEarthquakeMinMagnitude,
    floodDepthOverride,
    setFloodDepthOverride,
  } = props

  return (
    <motion.div
      className="absolute top-6 right-8 pointer-events-auto z-50"
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay: 0.5 }}
    >
      <div className="flex items-center gap-2 flex-wrap rounded-full bg-zinc-950/80 border border-zinc-800/60 px-2.5 py-1.5">
        {!commandMode && (
          <>
            <div className="flex flex-col gap-1">
              <select
                value={highFidelityScenarioId ?? ''}
                onChange={(e) => setHighFidelityScenarioId(e.target.value || null)}
                className="rounded border border-zinc-600 bg-zinc-900/95 text-zinc-300 text-[10px] py-1 px-1.5 focus:ring-zinc-500/50 max-w-[140px]"
                title="Flood/Wind: Open-Meteo or High-Fidelity"
              >
                <option value="">Open-Meteo (live)</option>
                {highFidelityScenarioIds.map((id) => (
                  <option key={id} value={id}>
                    {id === 'wrf_nyc_001' ? 'High-Fidelity: wrf_nyc_001' : `High-Fidelity: ${id}`}
                  </option>
                ))}
              </select>
              {selectedCountryCode != null && (
                <button
                  type="button"
                  onClick={() => {
                    const params = new URLSearchParams()
                    params.set('country', selectedCountryCode)
                    if (selectedCountryCity?.id) params.set('city', selectedCountryCity.id)
                    navigate(`/municipal?${params.toString()}`)
                  }}
                  title={selectedCountryCity ? 'Open Municipal Dashboard for this city' : 'Open Municipal Dashboard for this country'}
                  className="flex items-center justify-center gap-1.5 px-2 py-1 rounded border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-[10px] font-medium transition-colors"
                >
                  <BuildingLibraryIcon className="w-3.5 h-3.5 shrink-0" />
                  <span>Municipal</span>
                </button>
              )}
            </div>
            <span className="w-px h-4 bg-zinc-700" aria-hidden />
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Google Photorealistic 3D">
              <input type="checkbox" checked={showGoogle3dLayer} onChange={(e) => setShowGoogle3dLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="H3 Hex Grid (risk heatmap)">
              <input type="checkbox" checked={showZoneRiskVector || showH3Layer} onChange={(e) => { const on = e.target.checked; if (!on) { setShowH3Layer(false); setShowZoneRiskVector(false) } else setShowH3Layer(true) }} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 2l6 3.5v7l-6 3.5-6-3.5v-7L12 2z"/><path d="M6 5.5v7M18 12.5v-7M12 2v3.5M12 16.5V20"/></svg></span>
            </label>
            <div className="relative flex-shrink-0">
              <button
                type="button"
                onClick={() => setShowZoneRiskVectorPanel((open) => !open)}
                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] border transition-colors ${showZoneRiskVectorPanel || showZoneRiskVector ? 'bg-zinc-600 text-zinc-100 border-zinc-500' : 'bg-zinc-900/95 text-zinc-400 border-zinc-600 hover:text-zinc-200 hover:border-zinc-500'}`}
                title="Zone Risk Vector"
              >
                <span className="whitespace-nowrap">Zone Risk Vector</span>
              </button>
              {showZoneRiskVectorPanel && (
                <div className="absolute left-0 top-full mt-1 z-50 min-w-[200px] rounded border border-zinc-600 bg-zinc-900 shadow-xl p-2 space-y-2">
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Risk</div>
                  <select value={zoneRiskVectorDimension} onChange={(e) => setZoneRiskVectorDimension(e.target.value)} className="w-full bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-600 px-2 py-1">
                    <option value="p_agi">AGI</option>
                    <option value="p_bio">Bio</option>
                    <option value="p_nuclear">Nuclear</option>
                    <option value="p_climate">Climate</option>
                    <option value="p_financial">Financial</option>
                  </select>
                  <div className="text-[10px] text-zinc-400 uppercase tracking-wider">Zone (resolution)</div>
                  <select value={zoneRiskVectorResolution} onChange={(e) => setZoneRiskVectorResolution(Number(e.target.value))} className="w-full bg-zinc-800 text-zinc-200 text-xs rounded border border-zinc-600 px-2 py-1">
                    <option value={3}>3 (global)</option>
                    <option value={5}>5 (country)</option>
                    <option value={7}>7 (city)</option>
                    <option value={9}>9 (asset)</option>
                  </select>
                  <div className="flex gap-1 pt-1">
                    <button type="button" onClick={() => { setShowZoneRiskVector(true); setShowH3Layer(false); setShowZoneRiskVectorPanel(false) }} className="flex-1 px-2 py-1 rounded text-xs bg-emerald-600 hover:bg-emerald-500 text-zinc-100">Show on Globe</button>
                    <button type="button" onClick={() => setShowZoneRiskVectorPanel(false)} className="px-2 py-1 rounded text-xs bg-zinc-700 hover:bg-zinc-600 text-zinc-200">Cancel</button>
                  </div>
                </div>
              )}
              {showZoneRiskVector && !showZoneRiskVectorPanel && (
                <span className="ml-1 flex items-center gap-1 flex-wrap">
                  <select value={zoneRiskVectorDimension} onChange={(e) => setZoneRiskVectorDimension(e.target.value)} className="bg-zinc-800 text-zinc-200 text-[10px] rounded border border-zinc-600 px-1 py-0.5 max-w-[72px]" title="Risk type">
                    <option value="p_agi">AGI</option>
                    <option value="p_bio">Bio</option>
                    <option value="p_nuclear">Nuclear</option>
                    <option value="p_climate">Climate</option>
                    <option value="p_financial">Financial</option>
                  </select>
                  <select value={zoneRiskVectorResolution} onChange={(e) => setZoneRiskVectorResolution(Number(e.target.value))} className="bg-zinc-800 text-zinc-200 text-[10px] rounded border border-zinc-600 px-1 py-0.5 w-14" title="Resolution">
                    <option value={3}>3</option>
                    <option value={5}>5</option>
                    <option value={7}>7</option>
                    <option value={9}>9</option>
                  </select>
                  <button type="button" onClick={() => { setShowZoneRiskVector(false); setShowH3Layer(false) }} className="text-zinc-500 hover:text-zinc-100 px-0.5" title="Hide">×</button>
                </span>
              )}
            </div>
            {showH3Layer && !showZoneRiskVector && (
              <>
                <select value={h3Resolution} onChange={(e) => setH3Resolution(Number(e.target.value))} className="bg-zinc-900/95 text-zinc-300 text-[10px] rounded border border-zinc-600 px-1 py-0.5" title="H3 resolution">
                  <option value={3}>res 3</option>
                  <option value={5}>res 5</option>
                  <option value={7}>res 7</option>
                  <option value={9}>res 9</option>
                </select>
                <span className="w-px h-4 bg-zinc-700" aria-hidden />
                <div className="flex items-center gap-1" title="Date & time (risk-at-time)">
                  <span className="text-zinc-400 text-[10px] whitespace-nowrap">Date & time:</span>
                  <DateTimePickerEn value={timeSliderValue} onChange={setTimeSliderValue} className="bg-zinc-900/95 text-zinc-300 text-[10px] rounded border border-zinc-600 px-1 py-0.5" />
                  {timeSliderValue && (
                    <button type="button" onClick={() => setTimeSliderValue(null)} className="text-zinc-500 hover:text-zinc-100 text-[10px] px-1" title="Reset to current">×</button>
                  )}
                </div>
              </>
            )}
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Flood">
              <input type="checkbox" checked={showFloodLayer} onChange={(e) => setShowFloodLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M12 2C8 6 4 8 4 12c0 3.3 2.7 6 6 6s6-2.7 6-6c0-4-4-6-8-10zm0 14c-1.1 0-2-.9-2-2 0-.7.4-1.4 1-1.7V12h2v2.3c.6.3 1 1 1 1.7 0 1.1-.9 2-2 2z"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Wind">
              <input type="checkbox" checked={showWindLayer} onChange={(e) => setShowWindLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2 2 0 1 1 19 4H2m0 14h8a2 2 0 1 1 0 4H2"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Metro flood">
              <input type="checkbox" checked={showMetroFloodLayer} onChange={(e) => setShowMetroFloodLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M4 6h16v10H4V6zm2 2v6h3V8H6zm5 0v6h2V8h-2zm5 0v6h3V8h-3zM5 18h14v2H5v-2z"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Heat stress">
              <input type="checkbox" checked={showHeatLayer} onChange={(e) => setShowHeatLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM4 10.5H1v2h3v-2zm9-11.19h2V3.5h-2V-.69zM20 10.5v2h3v-2h-3zm-8-5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-1-9h2V7h-2V6.5zm1.09 7.5c.46 0 .84-.37.84-.84 0-.46-.38-.84-.84-.84-.46 0-.84.38-.84.84 0 .47.38.84.84.84z"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Heavy rain">
              <input type="checkbox" checked={showHeavyRainLayer} onChange={(e) => setShowHeavyRainLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M6.5 10c-.22 0-.4.18-.4.4v.2c0 .22.18.4.4.4h.01c.22 0 .4-.18.4-.4v-.2c-.01-.22-.19-.4-.4-.4z"/><path d="M19.35 10.04C18.67 6.59 15.64 4 12 4 9.11 4 6.6 5.64 5.35 8.04 2.34 8.36 0 10.91 0 14c0 3.31 2.69 6 6 6h13c2.76 0 5-2.24 5-5 0-2.64-2.05-4.78-4.65-4.96z"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Drought">
              <input type="checkbox" checked={showDroughtLayer} onChange={(e) => setShowDroughtLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 3v18M5 8h4l2 4 2-4h4M4 14h3l2 4 2-4h5M8 20h2M14 20h2"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="UV index">
              <input type="checkbox" checked={showUvLayer} onChange={(e) => setShowUvLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><path d="M6.76 4.84l-1.8-1.79-1.41 1.41 1.79 1.79 1.42-1.41zM1 10.5h3v2H1v-2zm9-9.19h2V3.5h-2V1.31zM20 10.5v2h3v-2h-3zm-9 4.69h2v2.19h-2V15.19zM12 5.5c-3.31 0-6 2.69-6 6s2.69 6 6 6 6-2.69 6-6-2.69-6-6-6zm0 10c-2.21 0-4-1.79-4-4s1.79-4 4-4 4 1.79 4 4-1.79 4-4 4zm-1-4h2v2h-2v-2z"/></svg></span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Live Incidents">
              <input type="checkbox" checked={showActiveIncidentsLayer} onChange={(e) => setShowActiveIncidentsLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-red-400 group-hover:text-red-300" aria-hidden><svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full"><circle cx="12" cy="12" r="4"/><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" opacity="0.3"/></svg></span>
              <span className="text-[10px] text-red-400/80 font-medium tracking-wide">LIVE</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer group" title="Earthquakes M5+">
              <input type="checkbox" checked={showEarthquakeLayer} onChange={(e) => setShowEarthquakeLayer(e.target.checked)} className="rounded border-zinc-500 bg-zinc-900/95 text-zinc-100 focus:ring-zinc-500/50 flex-shrink-0 accent-zinc-400 w-3.5 h-3.5" />
              <span className="w-4 h-4 flex-shrink-0 text-zinc-400 group-hover:text-zinc-200" aria-hidden><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-full h-full"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg></span>
            </label>
            {showEarthquakeLayer && (
              <div className="flex items-center gap-1">
                {([5, 6, 7, 8, 9] as const).map((m) => (
                  <button key={m} type="button" onClick={() => setEarthquakeMinMagnitude(m)} className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${earthquakeMinMagnitude === m ? 'bg-zinc-600 text-zinc-100 border border-zinc-500' : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-600'}`} title={`Magnitude M${m}+`}>M{m}</button>
                ))}
              </div>
            )}
            {showFloodLayer && (
              <div className="flex items-center gap-1">
                {FLOOD_LEVELS_M.map((m) => (
                  <button key={m} type="button" onClick={() => setFloodDepthOverride(m)} className={`px-1.5 py-0.5 rounded text-[10px] transition-colors ${floodDepthOverride === m ? 'bg-zinc-600 text-zinc-100 border border-zinc-500' : 'bg-zinc-900/90 text-zinc-400 hover:text-zinc-200 border border-zinc-600'}`} title={`Water ${m} m`}>{m}</button>
                ))}
              </div>
            )}
            <span className="w-px h-4 bg-zinc-700" aria-hidden />
          </>
        )}
        {!commandMode && <span className="w-px h-4 bg-zinc-700 flex-shrink-0" aria-hidden />}
        {!topBarExpanded ? (
          <>
            <Link to={quickActionsCommandCenter[0].path} className={`p-2 rounded-full text-zinc-500 transition-all flex-shrink-0 flex items-center justify-center ${quickActionIconColors[quickActionsCommandCenter[0].color]}`} title={quickActionsCommandCenter[0].label}>
              {(() => { const DashboardIcon = quickActionsCommandCenter[0].icon; return <DashboardIcon className="w-4 h-4 shrink-0" /> })()}
            </Link>
            <button type="button" onClick={() => setTopBarExpanded(true)} className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0" title="Expand quick nav">
              <ChevronDownIcon className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            {quickActionsCommandCenter.map((item) => (
              <span key={item.path} className="flex items-center gap-0 flex-shrink-0">
                {item.dividerBefore && <div className="w-px h-4 bg-zinc-700 flex-shrink-0" />}
                <Link to={item.path} className={`p-2 rounded-full text-zinc-500 transition-all flex-shrink-0 flex items-center justify-center ${quickActionIconColors[item.color]}`} title={item.label}>
                  <item.icon className="w-4 h-4 shrink-0" />
                </Link>
              </span>
            ))}
            <button type="button" onClick={() => setTopBarExpanded(false)} className="p-1.5 rounded-full text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800 transition-colors flex-shrink-0" title="Collapse">
              <ChevronUpIcon className="w-4 h-4" />
            </button>
          </>
        )}
      </div>
    </motion.div>
  )
}
