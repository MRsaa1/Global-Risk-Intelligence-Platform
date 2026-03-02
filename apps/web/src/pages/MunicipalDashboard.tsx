/**
 * Municipal Dashboard — ClimateShield Local
 *
 * Full dashboard with layout matching the ClimateShield Local mockup:
 * - Risk Summary (left), CesiumGlobe map (center), Community Status (right)
 * - Funding Opportunities + Upcoming Deadlines (bottom)
 * - Tabs: Overview | Risk | Adaptation | Grants | Alerts
 *
 * Default: static 3D Google map (Cesium Photorealistic 3D Tiles)
 * Drill-down: World → Country → City (3D digital twin via DigitalTwinPanel)
 * Institutional palette: BlackRock/Palantir — dark zinc, no bright accent
 */
import { useState, useEffect, useCallback, useMemo, lazy, Suspense } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  ArrowLeftIcon,
  ArrowPathIcon,
  ArrowTrendingUpIcon,
  BuildingOffice2Icon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  FireIcon,
  SunIcon,
  CloudIcon,
  BoltIcon,
  BellAlertIcon,
  CalendarDaysIcon,
  ChevronUpIcon,
  ChevronDownIcon,
  ClockIcon,
  CheckCircleIcon,
  CurrencyDollarIcon,
  MapPinIcon,
  SparklesIcon,
  XMarkIcon,
} from '@heroicons/react/24/outline'
import { getApiBase, getApiV1Base } from '../config/env'
import AccessGate from '../components/modules/AccessGate'
import RegulatoryExportPanel from '../components/RegulatoryExportPanel'
import UnifiedStressTestSelector from '../components/stress/UnifiedStressTestSelector'
import { PieChart, TimeSeriesChart } from '../components/charts'
import type { PieDataPoint, TimeSeriesSeries } from '../components/charts'

const CesiumGlobe = lazy(() => import('../components/CesiumGlobe'))
import SubmitAsFieldObservationModal from '../components/SubmitAsFieldObservationModal'

// API base resolved at request time (tunnel: ?api=http://127.0.0.1:19002)

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Community {
  id: string; name: string; population: number; lat: number; lng: number
}

interface Hazard {
  type: string; score: number; level: string; trend: string; pct: number
}

interface CommunityRisk {
  community: Community
  hazards: Hazard[]
  buildings_at_risk: { total: number; residential: number; commercial: number; critical: number }
  estimated_annual_loss_m: number
  loss_trend: number[]
  vulnerability_factors: { name: string; present: boolean }[]
  financial_exposure: { annual_expected_loss_m: number; loss_100_year_m: number; projected_2050_m: number; without_adaptation_2050_m: number }
}

interface Alert {
  id: string; type: string; level: string; message: string; expires: string
}

interface AlertsData {
  current_conditions: { temp_f: number; rain_24h_in: number; wind_mph: number; fire_risk: string; humidity_pct: number }
  alerts: Alert[]
  forecast_72h: { hour: number; flood_risk_pct: number; heat_risk_pct: number; fire_risk_pct: number }[]
}

interface Deadline {
  date: string; title: string; type: string
}

interface FundingApp {
  id: string; grant_name: string; status: string; deadline: string | null; progress_pct: number; amount_m: number
}

interface Measure {
  id: string; name: string; category: string
  cost_per_capita: number; effectiveness_pct: number
  roi_multiplier: number; implementation_months: number
  climate_risks_addressed: string[]; co_benefits: string[]
  description: string; relevance_score?: number
  total_cost_m?: number; expected_savings_m?: number
  affordable?: boolean; risks_matched?: string[]
}

interface Grant {
  id: string; name: string; agency: string; country: string
  max_award_m: number; match_required_pct: number
  eligible_risks: string[]; success_rate_pct: number
  deadline: string; commission_pct: number; description: string
  match_score?: number; estimated_commission_m?: number
  success_probability_pct?: number
  similar_cities_success_rate_pct?: number | null
  eligibility?: { population_eligible: boolean; risk_eligible: boolean; country_eligible: boolean; notes: string[] }
}

interface GrantApplicationRow {
  id: string
  grant_program_id: string
  grant_program_name: string
  municipality: string
  requested_amount_m: number
  status: string
  commission_rate: number
  commission_amount: number
  matched_at: string
  submitted_at: string | null
  decided_at: string | null
}

interface PayoutRow {
  id: string
  application_id: string
  payout_date: string
  amount: number
  currency: string
  status: string
  notes: string | null
  created_at: string | null
}

type Tab = 'overview' | 'risk' | 'adaptation' | 'grants' | 'alerts' | 'commissions' | 'plan' | 'regulatory' | 'reports' | 'subscription' | 'launch'

type CitiesByCountry = Record<string, { id: string; name: string; lat: number; lng: number; population: number }[]>

// ---------------------------------------------------------------------------
// Helpers — institutional palette (BlackRock/Palantir): dark, neutral, no bright accent
// ---------------------------------------------------------------------------

const HAZARD_ICONS: Record<string, typeof FireIcon> = {
  flood: CloudIcon,
  heat: SunIcon,
  drought: BoltIcon,
  wildfire: FireIcon,
}

const LEVEL_COLORS: Record<string, string> = {
  critical: '#a1a1aa',
  high: '#71717a',
  medium: '#52525b',
  low: '#3f3f46',
}

function levelColor(level: string) {
  return LEVEL_COLORS[level] || LEVEL_COLORS.medium
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  in_progress: { label: 'In Progress', cls: 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-300' },
  awarded: { label: 'Awarded', cls: 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-200' },
  not_started: { label: 'Not Started', cls: 'bg-zinc-900/50 border border-zinc-800/60 text-zinc-500' },
  submitted: { label: 'Submitted', cls: 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-400' },
}

// ---------------------------------------------------------------------------
// Sub-components (inline)
// ---------------------------------------------------------------------------

function CircularProgress({ value, size = 48, color }: { value: number; size?: number; color: string }) {
  const r = (size - 6) / 2
  const circ = 2 * Math.PI * r
  const offset = circ - (value / 100) * circ
  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#27272a" strokeWidth={4} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={4}
        strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="central"
        className="transform rotate-90 origin-center" fill={color} fontSize={11} fontWeight={700}>
        {value}%
      </text>
    </svg>
  )
}

function MiniCalendar({ deadlines }: { deadlines: Deadline[] }) {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const firstDay = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const monthName = now.toLocaleString('en', { month: 'long', year: 'numeric' })

  const deadlineDates = new Set(deadlines.map(d => {
    const dt = new Date(d.date)
    return dt.getMonth() === month && dt.getFullYear() === year ? dt.getDate() : -1
  }).filter(d => d > 0))

  const cells = []
  for (let i = 0; i < firstDay; i++) cells.push(<div key={`e${i}`} />)
  for (let d = 1; d <= daysInMonth; d++) {
    const isToday = d === now.getDate()
    const hasDeadline = deadlineDates.has(d)
    cells.push(
      <div key={d} className={`text-center text-xs py-0.5 rounded ${isToday ? 'bg-zinc-700 text-zinc-100 font-semibold' : hasDeadline ? 'bg-zinc-900/80 border border-zinc-800/60 text-zinc-300 font-medium' : 'text-zinc-500'}`}>
        {d}
      </div>
    )
  }

  return (
    <div>
      <div className="text-sm font-medium text-zinc-200 mb-2 text-center">{monthName}</div>
      <div className="grid grid-cols-7 gap-0.5 font-mono text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => <div key={d} className="text-center">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-0.5">{cells}</div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function MunicipalDashboard() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const tabFromUrl = searchParams.get('tab') as Tab | null
  const validTabs: Tab[] = ['overview', 'risk', 'adaptation', 'grants', 'commissions', 'plan', 'alerts', 'regulatory', 'reports', 'subscription', 'launch']
  const [tab, setTab] = useState<Tab>(tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : 'overview')
  const [loading, setLoading] = useState(true)
  const [selectedCity, setSelectedCity] = useState('bastrop_tx')
  const [, setCommunities] = useState<Community[]>([])

  // Map view: world (globe) → country → city (3D digital twin). Default: static 3D globe with Google tiles.
  const [mapViewLevel, setMapViewLevel] = useState<'world' | 'country' | 'city'>('world')
  const [selectedMapCountryCode, setSelectedMapCountryCode] = useState<string>('')
  const [selectedMapCityId, setSelectedMapCityId] = useState<string>('')
  const [countriesList, setCountriesList] = useState<{ code: string; name: string }[]>([])
  const [citiesByCountry, setCitiesByCountry] = useState<CitiesByCountry>({})
  /** Resolved city for map focus and "3D city" zoom (no Digital Twin / stress test — just zoom + flood) */
  const [digitalTwinCity, setDigitalTwinCity] = useState<Community | null>(null)
  /** 3D city in same globe: smooth zoom to street level, draw flood; no modal, no stress test list */
  const [city3DInGlobe, setCity3DInGlobe] = useState(false)

  // Data
  const [riskData, setRiskData] = useState<CommunityRisk | null>(null)
  const [alertsData, setAlertsData] = useState<AlertsData | null>(null)
  const [deadlines, setDeadlines] = useState<Deadline[]>([])
  const [funding, setFunding] = useState<FundingApp[]>([])
  const [measures, setMeasures] = useState<Measure[]>([])
  const [grants, setGrants] = useState<Grant[]>([])
  const [commissions, setCommissions] = useState<Record<string, unknown> | null>(null)
  const [applications, setApplications] = useState<GrantApplicationRow[]>([])
  const [payouts, setPayouts] = useState<PayoutRow[]>([])
  const [planBudget, setPlanBudget] = useState(200)
  const [showPayoutModal, setShowPayoutModal] = useState(false)
  const [payoutForm, setPayoutForm] = useState({ application_id: '', payout_date: new Date().toISOString().slice(0, 10), amount: 0, currency: 'USD', notes: '' })
  const [payoutSubmitLoading, setPayoutSubmitLoading] = useState(false)
  const [subscriptions, setSubscriptions] = useState<Array<{ id: string; tenant_id: string; tier: string; amount_yearly: number; currency: string; period_start: string | null; period_end: string | null; status: string }>>([])
  const [subscriptionTiers, setSubscriptionTiers] = useState<Array<{ id: string; amount_yearly: number; currency: string; amount_monthly?: number }>>([])
  const [cadaptProducts, setCadaptProducts] = useState<Array<{ id: string; name: string; price_min: number; price_max: number; currency: string }>>([])
  const [onboardingRequests, setOnboardingRequests] = useState<Array<{ id: string; municipality_name: string; population: number | null; status: string; requested_at: string | null }>>([])
  const [contractors, setContractors] = useState<Array<{ id: string; tenant_id: string; name: string; contractor_type: string | null; status: string }>>([])
  const [onboardingForm, setOnboardingForm] = useState({ municipality_name: '', population: '' as string | number, contact_email: '', contact_name: '', notes: '' })
  const [onboardingSubmitLoading, setOnboardingSubmitLoading] = useState(false)
  const [contractorForm, setContractorForm] = useState({ name: '', contractor_type: '', contact_info: '' })
  const [contractorSubmitLoading, setContractorSubmitLoading] = useState(false)
  const [showOnboardingForm, setShowOnboardingForm] = useState(false)
  const [showContractorForm, setShowContractorForm] = useState(false)
  const [trackBCities, setTrackBCities] = useState<Array<{ id: string; name: string; population?: number; lat?: number; lng?: number; population_band?: string }>>([])

  // AI grant draft
  const [grantDraftLoading, setGrantDraftLoading] = useState<string | null>(null)
  const [grantDraftResult, setGrantDraftResult] = useState<{ draft: string; grant_id: string; municipality: string } | null>(null)
  // Flood scenarios (10/50/100-year) — from GET /flood-scenarios (backward compat)
  const [floodScenarios, setFloodScenarios] = useState<{ return_period_years: number; flood_depth_m: number; estimated_loss_usd_m: number; description: string }[] | null>(null)
  // Full flood risk product (POST /flood-risk-product): economic breakdown, AEL, data sources
  const [floodRiskProduct, setFloodRiskProduct] = useState<{
    city_info?: { city_name: string; population: number; area_km2: number }
    data_sources?: Record<string, boolean>
    scenarios?: Array<{ return_period_years: number; flood_depth_m: number; extent_area_km2?: number; duration_hours?: number; economic?: { total_loss_usd: number; residential_loss_usd: number; commercial_loss_usd: number; infrastructure_loss_usd: number; business_interruption_usd: number; emergency_usd: number } }>
    economic_impact?: Array<{ return_period_years: number; total_loss_usd: number; residential_loss_usd: number; commercial_loss_usd: number; infrastructure_loss_usd: number; business_interruption_usd: number; emergency_usd: number }>
    ael_usd?: number
    flood_grid?: Array<{ lat: number; lon: number; depth_m: number }>
  } | null>(null)
  const [floodProductLoading, setFloodProductLoading] = useState(false)
  const [floodValidation, setFloodValidation] = useState<{ accuracy_pct?: number; avg_error_pct?: number; passed_count?: number; total_events?: number } | null>(null)
  const [floodRetrospective, setFloodRetrospective] = useState<{
    city_id: string
    city_name: string
    events: Array<{ event_id: string; city: string; date: string; model_loss_usd?: number; actual_loss_usd: number; error_pct?: number; pass: boolean }>
    total_events: number
    passed_count: number
    accuracy_pct: number | null
    avg_error_pct: number | null
    message?: string
  } | null>(null)
  // Historical validation
  const [validateEventId, setValidateEventId] = useState('')
  const [validateResult, setValidateResult] = useState<Record<string, unknown> | null>(null)
  const [validateLoading, setValidateLoading] = useState(false)
  // Create application (commission tracker)
  const [createAppGrantId, setCreateAppGrantId] = useState<string | null>(null)
  const [createAppMunicipality, setCreateAppMunicipality] = useState('')
  const [createAppAmount, setCreateAppAmount] = useState(10)
  const [createAppLoading, setCreateAppLoading] = useState(false)
  const [createAppError, setCreateAppError] = useState<string | null>(null)
  // Grant Writing Assistant — full application workflow (AI draft + human expert → 200-page export)
  const [draftProjectId, setDraftProjectId] = useState<string | null>(null)
  const [draftProject, setDraftProject] = useState<{ id: string; grant_program_id: string; municipality: string; sections: Record<string, string> } | null>(null)
  const [draftSectionGenerating, setDraftSectionGenerating] = useState<string | null>(null)
  const [draftExportResult, setDraftExportResult] = useState<{ full_text: string; word_count: number } | null>(null)
  const [draftGuideUploading, setDraftGuideUploading] = useState(false)
  const [draftProjectError, setDraftProjectError] = useState<string | null>(null)
  // Engineering Solutions Matcher (risk + depth + area → top solutions)
  const [engRiskType, setEngRiskType] = useState('flood')
  const [engDepthM, setEngDepthM] = useState(1)
  const [engAreaHa, setEngAreaHa] = useState(50)
  const [engMatchResult, setEngMatchResult] = useState<{ risk_type: string; depth_m: number; area_ha: number; total_in_catalog: number; matches: Array<{ id: string; name: string; solution_type: string; case_study_title: string; case_study_location: string; source: string; estimated_total_usd: number }> } | null>(null)
  const [engMatchLoading, setEngMatchLoading] = useState(false)

  // Zone simulation reports (stress test on 3D zones) — persisted in localStorage
  const MUNICIPAL_ZONE_REPORTS_KEY = 'pfrp-municipal-zone-reports'
  type ZoneReportEntry = { id: string; cityName: string; scenarioName: string; timestamp: string; country?: string; reportPayload: Record<string, unknown> }
  const [zoneReports, setZoneReports] = useState<ZoneReportEntry[]>([])
  useEffect(() => {
    try {
      const raw = localStorage.getItem(MUNICIPAL_ZONE_REPORTS_KEY)
      const list = raw ? JSON.parse(raw) : []
      setZoneReports(Array.isArray(list) ? list : [])
    } catch {
      setZoneReports([])
    }
  }, [])
  const saveZoneReport = useCallback((entry: ZoneReportEntry) => {
    setZoneReports(prev => {
      const next = [entry, ...prev].slice(0, 100)
      try {
        localStorage.setItem(MUNICIPAL_ZONE_REPORTS_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const removeZoneReport = useCallback((id: string) => {
    setZoneReports(prev => {
      const next = prev.filter(r => r.id !== id)
      try {
        localStorage.setItem(MUNICIPAL_ZONE_REPORTS_KEY, JSON.stringify(next))
      } catch {
        // ignore
      }
      return next
    })
  }, [])
  const clearZoneReports = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!window.confirm('Clear all simulation reports? This cannot be undone.')) return
    setZoneReports([])
    try {
      localStorage.removeItem(MUNICIPAL_ZONE_REPORTS_KEY)
    } catch {
      // ignore
    }
  }, [])
  // Municipal 3D: stress test selector + report + 4D timeline (same UX as Digital Twin)
  const [showMunicipalStressSelector, setShowMunicipalStressSelector] = useState(false)
  const [municipalStressScenarioId, setMunicipalStressScenarioId] = useState<string | null>(null)
  const [municipalStressRunning, setMunicipalStressRunning] = useState(false)
  const [municipalStressReport, setMunicipalStressReport] = useState<{
    /** Backend stress test ID — use for CZML so 4D timeline is for selected city, not catalog default (NY) */
    stressTestId: string
    eventId: string
    cityName: string
    eventName: string
    timestamp: string
    reportPayload: Record<string, unknown>
    complianceVerification?: { verified: boolean; verifications?: { framework_id: string; status: string; id: string }[]; verified_at: string | null }
  } | null>(null)
  const [municipalPlay4dCzmlUrl, setMunicipalPlay4dCzmlUrl] = useState<string | null>(null)
  // Simulation reports tab filters
  const [reportsFilterDateFrom, setReportsFilterDateFrom] = useState('')
  const [reportsFilterDateTo, setReportsFilterDateTo] = useState('')
  const [reportsFilterCountry, setReportsFilterCountry] = useState('')
  const [showRecordObservationModal, setShowRecordObservationModal] = useState(false)

  // Map layers (incl. "Infrastructure at risk" = H3 hex risk layer for areas with infrastructure exposure)
  const [mapLayers, setMapLayers] = useState({ flood: true, heat: true, drought: false, wildfire: false, infrastructureAtRisk: false })
  const [floodDepthOverride, setFloodDepthOverride] = useState<number | undefined>(undefined)
  const [floodBuildings, setFloodBuildings] = useState<Array<{ id: string; name: string; lat: number; lon: number; depth_m: number; return_period_years?: number; annual_probability: number; damage_ratio: number }> | null>(null)

  const [fetchError, setFetchError] = useState<string | null>(null)
  const [launchChecklist, setLaunchChecklist] = useState<{
    municipality_id: string
    steps: Array<{ id: string; label: string; done: boolean }>
    all_done: boolean
  } | null>(null)
  const [roiMetrics, setRoiMetrics] = useState<{
    loss_reduction_12m?: number; reaction_time_median_hours?: number; insurance_impact_score?: number
    calculated_at?: string; period?: string; sources?: string[]
  } | null>(null)
  const [nextActions, setNextActions] = useState<{
    playbook_id: string; municipality_id: string; next_actions: Array<{ step_id: string; action_type: string; label: string; order?: number }>
  } | null>(null)

  // Fetch all data for the selected city — entire dashboard rebuilds on city change
  const fetchAll = useCallback(async () => {
    if (!selectedCity) return
    setLoading(true)
    setFetchError(null)
    const q = `?city=${encodeURIComponent(selectedCity)}`
    const municipality = (selectedCity || '').replace(/_/g, ' ')
    try {
      const [riskRes, alertRes, dlRes, fundRes, commRes, measRes, commissionsRes, applicationsRes, payoutsRes, tiersRes, subsRes, productsRes, contractorsRes, onboardingRes, trackBRes, roiRes, launchRes, nextActionsRes] = await Promise.all([
        fetch(`${getApiV1Base()}/cadapt/community/risk${q}`),
        fetch(`${getApiV1Base()}/cadapt/community/alerts${q}`),
        fetch(`${getApiV1Base()}/cadapt/community/deadlines${q}`),
        fetch(`${getApiV1Base()}/cadapt/community/funding${q}`),
        fetch(`${getApiV1Base()}/cadapt/community/list`),
        fetch(`${getApiV1Base()}/cadapt/measures`),
        fetch(`${getApiV1Base()}/cadapt/commissions`),
        fetch(`${getApiV1Base()}/cadapt/applications?municipality=${encodeURIComponent(municipality)}`),
        fetch(`${getApiV1Base()}/cadapt/payouts`),
        fetch(`${getApiV1Base()}/cadapt/subscriptions/tiers`),
        fetch(`${getApiV1Base()}/cadapt/subscriptions`),
        fetch(`${getApiV1Base()}/cadapt/products`),
        fetch(`${getApiV1Base()}/cadapt/contractors?tenant_id=${encodeURIComponent(municipality)}`),
        fetch(`${getApiV1Base()}/cadapt/onboarding-requests`),
        fetch(`${getApiV1Base()}/cadapt/track-b-cities`),
        fetch(`${getApiV1Base()}/cadapt/roi-metrics${q}&period=12m`),
        fetch(`${getApiV1Base()}/cadapt/launch-checklist?municipality_id=${encodeURIComponent(selectedCity || 'bastrop_tx')}`),
        fetch(`${getApiV1Base()}/playbooks/flood_response/next-actions?municipality_id=${encodeURIComponent(selectedCity || 'bastrop_tx')}&limit=3`),
      ])
      if (nextActionsRes?.ok) { try { setNextActions(await nextActionsRes.json()) } catch { /* ignore */ } }
      if (riskRes.ok) setRiskData(await riskRes.json())
      if (alertRes.ok) setAlertsData(await alertRes.json())
      if (dlRes.ok) { const d = await dlRes.json(); setDeadlines(d.deadlines || []) }
      if (fundRes.ok) { const f = await fundRes.json(); setFunding(f.applications || []) }
      if (commRes.ok) { const c = await commRes.json(); setCommunities(c.communities || []) }
      if (measRes.ok) { const m = await measRes.json(); setMeasures(Array.isArray(m) ? m : m?.items || []) }
      if (commissionsRes.ok) setCommissions(await commissionsRes.json())
      if (applicationsRes.ok) { const a = await applicationsRes.json(); setApplications(Array.isArray(a) ? a : []) }
      if (payoutsRes.ok) { const p = await payoutsRes.json(); setPayouts(Array.isArray(p) ? p : []) }
      if (tiersRes.ok) { const t = await tiersRes.json(); setSubscriptionTiers(t.tiers || []) }
      if (subsRes.ok) { const s = await subsRes.json(); setSubscriptions(Array.isArray(s) ? s : []) }
      if (productsRes.ok) { const pr = await productsRes.json(); setCadaptProducts(pr.products || []) }
      if (contractorsRes.ok) { const co = await contractorsRes.json(); setContractors(Array.isArray(co) ? co : []) }
      if (onboardingRes.ok) { const ob = await onboardingRes.json(); setOnboardingRequests(Array.isArray(ob) ? ob : []) }
      if (trackBRes.ok) { const tb = await trackBRes.json(); setTrackBCities(Array.isArray(tb.cities) ? tb.cities : []) }
      if (roiRes.ok) { const roi = await roiRes.json(); setRoiMetrics(roi) }
      if (launchRes.ok) { const lc = await launchRes.json(); setLaunchChecklist(lc) }
    } catch (err) {
      console.error('Municipal dashboard fetch error:', err)
      const base = getApiV1Base()
      setFetchError(
        base === '/api/v1'
          ? 'Cannot reach API. If using a tunnel, open the app with ?api=http://127.0.0.1:19002 in the URL, then refresh.'
          : 'Cannot reach API. Check that the API is running (e.g. port 9002) and CORS allows this origin.'
      )
    } finally {
      setLoading(false)
    }
  }, [selectedCity])

  useEffect(() => {
    if (selectedCity) fetchAll()
  }, [selectedCity, fetchAll])
  useEffect(() => {
    if (tabFromUrl && tabFromUrl !== tab) setTab(tabFromUrl)
  }, [tabFromUrl])

  // Load countries for map country selector
  useEffect(() => {
    fetch('/data/countries.json')
      .then(res => res.json())
      .then((arr: { code: string; name: string }[]) => setCountriesList(Array.isArray(arr) ? arr : []))
      .catch(() => setCountriesList([]))
  }, [])

  // Load cities by country (for map city dropdown — same source as Command Center)
  useEffect(() => {
    fetch('/data/cities-by-country.json')
      .then(res => res.json())
      .then((data: CitiesByCountry) => setCitiesByCountry(typeof data === 'object' && data !== null ? data : {}))
      .catch(() => setCitiesByCountry({}))
  }, [])

  // Sync country & city from URL (from Command Center: same country/city when opening Municipal)
  const urlCountry = searchParams.get('country')
  const urlCity = searchParams.get('city')
  useEffect(() => {
    if (urlCountry) {
      setSelectedMapCountryCode(urlCountry)
      setMapViewLevel(urlCity ? 'city' : 'country')
    }
    if (urlCity) {
      setSelectedCity(urlCity)
      setSelectedMapCityId(urlCity)
      if (urlCountry) setMapViewLevel('city')
    }
  }, [urlCountry, urlCity])

  // Fetch grants when tab changes
  const fetchGrants = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/match`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          city_risks: riskData?.hazards?.map(h => h.type) || ['flood', 'heat'],
          country: 'USA',
          population: riskData?.community?.population || 12847,
          municipality: riskData?.community?.name || selectedCity?.replace(/_/g, ' '),
        }),
      })
      if (res.ok) { const g = await res.json(); setGrants(Array.isArray(g) ? g : g?.items || []) }
    } catch { /* ignore */ }
  }, [riskData, selectedCity])

  useEffect(() => { if (tab === 'grants') fetchGrants() }, [tab, fetchGrants])

  const fetchRecommendations = useCallback(async () => {
    try {
      const cityRisks = riskData?.hazards?.map(h => h.type) || ['flood', 'heat']
      const pop = riskData?.community?.population ?? 12847
      const res = await fetch(`${getApiV1Base()}/cadapt/measures/recommend`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city_risks: cityRisks, population: pop, budget_per_capita: planBudget }),
      })
      if (res.ok) {
        const m = await res.json()
        setMeasures(Array.isArray(m) ? m : m?.items || [])
      }
    } catch (err) {
      console.error('Recommendations error:', err)
    }
  }, [riskData, planBudget, selectedCity])

  useEffect(() => { if (tab === 'plan') fetchRecommendations() }, [tab, fetchRecommendations])

  const fetchFloodScenarios = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/flood-scenarios?city=${selectedCity}`)
      if (res.ok) {
        const data = await res.json()
        setFloodScenarios(data.scenarios || [])
      }
    } catch {
      setFloodScenarios(null)
    }
  }, [selectedCity])

  const fetchFloodRiskProduct = useCallback(async () => {
    setFloodProductLoading(true)
    setFloodRiskProduct(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/flood-risk-product`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity || undefined, include_grid: true }),
      })
      if (res.ok) {
        const data = await res.json()
        if (!data.error) setFloodRiskProduct(data)
      }
    } catch {
      setFloodRiskProduct(null)
    } finally {
      setFloodProductLoading(false)
    }
  }, [selectedCity])

  const fetchFloodValidation = useCallback(async () => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/flood-model/validate-batch`, { method: 'POST' })
      if (res.ok) {
        const data = await res.json()
        setFloodValidation({ accuracy_pct: data.accuracy_pct, avg_error_pct: data.avg_error_pct, passed_count: data.passed_count, total_events: data.total_events })
      }
    } catch {
      setFloodValidation(null)
    }
  }, [])

  const fetchFloodRetrospective = useCallback(async () => {
    if (!selectedCity) {
      setFloodRetrospective(null)
      return
    }
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/flood-model/retrospective?city=${encodeURIComponent(selectedCity)}`)
      if (res.ok) {
        const data = await res.json()
        setFloodRetrospective(data)
      } else {
        setFloodRetrospective(null)
      }
    } catch {
      setFloodRetrospective(null)
    }
  }, [selectedCity])

  const fetchFloodBuildings = useCallback(async () => {
    if (!selectedCity) {
      setFloodBuildings(null)
      return
    }
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/flood-buildings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city: selectedCity, return_period_years: 100 }),
      })
      if (res.ok) {
        const data = await res.json()
        if (!data.error && Array.isArray(data.buildings)) setFloodBuildings(data.buildings)
        else setFloodBuildings(null)
      } else {
        setFloodBuildings(null)
      }
    } catch {
      setFloodBuildings(null)
    }
  }, [selectedCity])

  // Load flood data for the selected city whenever it changes — all tabs use same city; no stress test / Digital Twin
  useEffect(() => {
    if (!selectedCity) return
    fetchFloodScenarios()
    fetchFloodRiskProduct()
    fetchFloodValidation()
    fetchFloodRetrospective()
    fetchFloodBuildings()
  }, [selectedCity, fetchFloodScenarios, fetchFloodRiskProduct, fetchFloodValidation, fetchFloodRetrospective, fetchFloodBuildings])

  const handleGrantDraft = useCallback(async (grantId: string) => {
    setGrantDraftLoading(grantId)
    setGrantDraftResult(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_program_id: grantId,
          municipality: riskData?.community?.name || selectedCity,
          city_risks: riskData?.hazards?.map(h => h.type) || ['flood', 'heat'],
          population: riskData?.community?.population ?? 12847,
        }),
      })
      const data = await res.json()
      if (data.draft) setGrantDraftResult({ draft: data.draft, grant_id: data.grant_id, municipality: data.municipality })
    } finally {
      setGrantDraftLoading(null)
    }
  }, [riskData, selectedCity])

  const handleValidate = useCallback(async () => {
    if (!validateEventId.trim()) return
    setValidateLoading(true)
    setValidateResult(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/validate?city=${selectedCity}&historical_event_id=${encodeURIComponent(validateEventId.trim())}`)
      const data = await res.json()
      setValidateResult(data)
    } finally {
      setValidateLoading(false)
    }
  }, [selectedCity, validateEventId])

  const refetchCommissionsAndApplications = useCallback(async () => {
    const municipality = (selectedCity || '').replace(/_/g, ' ')
    try {
      const [commRes, appRes, payRes] = await Promise.all([
        fetch(`${getApiV1Base()}/cadapt/commissions`),
        fetch(`${getApiV1Base()}/cadapt/applications?municipality=${encodeURIComponent(municipality)}`),
        fetch(`${getApiV1Base()}/cadapt/payouts`),
      ])
      if (commRes.ok) setCommissions(await commRes.json())
      if (appRes.ok) { const a = await appRes.json(); setApplications(Array.isArray(a) ? a : []) }
      if (payRes.ok) { const p = await payRes.json(); setPayouts(Array.isArray(p) ? p : []) }
    } catch { /* ignore */ }
  }, [selectedCity])

  const openCreateApplication = useCallback((grant: Grant) => {
    setCreateAppGrantId(grant.id)
    setCreateAppMunicipality(riskData?.community?.name || selectedCity.replace(/_/g, ' '))
    setCreateAppAmount(Math.min(grant.max_award_m, Math.max(0.1, grant.max_award_m * 0.5)))
    setCreateAppError(null)
  }, [riskData, selectedCity])

  const startFullApplication = useCallback(async (grantId: string) => {
    setDraftProjectError(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/draft-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_program_id: grantId,
          municipality: riskData?.community?.name || selectedCity?.replace(/_/g, ' ') || 'Municipality',
          city_risks: riskData?.hazards?.map(h => h.type) || ['flood', 'heat'],
          population: riskData?.community?.population ?? 12847,
        }),
      })
      let data: { id?: string; error?: string; grant_program_id?: string; municipality?: string; sections?: Record<string, string>; detail?: string | unknown } = {}
      try {
        data = await res.json()
      } catch {
        setDraftProjectError(res.ok ? 'Invalid response' : `Server error ${res.status}`)
        return
      }
      if (!res.ok) {
        const msg = typeof data.detail === 'string' ? data.detail : Array.isArray(data.detail) ? (data.detail as Array<{ msg?: string }>).map(d => d.msg).join(', ') : data.error || `HTTP ${res.status}`
        setDraftProjectError(msg)
        return
      }
      if (data.error || !data.id) {
        setDraftProjectError(data.error || 'No project id returned')
        return
      }
      setDraftProjectId(data.id)
      setDraftProject({ id: data.id, grant_program_id: data.grant_program_id ?? grantId, municipality: data.municipality ?? '', sections: data.sections || {} })
      setDraftExportResult(null)
    } catch (e) {
      setDraftProjectError(e instanceof Error ? e.message : 'Failed to start full application')
    }
  }, [riskData, selectedCity])

  const fetchDraftProject = useCallback(async (id: string) => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/draft-project/${id}`)
      if (res.ok) {
        const data = await res.json()
        setDraftProject(data)
      }
    } catch { /* ignore */ }
  }, [])

  const generateDraftSection = useCallback(async (sectionName: string) => {
    if (!draftProjectId) return
    setDraftSectionGenerating(sectionName)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/draft-project/${draftProjectId}/generate-section`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section_name: sectionName }),
      })
      const data = await res.json()
      if (data.content && draftProjectId) await fetchDraftProject(draftProjectId)
    } finally {
      setDraftSectionGenerating(null)
    }
  }, [draftProjectId, fetchDraftProject])

  const exportDraftProject = useCallback(async () => {
    if (!draftProjectId) return
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/grants/draft-project/${draftProjectId}/export`, { method: 'POST' })
      const data = await res.json()
      if (data.full_text != null) setDraftExportResult({ full_text: data.full_text, word_count: data.word_count ?? 0 })
    } catch { /* ignore */ }
  }, [draftProjectId])

  const uploadDraftGuide = useCallback(async (file: File) => {
    if (!draftProjectId || !file?.name?.toLowerCase().endsWith('.pdf')) return
    setDraftGuideUploading(true)
    try {
      const form = new FormData()
      form.append('file', file)
      const parseRes = await fetch(`${getApiV1Base()}/cadapt/grants/parse-guide`, { method: 'POST', body: form })
      const parsed = await parseRes.json()
      if (parsed.sections?.length) {
        await fetch(`${getApiV1Base()}/cadapt/grants/draft-project/${draftProjectId}/guide`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sections: parsed.sections }),
        })
      }
    } finally {
      setDraftGuideUploading(false)
    }
  }, [draftProjectId])

  const submitCreateApplication = useCallback(async () => {
    if (!createAppGrantId || createAppAmount <= 0) return
    setCreateAppLoading(true)
    setCreateAppError(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/applications`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          grant_program_id: createAppGrantId,
          municipality: createAppMunicipality.trim() || riskData?.community?.name || selectedCity,
          requested_amount_m: createAppAmount,
        }),
      })
      const data = await res.json()
      if (data.error) {
        setCreateAppError(data.error)
        return
      }
      await refetchCommissionsAndApplications()
      setCreateAppGrantId(null)
    } catch (e) {
      setCreateAppError(e instanceof Error ? e.message : 'Failed to create application')
    } finally {
      setCreateAppLoading(false)
    }
  }, [createAppGrantId, createAppMunicipality, createAppAmount, riskData, selectedCity, refetchCommissionsAndApplications])

  const updateApplicationStatus = useCallback(async (applicationId: string, status: string) => {
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })
      if (res.ok) await refetchCommissionsAndApplications()
    } catch { /* ignore */ }
  }, [refetchCommissionsAndApplications])

  const matchEngineeringSolutions = useCallback(async () => {
    setEngMatchLoading(true)
    setEngMatchResult(null)
    try {
      const res = await fetch(`${getApiV1Base()}/cadapt/engineering-solutions/match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ risk_type: engRiskType, depth_m: engDepthM, area_ha: engAreaHa, limit: 5 }),
      })
      if (res.ok) setEngMatchResult(await res.json())
    } catch {
      setEngMatchResult(null)
    } finally {
      setEngMatchLoading(false)
    }
  }, [engRiskType, engDepthM, engAreaHa])

  // Chart data
  const buildingsDonutData: PieDataPoint[] = useMemo(() => {
    if (!riskData) return []
    const b = riskData.buildings_at_risk
    return [
      { id: 'residential', label: `Residential (${b.residential})`, value: b.residential, color: '#71717a' },
      { id: 'commercial', label: `Commercial (${b.commercial})`, value: b.commercial, color: '#52525b' },
      { id: 'critical', label: `Critical (${b.critical})`, value: b.critical, color: '#a1a1aa' },
    ]
  }, [riskData])

  const lossTrendSeries: TimeSeriesSeries[] = useMemo(() => {
    if (!riskData?.loss_trend) return []
    const baseYear = 2021
    return [{
      id: 'ael', name: 'AEL ($M)',
      data: riskData.loss_trend.map((v, i) => ({ date: new Date(baseYear + i, 0, 1), value: v })),
      color: '#a1a1aa',
    }]
  }, [riskData])

  const focusCoords = useMemo(() => riskData ? { lat: riskData.community.lat, lng: riskData.community.lng } : null, [riskData])

  // Map view: global → country → city (3D digital twin). Coords for city from selected map city or current data community.
  const mapViewMode = useMemo((): 'global' | 'country' | 'city' => {
    if (mapViewLevel === 'world') return 'global'
    if (mapViewLevel === 'country') return 'country'
    return 'city'
  }, [mapViewLevel])
  const mapCountryCode = mapViewLevel !== 'world' && selectedMapCountryCode ? selectedMapCountryCode : null
  // Map city dropdown: only cities of the selected country (from cities-by-country.json)
  const mapCityOptions: Community[] = useMemo(() => {
    if (!selectedMapCountryCode || !citiesByCountry[selectedMapCountryCode]) return []
    return citiesByCountry[selectedMapCountryCode].map(c => ({
      id: c.id,
      name: c.name,
      population: c.population,
      lat: c.lat,
      lng: c.lng,
    }))
  }, [selectedMapCountryCode, citiesByCountry])
  const mapFocusCoords = useMemo(() => {
    if (mapViewLevel !== 'city') return null
    const c = mapCityOptions.find(c => c.id === selectedMapCityId)
      ?? (selectedMapCityId && digitalTwinCity?.id === selectedMapCityId ? digitalTwinCity : null)
      ?? (riskData?.community && (selectedMapCityId === selectedCity || !selectedMapCityId) ? riskData.community : null)
    return c ? { lat: c.lat, lng: c.lng } : null
  }, [mapViewLevel, selectedMapCityId, mapCityOptions, digitalTwinCity, riskData?.community, selectedCity])
  const coordsForClimateLayers = mapFocusCoords ?? focusCoords
  // Show climate layers (flood/heat/drought) at selected city only after a stress test has been run
  const coordsForClimateLayersWhenScenarioRun = municipalStressReport ? (coordsForClimateLayers ?? undefined) : undefined

  // Risk zones from the last run climate stress test — show affected zones on the globe (critical for visibility)
  const municipalRiskZones = useMemo(() => {
    const report = municipalStressReport
    if (!report?.reportPayload?.zones || !Array.isArray(report.reportPayload.zones)) return []
    const zones = report.reportPayload.zones as Array<{
      position: { lat: number; lng: number }
      radius: number
      riskLevel: string
      label: string
    }>
    const levelMap: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {
      critical: 'critical',
      high: 'high',
      medium: 'medium',
      low: 'low',
    }
    return zones.map((z, i) => {
      const level = levelMap[z.riskLevel?.toLowerCase()] ?? 'medium'
      const radiusM = typeof z.radius === 'number' ? z.radius : 2000
      const radiusKm = radiusM >= 100 ? radiusM / 1000 : radiusM
      return {
        id: `stress-${report.stressTestId}-${i}`,
        name: z.label || `Zone ${i + 1}`,
        zone_level: level,
        center_latitude: z.position?.lat ?? 0,
        center_longitude: z.position?.lng ?? 0,
        radius_km: radiusKm,
        risk_score: level === 'critical' ? 0.9 : level === 'high' ? 0.7 : level === 'medium' ? 0.5 : 0.3,
      }
    })
  }, [municipalStressReport])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'Overview' },
    { id: 'risk', label: 'Risk' },
    { id: 'adaptation', label: 'Adaptation' },
    { id: 'grants', label: 'Grants' },
    { id: 'commissions', label: 'Commissions' },
    { id: 'plan', label: 'Plan' },
    { id: 'alerts', label: 'Alerts' },
    { id: 'regulatory', label: 'Regulatory' },
    { id: 'reports', label: 'Simulation reports' },
    { id: 'subscription', label: 'Subscription' },
    { id: 'launch', label: 'Launch progress' },
  ]

  // -------------------------------------------------------------------------
  // RENDER
  // -------------------------------------------------------------------------

  return (
    <AccessGate moduleId="cadapt">
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans">
        {/* ---- HEADER ---- */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-3 border-b border-zinc-800/60/60">
          <button onClick={() => navigate('/modules')} className="p-2 rounded-md bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/60">
            <ArrowLeftIcon className="w-5 h-5 text-zinc-400" />
          </button>
          <BuildingOffice2Icon className="w-6 h-6 text-zinc-500" />
          <div className="flex-1 min-w-0">
            <h1 className="text-base font-display font-semibold truncate text-zinc-100 tracking-tight">Climate Adaptation & Local Resilience</h1>
            <p className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Municipal Dashboard — {riskData?.community?.name ?? selectedCity?.replace(/_/g, ' ') ?? 'Select city'}</p>
          </div>

          {/* Tabs */}
          <div className="hidden md:flex gap-1">
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium ${tab === t.id ? 'bg-zinc-900/80 text-zinc-100 border border-zinc-800/60' : 'text-zinc-500 hover:text-zinc-300 border border-transparent hover:bg-zinc-800/80'}`}
              >{t.label}</button>
            ))}
          </div>

          <button onClick={fetchAll} className="p-2 rounded-md bg-zinc-900/50 hover:bg-zinc-800 border border-zinc-800/60">
            <ArrowPathIcon className="w-5 h-5 text-zinc-400" />
          </button>
        </div>

        {fetchError && (
          <div className="mx-4 mt-2 px-4 py-3 rounded-md bg-amber-950/50 border border-amber-600/50 text-amber-200 text-sm flex items-start gap-2">
            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 mt-0.5" />
            <span>{fetchError}</span>
            <button type="button" onClick={() => setFetchError(null)} className="ml-auto shrink-0 text-amber-400/80 hover:text-amber-300" aria-label="Dismiss">×</button>
          </div>
        )}

        {/* Mobile tabs */}
        <div className="md:hidden flex gap-1 px-4 py-2 overflow-x-auto border-b border-zinc-800/60/60">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-1.5 rounded-md font-mono text-[10px] uppercase tracking-widest whitespace-nowrap ${tab === t.id ? 'bg-zinc-900/80 text-zinc-100 border border-zinc-800/60' : 'text-zinc-500'}`}
            >{t.label}</button>
          ))}
        </div>

        {/* Product modules — всегда видна под вкладками, с иконками */}
        <div className="px-4 py-2.5 border-b border-zinc-800/60/60 bg-zinc-900/50 flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mr-1">Product modules:</span>
          <button type="button" onClick={() => setTab('risk')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <CloudIcon className="w-4 h-4 shrink-0" />
            Flood
          </button>
          <span className="text-zinc-600">·</span>
          <button type="button" onClick={() => setTab('risk')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <SunIcon className="w-4 h-4 shrink-0" />
            Heat
          </button>
          <span className="text-zinc-600">·</span>
          <button type="button" onClick={() => setTab('risk')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <BoltIcon className="w-4 h-4 shrink-0" />
            Drought
          </button>
          <span className="text-zinc-600">·</span>
          <button type="button" onClick={() => setTab('grants')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <CurrencyDollarIcon className="w-4 h-4 shrink-0" />
            Grants
          </button>
          <span className="text-zinc-600">·</span>
          <button type="button" onClick={() => setTab('alerts')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <BellAlertIcon className="w-4 h-4 shrink-0" />
            Alerts
          </button>
          <span className="text-zinc-600">·</span>
          <button type="button" onClick={() => navigate('/effectiveness')} className="inline-flex items-center gap-1.5 text-xs text-zinc-400 hover:text-zinc-200">
            <ArrowTrendingUpIcon className="w-4 h-4 shrink-0" />
            Effectiveness
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center"><div className="animate-spin h-10 w-10 border-2 border-zinc-600 border-t-zinc-400 rounded-full" /></div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* ================================================================
                OVERVIEW TAB
               ================================================================ */}
            {tab === 'overview' && riskData && (
              <div className="p-4 space-y-4">
                {/* Top row: Risk Summary | Map | Community Status */}
                <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_280px] gap-4">
                  {/* -- LEFT: Risk Summary (current city drives all tabs) -- */}
                  <div className="space-y-3">
                    <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Risk Summary</h2>
                    <p className="font-mono text-[10px] text-zinc-500">Community: <span className="text-zinc-300">{digitalTwinCity?.name ?? riskData.community?.name ?? selectedCity?.replace(/_/g, ' ') ?? '—'}</span></p>
                    {(riskData.hazards ?? []).map(h => {
                      const Icon = HAZARD_ICONS[h.type] || ExclamationTriangleIcon
                      const color = levelColor(h.level)
                      return (
                        <motion.div key={h.type} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-3">
                          <div className="flex items-center gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-1.5 mb-1">
                                <Icon className="w-4 h-4 text-zinc-500" />
                                <span className="text-sm font-medium text-zinc-200 capitalize">{h.type}</span>
                                {h.trend === 'rising' && <ChevronUpIcon className="w-3 h-3 text-zinc-500" />}
                                {h.trend === 'falling' && <ChevronDownIcon className="w-3 h-3 text-zinc-500" />}
                              </div>
                              <div className="text-2xl font-semibold text-zinc-100">{h.score}</div>
                              <div className="text-xs font-medium text-zinc-500 uppercase mt-0.5">{h.level}</div>
                              <button onClick={() => setTab('risk')} className="text-xs text-zinc-400 hover:text-zinc-200 mt-1">View Details</button>
                            </div>
                            <CircularProgress value={h.pct} size={52} color={color} />
                          </div>
                        </motion.div>
                      )
                    })}
                  </div>

                  {/* -- CENTER: CesiumGlobe — default static 3D Google map; World → Country → City -- */}
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 overflow-hidden flex flex-col min-h-[400px]">
                    {/* Map level: World | Country | City (3D digital twin) */}
                    <div className="flex items-center gap-3 px-3 py-2 border-b border-zinc-800/60/60 bg-zinc-900/80 flex-wrap">
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Map</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <button
                          onClick={() => { setMapViewLevel('world'); setSelectedMapCountryCode(''); setSelectedMapCityId(''); setCity3DInGlobe(false) }}
                          className={`px-2 py-1 rounded-md text-xs font-medium border ${mapViewLevel === 'world' ? 'bg-zinc-800 text-zinc-100 border-zinc-800/60' : 'text-zinc-500 hover:text-zinc-300 border-zinc-800/60 hover:bg-zinc-800/80'}`}
                        >World</button>
                        <select
                          value={selectedMapCountryCode}
                          onChange={e => {
                            const v = e.target.value
                            setSelectedMapCountryCode(v)
                            if (v) setMapViewLevel('country')
                            else setMapViewLevel('world')
                            setSelectedMapCityId('')
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-xs text-zinc-100 font-sans"
                        >
                          <option value="">— Country —</option>
                          {countriesList.slice(0, 80).map(c => (
                            <option key={c.code} value={c.code}>{c.name}</option>
                          ))}
                        </select>
                        <select
                          value={selectedMapCityId}
                          onChange={e => {
                            const v = e.target.value
                            setSelectedMapCityId(v)
                            if (v) {
                              setMapViewLevel('city')
                              const city = mapCityOptions.find(c => c.id === v)
                              if (city) {
                                setDigitalTwinCity(city)
                                // Sync risk data city so flood grid + buildings load for this city (Risk tab)
                                setSelectedCity(v)
                              }
                              // Do NOT auto-open Digital Twin — only focus globe on city; user can open 3D via button
                            } else {
                              setDigitalTwinCity(null)
                              setCity3DInGlobe(false)
                            }
                          }}
                          disabled={!selectedMapCountryCode}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-xs text-zinc-100 font-sans disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <option value="">— City —</option>
                          {mapCityOptions.map(c => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                        {selectedMapCityId && digitalTwinCity && (
                          <>
                            <button
                              type="button"
                              onClick={() => setCity3DInGlobe(true)}
                              className="px-2 py-1 rounded-md text-xs font-medium border border-zinc-800/60 bg-zinc-900/80 text-zinc-200 hover:bg-zinc-800"
                            >
                              3D city
                            </button>
                            {city3DInGlobe && (
                              <div className="relative">
                                <button
                                  type="button"
                                  onClick={() => { setShowMunicipalStressSelector(!showMunicipalStressSelector); setMunicipalPlay4dCzmlUrl(null) }}
                                  disabled={municipalStressRunning}
                                  className="px-2 py-1 rounded text-xs font-medium border border-amber-600 bg-amber-900/80 text-amber-200 hover:bg-amber-800 disabled:opacity-50 flex items-center gap-1"
                                >
                                  {municipalStressRunning ? '…' : 'Select stress test'}
                                  <svg className={`w-3 h-3 transition-transform ${showMunicipalStressSelector ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                {showMunicipalStressSelector && !municipalStressRunning && (
                                  <div className="absolute top-full left-0 mt-1 w-96 max-h-[360px] overflow-hidden bg-zinc-950 rounded-md border border-zinc-800/60 shadow-2xl z-30">
                                    <div className="p-2">
                                      <UnifiedStressTestSelector
                                        filterMunicipalLocalOnly
                                        selectedScenarioId={municipalStressScenarioId}
                                        onSelect={async (scenario) => {
                                          const city = digitalTwinCity
                                          if (!city) return
                                          setMunicipalStressRunning(true)
                                          setShowMunicipalStressSelector(false)
                                          setMunicipalStressReport(null)
                                          setMunicipalPlay4dCzmlUrl(null)
                                          try {
                                            const res = await fetch(`${getApiV1Base()}/stress-tests/execute`, {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                city_name: city.name,
                                                center_latitude: city.lat,
                                                center_longitude: city.lng,
                                                event_id: scenario.id,
                                                severity: scenario.severity ?? 0.65,
                                                use_llm: true,
                                                entity_name: city.name,
                                                use_kg: true,
                                                use_cascade_gnn: true,
                                                use_nvidia_orchestration: true,
                                                source: 'zone_simulation',
                                              }),
                                            })
                                            if (!res.ok) throw new Error('Stress test failed')
                                            const data = await res.json()
                                            const reportPayload: Record<string, unknown> = {
                                              eventName: data.event_name,
                                              eventType: data.event_type,
                                              eventId: scenario.id,
                                              cityName: data.city_name,
                                              timestamp: data.timestamp,
                                              totalLoss: data.total_loss,
                                              totalBuildingsAffected: data.total_buildings_affected,
                                              totalPopulationAffected: data.total_population_affected,
                                              zones: (data.zones || []).map((z: { label: string; risk_level: string; position: { lat: number; lng: number }; radius: number; affected_buildings: number; estimated_loss: number; population_affected: number; recommendations?: string[] }) => ({
                                                position: z.position,
                                                radius: z.radius,
                                                riskLevel: z.risk_level,
                                                label: z.label,
                                                zoneType: data.event_type,
                                                affectedBuildings: z.affected_buildings,
                                                estimatedLoss: z.estimated_loss,
                                                populationAffected: z.population_affected,
                                                recommendations: z.recommendations || [],
                                              })),
                                              executiveSummary: data.executive_summary,
                                              concludingSummary: data.concluding_summary,
                                              mitigationActions: (data.mitigation_actions || []).map((a: { action: string; priority: string; cost?: number; risk_reduction?: number }) => ({ action: a.action, priority: a.priority, cost: a.cost || 0, riskReduction: a.risk_reduction || 0 })),
                                              dataSourcesUsed: data.data_sources || [],
                                              llmGenerated: data.llm_generated,
                                              regionActionPlan: data.region_action_plan,
                                              reportV2: data.report_v2,
                                              currency: data.currency || 'EUR',
                                              compliance_verification: data.compliance_verification,
                                            }
                                            setMunicipalStressScenarioId(scenario.id)
                                            setMunicipalStressReport({
                                              stressTestId: data.id,
                                              eventId: scenario.id,
                                              cityName: data.city_name,
                                              eventName: data.event_name,
                                              timestamp: data.timestamp,
                                              reportPayload,
                                              complianceVerification: data.compliance_verification,
                                            })
                                            const countryName = countriesList.find(c => c.code === selectedMapCountryCode)?.name ?? selectedMapCountryCode ?? ''
                                            saveZoneReport({
                                              id: data.id || `zone-${Date.now()}`,
                                              cityName: data.city_name,
                                              scenarioName: data.event_name,
                                              timestamp: data.timestamp,
                                              country: countryName,
                                              reportPayload,
                                            })
                                          } catch (e) {
                                            console.error(e)
                                          } finally {
                                            setMunicipalStressRunning(false)
                                          }
                                        }}
                                        onClear={() => { setMunicipalStressScenarioId(null); setShowMunicipalStressSelector(false) }}
                                      />
                                    </div>
                                    <div className="p-2 border-t border-zinc-800/60">
                                      <button type="button" onClick={() => setShowMunicipalStressSelector(false)} className="w-full py-1.5 text-xs text-zinc-500 hover:text-zinc-400">Cancel</button>
                                    </div>
                                  </div>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                    {/* Layer checkboxes */}
                    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-zinc-800/60/60 bg-zinc-900/80 flex-wrap">
                      {(['flood', 'heat', 'drought', 'wildfire'] as const).map(layer => (
                        <label key={layer} className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 cursor-pointer">
                          <input type="checkbox" checked={mapLayers[layer]}
                            onChange={() => setMapLayers(prev => ({ ...prev, [layer]: !prev[layer] }))}
                            className="rounded border-zinc-800/60 bg-zinc-900/80 text-zinc-400 w-3 h-3" />
                          <span className="capitalize">{layer}</span>
                        </label>
                      ))}
                      <label className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-zinc-500 cursor-pointer">
                        <input type="checkbox" checked={mapLayers.infrastructureAtRisk}
                          onChange={() => setMapLayers(prev => ({ ...prev, infrastructureAtRisk: !prev.infrastructureAtRisk }))}
                          className="rounded border-zinc-800/60 bg-zinc-900/80 text-zinc-400 w-3 h-3" />
                        <span>Infrastructure at risk</span>
                      </label>
                    </div>
                    <div className="flex-1 relative min-h-[320px]">
                      <Suspense fallback={<div className="flex items-center justify-center h-full text-zinc-500 text-sm">Loading 3D map...</div>}>
                        <CesiumGlobe
                          viewMode={mapViewMode}
                          selectedCountryCode={mapCountryCode}
                          focusCoordinates={mapFocusCoords}
                          showGoogle3dLayer={true}
                          city3DView={city3DInGlobe}
                          showFloodLayer={mapLayers.flood}
                          showHeatLayer={mapLayers.heat}
                          showDroughtLayer={mapLayers.drought}
                          showH3Layer={mapLayers.infrastructureAtRisk}
                          floodCenter={coordsForClimateLayersWhenScenarioRun}
                          floodDepthOverride={floodDepthOverride}
                          floodGrid={floodRiskProduct?.flood_grid ?? undefined}
                          floodBuildings={floodBuildings ?? undefined}
                          anomalyCenter={coordsForClimateLayersWhenScenarioRun}
                          stressTestCzmlUrl={municipalPlay4dCzmlUrl}
                          riskZones={municipalRiskZones}
                        />
                      </Suspense>
                      {/* Same UX as Digital Twin: Report ready + Play 4D Timeline + View Report (when 3D city + stress test complete) */}
                      {city3DInGlobe && municipalStressRunning && (
                        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-2 bg-black/85 rounded-md border border-amber-500/40 text-amber-200 text-sm z-20">
                          <div className="w-4 h-4 border-2 border-amber-300 border-t-transparent rounded-full animate-spin" />
                          <span>Analyzing…</span>
                        </div>
                      )}
                      {city3DInGlobe && municipalStressReport && !municipalStressRunning && (
                        <div className={`absolute left-1/2 -translate-x-1/2 flex items-center gap-3 px-4 py-2.5 bg-black/85 rounded-md border border-green-500/40 shadow-lg z-20 ${municipalPlay4dCzmlUrl ? 'bottom-20' : 'bottom-6'}`}>
                          <span className="text-green-400/80 text-sm font-medium flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Report ready
                          </span>
                          {municipalStressReport.complianceVerification?.verified && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 border border-emerald-500/40 text-emerald-400/80 text-xs font-medium" title="Regulatory verification passed">
                              Compliance verified
                            </span>
                          )}
                          <button
                            type="button"
                            onClick={() => {
                              const path = `/api/v1/stress-tests/${encodeURIComponent(municipalStressReport.stressTestId)}/czml`
                              const base = getApiBase()
                              setMunicipalPlay4dCzmlUrl(base ? `${base.replace(/\/+$/, '')}${path}` : path)
                            }}
                            className="px-3 py-1.5 bg-amber-700/80 text-amber-100 border border-amber-500/60 rounded-md text-sm font-medium hover:bg-amber-600/80 transition-colors flex items-center gap-1.5"
                            title="Animate the same scenario in 3D from T0 to T+12m. Timeline stops at T+12m. View Report = same stress test report."
                          >
                            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                              <path d="M8 5v14l11-7z" />
                            </svg>
                            Play 4D Timeline
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem('pfrp-stress-report', JSON.stringify(municipalStressReport.reportPayload))
                                window.open('/report?source=stress', '_blank', 'noopener,noreferrer')
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                            className="px-3 py-1.5 bg-zinc-800 border border-zinc-800/60 text-zinc-200 rounded-md text-sm font-medium hover:bg-zinc-700 transition-colors"
                          >
                            View Report
                          </button>
                          <button
                            type="button"
                            onClick={() => setShowRecordObservationModal(true)}
                            className="px-3 py-1.5 bg-sky-700/80 text-sky-100 border border-sky-500/60 rounded-md text-sm font-medium hover:bg-sky-600/80 transition-colors"
                            title="Send this scenario to Cross-Track Synergy for model calibration"
                          >
                            Record as field observation
                          </button>
                        </div>
                      )}
                    {municipalStressReport && (
                      <SubmitAsFieldObservationModal
                        isOpen={showRecordObservationModal}
                        onClose={() => setShowRecordObservationModal(false)}
                        initial={{
                          cityName: municipalStressReport.cityName,
                          eventName: municipalStressReport.eventName,
                          eventType: (municipalStressReport.reportPayload?.eventType as string) || (municipalStressReport.reportPayload?.event_type as string) || 'flood',
                          totalLoss: (municipalStressReport.reportPayload?.totalLoss as number) ?? (municipalStressReport.reportPayload?.total_loss as number) ?? 0,
                          stressTestId: municipalStressReport.stressTestId,
                        }}
                      />
                    )}
                    </div>
                    {/* Legend */}
                    <div className="flex items-center gap-4 px-3 py-1.5 border-t border-zinc-800/60 bg-zinc-900/80 font-mono text-[10px] uppercase tracking-wider text-zinc-500 flex-wrap">
                      <span>Legend</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-500" /> Extreme</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-600" /> High</span>
                      <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-zinc-700" /> Medium</span>
                      {mapLayers.flood && (floodRiskProduct?.flood_grid?.length || floodBuildings?.length) ? (
                        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-green-500/60" /> Flood: grid = depth (m), points = buildings (click for details)</span>
                      ) : null}
                      {mapLayers.infrastructureAtRisk && <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-sm bg-amber-600/80" /> H3 risk (infra at risk)</span>}
                    </div>
                  </div>

                  {/* -- RIGHT: Community Status -- */}
                  <div className="space-y-3">
                    <h2 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Community Status</h2>

                    {/* Population */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1"><MapPinIcon className="w-3 h-3" /> Population</div>
                      <div className="text-2xl font-semibold font-mono tabular-nums text-zinc-100">{riskData.community.population.toLocaleString()}</div>
                    </div>

                    {/* Buildings at Risk */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Buildings at Risk</div>
                      <div className="text-2xl font-semibold text-zinc-100 mb-2">{riskData.buildings_at_risk.total}</div>
                      <PieChart data={buildingsDonutData} size={120} innerRadius={0.65} showLegend showValues={false} />
                    </div>

                    {/* Critical infrastructure at risk */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Critical Infrastructure at Risk</div>
                      <div className="text-2xl font-semibold text-zinc-100">{riskData.buildings_at_risk.critical}</div>
                      <div className="text-[10px] text-zinc-500 mt-0.5">sites (toggle layer on map)</div>
                    </div>

                    {/* AEL & 100-year loss (municipality level) */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">AEL (Annual Expected Loss)</div>
                      <div className="text-2xl font-semibold text-zinc-100">${riskData.financial_exposure?.annual_expected_loss_m ?? riskData.estimated_annual_loss_m}M</div>
                      <div className="text-xs text-zinc-500 mt-2">100-year loss</div>
                      <div className="text-lg font-semibold text-zinc-200">${riskData.financial_exposure?.loss_100_year_m ?? '—'}M</div>
                    </div>

                    {/* Loss trend chart */}
                    {lossTrendSeries.length > 0 && (
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">AEL Trend</div>
                        <TimeSeriesChart series={lossTrendSeries} height={80} showGrid={false} showLegend={false} />
                      </div>
                    )}

                    {/* ROI evidence (3 metrics) */}
                    {roiMetrics && (
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">ROI evidence</div>
                        <div className="text-xs space-y-1">
                          {typeof roiMetrics.loss_reduction_12m === 'number' && (
                            <div>Loss avoided (12m): ${(roiMetrics.loss_reduction_12m / 1e6).toFixed(2)}M</div>
                          )}
                          {typeof roiMetrics.reaction_time_median_hours === 'number' && (
                            <div>Reaction time: {roiMetrics.reaction_time_median_hours}h</div>
                          )}
                          {typeof roiMetrics.insurance_impact_score === 'number' && (
                            <div>Insurance impact: {(roiMetrics.insurance_impact_score * 100).toFixed(0)}%</div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Launch progress (6–12 weeks) */}
                    {launchChecklist && (
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2 flex items-center justify-between">
                          <span>Launch progress</span>
                          <button type="button" onClick={() => setTab('launch')} className="text-xs text-zinc-400 hover:text-zinc-200">View all</button>
                        </div>
                        <div className="text-lg font-semibold text-zinc-100">
                          {launchChecklist.steps.filter(s => s.done).length} / {launchChecklist.steps.length}
                        </div>
                        {launchChecklist.all_done && <p className="text-emerald-400 text-xs mt-1">City live</p>}
                      </div>
                    )}

                    {/* Recommended actions (playbook) */}
                    {nextActions && nextActions.next_actions?.length > 0 && (
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Do now</div>
                        <ul className="space-y-2">
                          {nextActions.next_actions.map((a) => (
                            <li key={a.step_id} className="flex items-center justify-between gap-2">
                              <span className="text-sm text-zinc-200">{a.label}</span>
                              <button
                                type="button"
                                onClick={() => {
                                  if (a.action_type === 'assess_risk') setTab('risk')
                                  else if (a.action_type === 'generate_report') window.open(`${getApiV1Base()}/cadapt/insurability-report?city=${encodeURIComponent(selectedCity)}&format=json`, '_blank')
                                }}
                                className="text-xs px-2 py-1 rounded border border-zinc-600 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200"
                              >
                                {a.action_type === 'assess_risk' ? 'Open Risk' : a.action_type === 'generate_report' ? 'Get report' : 'Do'}
                              </button>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                </div>

                {/* Bottom row: Funding Opportunities | Upcoming Deadlines */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Funding Opportunities */}
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Funding Opportunities</h3>
                    <div className="space-y-3">
                      {funding.map(f => {
                        const badge = STATUS_BADGE[f.status] || STATUS_BADGE.not_started
                        return (
                          <div key={f.id} className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <div>
                                <span className="text-sm font-medium text-zinc-200">{f.grant_name}</span>
                                <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                              </div>
                              <div className="text-xs text-zinc-500">
                                {f.status === 'awarded' ? `$${(f.amount_m * 1_000_000).toLocaleString()}` : f.deadline ? `Due ${new Date(f.deadline).toLocaleDateString('en', { month: 'short', day: 'numeric' })}` : ''}
                              </div>
                            </div>
                            <div className="h-1.5 bg-zinc-800 rounded overflow-hidden">
                              <div className="h-full rounded bg-zinc-600 transition-all duration-500"
                                style={{ width: `${f.progress_pct}%` }} />
                            </div>
                            <div className="text-[10px] text-zinc-500 text-right">{f.progress_pct}%</div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* Upcoming Deadlines */}
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Upcoming Deadlines</h3>
                    <div className="grid grid-cols-[1fr_1fr] gap-4">
                      <MiniCalendar deadlines={deadlines} />
                      <div className="space-y-2">
                        {deadlines.slice(0, 5).map((dl, i) => (
                          <div key={i} className="flex items-start gap-2">
                            <CalendarDaysIcon className="w-4 h-4 mt-0.5 text-zinc-500 shrink-0" />
                            <div className="text-xs font-medium text-zinc-300">{new Date(dl.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}: {dl.title}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                RISK TAB
               ================================================================ */}
            {tab === 'risk' && riskData && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Risk Analysis — {digitalTwinCity?.name ?? riskData.community.name}</h2>

                {/* Hazard Breakdown */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Hazard Breakdown</h3>
                  <div className="space-y-4">
                    {(riskData.hazards ?? []).map(h => {
                      const color = levelColor(h.level)
                      return (
                        <div key={h.type}>
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-zinc-300 capitalize">{h.type}</span>
                            <span className="text-sm font-semibold text-zinc-200">{h.score}/100 — <span className="uppercase text-xs text-zinc-500">{h.level}</span></span>
                          </div>
                          <div className="h-2.5 bg-zinc-800 rounded overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${h.pct}%` }} transition={{ duration: 0.8 }}
                              className="h-full rounded" style={{ backgroundColor: color }} />
                          </div>
                          <div className="flex items-center gap-1 mt-0.5 text-[10px] text-zinc-500">
                            <span>Trend: {h.trend}</span>
                            {h.trend === 'rising' && <ChevronUpIcon className="w-3 h-3 text-zinc-400" />}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Financial Exposure */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Financial Exposure</h3>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                      <div className="text-xs text-zinc-500">Annual Expected Loss</div>
                      <div className="text-xl font-semibold text-zinc-100">${riskData.financial_exposure.annual_expected_loss_m}M</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                      <div className="text-xs text-zinc-500">100-Year Loss</div>
                      <div className="text-xl font-semibold text-zinc-100">${riskData.financial_exposure.loss_100_year_m}M</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                      <div className="text-xs text-zinc-500">Projected 2050</div>
                      <div className="text-xl font-semibold text-zinc-100">${riskData.financial_exposure.projected_2050_m}M</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                      <div className="text-xs text-zinc-500">Without Adaptation 2050</div>
                      <div className="text-xl font-semibold text-zinc-100">${riskData.financial_exposure.without_adaptation_2050_m}M</div>
                    </div>
                  </div>
                </div>

                {/* Vulnerability Factors */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Vulnerability Factors</h3>
                  <div className="space-y-2">
                    {riskData.vulnerability_factors.map((vf, i) => (
                      <div key={i} className="flex items-center gap-3 bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3">
                        {vf.present
                          ? <ExclamationTriangleIcon className="w-5 h-5 text-zinc-400 shrink-0" />
                          : <CheckCircleIcon className="w-5 h-5 text-zinc-500 shrink-0" />}
                        <span className={`text-sm ${vf.present ? 'text-zinc-200' : 'text-zinc-500'}`}>{vf.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Loss trend chart */}
                {lossTrendSeries.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">Annual Expected Loss Trend</h3>
                    <TimeSeriesChart series={lossTrendSeries} height={250} showGrid showLegend yAxisLabel="Loss ($M)" valueFormat="currency" />
                  </div>
                )}

                {/* Flood Risk Assessment — full product with economic breakdown, AEL, validation */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                      Flood Risk Assessment — {floodRiskProduct?.city_info?.city_name ?? riskData?.community?.name ?? selectedCity ?? 'Community'}
                    </h3>
                    <div className="flex items-center gap-2 flex-wrap">
                      <a href="/docs/USGS_SOURCES.html" target="_blank" rel="noopener noreferrer" className="text-[10px] text-zinc-500 hover:text-zinc-300 underline" title="UTF-8">
                        USGS sources (3DEP, WaterWatch)
                      </a>
                    {floodRetrospective != null && floodRetrospective.total_events > 0 && floodRetrospective.accuracy_pct != null && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          (floodRetrospective.accuracy_pct ?? 0) >= 90
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : (floodRetrospective.accuracy_pct ?? 0) >= 70
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-red-500/20 text-red-400'
                        }`}
                        title="Model vs fact for historical floods near this city"
                      >
                        Accuracy for this city: {(floodRetrospective.accuracy_pct ?? 0).toFixed(0)}% ({floodRetrospective.passed_count}/{floodRetrospective.total_events} events)
                      </span>
                    )}
                    {floodRetrospective != null && floodRetrospective.total_events === 0 && floodValidation != null && floodValidation.accuracy_pct != null && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          (floodValidation.accuracy_pct ?? 0) >= 90 ? 'bg-emerald-500/20 text-emerald-400' : (floodValidation.accuracy_pct ?? 0) >= 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                        }`}
                        title="Overall model validation (all pilot events)"
                      >
                        Validated: {(floodValidation.accuracy_pct ?? 0).toFixed(0)}% ({floodValidation.passed_count ?? 0}/{floodValidation.total_events ?? 0} events)
                      </span>
                    )}
                    {floodRetrospective == null && floodValidation != null && floodValidation.accuracy_pct != null && (
                      <span
                        className={`px-2 py-0.5 rounded text-xs font-medium ${
                          (floodValidation.accuracy_pct ?? 0) >= 90 ? 'bg-emerald-500/20 text-emerald-400' : (floodValidation.accuracy_pct ?? 0) >= 70 ? 'bg-amber-500/20 text-amber-400' : 'bg-red-500/20 text-red-400'
                        }`}
                        title="Model vs historical events"
                      >
                        Validated: {(floodValidation.accuracy_pct ?? 0).toFixed(0)}% ({floodValidation.passed_count ?? 0}/{floodValidation.total_events ?? 0} events)
                      </span>
                    )}
                    </div>
                  </div>
                  {floodRetrospective != null && floodRetrospective.total_events > 0 && floodRetrospective.events.length > 0 && (
                    <div className="mb-3 p-3 rounded bg-zinc-800/50 border border-zinc-800/60">
                      <p className="text-xs font-medium text-zinc-400 mb-2">Retrospective: model vs fact (historical floods near this city)</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[11px]">
                          <thead>
                            <tr className="text-left text-zinc-500 border-b border-zinc-600">
                              <th className="pb-1 pr-2">Event</th>
                              <th className="pb-1 pr-2">Date</th>
                              <th className="pb-1 pr-2">Model loss</th>
                              <th className="pb-1 pr-2">Actual loss</th>
                              <th className="pb-1 pr-2">Error</th>
                              <th className="pb-1">Pass</th>
                            </tr>
                          </thead>
                          <tbody>
                            {floodRetrospective.events.map(ev => (
                              <tr key={ev.event_id} className="border-b border-zinc-800/60/60">
                                <td className="py-1 pr-2 text-zinc-300">{ev.city}</td>
                                <td className="py-1 pr-2 text-zinc-400">{ev.date}</td>
                                <td className="py-1 pr-2 text-zinc-300">{ev.model_loss_usd != null ? (ev.model_loss_usd >= 1e9 ? `$${(ev.model_loss_usd / 1e9).toFixed(2)}B` : `$${(ev.model_loss_usd / 1e6).toFixed(1)}M`) : '—'}</td>
                                <td className="py-1 pr-2 text-zinc-300">{ev.actual_loss_usd >= 1e9 ? `$${(ev.actual_loss_usd / 1e9).toFixed(2)}B` : `$${(ev.actual_loss_usd / 1e6).toFixed(1)}M`}</td>
                                <td className="py-1 pr-2">{ev.error_pct != null ? `${ev.error_pct.toFixed(1)}%` : '—'}</td>
                                <td className="py-1">{ev.pass ? <span className="text-emerald-400/80">✓</span> : <span className="text-amber-400/80">✗</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {floodRetrospective.avg_error_pct != null && (
                        <p className="text-[10px] text-zinc-500 mt-2">Avg error: {floodRetrospective.avg_error_pct.toFixed(1)}% (pass if ≤20%)</p>
                      )}
                    </div>
                  )}
                  {floodRetrospective != null && floodRetrospective.total_events === 0 && floodRetrospective.message && (
                    <p className="text-[10px] text-zinc-500 mb-2">{floodRetrospective.message}</p>
                  )}
                  {floodRiskProduct?.data_sources && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {Object.entries(floodRiskProduct.data_sources).map(([k, v]) =>
                        v ? <span key={k} className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] text-zinc-400">{k}</span> : null
                      )}
                    </div>
                  )}
                  {floodProductLoading ? (
                    <p className="text-zinc-500 text-sm">Loading flood risk product…</p>
                  ) : floodRiskProduct?.scenarios && floodRiskProduct.scenarios.length > 0 ? (
                    <>
                      <div className="grid grid-cols-3 gap-3 mb-4">
                        {floodRiskProduct.scenarios.map(s => (
                          <div key={s.return_period_years} className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                            <div className="text-xs text-zinc-500">{s.return_period_years}-year</div>
                            <div className="text-lg font-semibold text-zinc-100 mt-1">{s.flood_depth_m} m</div>
                            <div className="text-xs text-zinc-500">depth</div>
                            {s.extent_area_km2 != null && <div className="text-xs text-zinc-500 mt-0.5">{s.extent_area_km2} km² extent</div>}
                            {s.duration_hours != null && <div className="text-xs text-zinc-500">~{s.duration_hours}h duration</div>}
                            <div className="text-lg font-semibold text-zinc-200 mt-2">
                              ${((s.economic?.total_loss_usd ?? 0) / 1e6).toFixed(2)}M
                            </div>
                            <div className="text-xs text-zinc-500">total loss</div>
                          </div>
                        ))}
                      </div>
                      {floodRiskProduct.economic_impact && floodRiskProduct.economic_impact.length > 0 && (
                        <div className="overflow-x-auto mb-3">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="text-left text-zinc-500 border-b border-zinc-800/60/60">
                                <th className="pb-1 pr-2">Component</th>
                                {floodRiskProduct.economic_impact.map(e => (
                                  <th key={e.return_period_years} className="pb-1 px-2">{e.return_period_years}-yr</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="text-zinc-300">
                              {['residential_loss_usd', 'commercial_loss_usd', 'infrastructure_loss_usd', 'business_interruption_usd', 'emergency_usd', 'total_loss_usd'].map(key => (
                                <tr key={key} className="border-b border-zinc-800/60">
                                  <td className="py-1 pr-2 capitalize">{key.replace(/_/g, ' ').replace('usd', '')}</td>
                                  {(floodRiskProduct.economic_impact ?? []).map(e => (
                                    <td key={e.return_period_years} className="py-1 px-2">
                                      ${((e as Record<string, number>)[key] / 1e6).toFixed(2)}M
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                      {floodRiskProduct.ael_usd != null && (
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 mb-3">
                          <span className="text-xs text-zinc-500">Annual Expected Loss (AEL)</span>
                          <div className="text-xl font-semibold text-zinc-100">${(floodRiskProduct.ael_usd / 1e6).toFixed(2)}M</div>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const sc100 = floodRiskProduct.scenarios?.find(s => s.return_period_years === 100)
                            if (sc100) {
                              setFloodDepthOverride(sc100.flood_depth_m)
                              setMapLayers(prev => ({ ...prev, flood: true }))
                              setTab('overview')
                            }
                          }}
                          className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-200 text-sm font-medium"
                        >
                          View on Globe (100-yr depth)
                        </button>
                        <button type="button" onClick={() => setFloodDepthOverride(undefined)} className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 text-zinc-400 text-sm">
                          Reset depth
                        </button>
                      </div>
                    </>
                  ) : floodScenarios && floodScenarios.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {floodScenarios.map(s => (
                        <div key={s.return_period_years} className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-4 text-center">
                          <div className="text-xs text-zinc-500">{s.return_period_years}-year</div>
                          <div className="text-lg font-semibold text-zinc-100 mt-1">{s.flood_depth_m} m</div>
                          <div className="text-xs text-zinc-500">depth</div>
                          <div className="text-lg font-semibold text-zinc-200 mt-2">${s.estimated_loss_usd_m}M</div>
                          <div className="text-xs text-zinc-500">est. loss</div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-zinc-500 text-sm">Loading scenarios…</p>
                  )}
                </div>

                {/* Model validation vs historical events */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Model validation (vs historical event)</h3>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <input
                      type="text"
                      value={validateEventId}
                      onChange={e => setValidateEventId(e.target.value)}
                      placeholder="Historical event ID"
                      className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-1.5 text-sm text-zinc-100 font-sans w-48"
                    />
                    <button
                      type="button"
                      onClick={handleValidate}
                      disabled={validateLoading || !validateEventId.trim()}
                      className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium disabled:opacity-50"
                    >
                      {validateLoading ? 'Validating…' : 'Validate'}
                    </button>
                  </div>
                  {validateResult && !validateResult.error && (
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-sm space-y-1">
                      <div className="flex justify-between"><span className="text-zinc-500">Event</span><span className="text-zinc-200">{String(validateResult.event_name)}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Model loss (EUR)</span><span className="text-zinc-200">{Number(validateResult.model_loss_eur).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Actual loss (EUR)</span><span className="text-zinc-200">{Number(validateResult.actual_loss_eur).toLocaleString()}</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Error %</span><span className="text-zinc-200">{Number(validateResult.error_pct)}%</span></div>
                      <div className="flex justify-between"><span className="text-zinc-500">Divergence &gt;20%</span><span className={validateResult.divergence_gt_20 ? 'text-amber-400' : 'text-zinc-400'}>{validateResult.divergence_gt_20 ? 'Yes' : 'No'}</span></div>
                    </div>
                  )}
                  {validateResult?.error ? <p className="text-zinc-500 text-sm">{String(validateResult.error)}</p> : null}
                </div>

                {/* Engineering Solutions Matcher: risk type + depth + area → top 3–5 with prices and cases */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Engineering Solutions Matcher</h3>
                  <p className="text-sm text-zinc-500 mb-4">Enter risk type, flood depth (m), and area (ha). Get top solutions with prices and case studies (FEMA / USACE / EPA style).</p>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      Risk type
                      <select value={engRiskType} onChange={e => setEngRiskType(e.target.value)} className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1.5 text-zinc-100 text-sm font-sans">
                        <option value="flood">Flood</option>
                        <option value="storm_surge">Storm surge</option>
                        <option value="stormwater">Stormwater</option>
                      </select>
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      Depth (m)
                      <input type="number" min={0} step={0.1} value={engDepthM} onChange={e => setEngDepthM(Number(e.target.value))} className="w-20 bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1.5 text-zinc-100 text-sm font-mono tabular-nums" />
                    </label>
                    <label className="flex items-center gap-2 text-sm text-zinc-400">
                      Area (ha)
                      <input type="number" min={0} step={1} value={engAreaHa} onChange={e => setEngAreaHa(Number(e.target.value))} className="w-24 bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1.5 text-zinc-100 text-sm font-mono tabular-nums" />
                    </label>
                    <button type="button" onClick={matchEngineeringSolutions} disabled={engMatchLoading} className="px-4 py-2 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium disabled:opacity-50">
                      {engMatchLoading ? 'Matching…' : 'Match solutions'}
                    </button>
                  </div>
                  {engMatchResult && (
                    <div className="space-y-3">
                      <div className="text-xs text-zinc-500">Top {engMatchResult.matches.length} of {engMatchResult.total_in_catalog} in catalog</div>
                      {engMatchResult.matches.map((m: { id: string; name: string; solution_type: string; case_study_title: string; case_study_location: string; source: string; estimated_total_usd: number }) => (
                        <div key={m.id} className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <div className="font-medium text-zinc-200">{m.name}</div>
                              <div className="text-xs text-zinc-500 mt-0.5">{m.solution_type}</div>
                              <div className="text-xs text-zinc-400 mt-1">Case: {m.case_study_title} — {m.case_study_location}</div>
                              <div className="text-[10px] text-zinc-500 mt-0.5">Source: {m.source}</div>
                            </div>
                            <div className="text-right font-semibold text-zinc-100">${(m.estimated_total_usd / 1e6).toFixed(2)}M</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ================================================================
                ADAPTATION TAB
               ================================================================ */}
            {tab === 'adaptation' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Adaptation Measures</h2>
                <p className="text-sm text-zinc-500">{measures.length} pre-built measures with cost, ROI, and implementation data.</p>
                <div className="space-y-3">
                  {measures.map(m => (
                    <motion.div key={m.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-zinc-200">{m.name}</div>
                          <div className="text-sm text-zinc-500">{m.description}</div>
                        </div>
                        {m.relevance_score !== undefined && (
                          <div className="text-right">
                            <div className="text-lg font-semibold text-zinc-100">{m.relevance_score.toFixed(1)}</div>
                            <div className="text-xs text-zinc-500">relevance</div>
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Cost/Capita</div>
                          <div className="font-semibold text-zinc-200">${m.cost_per_capita}</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Effectiveness</div>
                          <div className="font-semibold text-zinc-200">{m.effectiveness_pct}%</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">ROI</div>
                          <div className="font-semibold text-zinc-200">{m.roi_multiplier}x</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Timeline</div>
                          <div className="font-semibold text-zinc-200">{m.implementation_months}mo</div>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1 mt-2">
                        {m.climate_risks_addressed.map(r => (
                          <span key={r} className="px-2 py-0.5 bg-zinc-700 text-zinc-300 rounded text-xs">{r}</span>
                        ))}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* ================================================================
                GRANTS TAB
               ================================================================ */}
            {tab === 'grants' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Grant Finder</h2>
                <p className="text-sm text-zinc-500">Matched funding opportunities for {riskData?.community.name || 'your community'}.</p>

                {/* Funding applications status */}
                {funding.length > 0 && (
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Your Applications</h3>
                    <div className="space-y-2">
                      {funding.map(f => {
                        const badge = STATUS_BADGE[f.status] || STATUS_BADGE.not_started
                        return (
                          <div key={f.id} className="flex items-center justify-between bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3">
                            <div>
                              <span className="text-sm font-medium text-zinc-200">{f.grant_name}</span>
                              <span className={`ml-2 px-2 py-0.5 rounded text-[10px] font-medium ${badge.cls}`}>{badge.label}</span>
                            </div>
                            <span className="text-sm font-semibold text-zinc-100">${f.amount_m}M</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {draftProjectError && (
                  <div className="rounded border border-red-500/50 bg-red-500/10 px-3 py-2 text-sm text-red-300">
                    {draftProjectError}
                    <button type="button" onClick={() => setDraftProjectError(null)} className="ml-2 underline">Dismiss</button>
                  </div>
                )}
                {/* Grant list */}
                <div className="space-y-3">
                  {grants.map(g => (
                    <motion.div key={g.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-medium text-zinc-200">{g.name}</div>
                          <div className="text-sm text-zinc-500">{g.agency} — {g.country}</div>
                          <div className="text-xs text-zinc-500 mt-1">{g.description}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-semibold text-zinc-100">${g.max_award_m}M</div>
                          <div className="text-xs text-zinc-500">max award</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-2 mb-2">
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Match Req.</div>
                          <div className="font-semibold text-zinc-200">{g.match_required_pct}%</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Success prob.</div>
                          <div className="font-semibold text-zinc-200">{g.success_probability_pct ?? g.success_rate_pct}%</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Similar cities</div>
                          <div className="font-semibold text-zinc-300">{g.similar_cities_success_rate_pct != null ? `${g.similar_cities_success_rate_pct}%` : '—'}</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Deadline</div>
                          <div className="font-semibold text-zinc-200 text-xs">{g.deadline}</div>
                        </div>
                        <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-2 text-center">
                          <div className="text-xs text-zinc-500">Commission</div>
                          <div className="font-semibold text-zinc-300">${(g.estimated_commission_m ?? 0).toFixed(3)}M</div>
                        </div>
                      </div>
                      {g.eligibility?.notes?.length ? (
                        <p className="text-xs text-zinc-500 mb-1">Eligibility: {g.eligibility.notes.join('; ') || 'OK'}</p>
                      ) : null}
                      {g.match_score !== undefined && (
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">Match</span>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded overflow-hidden">
                            <div className="h-full bg-zinc-600 rounded" style={{ width: `${Math.min(100, (g.match_score ?? 0) * 100)}%` }} />
                          </div>
                          <span className="text-xs font-medium text-zinc-400">{((g.match_score ?? 0) * 100).toFixed(0)}%</span>
                        </div>
                      )}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => handleGrantDraft(g.id)}
                          disabled={grantDraftLoading !== null}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-800/60 text-zinc-300 text-xs font-medium disabled:opacity-50"
                        >
                          <SparklesIcon className="w-4 h-4" />
                          {grantDraftLoading === g.id ? 'Generating…' : 'Generate AI draft'}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCreateApplication(g)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 border border-zinc-800/60 text-zinc-200 text-xs font-medium"
                        >
                          <CurrencyDollarIcon className="w-4 h-4" />
                          Create application
                        </button>
                        <button
                          type="button"
                          onClick={() => startFullApplication(g.id)}
                          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-800/60 text-zinc-300 text-xs font-medium"
                          title="AI draft + human expert → full 200-page style export"
                        >
                          <DocumentTextIcon className="w-4 h-4" />
                          Full application
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {/* Grant Writing Assistant — full application workflow */}
                {draftProjectId && draftProject && (
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4 mt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold text-zinc-200">Grant Writing Assistant — Full application</h3>
                      <button type="button" onClick={() => { setDraftProjectId(null); setDraftProject(null); setDraftExportResult(null); setDraftProjectError(null) }} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
                        <XMarkIcon className="w-5 h-5" />
                      </button>
                    </div>
                    <p className="text-xs text-zinc-500 mb-3">{draftProject.municipality} — generate sections from FOIA examples + program guide, then export.</p>
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <label className="px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-800/60 text-zinc-300 text-xs font-medium cursor-pointer hover:bg-zinc-700">
                        <input type="file" accept=".pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) uploadDraftGuide(f); e.target.value = '' }} disabled={draftGuideUploading} />
                        {draftGuideUploading ? 'Uploading…' : 'Upload PDF guide'}
                      </label>
                      {['executive_summary', 'objectives', 'activities', 'timeline', 'budget', 'community_engagement'].map(section => (
                        <button
                          key={section}
                          type="button"
                          onClick={() => generateDraftSection(section)}
                          disabled={draftSectionGenerating !== null}
                          className="px-3 py-1.5 rounded-md bg-zinc-800 hover:bg-zinc-700 border border-zinc-800/60 text-zinc-300 text-xs font-medium disabled:opacity-50"
                        >
                          {draftSectionGenerating === section ? '…' : (draftProject.sections?.[section] ? 'Regen ' : 'Gen ') + section.replace(/_/g, ' ')}
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={exportDraftProject}
                        className="px-3 py-1.5 rounded-md bg-zinc-700 hover:bg-zinc-600 border border-zinc-800/60 text-zinc-200 text-xs font-medium"
                      >
                        Export full document
                      </button>
                    </div>
                    {draftExportResult && (
                      <div className="mt-2 p-3 bg-zinc-900/80 rounded-md border border-zinc-800/60 max-h-48 overflow-y-auto">
                        <p className="text-xs text-zinc-500 mb-1">Exported {draftExportResult.word_count} words</p>
                        <pre className="text-xs text-zinc-400 whitespace-pre-wrap font-sans">{draftExportResult.full_text.slice(0, 2000)}{draftExportResult.full_text.length > 2000 ? '…' : ''}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Create application modal */}
            {createAppGrantId && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !createAppLoading && setCreateAppGrantId(null)}>
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 max-w-md w-full p-5" onClick={e => e.stopPropagation()}>
                  <h3 className="text-base font-semibold text-zinc-100 mb-4">Create grant application</h3>
                  <p className="text-sm text-zinc-500 mb-4">Track this grant for commission (7% on approved amount).</p>
                  <div className="space-y-3 mb-4">
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Municipality</label>
                    <input
                      type="text"
                      value={createAppMunicipality}
                      onChange={e => setCreateAppMunicipality(e.target.value)}
                      className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans"
                      placeholder="e.g. Bastrop, TX"
                    />
                    <label className="block font-mono text-[10px] uppercase tracking-widest text-zinc-500">Requested amount (M USD)</label>
                    <input
                      type="number"
                      min={0.1}
                      step={0.5}
                      value={createAppAmount}
                      onChange={e => setCreateAppAmount(Number(e.target.value))}
                      className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans"
                    />
                  </div>
                  {createAppError && <p className="text-sm text-red-400/80 mb-3">{createAppError}</p>}
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setCreateAppGrantId(null)} disabled={createAppLoading} className="px-3 py-1.5 rounded-md bg-zinc-800 text-zinc-300 text-sm">Cancel</button>
                    <button type="button" onClick={submitCreateApplication} disabled={createAppLoading} className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium disabled:opacity-50">{createAppLoading ? 'Creating…' : 'Create application'}</button>
                  </div>
                </div>
              </div>
            )}

            {/* Grant draft modal */}
            {grantDraftResult && (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setGrantDraftResult(null)}>
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/60">
                    <span className="text-sm font-medium text-zinc-200">AI draft — {grantDraftResult.grant_id}</span>
                    <button type="button" onClick={() => setGrantDraftResult(null)} className="p-1 rounded hover:bg-zinc-800">
                      <XMarkIcon className="w-5 h-5 text-zinc-400" />
                    </button>
                  </div>
                  <div className="p-4 overflow-y-auto flex-1 text-sm text-zinc-300 whitespace-pre-wrap">{grantDraftResult.draft}</div>
                </div>
              </div>
            )}

            {/* ================================================================
                COMMISSIONS TAB
               ================================================================ */}
            {tab === 'commissions' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Commission Tracker (7% per Successful Grant)</h2>
                {commissions ? (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4 text-center">
                        <div className="text-xs text-zinc-500">Total Potential</div>
                        <div className="text-2xl font-bold text-zinc-400 mt-1">${(commissions.total_potential_commission_m as number)?.toFixed(2) ?? '0.00'}M</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4 text-center">
                        <div className="text-xs text-zinc-500">Approved</div>
                        <div className="text-2xl font-bold text-zinc-100 mt-1">${(commissions.approved_commission_m as number)?.toFixed(2) ?? '0.00'}M</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4 text-center">
                        <div className="text-xs text-zinc-500">Pending</div>
                        <div className="text-2xl font-bold text-zinc-300 mt-1">${(commissions.pending_commission_m as number)?.toFixed(2) ?? '0.00'}M</div>
                      </div>
                      <div className="bg-zinc-900/50 rounded-md border border-emerald-800/60 p-4 text-center">
                        <div className="text-xs text-zinc-500">Paid out (from payouts)</div>
                        <div className="text-2xl font-bold text-emerald-300 mt-1">${(commissions.paid_out_m as number)?.toFixed(2) ?? '0.00'}M</div>
                        <div className="text-[10px] text-zinc-500 mt-0.5">{(commissions.payouts_count as number) ?? 0} payout(s)</div>
                      </div>
                    </div>
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">By status</h3>
                      <div className="space-y-2">
                        {Object.entries(commissions.by_status || {}).map(([status, count]) => (
                          <div key={status} className="flex items-center justify-between bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3">
                            <span className="capitalize text-zinc-400">{String(status).replace(/_/g, ' ')}</span>
                            <span className="font-semibold text-zinc-100">{String(count)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    {/* Applications list */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Applications</h3>
                      {applications.length === 0 ? (
                        <p className="text-zinc-500 text-sm">No applications yet. Create one from the Grants tab.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-zinc-500 border-b border-zinc-800/60/60">
                                <th className="pb-2 pr-3">Grant</th>
                                <th className="pb-2 pr-3">Municipality</th>
                                <th className="pb-2 pr-3">Requested</th>
                                <th className="pb-2 pr-3">Status</th>
                                <th className="pb-2 pr-3">Commission</th>
                                <th className="pb-2 pr-3">Submitted</th>
                              </tr>
                            </thead>
                            <tbody>
                              {applications.map(app => (
                                <tr key={app.id} className="border-b border-zinc-800/60/80">
                                  <td className="py-2 pr-3 text-zinc-200">{app.grant_program_name}</td>
                                  <td className="py-2 pr-3 text-zinc-400">{app.municipality}</td>
                                  <td className="py-2 pr-3 text-zinc-300">${app.requested_amount_m?.toFixed(2)}M</td>
                                  <td className="py-2 pr-3">
                                    <select
                                      value={app.status}
                                      onChange={e => updateApplicationStatus(app.id, e.target.value)}
                                      className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-0.5 text-xs text-zinc-200 capitalize"
                                    >
                                      {['draft', 'submitted', 'under_review', 'approved', 'denied'].map(s => (
                                        <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 pr-3 font-medium text-zinc-100">${app.commission_amount?.toFixed(3)}M</td>
                                    <td className="py-2 pr-3 text-zinc-500 text-xs">{app.submitted_at ? new Date(app.submitted_at).toLocaleDateString() : '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    {/* Payouts (application → payout) */}
                    <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                      <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3 flex items-center justify-between">
                        <span>Payouts</span>
                        <button type="button" onClick={() => { setPayoutForm({ application_id: applications.find(a => a.status === 'approved')?.id ?? '', payout_date: new Date().toISOString().slice(0, 10), amount: 0, currency: 'USD', notes: '' }); setShowPayoutModal(true) }} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200">Add payout</button>
                      </h3>
                      {payouts.length === 0 ? (
                        <p className="text-zinc-500 text-sm">No payouts yet. Add a payout for an approved application.</p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead>
                              <tr className="text-left text-zinc-500 border-b border-zinc-800/60/60">
                                <th className="pb-2 pr-3">Application</th>
                                <th className="pb-2 pr-3">Date</th>
                                <th className="pb-2 pr-3">Amount</th>
                                <th className="pb-2 pr-3">Status</th>
                                <th className="pb-2 pr-3">Notes</th>
                              </tr>
                            </thead>
                            <tbody>
                              {payouts.map(p => (
                                <tr key={p.id} className="border-b border-zinc-800/60/80">
                                  <td className="py-2 pr-3 font-mono text-zinc-400 text-xs">{p.application_id}</td>
                                  <td className="py-2 pr-3 text-zinc-300">{p.payout_date ? new Date(p.payout_date).toLocaleDateString() : '—'}</td>
                                  <td className="py-2 pr-3 text-zinc-200">{p.currency} {p.amount?.toFixed(2)}</td>
                                  <td className="py-2 pr-3">
                                    <select
                                      value={p.status}
                                      onChange={async e => {
                                        try {
                                          const res = await fetch(`${getApiV1Base()}/cadapt/payouts/${p.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: e.target.value }) })
                                          if (res.ok) refetchCommissionsAndApplications()
                                        } catch { /* ignore */ }
                                      }}
                                      className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-0.5 text-xs text-zinc-200 capitalize"
                                    >
                                      {['pending', 'paid', 'cancelled'].map(s => (
                                        <option key={s} value={s}>{s}</option>
                                      ))}
                                    </select>
                                  </td>
                                  <td className="py-2 pr-3 text-zinc-500 text-xs max-w-[120px] truncate" title={p.notes ?? ''}>{p.notes ?? '—'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                    {showPayoutModal && (
                      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={() => setShowPayoutModal(false)}>
                        <div className="bg-zinc-900/50 border border-zinc-800/60 rounded-md p-4 w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
                          <h3 className="text-sm font-semibold text-zinc-100 mb-3">Add payout</h3>
                          <div className="space-y-3">
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Application</label>
                              <select value={payoutForm.application_id} onChange={e => setPayoutForm(f => ({ ...f, application_id: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans">
                                <option value="">Select application</option>
                                {applications.filter(a => a.status === 'approved').map(a => (
                                  <option key={a.id} value={a.id}>{a.grant_program_name} — {a.id}</option>
                                ))}
                              </select>
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Payout date</label>
                              <input type="date" value={payoutForm.payout_date} onChange={e => setPayoutForm(f => ({ ...f, payout_date: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans" />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Amount</label>
                              <input type="number" min={0} step={0.01} value={payoutForm.amount || ''} onChange={e => setPayoutForm(f => ({ ...f, amount: Number(e.target.value) || 0 }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans" />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Currency</label>
                              <input type="text" maxLength={3} value={payoutForm.currency} onChange={e => setPayoutForm(f => ({ ...f, currency: e.target.value.toUpperCase() }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans" />
                            </div>
                            <div>
                              <label className="block text-xs text-zinc-500 mb-1">Notes (optional)</label>
                              <input type="text" value={payoutForm.notes} onChange={e => setPayoutForm(f => ({ ...f, notes: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm font-sans" />
                            </div>
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button type="button" onClick={() => setShowPayoutModal(false)} className="flex-1 px-3 py-2 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200 text-sm">Cancel</button>
                            <button
                              type="button"
                              disabled={!payoutForm.application_id || payoutForm.amount <= 0 || payoutSubmitLoading}
                              onClick={async () => {
                                if (!payoutForm.application_id || payoutForm.amount <= 0) return
                                setPayoutSubmitLoading(true)
                                try {
                                  const res = await fetch(`${getApiV1Base()}/cadapt/payouts`, {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({
                                      application_id: payoutForm.application_id,
                                      payout_date: payoutForm.payout_date,
                                      amount: payoutForm.amount,
                                      currency: payoutForm.currency,
                                      notes: payoutForm.notes || undefined,
                                    }),
                                  })
                                  if (res.ok) { setShowPayoutModal(false); refetchCommissionsAndApplications() }
                                } finally { setPayoutSubmitLoading(false) }
                              }}
                              className="flex-1 px-3 py-2 rounded bg-zinc-600 hover:bg-zinc-500 disabled:opacity-50 text-zinc-100 text-sm"
                            >
                              {payoutSubmitLoading ? 'Saving…' : 'Save'}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-500 text-sm">Loading commissions…</p>
                )}
              </div>
            )}

            {/* ================================================================
                PLAN TAB (portfolio optimizer + timeline)
               ================================================================ */}
            {tab === 'plan' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Adaptation Plan</h2>
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] font-medium text-zinc-500 uppercase tracking-widest mb-2">Portfolio optimizer (constraint: budget)</h3>
                  <p className="text-sm text-zinc-500 mb-4">Maximize risk reduction within budget. Measures below are ranked by urgency (shorter timeline = higher urgency).</p>
                  <div className="flex flex-wrap items-center gap-3 mb-4">
                    <span className="text-sm text-zinc-500">Population: {riskData?.community?.population?.toLocaleString() ?? '—'}</span>
                    <label className="flex items-center gap-2 text-sm text-zinc-500">
                      Budget/capita: $
                      <input type="number" min={10} max={1000} step={10} value={planBudget} onChange={e => setPlanBudget(Number(e.target.value))}
                        className="w-16 bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-100 text-sm" />
                    </label>
                    <button type="button" onClick={() => fetchRecommendations()} className="px-3 py-1.5 rounded-md bg-zinc-600 hover:bg-zinc-500 text-zinc-100 text-sm font-medium">Re-optimize</button>
                  </div>
                  <a href="/command" className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200">
                    <MapPinIcon className="w-4 h-4" />
                    View risk by H3 hex on globe
                  </a>
                </div>
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Timeline by urgency (shortest first)</h3>
                  <div className="space-y-2">
                    {[...measures].sort((a, b) => a.implementation_months - b.implementation_months).map((m, i) => (
                      <div key={m.id} className="flex items-center gap-4 py-2 border-b border-zinc-800/60 last:border-0">
                        <span className="text-xs text-zinc-500 w-6">{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-zinc-200">{m.name}</div>
                          <div className="text-xs text-zinc-500">{m.implementation_months} months · ${m.cost_per_capita}/capita · {m.effectiveness_pct}% effectiveness</div>
                        </div>
                        <span className="px-2 py-0.5 rounded bg-zinc-800 text-xs text-zinc-400 shrink-0">{m.implementation_months}mo</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================
                ALERTS TAB
               ================================================================ */}
            {tab === 'alerts' && alertsData && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Early Warning Center — {riskData?.community.name}</h2>

                {/* Current Conditions */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Current Conditions</h3>
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-center">
                      <SunIcon className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="text-xs text-zinc-500">Temperature</div>
                      <div className="text-xl font-semibold text-zinc-100">{alertsData.current_conditions.temp_f}&deg;F</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-center">
                      <CloudIcon className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="text-xs text-zinc-500">Rain (24h)</div>
                      <div className="text-xl font-semibold text-zinc-100">{alertsData.current_conditions.rain_24h_in}&quot;</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-center">
                      <BoltIcon className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="text-xs text-zinc-500">Wind</div>
                      <div className="text-xl font-semibold text-zinc-100">{alertsData.current_conditions.wind_mph} mph</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-center">
                      <FireIcon className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="text-xs text-zinc-500">Fire Risk</div>
                      <div className="text-xl font-semibold text-zinc-100 capitalize">{alertsData.current_conditions.fire_risk}</div>
                    </div>
                    <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 text-center">
                      <CloudIcon className="w-5 h-5 mx-auto mb-1 text-zinc-400" />
                      <div className="text-xs text-zinc-500">Humidity</div>
                      <div className="text-xl font-semibold text-zinc-100">{alertsData.current_conditions.humidity_pct}%</div>
                    </div>
                  </div>
                </div>

                {/* Active Alerts */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Active Alerts</h3>
                  {alertsData.alerts.length === 0 ? (
                    <div className="text-center text-zinc-500 py-4 text-sm">No active alerts</div>
                  ) : (
                    <div className="space-y-2">
                      {alertsData.alerts.map(a => (
                        <div key={a.id} className="rounded-md border border-zinc-800/60 bg-zinc-900/80 p-3">
                          <div className="flex items-center gap-2">
                            <ExclamationTriangleIcon className="w-5 h-5 shrink-0 text-zinc-400" />
                            <div className="flex-1">
                              <div className="text-sm font-medium text-zinc-200">{a.message}</div>
                              <div className="text-xs text-zinc-500 flex items-center gap-1 mt-0.5">
                                <ClockIcon className="w-3 h-3" />
                                Expires: {new Date(a.expires).toLocaleString('en', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-xs font-medium uppercase text-zinc-400 bg-zinc-700">{a.level}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 72h Forecast — community-specific 48–72h outlook */}
                <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-5">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">72-Hour Risk Forecast</h3>
                  <p className="text-[10px] text-zinc-500 mb-3">Community-specific 48–72h outlook</p>
                  <div className="space-y-3">
                    {['flood', 'heat', 'fire'].map(riskType => {
                      const key = `${riskType}_risk_pct` as 'flood_risk_pct' | 'heat_risk_pct' | 'fire_risk_pct'
                      const label = riskType.charAt(0).toUpperCase() + riskType.slice(1)
                      return (
                        <div key={riskType}>
                          <div className="text-xs text-zinc-500 mb-1">{label} Risk (%)</div>
                          <div className="flex items-end gap-[2px] h-12">
                            {alertsData.forecast_72h.map((f, i) => {
                              const val = f[key]
                              return (
                                <div key={i} className="flex-1 relative group">
                                  <div className="rounded-t bg-zinc-600" style={{ height: `${(val / 100) * 48}px`, opacity: 0.5 + (val / 200) }} />
                                  <div className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] text-zinc-500 opacity-0 group-hover:opacity-100">{val}%</div>
                                </div>
                              )
                            })}
                          </div>
                          <div className="flex justify-between text-[8px] text-zinc-500 mt-0.5">
                            <span>Now</span><span>24h</span><span>48h</span><span>72h</span>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Mobile early warning */}
                <div className="bg-zinc-900/80 rounded-md border border-zinc-800/60 p-3 flex items-center gap-3">
                  <span className="text-zinc-400 text-sm">Early warning on mobile: PWA and native app coming soon.</span>
                </div>
              </div>
            )}

            {/* ================================================================
                REGULATORY TAB — Disclosure Export, OSFI B-15, GHG Inventory
               ================================================================ */}
            {tab === 'regulatory' && (
              <div className="p-4">
                <RegulatoryExportPanel
                  defaultOrganization={riskData?.community?.name ?? 'Organization'}
                  defaultReportingPeriod="2025-01-01 to 2025-12-31"
                />
              </div>
            )}

            {/* ================================================================
                SIMULATION REPORTS TAB — Zone stress test reports (3D / Digital Twin)
               ================================================================ */}
            {tab === 'reports' && (() => {
              const reportCountries = Array.from(new Set(zoneReports.map(r => r.country || r.cityName).filter(Boolean))).sort()
              const filteredReports = zoneReports.filter((r) => {
                const t = new Date(r.timestamp).getTime()
                if (reportsFilterDateFrom) {
                  const from = new Date(reportsFilterDateFrom).setHours(0, 0, 0, 0)
                  if (t < from) return false
                }
                if (reportsFilterDateTo) {
                  const to = new Date(reportsFilterDateTo).setHours(23, 59, 59, 999)
                  if (t > to) return false
                }
                if (reportsFilterCountry) {
                  const countryMatch = (r.country || r.cityName || '').toLowerCase().includes(reportsFilterCountry.toLowerCase())
                  if (!countryMatch) return false
                }
                return true
              })
              return (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Simulation reports</h2>
                <p className="text-zinc-500 text-sm">Reports from zone stress tests run on 3D (Digital Twin or Municipal map).</p>

                {/* Filters: date range + country — English only (Month, Day, Year dropdowns to avoid locale) */}
                {(() => {
                  const MONTHS_EN: string[] = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
                  const parseYmd = (ymd: string): { y: number; m: number; d: number } => {
                    if (!ymd || !/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return { y: new Date().getFullYear(), m: 1, d: 1 }
                    const [y, m, d] = ymd.split('-').map(Number)
                    return { y, m, d }
                  }
                  const toYmd = (y: number, m: number, d: number): string => `${y}-${String(m).padStart(2, '0')}-${String(Math.min(d, new Date(y, m, 0).getDate())).padStart(2, '0')}`
                  const fromParsed = parseYmd(reportsFilterDateFrom)
                  const toParsed = parseYmd(reportsFilterDateTo)
                  const currentYear = new Date().getFullYear()
                  const years = Array.from({ length: 10 }, (_, i) => currentYear - 5 + i)
                  return (
                    <div className="flex flex-wrap items-center gap-4 p-3 rounded-md bg-zinc-900 border border-zinc-800">
                      <span className="text-zinc-500 text-xs uppercase tracking-wider">Filters</span>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                        <span>From</span>
                        <select
                          value={reportsFilterDateFrom ? fromParsed.m : ''}
                          onChange={(e) => {
                            const m = Number(e.target.value) || 1
                            setReportsFilterDateFrom(toYmd(fromParsed.y, m, fromParsed.d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 min-w-[100px]"
                        >
                          <option value="">Month</option>
                          {MONTHS_EN.map((name, i) => (
                            <option key={name} value={i + 1}>{name}</option>
                          ))}
                        </select>
                        <select
                          value={reportsFilterDateFrom ? fromParsed.d : ''}
                          onChange={(e) => {
                            const d = Number(e.target.value) || 1
                            setReportsFilterDateFrom(toYmd(fromParsed.y, fromParsed.m, d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 w-14"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <select
                          value={reportsFilterDateFrom ? fromParsed.y : ''}
                          onChange={(e) => {
                            const y = Number(e.target.value) || currentYear
                            setReportsFilterDateFrom(toYmd(y, fromParsed.m, fromParsed.d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 w-20"
                        >
                          <option value="">Year</option>
                          {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-zinc-400 flex-wrap">
                        <span>To</span>
                        <select
                          value={reportsFilterDateTo ? toParsed.m : ''}
                          onChange={(e) => {
                            const m = Number(e.target.value) || 1
                            setReportsFilterDateTo(toYmd(toParsed.y, m, toParsed.d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 min-w-[100px]"
                        >
                          <option value="">Month</option>
                          {MONTHS_EN.map((name, i) => (
                            <option key={name} value={i + 1}>{name}</option>
                          ))}
                        </select>
                        <select
                          value={reportsFilterDateTo ? toParsed.d : ''}
                          onChange={(e) => {
                            const d = Number(e.target.value) || 1
                            setReportsFilterDateTo(toYmd(toParsed.y, toParsed.m, d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 w-14"
                        >
                          <option value="">Day</option>
                          {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                            <option key={d} value={d}>{d}</option>
                          ))}
                        </select>
                        <select
                          value={reportsFilterDateTo ? toParsed.y : ''}
                          onChange={(e) => {
                            const y = Number(e.target.value) || currentYear
                            setReportsFilterDateTo(toYmd(y, toParsed.m, toParsed.d))
                          }}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 w-20"
                        >
                          <option value="">Year</option>
                          {years.map((y) => (
                            <option key={y} value={y}>{y}</option>
                          ))}
                        </select>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        Country
                        <select
                          value={reportsFilterCountry}
                          onChange={(e) => setReportsFilterCountry(e.target.value)}
                          className="bg-zinc-900/80 border border-zinc-800/60 rounded-md px-2 py-1 text-zinc-200 min-w-[120px]"
                        >
                          <option value="">All</option>
                          {reportCountries.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                  )
                })()}

                {/* Clear all */}
                {zoneReports.length > 0 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearZoneReports}
                      className="px-3 py-1.5 rounded text-xs font-medium bg-red-900/60 hover:bg-red-900/80 border border-red-700 text-red-200"
                    >
                      Clear all reports
                    </button>
                  </div>
                )}

                {filteredReports.length === 0 ? (
                  <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-8 text-center text-zinc-500 text-sm">
                    {zoneReports.length === 0
                      ? 'No reports yet. Run a zone stress test from Digital Twin or from Overview (3D city) using "Select stress test".'
                      : 'No reports match the current filters.'}
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {filteredReports.map((r) => (
                      <li key={r.id} className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4 flex items-center justify-between gap-4 flex-wrap">
                        <div>
                          <div className="text-zinc-200 font-medium">{r.cityName}</div>
                          <div className="text-zinc-500 text-xs mt-0.5">
                            {r.scenarioName} · {new Date(r.timestamp).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}
                            {r.country && <span className="ml-1">· {r.country}</span>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              try {
                                localStorage.setItem('pfrp-stress-report', JSON.stringify(r.reportPayload))
                                window.open('/report?source=stress', '_blank', 'noopener,noreferrer')
                              } catch (e) {
                                console.error(e)
                              }
                            }}
                            className="px-3 py-1.5 rounded bg-zinc-700 text-zinc-200 text-xs font-medium hover:bg-zinc-600"
                          >
                            Open report
                          </button>
                          <button
                            type="button"
                            onClick={() => removeZoneReport(r.id)}
                            className="px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-900/80 border border-red-800 text-red-200 text-xs font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              )
            })()}

            {tab === 'launch' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Launch progress (6–12 weeks)</h2>
                <p className="text-zinc-500 text-sm">City launch checklist for {launchChecklist?.municipality_id ?? selectedCity}. Complete steps to reach live status.</p>
                {launchChecklist ? (
                  <>
                    <ul className="space-y-2">
                      {launchChecklist.steps.map((s) => (
                        <li key={s.id} className="flex items-center gap-3 py-2 border-b border-zinc-800/60 last:border-0">
                          <span className={s.done ? 'text-emerald-500' : 'text-zinc-500'}>
                            {s.done ? (
                              <CheckCircleIcon className="w-5 h-5" />
                            ) : (
                              <span className="inline-flex w-5 h-5 rounded-full border-2 border-zinc-600" />
                            )}
                          </span>
                          <span className={s.done ? 'text-zinc-300' : 'text-zinc-500'}>{s.label}</span>
                        </li>
                      ))}
                    </ul>
                    {launchChecklist.all_done && (
                      <p className="text-emerald-400 text-sm font-medium">All steps complete — city is live.</p>
                    )}
                  </>
                ) : (
                  <p className="text-zinc-500 text-sm">Loading checklist…</p>
                )}
              </div>
            )}

            {tab === 'subscription' && (
              <div className="p-4 space-y-4">
                <h2 className="text-base font-semibold text-zinc-100">Subscription</h2>
                <p className="text-zinc-500 text-sm">SaaS subscription for this municipality ($5K–20K/year; Track B 5K–50K: $1K–2K/month). Complements grant commission.</p>
                {(() => {
                  const tenantId = (riskData?.community?.name || selectedCity?.replace(/_/g, ' ') || 'municipality').trim()
                  const mySubs = subscriptions.filter((s) => s.tenant_id === tenantId || s.tenant_id === selectedCity)
                  return (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {subscriptionTiers.map((t) => (
                          <div key={t.id} className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                            <div className="font-medium text-zinc-200 capitalize">{t.id.replace(/_/g, ' ')}</div>
                            {t.id.startsWith('track_b') && t.amount_monthly != null ? (
                              <div className="text-lg font-semibold text-zinc-100 mt-1">${t.amount_monthly.toLocaleString()}<span className="text-zinc-500 text-sm font-normal">/month</span></div>
                            ) : (
                              <div className="text-lg font-semibold text-zinc-100 mt-1">${(t.amount_yearly / 1000).toFixed(0)}K<span className="text-zinc-500 text-sm font-normal">/year</span></div>
                            )}
                            <div className="text-xs text-zinc-500 mt-1">{t.currency}{t.id.startsWith('track_b') ? ' · Track B (5K–50K)' : ''}</div>
                          </div>
                        ))}
                      </div>
                      {cadaptProducts.length > 0 && (
                        <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                          <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">One-off products</h3>
                          <ul className="space-y-2">
                            {cadaptProducts.map((prod) => (
                              <li key={prod.id} className="flex justify-between items-center py-2 border-b border-zinc-800/60 last:border-0">
                                <span className="text-zinc-200">{prod.name}</span>
                                <span className="text-zinc-400 text-sm">${(prod.price_min / 1000).toFixed(0)}K–${(prod.price_max / 1000).toFixed(0)}K {prod.currency}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Current subscription (tenant: {tenantId})</h3>
                        {mySubs.length === 0 ? (
                          <p className="text-zinc-500 text-sm">No active subscription. Use API to create one: POST /api/v1/cadapt/subscriptions with tenant_id, tier, period_start, period_end.</p>
                        ) : (
                          <ul className="space-y-2">
                            {mySubs.map((s) => (
                              <li key={s.id} className="flex items-center justify-between py-2 border-b border-zinc-800/60 last:border-0">
                                <span className="text-zinc-200">{s.tier} · ${s.amount_yearly?.toLocaleString()}/year</span>
                                <span className="text-zinc-500 text-xs">{s.period_end ? new Date(s.period_end).toLocaleDateString() : ''} · {s.status}</span>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {/* Municipal onboarding (Track B) */}
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Municipal onboarding (Track B 5K–50K)</h3>
                        {!showOnboardingForm ? (
                          <button type="button" onClick={() => setShowOnboardingForm(true)} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200">Request onboarding</button>
                        ) : (
                          <div className="space-y-2">
                            <input placeholder="Municipality name" value={onboardingForm.municipality_name} onChange={e => setOnboardingForm(f => ({ ...f, municipality_name: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <input type="number" placeholder="Population (5K–50K)" value={onboardingForm.population} onChange={e => setOnboardingForm(f => ({ ...f, population: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <input type="email" placeholder="Contact email" value={onboardingForm.contact_email} onChange={e => setOnboardingForm(f => ({ ...f, contact_email: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <input placeholder="Contact name" value={onboardingForm.contact_name} onChange={e => setOnboardingForm(f => ({ ...f, contact_name: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <div className="flex gap-2">
                              <button type="button" disabled={onboardingSubmitLoading || !onboardingForm.municipality_name.trim()} onClick={async () => { setOnboardingSubmitLoading(true); try { const res = await fetch(`${getApiV1Base()}/cadapt/onboarding-requests`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ municipality_name: onboardingForm.municipality_name.trim(), population: onboardingForm.population ? Number(onboardingForm.population) : undefined, contact_email: onboardingForm.contact_email || undefined, contact_name: onboardingForm.contact_name || undefined }) }); if (res.ok) { setShowOnboardingForm(false); setOnboardingForm({ municipality_name: '', population: '', contact_email: '', contact_name: '', notes: '' }); fetchAll() } else { const err = await res.json(); window.alert(err.detail || 'Failed') } } finally { setOnboardingSubmitLoading(false) } }} className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50">{onboardingSubmitLoading ? 'Sending…' : 'Submit'}</button>
                              <button type="button" onClick={() => setShowOnboardingForm(false)} className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300">Cancel</button>
                            </div>
                          </div>
                        )}
                        {onboardingRequests.length > 0 && (
                          <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                            {onboardingRequests.slice(0, 5).map((r) => (
                              <li key={r.id}>{r.municipality_name}{r.population != null ? ` (${r.population.toLocaleString()})` : ''} — {r.status}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {/* Contractors (Track B) */}
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Contractors (Track B)</h3>
                        {!showContractorForm ? (
                          <button type="button" onClick={() => setShowContractorForm(true)} className="text-xs px-2 py-1 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200">Add contractor</button>
                        ) : (
                          <div className="space-y-2">
                            <input placeholder="Name" value={contractorForm.name} onChange={e => setContractorForm(f => ({ ...f, name: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <input placeholder="Type (e.g. engineering, consulting)" value={contractorForm.contractor_type} onChange={e => setContractorForm(f => ({ ...f, contractor_type: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <input placeholder="Contact info" value={contractorForm.contact_info} onChange={e => setContractorForm(f => ({ ...f, contact_info: e.target.value }))} className="w-full bg-zinc-900/80 border border-zinc-800/60 rounded-md px-3 py-2 text-zinc-100 text-sm" />
                            <div className="flex gap-2">
                              <button type="button" disabled={contractorSubmitLoading || !contractorForm.name.trim()} onClick={async () => { setContractorSubmitLoading(true); try { const res = await fetch(`${getApiV1Base()}/cadapt/contractors`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenant_id: tenantId, name: contractorForm.name.trim(), contractor_type: contractorForm.contractor_type || undefined, contact_info: contractorForm.contact_info || undefined }) }); if (res.ok) { setShowContractorForm(false); setContractorForm({ name: '', contractor_type: '', contact_info: '' }); fetchAll() } else { const err = await res.json(); window.alert(err.detail || 'Failed') } } finally { setContractorSubmitLoading(false) } }} className="text-xs px-2 py-1 rounded bg-emerald-700 hover:bg-emerald-600 text-white disabled:opacity-50">{contractorSubmitLoading ? 'Saving…' : 'Save'}</button>
                              <button type="button" onClick={() => setShowContractorForm(false)} className="text-xs px-2 py-1 rounded bg-zinc-700 text-zinc-300">Cancel</button>
                            </div>
                          </div>
                        )}
                        {contractors.length > 0 && (
                          <ul className="mt-3 space-y-1 text-sm">
                            {contractors.map((c) => (
                              <li key={c.id} className="text-zinc-300">{c.name}{c.contractor_type ? <span className="text-zinc-500"> · {c.contractor_type}</span> : ''} — {c.status}</li>
                            ))}
                          </ul>
                        )}
                      </div>
                      {/* Track B cities (5K–50K) — list and quick select */}
                      <div className="bg-zinc-900/50 rounded-md border border-zinc-800/60 p-4">
                        <h3 className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-3">Track B cities (5K–50K population)</h3>
                        <p className="text-zinc-500 text-xs mb-3">Municipalities eligible for Track B SaaS ($1K–2K/month). Select one to switch dashboard city.</p>
                        {trackBCities.length === 0 ? (
                          <p className="text-zinc-500 text-sm">No Track B cities loaded.</p>
                        ) : (
                          <ul className="space-y-1.5 max-h-48 overflow-y-auto">
                            {trackBCities.map((c) => (
                              <li key={c.id} className="flex items-center justify-between gap-2 py-1.5 border-b border-zinc-800/40 last:border-0">
                                <span className="text-zinc-300 text-sm">{c.name}{c.population != null ? <span className="text-zinc-500 ml-1">({c.population.toLocaleString()})</span> : ''}</span>
                                <button
                                  type="button"
                                  onClick={() => { setSelectedCity(c.id); setMapViewLevel('city'); setSelectedMapCityId(c.id); }}
                                  className="text-xs px-2 py-0.5 rounded bg-zinc-700 hover:bg-zinc-600 text-zinc-200"
                                >
                                  {selectedCity === c.id ? 'Current' : 'Select'}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </div>
        )}
      </div>
    </AccessGate>
  )
}
