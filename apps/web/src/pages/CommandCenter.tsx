/**
 * GLOBAL RISK COMMAND CENTER
 * ===========================
 * 
 * Decision Intelligence Platform - NOT a dashboard.
 * 
 * Design Principles:
 * 1. One Screen - no page navigation
 * 2. Scene > Layout - user is "inside" the system
 * 3. Focus > Navigation - click changes context, not page
 * 4. Silence > Noise - every pixel must carry meaning
 * 5. 30-Second Rule - critical decision in 30 seconds
 * 
 * Reference: IDENTITY.md
 */
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CubeTransparentIcon, CpuChipIcon, DocumentTextIcon, InformationCircleIcon, LinkIcon } from '@heroicons/react/24/outline'
import AIAssistant, { type AIAssistantHandle } from '../components/AIAssistant'
import CesiumGlobe, { RiskZone, ZoneAsset } from '../components/CesiumGlobe'
import DigitalTwinPanel from '../components/DigitalTwinPanel'
import { useWebSocket, RiskUpdate } from '../lib/useWebSocket'
import { ActionPlanModal, UnifiedStressTestPanel } from '../components/stress'
import { UNIVERSAL_ACTION_PLAN_TEMPLATE } from '../lib/universalActionPlanTemplate'
import UnifiedStressTestSelector from '../components/stress/UnifiedStressTestSelector'
import HistoricalEventPanel from '../components/HistoricalEventPanel'
import SystemOverseerWidget from '../components/dashboard/SystemOverseerWidget'
import AgentMonitoringWidget from '../components/dashboard/AgentMonitoringWidget'
import ActiveIncidentsPanel from '../components/dashboard/ActiveIncidentsPanel'
import AlertFeedPanel from '../components/AlertFeedPanel'
// ThreatIntelFeed available but not used in current layout
import SendToARINButton from '../components/SendToARINButton'
import ARINVerdictBadge from '../components/ARINVerdictBadge'
import { exportStressTestPdf } from '../lib/exportService'
import { mapEventIdToCascadeScenarioId } from '../lib/stressTestToCascade'
import { CURRENT_EVENTS as currentEvents, FORECAST_SCENARIOS as forecastScenarios } from '../lib/riskEventCatalog'
// STRESS_TYPES_WITH_ZONE_ENTITIES available for zone-entity stress tests
// Platform state management
import { usePlatformStore, usePortfolio, useSelectedZone, useShowDigitalTwinPanel, useActiveScenario, useSelectedStressTestId, useCommandMode, useToggleCommandMode, useRecentEvents } from '../store/platformStore'
import { EventTypes } from '../types/events'
import type { PlatformEvent } from '../types/events'
import { CommandModePanel } from '../components/command'
import CommandCenterTopBar from '../components/command/CommandCenterTopBar'
import { assetsApi, replayApi } from '../lib/api'
import { quickActionsCommandCenter, quickActionIconColors } from '../config/quickActions'
import { formatEur } from '../lib/formatCurrency'
import { getApiBase, getApiV1Base } from '../config/env'

// Runtime ?api= or VITE_API_URL — same as Dashboard so data matches
const getCommandApi = (): string => getApiV1Base()

// ============================================
// UI ATOMS — Corporate style (zinc, no glass)
// ============================================
const CC_LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
const CC_CARD = 'rounded-md bg-zinc-900 border border-zinc-800'
const CC_MUTED = 'text-zinc-500'
const CC_MUTED_LIGHT = 'text-zinc-400'
const CC_TEXT = 'text-zinc-100'
const CC_BORDER = 'border-zinc-700'
const CC_BG_HOVER = 'hover:bg-zinc-800'

function Keycap({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="px-2 py-1 rounded-md bg-zinc-800 border border-zinc-700 text-[10px] font-mono text-zinc-300">
      {children}
    </kbd>
  )
}

// ============================================
// TYPES
// ============================================

// PortfolioState shape is managed by platformStore; kept as doc reference
// totalExposure (B), atRisk (B), criticalCount, weightedRisk (0-1)

interface FocusedHotspot {
  id: string
  name: string
  region: string
  risk: number
  exposure: number
  trend: 'up' | 'down' | 'stable'
  factors: {
    climate: number
    credit: number
    operational: number
    geopolitical: number
    flood: number
    earthquake: number
    fire: number
    structural: number
  }
}

interface ActiveScenario {
  type: string
  severity: number
  active: boolean
}

// ============================================
// HELPER FUNCTIONS
// ============================================

// getRiskLevel removed - using inline conditions instead

function getRiskColor(risk: number): string {
  // Professional muted colors - not too bright
  if (risk > 0.8) return 'text-red-300'  // Muted red
  if (risk > 0.6) return 'text-orange-300'  // Muted orange
  if (risk > 0.4) return 'text-amber-300'  // Muted amber
  return 'text-emerald-300'  // Muted green
}

/** Dot/marker color by risk % — only for Quick Navigation (Z) for now */
function getRiskDotColor(risk: number): string {
  if (risk > 0.8) return 'bg-red-400/90'
  if (risk > 0.6) return 'bg-orange-400/90'
  if (risk > 0.4) return 'bg-amber-400/90'
  return 'bg-emerald-400/90'
}

function formatBillions(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}T`
  return `${value.toFixed(1)}B`
}

// Determine risk posture level for institutional display
function getRiskPosture(weightedRisk: number): { level: string; color: string; arrow: string } {
  if (weightedRisk > 0.75) return { level: 'CRITICAL', color: 'text-red-400/80', arrow: '↑↑' }
  if (weightedRisk > 0.6) return { level: 'ELEVATED', color: 'text-orange-400/80', arrow: '↑' }
  if (weightedRisk > 0.4) return { level: 'MODERATE', color: 'text-amber-400/80', arrow: '→' }
  return { level: 'STABLE', color: 'text-emerald-400/80', arrow: '↓' }
}

function formatRecentTime(timestamp: string): string {
  const date = new Date(timestamp)
  const now = new Date()
  const diff = Math.floor((now.getTime() - date.getTime()) / 1000)
  if (diff < 60) return 'now'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return `${Math.floor(diff / 86400)}d`
}

function createPlatformEvent(
  eventType: string,
  entityType: string,
  entityId: string,
  data: Record<string, unknown> = {},
): PlatformEvent {
  return {
    event_id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    event_type: eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    triggers: [],
    actor_type: 'user',
    entity_type: entityType,
    entity_id: entityId,
    action: eventType.split('.').pop() || 'updated',
    data: { name: entityId, ...data },
    intent: false,
  }
}

// Risk factor → scenario IDs from registry (Stress Scenarios)
const FACTOR_TO_SCENARIO_IDS: Record<string, string[]> = {
  climate: ['NGFS_SSP5_2050', 'NGFS_SSP2_2040', 'Flood_Extreme_100y', 'Heat_Stress_Energy', 'Sea_Level_Coastal', 'Wildfire_Insurance', 'Climate_Disclosure_Enforcement'],
  credit: ['EBA_Adverse', 'FED_Severely_Adverse_CRE', 'Liquidity_Freeze', 'Asset_Price_Collapse', 'IMF_Systemic', 'Sovereign_Debt_Crisis', 'Currency_Devaluation', 'Government_Default', 'Sudden_Capital_Increase', 'Resolution_Regime_Activation'],
  operational: ['COVID19_Replay', 'Pandemic_X', 'Urban_Riots_Asset_Damage', 'Infrastructure_Sabotage', 'Prolonged_Social_Instability'],
  geopolitical: ['Regional_Conflict_Spillover', 'Sanctions_Escalation', 'Trade_War_Supply_Chain', 'Energy_Shock'],
  flood: ['Flood_Extreme_100y', 'Sea_Level_Coastal', 'NGFS_SSP5_2050', 'NGFS_SSP2_2040'],
  earthquake: [],
  fire: ['Wildfire_Insurance', 'Heat_Stress_Energy'],
  structural: ['Infrastructure_Sabotage', 'Urban_Riots_Asset_Damage'],
}

// ============================================
// RISK LEVEL ROW COMPONENT
// ============================================

// View mode for risk indicators
type RiskViewMode = 'menu' | 'zones' | 'historical' | 'current' | 'forecast'

interface RiskLevelRowProps {
  level: 'critical' | 'high' | 'medium' | 'low'
  label: string
  color: 'red' | 'orange' | 'yellow' | 'green'
  zones: { id: string; name: string; risk: number }[]
  countOverride?: number  // From API (geodata/summary), refreshed every 5 min
  isExpanded: boolean
  onToggle: () => void
  onZoneClick: (id: string) => void
  onZoneLinksClick?: (id: string) => void
  onHistoricalSelect?: (eventId: string) => void
  onCurrentSelect?: (zoneId: string, category: string) => void
  onForecastSelect?: (zoneId: string, horizon: number) => void
  onOpenDigitalTwin?: (cityId: string, cityName: string, eventId?: string, eventName?: string, eventCategory?: string, timeHorizon?: string) => void
}

function RiskLevelRow({ level: _level, label, color, zones, countOverride, isExpanded, onToggle, onZoneClick: _onZoneClick, onZoneLinksClick, onHistoricalSelect, onCurrentSelect: _onCurrentSelect, onForecastSelect: _onForecastSelect, onOpenDigitalTwin }: RiskLevelRowProps) {
  // Note: _onZoneClick, _onCurrentSelect, _onForecastSelect are available but not directly used in this component
  const [viewMode, setViewMode] = useState<RiskViewMode>('menu')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedHorizon, setSelectedHorizon] = useState<number | null>(null)
  // New states for event → country → city flow
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<{ id: string; name: string; risk: number } | null>(null)
  
  // Professional muted color palette - serious, not cartoonish
  const colorClasses = {
    red: { text: 'text-red-300', bg: 'bg-red-500/20', border: 'border-red-500/20', hover: 'hover:bg-red-500/10' },
    orange: { text: 'text-orange-300', bg: 'bg-orange-500/20', border: 'border-orange-500/20', hover: 'hover:bg-orange-500/10' },
    yellow: { text: 'text-amber-300', bg: 'bg-amber-500/20', border: 'border-amber-500/20', hover: 'hover:bg-zinc-800' },
    green: { text: 'text-emerald-300', bg: 'bg-emerald-500/20', border: 'border-emerald-500/20', hover: 'hover:bg-emerald-500/10' },
  }
  
  const colors = colorClasses[color]
  
  // Historical events database (1970-present) - FULL LIST
  const historicalEvents = [
    // Financial Crises
    { id: 'crash1929', name: '1929 Great Depression', year: 1929, type: 'financial' },
    { id: 'oil1973', name: '1973 Oil Crisis', year: 1973, type: 'energy' },
    { id: 'latam1982', name: '1982 Latin American Debt', year: 1982, type: 'financial' },
    { id: 'blackmonday1987', name: '1987 Black Monday', year: 1987, type: 'financial' },
    { id: 'japan1990', name: '1990 Japan Asset Bubble', year: 1990, type: 'financial' },
    { id: 'mexico1994', name: '1994 Mexican Peso Crisis', year: 1994, type: 'financial' },
    { id: 'asian1997', name: '1997 Asian Financial Crisis', year: 1997, type: 'financial' },
    { id: 'russia1998', name: '1998 Russian Default', year: 1998, type: 'financial' },
    { id: 'dotcom2000', name: '2000 Dot-Com Bubble', year: 2000, type: 'financial' },
    { id: 'argentina2001', name: '2001 Argentine Crisis', year: 2001, type: 'financial' },
    { id: 'lehman2008', name: '2008 Global Financial Crisis', year: 2008, type: 'financial' },
    { id: 'flashcrash2010', name: '2010 Flash Crash', year: 2010, type: 'financial' },
    { id: 'eurozone2011', name: '2011 Eurozone Debt Crisis', year: 2011, type: 'financial' },
    { id: 'china2015', name: '2015 China Stock Crash', year: 2015, type: 'financial' },
    { id: 'crypto2022', name: '2022 Crypto Collapse', year: 2022, type: 'financial' },
    { id: 'svb2023', name: '2023 SVB Bank Failure', year: 2023, type: 'financial' },
    // Climate & Natural Disasters
    { id: 'chernobyl1986', name: '1986 Chernobyl', year: 1986, type: 'climate' },
    { id: 'tsunami2004', name: '2004 Indian Ocean Tsunami', year: 2004, type: 'climate' },
    { id: 'katrina2005', name: '2005 Hurricane Katrina', year: 2005, type: 'climate' },
    { id: 'fukushima2011', name: '2011 Fukushima', year: 2011, type: 'climate' },
    { id: 'sandy2012', name: '2012 Hurricane Sandy', year: 2012, type: 'climate' },
    { id: 'australia2020', name: '2020 Australia Wildfires', year: 2020, type: 'climate' },
    // Geopolitical
    { id: 'gulf1990', name: '1990 Gulf War', year: 1990, type: 'geopolitical' },
    { id: 'sept11_2001', name: '2001 September 11', year: 2001, type: 'geopolitical' },
    { id: 'iraq2003', name: '2003 Iraq War', year: 2003, type: 'geopolitical' },
    { id: 'crimea2014', name: '2014 Crimea Annexation', year: 2014, type: 'geopolitical' },
    { id: 'brexit2016', name: '2016 Brexit', year: 2016, type: 'geopolitical' },
    { id: 'tradewars2018', name: '2018 US-China Trade War', year: 2018, type: 'geopolitical' },
    { id: 'ukraine2022', name: '2022 Ukraine Conflict', year: 2022, type: 'geopolitical' },
    { id: 'taiwan2024', name: '2024 Taiwan Tensions', year: 2024, type: 'geopolitical' },
    // Pandemics
    { id: 'sars2003', name: '2003 SARS', year: 2003, type: 'pandemic' },
    { id: 'h1n1_2009', name: '2009 H1N1 Swine Flu', year: 2009, type: 'pandemic' },
    { id: 'ebola2014', name: '2014 Ebola Outbreak', year: 2014, type: 'pandemic' },
    { id: 'covid2020', name: '2020 COVID-19', year: 2020, type: 'pandemic' },
    // Social & Political
    { id: 'arabspring2011', name: '2011 Arab Spring', year: 2011, type: 'social' },
    { id: 'occupy2011', name: '2011 Occupy Movement', year: 2011, type: 'social' },
    { id: 'yellowvest2018', name: '2018 Yellow Vest Protests', year: 2018, type: 'social' },
    { id: 'blm2020', name: '2020 BLM Protests', year: 2020, type: 'social' },
  ]
  
  // Affected countries and cities database
  const affectedRegions: Record<string, { countries: { id: string; name: string; flag: string; cities: { id: string; name: string; risk: number; cesiumId?: number }[] }[] }> = {
    // Climate Events
    drought2024: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.75, cesiumId: 0 },
        { id: 'munich', name: 'Munich', risk: 0.68, cesiumId: 0 },
        { id: 'cologne', name: 'Cologne', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.65, cesiumId: 0 },
        { id: 'lyon', name: 'Lyon', risk: 0.70, cesiumId: 0 },
        { id: 'marseille', name: 'Marseille', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [
        { id: 'madrid', name: 'Madrid', risk: 0.82, cesiumId: 0 },
        { id: 'barcelona', name: 'Barcelona', risk: 0.75, cesiumId: 0 },
      ]},
    ]},
    // Geopolitical
    ukraine_ongoing: { countries: [
      { id: 'ua', name: 'Ukraine', flag: '🇺🇦', cities: [
        { id: 'kyiv', name: 'Kyiv', risk: 0.95, cesiumId: 0 },
        { id: 'kharkiv', name: 'Kharkiv', risk: 0.92, cesiumId: 0 },
        { id: 'odesa', name: 'Odesa', risk: 0.85, cesiumId: 0 },
      ]},
      { id: 'pl', name: 'Poland', flag: '🇵🇱', cities: [
        { id: 'warsaw', name: 'Warsaw', risk: 0.55, cesiumId: 0 },
        { id: 'krakow', name: 'Krakow', risk: 0.48, cesiumId: 0 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.42, cesiumId: 0 },
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.45, cesiumId: 0 },
      ]},
    ]},
    israel_gaza: { countries: [
      { id: 'il', name: 'Israel', flag: '🇮🇱', cities: [
        { id: 'telaviv', name: 'Tel Aviv', risk: 0.88, cesiumId: 0 },
        { id: 'jerusalem', name: 'Jerusalem', risk: 0.82, cesiumId: 0 },
        { id: 'haifa', name: 'Haifa', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'cairo', name: 'Cairo', risk: 0.55, cesiumId: 0 },
      ]},
      { id: 'jo', name: 'Jordan', flag: '🇯🇴', cities: [
        { id: 'amman', name: 'Amman', risk: 0.48, cesiumId: 0 },
      ]},
    ]},
    redse_shipping: { countries: [
      { id: 'ae', name: 'UAE', flag: '🇦🇪', cities: [
        { id: 'dubai', name: 'Dubai', risk: 0.72, cesiumId: 0 },
        { id: 'abudhabi', name: 'Abu Dhabi', risk: 0.65, cesiumId: 0 },
      ]},
      { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', cities: [
        { id: 'jeddah', name: 'Jeddah', risk: 0.78, cesiumId: 0 },
        { id: 'riyadh', name: 'Riyadh', risk: 0.55, cesiumId: 0 },
      ]},
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'suez', name: 'Suez', risk: 0.85, cesiumId: 0 },
      ]},
    ]},
    taiwan_strait: { countries: [
      { id: 'tw', name: 'Taiwan', flag: '🇹🇼', cities: [
        { id: 'taipei', name: 'Taipei', risk: 0.85, cesiumId: 0 },
        { id: 'kaohsiung', name: 'Kaohsiung', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.55, cesiumId: 2602291 },
        { id: 'osaka', name: 'Osaka', risk: 0.52, cesiumId: 0 },
      ]},
      { id: 'kr', name: 'South Korea', flag: '🇰🇷', cities: [
        { id: 'seoul', name: 'Seoul', risk: 0.48, cesiumId: 0 },
      ]},
    ]},
    // Financial
    china_property: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.85, cesiumId: 0 },
        { id: 'beijing', name: 'Beijing', risk: 0.78, cesiumId: 0 },
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.82, cesiumId: 0 },
        { id: 'guangzhou', name: 'Guangzhou', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'hk', name: 'Hong Kong', flag: '🇭🇰', cities: [
        { id: 'hongkong', name: 'Hong Kong', risk: 0.72, cesiumId: 0 },
      ]},
    ]},
    commercial_re: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.82, cesiumId: 75343 },
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.88, cesiumId: 0 },
        { id: 'chicago', name: 'Chicago', risk: 0.75, cesiumId: 0 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.72, cesiumId: 0 },
        { id: 'boston', name: 'Boston', risk: 0.68, cesiumId: 354759 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.75, cesiumId: 0 },
      ]},
    ]},
    // Forecast scenarios
    ai_disruption: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.82, cesiumId: 0 },
        { id: 'seattle', name: 'Seattle', risk: 0.78, cesiumId: 0 },
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.75, cesiumId: 0 },
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.68, cesiumId: 0 },
      ]},
    ]},
    water_scarcity: { countries: [
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'chennai', name: 'Chennai', risk: 0.92, cesiumId: 0 },
        { id: 'bangalore', name: 'Bangalore', risk: 0.85, cesiumId: 0 },
        { id: 'delhi', name: 'Delhi', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'za', name: 'South Africa', flag: '🇿🇦', cities: [
        { id: 'capetown', name: 'Cape Town', risk: 0.88, cesiumId: 0 },
        { id: 'johannesburg', name: 'Johannesburg', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'mx', name: 'Mexico', flag: '🇲🇽', cities: [
        { id: 'mexicocity', name: 'Mexico City', risk: 0.82, cesiumId: 0 },
      ]},
    ]},
    sea_level: { countries: [
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [
        { id: 'dhaka', name: 'Dhaka', risk: 0.95, cesiumId: 0 },
        { id: 'chittagong', name: 'Chittagong', risk: 0.92, cesiumId: 0 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'amsterdam', name: 'Amsterdam', risk: 0.82, cesiumId: 0 },
        { id: 'rotterdam', name: 'Rotterdam', risk: 0.85, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'miami', name: 'Miami', risk: 0.88, cesiumId: 0 },
        { id: 'neworleans', name: 'New Orleans', risk: 0.92, cesiumId: 0 },
      ]},
    ]},
    climate_tipping: { countries: [
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'sydney', name: 'Sydney', risk: 0.78, cesiumId: 2644092 },
        { id: 'melbourne', name: 'Melbourne', risk: 0.75, cesiumId: 69380 },
      ]},
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'saopaulo', name: 'São Paulo', risk: 0.82, cesiumId: 0 },
        { id: 'riodejaneiro', name: 'Rio de Janeiro', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'id', name: 'Indonesia', flag: '🇮🇩', cities: [
        { id: 'jakarta', name: 'Jakarta', risk: 0.92, cesiumId: 0 },
      ]},
    ]},
    // Additional Current Events
    flood_asia: { countries: [
      { id: 'th', name: 'Thailand', flag: '🇹🇭', cities: [
        { id: 'bangkok', name: 'Bangkok', risk: 0.82, cesiumId: 0 },
        { id: 'chiangmai', name: 'Chiang Mai', risk: 0.65, cesiumId: 0 },
      ]},
      { id: 'vn', name: 'Vietnam', flag: '🇻🇳', cities: [
        { id: 'hochiminh', name: 'Ho Chi Minh City', risk: 0.78, cesiumId: 0 },
        { id: 'hanoi', name: 'Hanoi', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'ph', name: 'Philippines', flag: '🇵🇭', cities: [
        { id: 'manila', name: 'Manila', risk: 0.85, cesiumId: 0 },
      ]},
    ]},
    wildfire_canada: { countries: [
      { id: 'ca', name: 'Canada', flag: '🇨🇦', cities: [
        { id: 'vancouver', name: 'Vancouver', risk: 0.72, cesiumId: 0 },
        { id: 'calgary', name: 'Calgary', risk: 0.68, cesiumId: 0 },
        { id: 'edmonton', name: 'Edmonton', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'seattle', name: 'Seattle', risk: 0.55, cesiumId: 0 },
        { id: 'portland', name: 'Portland', risk: 0.52, cesiumId: 0 },
      ]},
    ]},
    elnino: { countries: [
      { id: 'pe', name: 'Peru', flag: '🇵🇪', cities: [
        { id: 'lima', name: 'Lima', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'ec', name: 'Ecuador', flag: '🇪🇨', cities: [
        { id: 'guayaquil', name: 'Guayaquil', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'sydney', name: 'Sydney', risk: 0.62, cesiumId: 2644092 },
        { id: 'brisbane', name: 'Brisbane', risk: 0.68, cesiumId: 0 },
      ]},
    ]},
    korea_tensions: { countries: [
      { id: 'kr', name: 'South Korea', flag: '🇰🇷', cities: [
        { id: 'seoul', name: 'Seoul', risk: 0.72, cesiumId: 0 },
        { id: 'busan', name: 'Busan', risk: 0.55, cesiumId: 0 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.48, cesiumId: 2602291 },
        { id: 'fukuoka', name: 'Fukuoka', risk: 0.52, cesiumId: 0 },
      ]},
    ]},
    rate_hikes: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
        { id: 'chicago', name: 'Chicago', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.70, cesiumId: 0 },
      ]},
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.68, cesiumId: 0 },
      ]},
    ]},
    em_debt: { countries: [
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [
        { id: 'buenosaires', name: 'Buenos Aires', risk: 0.82, cesiumId: 0 },
      ]},
      { id: 'tr', name: 'Turkey', flag: '🇹🇷', cities: [
        { id: 'istanbul', name: 'Istanbul', risk: 0.75, cesiumId: 0 },
        { id: 'ankara', name: 'Ankara', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'za', name: 'South Africa', flag: '🇿🇦', cities: [
        { id: 'johannesburg', name: 'Johannesburg', risk: 0.65, cesiumId: 0 },
      ]},
    ]},
    bank_stress: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.72, cesiumId: 0 },
        { id: 'newyork', name: 'New York', risk: 0.65, cesiumId: 75343 },
        { id: 'charlotte', name: 'Charlotte', risk: 0.58, cesiumId: 0 },
      ]},
    ]},
    covid_variants: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.45, cesiumId: 0 },
        { id: 'shanghai', name: 'Shanghai', risk: 0.42, cesiumId: 0 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.38, cesiumId: 0 },
        { id: 'delhi', name: 'Delhi', risk: 0.35, cesiumId: 0 },
      ]},
    ]},
    avian_flu: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'guangzhou', name: 'Guangzhou', risk: 0.52, cesiumId: 0 },
        { id: 'wuhan', name: 'Wuhan', risk: 0.48, cesiumId: 0 },
      ]},
      { id: 'vn', name: 'Vietnam', flag: '🇻🇳', cities: [
        { id: 'hanoi', name: 'Hanoi', risk: 0.45, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'atlanta', name: 'Atlanta', risk: 0.35, cesiumId: 0 },
      ]},
    ]},
    disease_x: { countries: [
      { id: 'global', name: 'Global Monitoring', flag: '🌍', cities: [
        { id: 'geneva', name: 'Geneva (WHO)', risk: 0.28, cesiumId: 0 },
        { id: 'atlanta', name: 'Atlanta (CDC)', risk: 0.25, cesiumId: 0 },
        { id: 'beijing', name: 'Beijing (CCDC)', risk: 0.30, cesiumId: 0 },
      ]},
    ]},
    chip_shortage: { countries: [
      { id: 'tw', name: 'Taiwan', flag: '🇹🇼', cities: [
        { id: 'hsinchu', name: 'Hsinchu (TSMC)', risk: 0.72, cesiumId: 0 },
        { id: 'taipei', name: 'Taipei', risk: 0.65, cesiumId: 0 },
      ]},
      { id: 'kr', name: 'South Korea', flag: '🇰🇷', cities: [
        { id: 'seoul', name: 'Seoul (Samsung)', risk: 0.58, cesiumId: 0 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.52, cesiumId: 2602291 },
      ]},
    ]},
    rare_earth: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'baotou', name: 'Baotou', risk: 0.82, cesiumId: 0 },
        { id: 'ganzhou', name: 'Ganzhou', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'perth', name: 'Perth', risk: 0.45, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'lasvegas', name: 'Las Vegas', risk: 0.38, cesiumId: 0 },
      ]},
    ]},
    energy_transition: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.55, cesiumId: 0 },
        { id: 'hamburg', name: 'Hamburg', risk: 0.52, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'houston', name: 'Houston', risk: 0.62, cesiumId: 0 },
        { id: 'denver', name: 'Denver', risk: 0.48, cesiumId: 0 },
      ]},
      { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', cities: [
        { id: 'riyadh', name: 'Riyadh', risk: 0.58, cesiumId: 0 },
      ]},
    ]},
    // Forecast scenarios
    climate_migration: { countries: [
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [
        { id: 'dhaka', name: 'Dhaka', risk: 0.85, cesiumId: 0 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.72, cesiumId: 0 },
        { id: 'kolkata', name: 'Kolkata', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'mx', name: 'Mexico', flag: '🇲🇽', cities: [
        { id: 'mexicocity', name: 'Mexico City', risk: 0.65, cesiumId: 0 },
      ]},
    ]},
    debt_crisis: { countries: [
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [
        { id: 'rome', name: 'Rome', risk: 0.68, cesiumId: 0 },
        { id: 'milan', name: 'Milan', risk: 0.62, cesiumId: 0 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.58, cesiumId: 2602291 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.52, cesiumId: 0 },
      ]},
    ]},
    cyber_attack: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.65, cesiumId: 0 },
        { id: 'newyork', name: 'New York', risk: 0.62, cesiumId: 75343 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58, cesiumId: 0 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.52, cesiumId: 0 },
      ]},
    ]},
    biodiversity: { countries: [
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'manaus', name: 'Manaus', risk: 0.82, cesiumId: 0 },
        { id: 'belem', name: 'Belém', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'id', name: 'Indonesia', flag: '🇮🇩', cities: [
        { id: 'jakarta', name: 'Jakarta', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'cg', name: 'DR Congo', flag: '🇨🇩', cities: [
        { id: 'kinshasa', name: 'Kinshasa', risk: 0.68, cesiumId: 0 },
      ]},
    ]},
    pandemic_new: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'newyork', name: 'New York', risk: 0.75, cesiumId: 75343 },
        { id: 'london', name: 'London', risk: 0.72, cesiumId: 0 },
        { id: 'tokyo', name: 'Tokyo', risk: 0.70, cesiumId: 2602291 },
        { id: 'mumbai', name: 'Mumbai', risk: 0.78, cesiumId: 0 },
      ]},
    ]},
    arctic_conflict: { countries: [
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'murmansk', name: 'Murmansk', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'no', name: 'Norway', flag: '🇳🇴', cities: [
        { id: 'oslo', name: 'Oslo', risk: 0.55, cesiumId: 0 },
        { id: 'tromso', name: 'Tromsø', risk: 0.62, cesiumId: 0 },
      ]},
      { id: 'ca', name: 'Canada', flag: '🇨🇦', cities: [
        { id: 'iqaluit', name: 'Iqaluit', risk: 0.58, cesiumId: 0 },
      ]},
    ]},
    food_crisis: { countries: [
      { id: 'ng', name: 'Nigeria', flag: '🇳🇬', cities: [
        { id: 'lagos', name: 'Lagos', risk: 0.82, cesiumId: 0 },
        { id: 'abuja', name: 'Abuja', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'et', name: 'Ethiopia', flag: '🇪🇹', cities: [
        { id: 'addisababa', name: 'Addis Ababa', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.68, cesiumId: 0 },
      ]},
    ]},
    currency_reset: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
        { id: 'washington', name: 'Washington DC', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.75, cesiumId: 0 },
        { id: 'shanghai', name: 'Shanghai', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [
        { id: 'zurich', name: 'Zurich', risk: 0.55, cesiumId: 0 },
      ]},
    ]},
    mass_extinction: { countries: [
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'manaus', name: 'Manaus', risk: 0.92, cesiumId: 0 },
      ]},
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'brisbane', name: 'Brisbane', risk: 0.85, cesiumId: 0 },
      ]},
      { id: 'id', name: 'Indonesia', flag: '🇮🇩', cities: [
        { id: 'jakarta', name: 'Jakarta', risk: 0.88, cesiumId: 0 },
      ]},
    ]},
    global_conflict: { countries: [
      { id: 'global', name: 'Multiple Regions', flag: '🌍', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.82, cesiumId: 0 },
        { id: 'moscow', name: 'Moscow', risk: 0.85, cesiumId: 0 },
        { id: 'beijing', name: 'Beijing', risk: 0.78, cesiumId: 0 },
        { id: 'brussels', name: 'Brussels', risk: 0.72, cesiumId: 0 },
      ]},
    ]},
    // Additional forecast scenarios
    deglobalization: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.68, cesiumId: 0 },
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'detroit', name: 'Detroit', risk: 0.58, cesiumId: 0 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.55, cesiumId: 0 },
      ]},
    ]},
    pandemic_novel: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'newyork', name: 'New York', risk: 0.75, cesiumId: 75343 },
        { id: 'london', name: 'London', risk: 0.72, cesiumId: 0 },
        { id: 'tokyo', name: 'Tokyo', risk: 0.70, cesiumId: 2602291 },
      ]},
    ]},
    energy_crisis: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.72, cesiumId: 0 },
        { id: 'munich', name: 'Munich', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.65, cesiumId: 2602291 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.78, cesiumId: 0 },
        { id: 'delhi', name: 'Delhi', risk: 0.75, cesiumId: 0 },
      ]},
    ]},
    food_security: { countries: [
      { id: 'ng', name: 'Nigeria', flag: '🇳🇬', cities: [
        { id: 'lagos', name: 'Lagos', risk: 0.82, cesiumId: 0 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'cairo', name: 'Cairo', risk: 0.72, cesiumId: 0 },
      ]},
    ]},
    agi_emergence: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.72, cesiumId: 0 },
        { id: 'seattle', name: 'Seattle', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.62, cesiumId: 0 },
      ]},
    ]},
    nuclear_proliferation: { countries: [
      { id: 'ir', name: 'Iran', flag: '🇮🇷', cities: [
        { id: 'tehran', name: 'Tehran', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'kp', name: 'North Korea', flag: '🇰🇵', cities: [
        { id: 'pyongyang', name: 'Pyongyang', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'pk', name: 'Pakistan', flag: '🇵🇰', cities: [
        { id: 'islamabad', name: 'Islamabad', risk: 0.55, cesiumId: 0 },
      ]},
    ]},
    arctic_collapse: { countries: [
      { id: 'gl', name: 'Greenland', flag: '🇬🇱', cities: [
        { id: 'nuuk', name: 'Nuuk', risk: 0.88, cesiumId: 0 },
      ]},
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'murmansk', name: 'Murmansk', risk: 0.82, cesiumId: 0 },
      ]},
      { id: 'no', name: 'Norway', flag: '🇳🇴', cities: [
        { id: 'svalbard', name: 'Svalbard', risk: 0.85, cesiumId: 0 },
      ]},
    ]},
    demographic_crisis: { countries: [
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.82, cesiumId: 2602291 },
        { id: 'osaka', name: 'Osaka', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'kr', name: 'South Korea', flag: '🇰🇷', cities: [
        { id: 'seoul', name: 'Seoul', risk: 0.85, cesiumId: 0 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.72, cesiumId: 0 },
      ]},
    ]},
    resource_wars: { countries: [
      { id: 'cg', name: 'DR Congo', flag: '🇨🇩', cities: [
        { id: 'kinshasa', name: 'Kinshasa', risk: 0.78, cesiumId: 0 },
      ]},
      { id: 'bo', name: 'Bolivia', flag: '🇧🇴', cities: [
        { id: 'lapaz', name: 'La Paz', risk: 0.68, cesiumId: 0 },
      ]},
      { id: 'cl', name: 'Chile', flag: '🇨🇱', cities: [
        { id: 'santiago', name: 'Santiago', risk: 0.62, cesiumId: 0 },
      ]},
    ]},
    automation_unemployment: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'detroit', name: 'Detroit', risk: 0.82, cesiumId: 0 },
        { id: 'chicago', name: 'Chicago', risk: 0.75, cesiumId: 0 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'stuttgart', name: 'Stuttgart', risk: 0.72, cesiumId: 0 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'guangzhou', name: 'Guangzhou', risk: 0.78, cesiumId: 0 },
      ]},
    ]},
    global_governance: { countries: [
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [
        { id: 'geneva', name: 'Geneva', risk: 0.55, cesiumId: 0 },
      ]},
      { id: 'be', name: 'Belgium', flag: '🇧🇪', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.58, cesiumId: 0 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York (UN)', risk: 0.52, cesiumId: 75343 },
      ]},
    ]},
    space_economy: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'houston', name: 'Houston', risk: 0.48, cesiumId: 0 },
        { id: 'capecanaveral', name: 'Cape Canaveral', risk: 0.45, cesiumId: 0 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.42, cesiumId: 0 },
      ]},
    ]},
    synthetic_bio: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'boston', name: 'Boston', risk: 0.62, cesiumId: 354759 },
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.58, cesiumId: 0 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'cambridge', name: 'Cambridge', risk: 0.55, cesiumId: 0 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.52, cesiumId: 0 },
      ]},
    ]},
    
    // ===== STRESS LAB SCENARIOS =====
    // Rhine Valley Flood
    'flood-rhine': { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'cologne', name: 'Cologne', risk: 0.92 },
        { id: 'dusseldorf', name: 'Düsseldorf', risk: 0.88 },
        { id: 'bonn', name: 'Bonn', risk: 0.85 },
        { id: 'mainz', name: 'Mainz', risk: 0.82 },
        { id: 'koblenz', name: 'Koblenz', risk: 0.90 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'rotterdam', name: 'Rotterdam', risk: 0.78 },
        { id: 'arnhem', name: 'Arnhem', risk: 0.75 },
      ]},
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [
        { id: 'basel', name: 'Basel', risk: 0.72 },
      ]},
    ]},
    // European Heatwave
    'heatwave-eu': { countries: [
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [
        { id: 'madrid', name: 'Madrid', risk: 0.88 },
        { id: 'seville', name: 'Seville', risk: 0.92 },
        { id: 'barcelona', name: 'Barcelona', risk: 0.82 },
      ]},
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.78 },
        { id: 'lyon', name: 'Lyon', risk: 0.82 },
        { id: 'marseille', name: 'Marseille', risk: 0.85 },
      ]},
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [
        { id: 'rome', name: 'Rome', risk: 0.85 },
        { id: 'milan', name: 'Milan', risk: 0.78 },
        { id: 'naples', name: 'Naples', risk: 0.88 },
      ]},
      { id: 'gr', name: 'Greece', flag: '🇬🇷', cities: [
        { id: 'athens', name: 'Athens', risk: 0.90 },
      ]},
    ]},
    // Eastern Europe Escalation
    'conflict-east': { countries: [
      { id: 'ua', name: 'Ukraine', flag: '🇺🇦', cities: [
        { id: 'kyiv', name: 'Kyiv', risk: 0.95 },
        { id: 'kharkiv', name: 'Kharkiv', risk: 0.98 },
        { id: 'odesa', name: 'Odesa', risk: 0.88 },
        { id: 'lviv', name: 'Lviv', risk: 0.75 },
      ]},
      { id: 'pl', name: 'Poland', flag: '🇵🇱', cities: [
        { id: 'warsaw', name: 'Warsaw', risk: 0.65 },
        { id: 'krakow', name: 'Krakow', risk: 0.58 },
        { id: 'rzeszow', name: 'Rzeszów', risk: 0.72 },
      ]},
      { id: 'lt', name: 'Lithuania', flag: '🇱🇹', cities: [
        { id: 'vilnius', name: 'Vilnius', risk: 0.62 },
      ]},
      { id: 'ro', name: 'Romania', flag: '🇷🇴', cities: [
        { id: 'bucharest', name: 'Bucharest', risk: 0.55 },
      ]},
    ]},
    // Trade Route Blockade
    blockade: { countries: [
      { id: 'sg', name: 'Singapore', flag: '🇸🇬', cities: [
        { id: 'singapore', name: 'Singapore', risk: 0.82 },
      ]},
      { id: 'ae', name: 'UAE', flag: '🇦🇪', cities: [
        { id: 'dubai', name: 'Dubai', risk: 0.78 },
      ]},
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'suez', name: 'Port Suez', risk: 0.88 },
        { id: 'alexandria', name: 'Alexandria', risk: 0.75 },
      ]},
      { id: 'tr', name: 'Turkey', flag: '🇹🇷', cities: [
        { id: 'istanbul', name: 'Istanbul', risk: 0.72 },
      ]},
    ]},
    // Sanctions Package
    sanctions: { countries: [
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'moscow', name: 'Moscow', risk: 0.85 },
        { id: 'stpetersburg', name: 'St. Petersburg', risk: 0.78 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.55 },
        { id: 'berlin', name: 'Berlin', risk: 0.52 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58 },
      ]},
    ]},
    // Regime Transition
    'regime-change': { countries: [
      { id: 'ir', name: 'Iran', flag: '🇮🇷', cities: [
        { id: 'tehran', name: 'Tehran', risk: 0.82 },
        { id: 'isfahan', name: 'Isfahan', risk: 0.72 },
      ]},
      { id: 've', name: 'Venezuela', flag: '🇻🇪', cities: [
        { id: 'caracas', name: 'Caracas', risk: 0.78 },
      ]},
      { id: 'mm', name: 'Myanmar', flag: '🇲🇲', cities: [
        { id: 'yangon', name: 'Yangon', risk: 0.75 },
      ]},
    ]},
    // Eurozone Liquidity Crisis
    'liquidity-eu': { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'frankfurt', name: 'Frankfurt (ECB)', risk: 0.88 },
        { id: 'munich', name: 'Munich', risk: 0.72 },
      ]},
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [
        { id: 'rome', name: 'Rome', risk: 0.85 },
        { id: 'milan', name: 'Milan', risk: 0.82 },
      ]},
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [
        { id: 'madrid', name: 'Madrid', risk: 0.78 },
      ]},
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.75 },
      ]},
    ]},
    // Credit Crunch
    'credit-crunch': { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York (Wall Street)', risk: 0.85, cesiumId: 75343 },
        { id: 'chicago', name: 'Chicago', risk: 0.78 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London (City)', risk: 0.82 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.72, cesiumId: 2602291 },
      ]},
    ]},
    // Basel IV Implementation
    'basel-full': { countries: [
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [
        { id: 'basel', name: 'Basel (BIS)', risk: 0.55 },
        { id: 'zurich', name: 'Zurich', risk: 0.52 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.48 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.45, cesiumId: 75343 },
        { id: 'washington', name: 'Washington DC (Fed)', risk: 0.42 },
      ]},
    ]},
    // Pandemic Variant X
    'pandemic-x': { countries: [
      { id: 'global', name: 'Global Outbreak', flag: '🌍', cities: [
        { id: 'newyork', name: 'New York', risk: 0.85, cesiumId: 75343 },
        { id: 'london', name: 'London', risk: 0.82 },
        { id: 'tokyo', name: 'Tokyo', risk: 0.78, cesiumId: 2602291 },
        { id: 'mumbai', name: 'Mumbai', risk: 0.88 },
        { id: 'saopaulo', name: 'São Paulo', risk: 0.85 },
      ]},
    ]},
    // Mass Civil Unrest
    'mass-protest': { countries: [
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.72 },
        { id: 'lyon', name: 'Lyon', risk: 0.65 },
        { id: 'marseille', name: 'Marseille', risk: 0.68 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.65 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.62 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58 },
      ]},
    ]},
    // General Strike
    'general-strike': { countries: [
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.68 },
        { id: 'lyon', name: 'Lyon', risk: 0.62 },
      ]},
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [
        { id: 'rome', name: 'Rome', risk: 0.58 },
        { id: 'milan', name: 'Milan', risk: 0.55 },
      ]},
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [
        { id: 'madrid', name: 'Madrid', risk: 0.52 },
        { id: 'barcelona', name: 'Barcelona', risk: 0.55 },
      ]},
    ]},
    // Sea Level Rise +0.5m (10yr)
    'sea-level-10': { countries: [
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [
        { id: 'dhaka', name: 'Dhaka', risk: 0.82 },
        { id: 'chittagong', name: 'Chittagong', risk: 0.88 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'amsterdam', name: 'Amsterdam', risk: 0.72 },
        { id: 'rotterdam', name: 'Rotterdam', risk: 0.78 },
      ]},
      { id: 'vn', name: 'Vietnam', flag: '🇻🇳', cities: [
        { id: 'hochiminh', name: 'Ho Chi Minh City', risk: 0.75 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'miami', name: 'Miami', risk: 0.72 },
        { id: 'neworleans', name: 'New Orleans', risk: 0.78 },
      ]},
    ]},
    
    // ===== ADDITIONAL NEW EVENTS =====
    // Australian Bushfires
    wildfire_aus: { countries: [
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'sydney', name: 'Sydney', risk: 0.72, cesiumId: 2644092 },
        { id: 'melbourne', name: 'Melbourne', risk: 0.68, cesiumId: 69380 },
        { id: 'brisbane', name: 'Brisbane', risk: 0.65 },
        { id: 'perth', name: 'Perth', risk: 0.55 },
      ]},
    ]},
    // Hurricane Season
    hurricane_atlantic: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'miami', name: 'Miami', risk: 0.78 },
        { id: 'houston', name: 'Houston', risk: 0.72 },
        { id: 'neworleans', name: 'New Orleans', risk: 0.82 },
        { id: 'tampa', name: 'Tampa', risk: 0.75 },
      ]},
      { id: 'mx', name: 'Mexico', flag: '🇲🇽', cities: [
        { id: 'cancun', name: 'Cancún', risk: 0.72 },
      ]},
      { id: 'cu', name: 'Cuba', flag: '🇨🇺', cities: [
        { id: 'havana', name: 'Havana', risk: 0.68 },
      ]},
    ]},
    // Polar Vortex
    arctic_vortex: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'chicago', name: 'Chicago', risk: 0.72 },
        { id: 'minneapolis', name: 'Minneapolis', risk: 0.78 },
        { id: 'detroit', name: 'Detroit', risk: 0.68 },
      ]},
      { id: 'ca', name: 'Canada', flag: '🇨🇦', cities: [
        { id: 'toronto', name: 'Toronto', risk: 0.65 },
        { id: 'montreal', name: 'Montreal', risk: 0.72 },
      ]},
    ]},
    // Monsoon Failure
    monsoon_fail: { countries: [
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.72 },
        { id: 'delhi', name: 'Delhi', risk: 0.75 },
        { id: 'chennai', name: 'Chennai', risk: 0.68 },
        { id: 'hyderabad', name: 'Hyderabad', risk: 0.65 },
      ]},
      { id: 'pk', name: 'Pakistan', flag: '🇵🇰', cities: [
        { id: 'karachi', name: 'Karachi', risk: 0.68 },
        { id: 'lahore', name: 'Lahore', risk: 0.62 },
      ]},
    ]},
    // Iran-Israel Tensions
    iran_israel: { countries: [
      { id: 'il', name: 'Israel', flag: '🇮🇱', cities: [
        { id: 'telaviv', name: 'Tel Aviv', risk: 0.85 },
        { id: 'haifa', name: 'Haifa', risk: 0.78 },
      ]},
      { id: 'ir', name: 'Iran', flag: '🇮🇷', cities: [
        { id: 'tehran', name: 'Tehran', risk: 0.82 },
      ]},
      { id: 'lb', name: 'Lebanon', flag: '🇱🇧', cities: [
        { id: 'beirut', name: 'Beirut', risk: 0.75 },
      ]},
    ]},
    // NATO Expansion
    nato_expansion: { countries: [
      { id: 'fi', name: 'Finland', flag: '🇫🇮', cities: [
        { id: 'helsinki', name: 'Helsinki', risk: 0.55 },
      ]},
      { id: 'se', name: 'Sweden', flag: '🇸🇪', cities: [
        { id: 'stockholm', name: 'Stockholm', risk: 0.52 },
      ]},
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'stpetersburg', name: 'St. Petersburg', risk: 0.65 },
      ]},
    ]},
    // South China Sea
    south_china_sea: { countries: [
      { id: 'ph', name: 'Philippines', flag: '🇵🇭', cities: [
        { id: 'manila', name: 'Manila', risk: 0.72 },
      ]},
      { id: 'vn', name: 'Vietnam', flag: '🇻🇳', cities: [
        { id: 'danang', name: 'Da Nang', risk: 0.68 },
      ]},
      { id: 'my', name: 'Malaysia', flag: '🇲🇾', cities: [
        { id: 'kualalumpur', name: 'Kuala Lumpur', risk: 0.55 },
      ]},
    ]},
    // India-Pakistan
    india_pakistan: { countries: [
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.72 },
        { id: 'mumbai', name: 'Mumbai', risk: 0.65 },
      ]},
      { id: 'pk', name: 'Pakistan', flag: '🇵🇰', cities: [
        { id: 'islamabad', name: 'Islamabad', risk: 0.75 },
        { id: 'lahore', name: 'Lahore', risk: 0.68 },
      ]},
    ]},
    // Venezuela-Guyana
    venezuela_guyana: { countries: [
      { id: 've', name: 'Venezuela', flag: '🇻🇪', cities: [
        { id: 'caracas', name: 'Caracas', risk: 0.52 },
      ]},
      { id: 'gy', name: 'Guyana', flag: '🇬🇾', cities: [
        { id: 'georgetown', name: 'Georgetown', risk: 0.68 },
      ]},
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'boavista', name: 'Boa Vista', risk: 0.45 },
      ]},
    ]},
    // Dollar Dominance
    dollar_dominance: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.62, cesiumId: 75343 },
        { id: 'washington', name: 'Washington DC', risk: 0.58 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.55 },
        { id: 'shanghai', name: 'Shanghai', risk: 0.52 },
      ]},
    ]},
    // Crypto Contagion
    crypto_contagion: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.55 },
        { id: 'newyork', name: 'New York', risk: 0.52, cesiumId: 75343 },
      ]},
      { id: 'ae', name: 'UAE', flag: '🇦🇪', cities: [
        { id: 'dubai', name: 'Dubai', risk: 0.48 },
      ]},
      { id: 'sg', name: 'Singapore', flag: '🇸🇬', cities: [
        { id: 'singapore', name: 'Singapore', risk: 0.45 },
      ]},
    ]},
    // Pension Shortfall
    pension_shortfall: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'chicago', name: 'Chicago', risk: 0.68 },
        { id: 'detroit', name: 'Detroit', risk: 0.72 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.62, cesiumId: 2602291 },
      ]},
    ]},
    // Insurance Crisis
    insurance_crisis: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'miami', name: 'Miami', risk: 0.78 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.72 },
      ]},
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'sydney', name: 'Sydney', risk: 0.65, cesiumId: 2644092 },
      ]},
    ]},
    // Bond Volatility
    bond_volatility: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
        { id: 'chicago', name: 'Chicago', risk: 0.68 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.65 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.62, cesiumId: 2602291 },
      ]},
    ]},
    // Mpox
    mpox_spread: { countries: [
      { id: 'cg', name: 'DR Congo', flag: '🇨🇩', cities: [
        { id: 'kinshasa', name: 'Kinshasa', risk: 0.72 },
      ]},
      { id: 'ng', name: 'Nigeria', flag: '🇳🇬', cities: [
        { id: 'lagos', name: 'Lagos', risk: 0.55 },
      ]},
      { id: 'global', name: 'Global Spread', flag: '🌍', cities: [
        { id: 'london', name: 'London', risk: 0.35 },
        { id: 'newyork', name: 'New York', risk: 0.32, cesiumId: 75343 },
      ]},
    ]},
    // Antibiotic Resistance
    antibiotic_resist: { countries: [
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.72 },
        { id: 'delhi', name: 'Delhi', risk: 0.68 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.58 },
      ]},
      { id: 'global', name: 'Global Health', flag: '🌍', cities: [
        { id: 'geneva', name: 'Geneva (WHO)', risk: 0.45 },
      ]},
    ]},
    // Zoonotic Spillover
    zoonotic_spillover: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'guangzhou', name: 'Guangzhou', risk: 0.62 },
        { id: 'wuhan', name: 'Wuhan', risk: 0.58 },
      ]},
      { id: 'id', name: 'Indonesia', flag: '🇮🇩', cities: [
        { id: 'jakarta', name: 'Jakarta', risk: 0.55 },
      ]},
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'manaus', name: 'Manaus', risk: 0.52 },
      ]},
    ]},
    // Healthcare Collapse
    healthcare_collapse: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.58, cesiumId: 75343 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.55 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.62 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.48 },
      ]},
    ]},
    // Farmer Protests
    farmer_protests: { countries: [
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.68 },
        { id: 'lyon', name: 'Lyon', risk: 0.62 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.55 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'amsterdam', name: 'Amsterdam', risk: 0.58 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.65 },
      ]},
    ]},
    // Cost of Living
    cost_living: { countries: [
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.68 },
        { id: 'manchester', name: 'Manchester', risk: 0.62 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.55 },
      ]},
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'paris', name: 'Paris', risk: 0.58 },
      ]},
    ]},
    // Political Polarization
    political_polarization: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.72 },
        { id: 'newyork', name: 'New York', risk: 0.58, cesiumId: 75343 },
      ]},
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'brasilia', name: 'Brasília', risk: 0.68 },
        { id: 'saopaulo', name: 'São Paulo', risk: 0.62 },
      ]},
    ]},
    // Election Unrest
    election_unrest: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.65 },
        { id: 'atlanta', name: 'Atlanta', risk: 0.55 },
      ]},
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'brasilia', name: 'Brasília', risk: 0.58 },
      ]},
    ]},
    // Labor Disputes
    labor_disputes: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'detroit', name: 'Detroit', risk: 0.62 },
        { id: 'losangeles', name: 'Los Angeles', risk: 0.58 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.52 },
      ]},
    ]},
    // Supply Chain additions
    suez_blockage: { countries: [
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'suez', name: 'Port Suez', risk: 0.82 },
        { id: 'portsaid', name: 'Port Said', risk: 0.78 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'rotterdam', name: 'Rotterdam', risk: 0.58 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'hamburg', name: 'Hamburg', risk: 0.55 },
      ]},
    ]},
    port_congestion: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.72 },
        { id: 'ningbo', name: 'Ningbo', risk: 0.68 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'losangeles', name: 'Los Angeles', risk: 0.62 },
        { id: 'longbeach', name: 'Long Beach', risk: 0.65 },
      ]},
    ]},
    lithium_shortage: { countries: [
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'perth', name: 'Perth', risk: 0.62 },
      ]},
      { id: 'cl', name: 'Chile', flag: '🇨🇱', cities: [
        { id: 'santiago', name: 'Santiago', risk: 0.58 },
      ]},
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [
        { id: 'salta', name: 'Salta', risk: 0.55 },
      ]},
    ]},
    food_supply: { countries: [
      { id: 'ua', name: 'Ukraine', flag: '🇺🇦', cities: [
        { id: 'odesa', name: 'Odesa', risk: 0.82 },
      ]},
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'cairo', name: 'Cairo', risk: 0.72 },
      ]},
      { id: 'ng', name: 'Nigeria', flag: '🇳🇬', cities: [
        { id: 'lagos', name: 'Lagos', risk: 0.68 },
      ]},
    ]},
    pharmaceutical: { countries: [
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'hyderabad', name: 'Hyderabad', risk: 0.65 },
        { id: 'mumbai', name: 'Mumbai', risk: 0.58 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.55 },
      ]},
    ]},
    // Regulatory additions
    'basel-iv': { countries: [
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [
        { id: 'basel', name: 'Basel (BIS)', risk: 0.52 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'frankfurt', name: 'Frankfurt (ECB)', risk: 0.48 },
      ]},
    ]},
    eu_ai_act: { countries: [
      { id: 'be', name: 'Belgium', flag: '🇧🇪', cities: [
        { id: 'brussels', name: 'Brussels (EU)', risk: 0.55 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.52 },
      ]},
    ]},
    carbon_border: { countries: [
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.58 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.55 },
      ]},
    ]},
    antitrust: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.58 },
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.62 },
      ]},
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.55 },
      ]},
    ]},
    data_sovereignty: { countries: [
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.52 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'beijing', name: 'Beijing', risk: 0.55 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.48 },
      ]},
    ]},
    esg_mandates: { countries: [
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.55 },
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.52 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.48 },
      ]},
    ]},
    tax_reform: { countries: [
      { id: 'ie', name: 'Ireland', flag: '🇮🇪', cities: [
        { id: 'dublin', name: 'Dublin', risk: 0.62 },
      ]},
      { id: 'lu', name: 'Luxembourg', flag: '🇱🇺', cities: [
        { id: 'luxembourg', name: 'Luxembourg', risk: 0.58 },
      ]},
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [
        { id: 'amsterdam', name: 'Amsterdam', risk: 0.52 },
      ]},
    ]},
    // Technology additions
    ai_disruption_now: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.72 },
        { id: 'newyork', name: 'New York', risk: 0.65, cesiumId: 75343 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58 },
      ]},
    ]},
    cyber_infrastructure: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.78 },
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
      ]},
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.65 },
      ]},
    ]},
    ransomware_wave: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
        { id: 'chicago', name: 'Chicago', risk: 0.65 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.62 },
      ]},
    ]},
    cloud_outage: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'seattle', name: 'Seattle (AWS)', risk: 0.65 },
        { id: 'ashburn', name: 'Ashburn (Azure)', risk: 0.62 },
      ]},
      { id: 'global', name: 'Global Impact', flag: '🌍', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.55, cesiumId: 2602291 },
        { id: 'london', name: 'London', risk: 0.52 },
      ]},
    ]},
    quantum_threat: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.48 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'hefei', name: 'Hefei', risk: 0.52 },
      ]},
    ]},
    deepfake_fraud: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'newyork', name: 'New York', risk: 0.58, cesiumId: 75343 },
        { id: 'london', name: 'London', risk: 0.55 },
        { id: 'hongkong', name: 'Hong Kong', risk: 0.62 },
      ]},
    ]},
    // Energy additions
    oil_shock: { countries: [
      { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', cities: [
        { id: 'riyadh', name: 'Riyadh', risk: 0.72 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'houston', name: 'Houston', risk: 0.78 },
      ]},
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'moscow', name: 'Moscow', risk: 0.68 },
      ]},
    ]},
    gas_shortage_eu: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.72 },
        { id: 'munich', name: 'Munich', risk: 0.68 },
      ]},
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [
        { id: 'milan', name: 'Milan', risk: 0.65 },
      ]},
      { id: 'at', name: 'Austria', flag: '🇦🇹', cities: [
        { id: 'vienna', name: 'Vienna', risk: 0.62 },
      ]},
    ]},
    power_grid: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'houston', name: 'Houston (Texas)', risk: 0.72 },
        { id: 'phoenix', name: 'Phoenix', risk: 0.65 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.68 },
      ]},
    ]},
    opec_action: { countries: [
      { id: 'sa', name: 'Saudi Arabia', flag: '🇸🇦', cities: [
        { id: 'riyadh', name: 'Riyadh', risk: 0.68 },
      ]},
      { id: 'ae', name: 'UAE', flag: '🇦🇪', cities: [
        { id: 'abudhabi', name: 'Abu Dhabi', risk: 0.62 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'houston', name: 'Houston', risk: 0.58 },
      ]},
    ]},
    nuclear_phase_out: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.55 },
        { id: 'munich', name: 'Munich', risk: 0.52 },
      ]},
      { id: 'be', name: 'Belgium', flag: '🇧🇪', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.48 },
      ]},
    ]},
    renewable_intermittency: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.52 },
      ]},
      { id: 'dk', name: 'Denmark', flag: '🇩🇰', cities: [
        { id: 'copenhagen', name: 'Copenhagen', risk: 0.48 },
      ]},
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [
        { id: 'madrid', name: 'Madrid', risk: 0.45 },
      ]},
    ]},
    // New Forecast scenarios
    credit_crunch_5yr: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
      ]},
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.68 },
      ]},
    ]},
    supply_chain_breakdown: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.78 },
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.75 },
      ]},
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'singapore', name: 'Singapore', risk: 0.68 },
        { id: 'rotterdam', name: 'Rotterdam', risk: 0.62 },
      ]},
    ]},
    energy_shock: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [
        { id: 'berlin', name: 'Berlin', risk: 0.72 },
      ]},
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [
        { id: 'tokyo', name: 'Tokyo', risk: 0.68, cesiumId: 2602291 },
      ]},
    ]},
    banking_crisis: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.82, cesiumId: 75343 },
      ]},
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'frankfurt', name: 'Frankfurt', risk: 0.78 },
      ]},
    ]},
    regional_conflict: { countries: [
      { id: 'global', name: 'Global Hotspots', flag: '🌍', cities: [
        { id: 'taipei', name: 'Taipei', risk: 0.78 },
        { id: 'seoul', name: 'Seoul', risk: 0.72 },
        { id: 'telaviv', name: 'Tel Aviv', risk: 0.75 },
      ]},
    ]},
    pandemic_outbreak: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'newyork', name: 'New York', risk: 0.72, cesiumId: 75343 },
        { id: 'london', name: 'London', risk: 0.68 },
        { id: 'tokyo', name: 'Tokyo', risk: 0.65, cesiumId: 2602291 },
      ]},
    ]},
    ai_governance: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.72 },
        { id: 'washington', name: 'Washington DC', risk: 0.68 },
      ]},
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.62 },
      ]},
    ]},
    infrastructure_decay: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.68, cesiumId: 75343 },
        { id: 'chicago', name: 'Chicago', risk: 0.72 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.58 },
      ]},
    ]},
    financial_decoupling: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shanghai', name: 'Shanghai', risk: 0.75 },
        { id: 'hongkong', name: 'Hong Kong', risk: 0.72 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'newyork', name: 'New York', risk: 0.68, cesiumId: 75343 },
      ]},
    ]},
    mass_migration: { countries: [
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [
        { id: 'brussels', name: 'Brussels', risk: 0.72 },
        { id: 'berlin', name: 'Berlin', risk: 0.68 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'elpaso', name: 'El Paso', risk: 0.78 },
        { id: 'sandiego', name: 'San Diego', risk: 0.72 },
      ]},
    ]},
    antibiotic_failure: { countries: [
      { id: 'global', name: 'Global Health', flag: '🌍', cities: [
        { id: 'geneva', name: 'Geneva (WHO)', risk: 0.72 },
        { id: 'atlanta', name: 'Atlanta (CDC)', risk: 0.68 },
      ]},
    ]},
    permafrost_methane: { countries: [
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [
        { id: 'norilsk', name: 'Norilsk', risk: 0.82 },
        { id: 'yakutsk', name: 'Yakutsk', risk: 0.78 },
      ]},
      { id: 'ca', name: 'Canada', flag: '🇨🇦', cities: [
        { id: 'yellowknife', name: 'Yellowknife', risk: 0.72 },
      ]},
    ]},
    coastal_flooding: { countries: [
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [
        { id: 'dhaka', name: 'Dhaka', risk: 0.88 },
      ]},
      { id: 'vn', name: 'Vietnam', flag: '🇻🇳', cities: [
        { id: 'hochiminh', name: 'Ho Chi Minh City', risk: 0.82 },
      ]},
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'miami', name: 'Miami', risk: 0.78 },
      ]},
    ]},
    currency_collapse: { countries: [
      { id: 'tr', name: 'Turkey', flag: '🇹🇷', cities: [
        { id: 'istanbul', name: 'Istanbul', risk: 0.72 },
      ]},
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [
        { id: 'buenosaires', name: 'Buenos Aires', risk: 0.78 },
      ]},
    ]},
    autonomous_warfare: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'washington', name: 'Washington DC', risk: 0.68 },
        { id: 'beijing', name: 'Beijing', risk: 0.65 },
        { id: 'moscow', name: 'Moscow', risk: 0.62 },
      ]},
    ]},
    genetic_engineering: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'boston', name: 'Boston', risk: 0.62, cesiumId: 354759 },
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.58 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.55 },
      ]},
    ]},
    amazon_dieback: { countries: [
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'manaus', name: 'Manaus', risk: 0.88 },
        { id: 'belem', name: 'Belém', risk: 0.82 },
      ]},
      { id: 'co', name: 'Colombia', flag: '🇨🇴', cities: [
        { id: 'leticia', name: 'Leticia', risk: 0.75 },
      ]},
    ]},
    ocean_acidification: { countries: [
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [
        { id: 'cairns', name: 'Cairns (Great Barrier)', risk: 0.85 },
      ]},
      { id: 'ph', name: 'Philippines', flag: '🇵🇭', cities: [
        { id: 'manila', name: 'Manila', risk: 0.72 },
      ]},
    ]},
    superintelligence: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.72 },
      ]},
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [
        { id: 'london', name: 'London', risk: 0.65 },
      ]},
    ]},
    global_water_wars: { countries: [
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [
        { id: 'cairo', name: 'Cairo', risk: 0.78 },
      ]},
      { id: 'et', name: 'Ethiopia', flag: '🇪🇹', cities: [
        { id: 'addisababa', name: 'Addis Ababa', risk: 0.72 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'delhi', name: 'Delhi', risk: 0.68 },
      ]},
    ]},
    mass_urbanization: { countries: [
      { id: 'ng', name: 'Nigeria', flag: '🇳🇬', cities: [
        { id: 'lagos', name: 'Lagos', risk: 0.82 },
      ]},
      { id: 'in', name: 'India', flag: '🇮🇳', cities: [
        { id: 'mumbai', name: 'Mumbai', risk: 0.78 },
        { id: 'delhi', name: 'Delhi', risk: 0.75 },
      ]},
    ]},
    fusion_revolution: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.45 },
      ]},
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [
        { id: 'cadarache', name: 'Cadarache (ITER)', risk: 0.42 },
      ]},
    ]},
    post_scarcity: { countries: [
      { id: 'global', name: 'Global Transition', flag: '🌍', cities: [
        { id: 'sanfrancisco', name: 'San Francisco', risk: 0.48 },
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.45 },
      ]},
    ]},
    human_enhancement: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [
        { id: 'boston', name: 'Boston', risk: 0.55, cesiumId: 354759 },
      ]},
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [
        { id: 'shenzhen', name: 'Shenzhen', risk: 0.52 },
      ]},
    ]},
    geoengineering: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [
        { id: 'geneva', name: 'Geneva', risk: 0.62 },
        { id: 'newyork', name: 'New York (UN)', risk: 0.58, cesiumId: 75343 },
      ]},
    ]},
    biosphere_collapse: { countries: [
      { id: 'br', name: 'Brazil', flag: '🇧🇷', cities: [
        { id: 'manaus', name: 'Manaus', risk: 0.92 },
      ]},
      { id: 'id', name: 'Indonesia', flag: '🇮🇩', cities: [
        { id: 'jakarta', name: 'Jakarta', risk: 0.85 },
      ]},
      { id: 'cg', name: 'DR Congo', flag: '🇨🇩', cities: [
        { id: 'kinshasa', name: 'Kinshasa', risk: 0.82 },
      ]},
    ]},

    // ===== STRESS SCENARIO REGISTRY (EBA, Fed, NGFS, IMF, Extended) – link with Stress Test (S) =====
    EBA_Adverse: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'frankfurt', name: 'Frankfurt (ECB)', risk: 0.88 }] },
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [{ id: 'milan', name: 'Milan', risk: 0.82 }] },
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'paris', name: 'Paris', risk: 0.78 }] },
    ]},
    FED_Severely_Adverse_CRE: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'newyork', name: 'New York', risk: 0.90, cesiumId: 75343 }, { id: 'sanfrancisco', name: 'San Francisco', risk: 0.88 }] },
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [{ id: 'london', name: 'London', risk: 0.82 }] },
    ]},
    Liquidity_Freeze: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'frankfurt', name: 'Frankfurt', risk: 0.88 }] },
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [{ id: 'milan', name: 'Milan', risk: 0.85 }] },
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'paris', name: 'Paris', risk: 0.78 }] },
    ]},
    Asset_Price_Collapse: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'newyork', name: 'New York', risk: 0.85, cesiumId: 75343 }] },
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [{ id: 'london', name: 'London', risk: 0.80 }] },
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [{ id: 'tokyo', name: 'Tokyo', risk: 0.75, cesiumId: 2602291 }] },
    ]},
    IMF_Systemic: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'newyork', name: 'New York', risk: 0.92, cesiumId: 75343 }] },
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [{ id: 'zurich', name: 'Zurich', risk: 0.85 }] },
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [{ id: 'london', name: 'London', risk: 0.88 }] },
    ]},
    NGFS_SSP5_2050: { countries: [
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [{ id: 'dhaka', name: 'Dhaka', risk: 0.92 }] },
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [{ id: 'rotterdam', name: 'Rotterdam', risk: 0.85 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'miami', name: 'Miami', risk: 0.88 }] },
    ]},
    NGFS_SSP2_2040: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'berlin', name: 'Berlin', risk: 0.62 }] },
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'paris', name: 'Paris', risk: 0.58 }] },
    ]},
    Flood_Extreme_100y: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'cologne', name: 'Cologne', risk: 0.90 }, { id: 'bonn', name: 'Bonn', risk: 0.88 }] },
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [{ id: 'rotterdam', name: 'Rotterdam', risk: 0.85 }] },
    ]},
    Heat_Stress_Energy: { countries: [
      { id: 'es', name: 'Spain', flag: '🇪🇸', cities: [{ id: 'madrid', name: 'Madrid', risk: 0.82 }] },
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [{ id: 'rome', name: 'Rome', risk: 0.78 }] },
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'marseille', name: 'Marseille', risk: 0.80 }] },
    ]},
    Sea_Level_Coastal: { countries: [
      { id: 'nl', name: 'Netherlands', flag: '🇳🇱', cities: [{ id: 'amsterdam', name: 'Amsterdam', risk: 0.80 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'miami', name: 'Miami', risk: 0.85 }] },
      { id: 'bd', name: 'Bangladesh', flag: '🇧🇩', cities: [{ id: 'chittagong', name: 'Chittagong', risk: 0.88 }] },
    ]},
    Wildfire_Insurance: { countries: [
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'losangeles', name: 'Los Angeles', risk: 0.82 }] },
      { id: 'au', name: 'Australia', flag: '🇦🇺', cities: [{ id: 'sydney', name: 'Sydney', risk: 0.78, cesiumId: 2644092 }] },
    ]},
    Sanctions_Escalation: { countries: [
      { id: 'ru', name: 'Russia', flag: '🇷🇺', cities: [{ id: 'moscow', name: 'Moscow', risk: 0.88 }] },
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'frankfurt', name: 'Frankfurt', risk: 0.58 }] },
    ]},
    Trade_War_Supply_Chain: { countries: [
      { id: 'cn', name: 'China', flag: '🇨🇳', cities: [{ id: 'shanghai', name: 'Shanghai', risk: 0.78 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'losangeles', name: 'Los Angeles', risk: 0.72 }] },
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'hamburg', name: 'Hamburg', risk: 0.68 }] },
    ]},
    Energy_Shock: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'berlin', name: 'Berlin', risk: 0.78 }] },
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [{ id: 'milan', name: 'Milan', risk: 0.72 }] },
    ]},
    Regional_Conflict_Spillover: { countries: [
      { id: 'ua', name: 'Ukraine', flag: '🇺🇦', cities: [{ id: 'kyiv', name: 'Kyiv', risk: 0.95 }] },
      { id: 'pl', name: 'Poland', flag: '🇵🇱', cities: [{ id: 'warsaw', name: 'Warsaw', risk: 0.62 }] },
    ]},
    COVID19_Replay: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [{ id: 'newyork', name: 'New York', risk: 0.82, cesiumId: 75343 }, { id: 'london', name: 'London', risk: 0.78 }] },
    ]},
    Pandemic_X: { countries: [
      { id: 'global', name: 'Global', flag: '🌍', cities: [{ id: 'newyork', name: 'New York', risk: 0.85, cesiumId: 75343 }, { id: 'tokyo', name: 'Tokyo', risk: 0.80, cesiumId: 2602291 }] },
    ]},
    Sovereign_Debt_Crisis: { countries: [
      { id: 'it', name: 'Italy', flag: '🇮🇹', cities: [{ id: 'rome', name: 'Rome', risk: 0.82 }] },
      { id: 'gr', name: 'Greece', flag: '🇬🇷', cities: [{ id: 'athens', name: 'Athens', risk: 0.78 }] },
      { id: 'jp', name: 'Japan', flag: '🇯🇵', cities: [{ id: 'tokyo', name: 'Tokyo', risk: 0.72, cesiumId: 2602291 }] },
    ]},
    Currency_Devaluation: { countries: [
      { id: 'tr', name: 'Turkey', flag: '🇹🇷', cities: [{ id: 'istanbul', name: 'Istanbul', risk: 0.78 }] },
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [{ id: 'buenosaires', name: 'Buenos Aires', risk: 0.82 }] },
    ]},
    Government_Default: { countries: [
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [{ id: 'buenosaires', name: 'Buenos Aires', risk: 0.85 }] },
      { id: 'eg', name: 'Egypt', flag: '🇪🇬', cities: [{ id: 'cairo', name: 'Cairo', risk: 0.72 }] },
    ]},
    Sudden_Capital_Increase: { countries: [
      { id: 'ch', name: 'Switzerland', flag: '🇨🇭', cities: [{ id: 'zurich', name: 'Zurich', risk: 0.68 }] },
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'frankfurt', name: 'Frankfurt', risk: 0.65 }] },
    ]},
    Climate_Disclosure_Enforcement: { countries: [
      { id: 'eu', name: 'European Union', flag: '🇪🇺', cities: [{ id: 'brussels', name: 'Brussels', risk: 0.58 }] },
      { id: 'uk', name: 'United Kingdom', flag: '🇬🇧', cities: [{ id: 'london', name: 'London', risk: 0.55 }] },
    ]},
    Resolution_Regime_Activation: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'frankfurt', name: 'Frankfurt', risk: 0.88 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'newyork', name: 'New York', risk: 0.82, cesiumId: 75343 }] },
    ]},
    Urban_Riots_Asset_Damage: { countries: [
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'paris', name: 'Paris', risk: 0.75 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'losangeles', name: 'Los Angeles', risk: 0.68 }] },
    ]},
    Infrastructure_Sabotage: { countries: [
      { id: 'de', name: 'Germany', flag: '🇩🇪', cities: [{ id: 'berlin', name: 'Berlin', risk: 0.78 }] },
      { id: 'us', name: 'United States', flag: '🇺🇸', cities: [{ id: 'washington', name: 'Washington DC', risk: 0.72 }] },
    ]},
    Prolonged_Social_Instability: { countries: [
      { id: 'fr', name: 'France', flag: '🇫🇷', cities: [{ id: 'paris', name: 'Paris', risk: 0.68 }] },
      { id: 'ar', name: 'Argentina', flag: '🇦🇷', cities: [{ id: 'buenosaires', name: 'Buenos Aires', risk: 0.72 }] },
    ]},
  }
  
  // Current / Forecast scenario catalogs live in ../lib/riskEventCatalog.ts
  
  // Event categories = currentEvents (used directly in JSX)
  
  // Category icon component
  const CategoryIcon = ({ id }: { id: string }) => {
    const iconClass = "w-3.5 h-3.5 text-zinc-500"
    switch (id) {
      case 'climate':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 15a4 4 0 004 4h9a5 5 0 10-.1-9.999 5.002 5.002 0 10-9.78 2.096A4.001 4.001 0 003 15z" /></svg>
      case 'geopolitical':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
      case 'financial':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
      case 'pandemic':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
      case 'civil_unrest':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
      case 'supply':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" /></svg>
      case 'regulatory':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
      case 'technology':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
      case 'energy':
        return <svg className={iconClass} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
      default:
        return <div className="w-3.5 h-3.5 rounded-full bg-zinc-500" />
    }
  }
  
  // Reset submenu when collapsed
  useEffect(() => {
    if (!isExpanded) {
      setViewMode('menu')
      setSelectedCategory(null)
      setSelectedHorizon(null)
      setSelectedEventId(null)
      setSelectedCountry(null)
      setSelectedCity(null)
    }
  }, [isExpanded])
  
  const displayCount = countOverride ?? zones.length
  if (zones.length === 0 && !(countOverride && countOverride > 0)) return null

  return (
    <div className="relative">
      {/* Main row - clickable */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md transition-all min-w-0 ${colors.hover} ${isExpanded ? 'bg-zinc-800' : ''}`}
      >
        {/* Count - use API when available (refreshed every 5 min) */}
        <span className={`${colors.text} text-lg font-light min-w-[20px] shrink-0`}>
          {displayCount}
        </span>
        
        {/* Label */}
        <span className="text-zinc-500 text-xs flex-1 text-left min-w-0 truncate">
          {label}
        </span>
        
        {/* Expand icon */}
        <svg 
          className={`w-3 h-3 text-zinc-600 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
          fill="none" 
          stroke="currentColor" 
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown menu */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className={`mt-1 ml-2 border-l-2 ${colors.border} pl-2`}>
              
              {/* ===== MAIN MENU (3 options) ===== */}
              {viewMode === 'menu' && (
                <div className="space-y-1 py-1">
                  {/* Option 0: Zones */}
                  <button
                    onClick={() => setViewMode('zones')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                  >
                    <LinkIcon className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" />
                    <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">Zones</span>
                    <span className="text-zinc-600 text-[10px]">{displayCount}</span>
                  </button>

                  {/* Option 1: Historical */}
                  <button
                    onClick={() => setViewMode('historical')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">Historical Events</span>
                    <span className="text-zinc-600 text-[10px]">1970+</span>
                  </button>
                  
                  {/* Option 2: Current */}
                  <button
                    onClick={() => setViewMode('current')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">Current Events</span>
                    <span className="text-zinc-600 text-[10px]">0-1yr</span>
                  </button>
                  
                  {/* Option 3: Forecast */}
                  <button
                    onClick={() => setViewMode('forecast')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">Forecast</span>
                    <span className="text-zinc-600 text-[10px]">5-30yr</span>
                  </button>
                </div>
              )}

              {/* ===== ZONES SUBMENU ===== */}
              {viewMode === 'zones' && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Zones ({label})
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1 space-y-1">
                    {zones
                      .slice()
                      .sort((a, b) => b.risk - a.risk)
                      .map((z) => (
                        <div
                          key={z.id}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all group"
                        >
                          <button
                            onClick={() => _onZoneClick(z.id)}
                            className="flex-1 min-w-0 text-left"
                            title="Focus zone"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-zinc-300 text-xs group-hover:text-zinc-100 truncate">
                                {z.name}
                              </span>
                              <span className="text-zinc-600 text-[10px] flex-shrink-0">
                                {(z.risk * 100).toFixed(0)}%
                              </span>
                            </div>
                          </button>
                          <button
                            onClick={() => (onZoneLinksClick ? onZoneLinksClick(z.id) : _onZoneClick(z.id))}
                            className="p-1.5 rounded border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors flex-shrink-0"
                            title="Show dependency links for this zone"
                          >
                            <LinkIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}
              
              {/* ===== HISTORICAL SUBMENU ===== */}
              {viewMode === 'historical' && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Historical Events (1970-Present)
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {historicalEvents.map((event) => (
                      <button
                        key={event.id}
                        onClick={() => {
                          onHistoricalSelect?.(event.id)
                          // Historical events open report, not 3D view
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {event.name}
                        </span>
                        <span className="text-zinc-600 text-[10px]">{event.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* ===== CURRENT SUBMENU ===== */}
              {viewMode === 'current' && !selectedCategory && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Current Event Categories
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {currentEvents.map((cat) => (
                      <button
                        key={cat.id}
                        onClick={() => setSelectedCategory(cat.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <CategoryIcon id={cat.id} />
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {cat.name}
                        </span>
                        <span className="text-zinc-600 text-[10px]">{cat.events.length}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* CURRENT - Events list after category selected */}
              {viewMode === 'current' && selectedCategory && !selectedEventId && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to categories
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    {currentEvents.find(c => c.id === selectedCategory)?.name || 'Events'}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(currentEvents.find(c => c.id === selectedCategory)?.events ?? []).map((event) => (
                      <button
                        key={event.id}
                        onClick={() => setSelectedEventId(event.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {event.name}
                        </span>
                        <span className={`text-[10px] font-mono ${event.risk > 0.7 ? 'text-red-300' : event.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'}`}>
                          {(event.risk * 100).toFixed(0)}%
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* CURRENT - Countries list after event selected */}
              {viewMode === 'current' && selectedEventId && !selectedCountry && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to events
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Affected Countries
                  </div>
                  {(affectedRegions[selectedEventId]?.countries || []).map((country) => (
                    <button
                      key={country.id}
                      onClick={() => setSelectedCountry(country.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                    >
                      <span className="text-sm">{country.flag}</span>
                      <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                        {country.name}
                      </span>
                      <span className="text-zinc-600 text-[10px]">{country.cities.length} cities</span>
                    </button>
                  ))}
                  {!affectedRegions[selectedEventId] && (
                    <div className="text-zinc-600 text-xs px-2 py-2">
                      Region data loading...
                    </div>
                  )}
                </div>
              )}
              
              {/* CURRENT - Cities list after country selected */}
              {viewMode === 'current' && selectedEventId && selectedCountry && !selectedCity && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to countries
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.name || 'Cities'}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.cities ?? []).map((city) => {
                      const eventInfo = currentEvents.flatMap(c => c.events).find(e => e.id === selectedEventId)
                      const categoryInfo = currentEvents.find(c => c.events.some(e => e.id === selectedEventId))
                      return (
                      <button
                        key={city.id}
                        onClick={() => {
                          // IMMEDIATELY open Digital Twin when city is clicked
                          setSelectedCity(city)
                          onOpenDigitalTwin?.(
                            city.id, 
                            city.name, 
                            selectedEventId,
                            eventInfo?.name,
                            categoryInfo?.id,
                            'current'
                          )
                          console.log('City clicked:', city.name, '- Opening Digital Twin for event:', eventInfo?.name)
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {city.name}
                        </span>
                        <span className={`text-[10px] font-mono ${city.risk > 0.7 ? 'text-red-300' : city.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'}`}>
                          {(city.risk * 100).toFixed(0)}%
                        </span>
                      </button>
                    )})}
                  </div>
                </div>
              )}
              
              {/* CURRENT - City selected - Digital Twin is open */}
              {viewMode === 'current' && selectedEventId && selectedCountry && selectedCity && (
                <div className="space-y-2 py-1">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to cities
                  </button>
                  
                  {/* Selected city info - Digital Twin is open */}
                  <div className="px-2 py-2 bg-zinc-800 rounded-md border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                      <span className="text-zinc-200 text-sm font-medium">{selectedCity.name}</span>
                    </div>
                    <div className="text-zinc-500 text-[10px] mb-1">
                      Event: {currentEvents.flatMap(c => c.events).find(e => e.id === selectedEventId)?.name || selectedEventId}
                    </div>
                    <div className="text-zinc-500 text-[10px]">
                      Digital Twin is open. Click "Run Stress Test" button on the 3D view to analyze risk zones.
                    </div>
                  </div>
                </div>
              )}
              
              {/* ===== FORECAST SUBMENU ===== */}
              {viewMode === 'forecast' && !selectedHorizon && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Forecast Horizon
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {forecastScenarios.map((period) => (
                      <button
                        key={period.horizon}
                        onClick={() => setSelectedHorizon(period.horizon)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <svg className="w-3.5 h-3.5 text-zinc-500 group-hover:text-zinc-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                        </svg>
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {period.name}
                        </span>
                        <span className="text-zinc-600 text-[10px]">{period.scenarios.length} scenarios</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* FORECAST - Scenarios list after horizon selected */}
              {viewMode === 'forecast' && selectedHorizon && !selectedEventId && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedHorizon(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to horizons
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    {forecastScenarios.find(f => f.horizon === selectedHorizon)?.name || `${selectedHorizon}yr Scenarios`}
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(forecastScenarios.find(f => f.horizon === selectedHorizon)?.scenarios ?? []).map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => setSelectedEventId(scenario.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {scenario.name}
                        </span>
                        <span className={`text-[10px] font-mono ${scenario.risk > 0.7 ? 'text-red-300' : scenario.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'}`}>
                          {(scenario.risk * 100).toFixed(0)}%
                        </span>
                        <span className="text-zinc-600 text-[9px] ml-1">{scenario.type}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* FORECAST - Countries list after scenario selected */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && !selectedCountry && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to scenarios
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    Affected Countries
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(affectedRegions[selectedEventId]?.countries || []).map((country) => (
                      <button
                        key={country.id}
                        onClick={() => setSelectedCountry(country.id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-sm">{country.flag}</span>
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {country.name}
                        </span>
                        <span className="text-zinc-600 text-[10px]">{country.cities.length} cities</span>
                      </button>
                    ))}
                    {!affectedRegions[selectedEventId] && (
                      <div className="text-zinc-600 text-xs px-2 py-2">
                        Region data for forecast...
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              {/* FORECAST - Cities list after country selected */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && selectedCountry && !selectedCity && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to countries
                  </button>
                  <div className="font-mono text-[10px] px-2 py-1 uppercase tracking-widest text-zinc-500">
                    {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.name || 'Cities'} - {selectedHorizon}yr
                  </div>
                  <div className="max-h-[300px] overflow-y-auto custom-scrollbar pr-1">
                    {(affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.cities ?? []).map((city) => {
                      // Find scenario name from forecastScenarios
                      const scenarioInfo = forecastScenarios.flatMap(h => h.scenarios).find(s => s.id === selectedEventId)
                      return (
                      <button
                        key={city.id}
                        onClick={() => {
                          // IMMEDIATELY open Digital Twin when city is clicked
                          setSelectedCity(city)
                          onOpenDigitalTwin?.(
                            city.id, 
                            city.name, 
                            selectedEventId,
                            scenarioInfo?.name,
                            scenarioInfo?.type,
                            selectedHorizon ? `${selectedHorizon}yr` : undefined
                          )
                          console.log('City clicked:', city.name, '- Opening Digital Twin for forecast:', scenarioInfo?.name, selectedHorizon + 'yr')
                        }}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-zinc-800 transition-all text-left group"
                      >
                        <span className="text-zinc-300 text-xs group-hover:text-zinc-100 flex-1">
                          {city.name}
                        </span>
                        <span className={`text-[10px] font-mono ${city.risk > 0.7 ? 'text-red-300' : city.risk > 0.5 ? 'text-orange-300' : 'text-amber-300'}`}>
                          {(city.risk * 100).toFixed(0)}%
                        </span>
                      </button>
                    )})}
                  </div>
                </div>
              )}
              
              {/* FORECAST - City selected - Digital Twin is open */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && selectedCountry && selectedCity && (
                <div className="space-y-2 py-1">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-zinc-500 text-[10px] hover:text-zinc-400"
                  >
                    ← Back to cities
                  </button>
                  
                  {/* Selected city info - Digital Twin is open */}
                  <div className="px-2 py-2 bg-zinc-800 rounded-md border border-zinc-700">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-zinc-500 animate-pulse" />
                      <span className="text-zinc-200 text-sm font-medium">{selectedCity.name}</span>
                    </div>
                    <div className="text-zinc-500 text-[10px] mb-1">
                      Scenario: {forecastScenarios.flatMap(h => h.scenarios).find(s => s.id === selectedEventId)?.name || selectedEventId}
                    </div>
                    <div className="text-zinc-500 text-[10px] mb-1">
                      Horizon: {selectedHorizon} years
                    </div>
                    <div className="text-zinc-500 text-[10px]">
                      Digital Twin is open. Click "Run Stress Test" button on the 3D view to analyze risk zones.
                    </div>
                  </div>
                </div>
              )}
              
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

// ============================================
// ENTRY ANIMATION COMPONENT
// ============================================

function EntryAnimation({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'init' | 'loading' | 'entering' | 'done'>('init')
  
  useEffect(() => {
    // Phase 1: Initial black screen
    const t1 = setTimeout(() => setPhase('loading'), 300)
    // Phase 2: Loading animation
    const t2 = setTimeout(() => setPhase('entering'), 2000)
    // Phase 3: Fade out
    const t3 = setTimeout(() => {
      setPhase('done')
      onComplete()
    }, 3500)
    
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
      clearTimeout(t3)
    }
  }, [onComplete])
  
  if (phase === 'done') return null
  
  return (
    <motion.div
      className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: '#09090b' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'entering' ? 0 : 1 }}
      transition={{ duration: 1.5 }}
    >
      <div className="text-center">
        {/* Logo */}
        <motion.div
          className="w-24 h-24 mx-auto mb-8 rounded-md bg-zinc-800 border border-zinc-700 flex items-center justify-center"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ 
            scale: phase === 'loading' ? [1, 1.1, 1] : 1,
            opacity: 1,
          }}
          transition={{ 
            scale: { duration: 2, repeat: Infinity, ease: 'easeInOut' },
            opacity: { duration: 0.5 }
          }}
        >
          <CubeTransparentIcon className="w-12 h-12 text-zinc-500" />
        </motion.div>
        
        {/* Title */}
        <motion.h1
          className="text-zinc-100 text-2xl font-light mb-2 tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Global Risk Command Center
        </motion.h1>
        
        <motion.p
          className="text-zinc-500 text-sm mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
        >
          Physical-Financial Risk Platform
        </motion.p>
        
        {/* Loading indicator */}
        <motion.div
          className="flex justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {phase === 'loading' && (
            <>
              <motion.div
                className="font-mono text-[10px] uppercase tracking-widest text-zinc-500"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Initializing Global View
              </motion.div>
            </>
          )}
          {phase === 'entering' && (
            <motion.div
              className="font-mono text-[10px] uppercase tracking-widest text-zinc-500"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              Entering System
            </motion.div>
          )}
        </motion.div>
        
        {/* Progress dots */}
        <motion.div
          className="flex justify-center gap-1.5 mt-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
        >
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-zinc-500"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-zinc-950/50" />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, #09090b 70%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'entering' ? 0 : 0.5 }}
        />
      </div>
    </motion.div>
  )
}

// Map climate zone display names (from globe) to cityId for Digital Twin
const CLIMATE_CITY_DISPLAY_TO_ID: Record<string, string> = {
  // Americas
  'New York': 'newyork',
  'New Orleans': 'neworleans',
  'Los Angeles': 'losangeles',
  'San Francisco': 'sanfrancisco',
  'Washington DC': 'washington',
  'Washington': 'washington',
  'Miami': 'miami',
  'Houston': 'houston',
  'Phoenix': 'phoenix',
  'Honolulu': 'honolulu',
  'Mexico City': 'mexicocity',
  'São Paulo': 'saopaulo',
  'Rio de Janeiro': 'riodejaneiro',
  'Buenos Aires': 'buenosaires',
  'Lima': 'lima',
  'La Paz': 'lapaz',
  'Ottawa': 'ottawa',
  'Toronto': 'toronto',
  'Vancouver': 'vancouver',
  'Montreal': 'montreal',
  // Europe
  'London': 'london',
  'Paris': 'paris',
  'Berlin': 'berlin',
  'Frankfurt': 'frankfurt',
  'Munich': 'munich',
  'Amsterdam': 'amsterdam',
  'Rotterdam': 'rotterdam',
  'Brussels': 'brussels',
  'Cologne': 'cologne',
  'Rome': 'rome',
  'Milan': 'milan',
  'Madrid': 'madrid',
  'Barcelona': 'barcelona',
  'Moscow': 'moscow',
  'Warsaw': 'warsaw',
  'Vienna': 'vienna',
  'Copenhagen': 'copenhagen',
  'Zurich': 'zurich',
  'Geneva': 'geneva',
  // Asia
  'Tokyo': 'tokyo',
  'Hong Kong': 'hongkong',
  'Shanghai': 'shanghai',
  'Beijing': 'beijing',
  'Seoul': 'seoul',
  'Taipei': 'taipei',
  'Singapore': 'singapore',
  'Bangkok': 'bangkok',
  'Jakarta': 'jakarta',
  'Manila': 'manila',
  'Ho Chi Minh': 'hochiminh',
  'Mumbai': 'mumbai',
  'Delhi': 'delhi',
  'Karachi': 'karachi',
  'Dhaka': 'dhaka',
  'Dubai': 'dubai',
  'Tehran': 'tehran',
  'Baghdad': 'baghdad',
  'Kabul': 'kabul',
  'Sanaa': 'sanaa',
  'Jerusalem': 'jerusalem',
  'Tel Aviv': 'telaviv',
  'Istanbul': 'istanbul',
  'Guangzhou': 'guangzhou',
  // Africa
  'Cairo': 'cairo',
  'Lagos': 'lagos',
  'Johannesburg': 'johannesburg',
  'Cape Town': 'capetown',
  'Nairobi': 'nairobi',
  'Khartoum': 'khartoum',
  'Lusaka': 'lusaka',
  'Tripoli': 'tripoli',
  // Oceania
  'Sydney': 'sydney',
  'Melbourne': 'melbourne',
  'Brisbane': 'brisbane',
  'Canberra': 'canberra',
  'Auckland': 'auckland',
}

// ============================================
// CITY COORDINATES DATABASE FOR DIGITAL TWIN
// ============================================
const CITY_COORDINATES: Record<string, { lat: number; lng: number; exposure?: number; risk?: number }> = {
  // Major cities with coordinates for Digital Twin
  newyork: { lat: 40.7128, lng: -74.0060, exposure: 82, risk: 0.75 },
  tokyo: { lat: 35.6762, lng: 139.6503, exposure: 94, risk: 0.92 },
  london: { lat: 51.5074, lng: -0.1278, exposure: 58, risk: 0.68 },
  paris: { lat: 48.8566, lng: 2.3522, exposure: 52, risk: 0.62 },
  frankfurt: { lat: 50.1109, lng: 8.6821, exposure: 28, risk: 0.58 },
  berlin: { lat: 52.5200, lng: 13.4050, exposure: 38, risk: 0.55 },
  munich: { lat: 48.1351, lng: 11.5820, exposure: 26, risk: 0.52 },
  sydney: { lat: -33.8688, lng: 151.2093, exposure: 38, risk: 0.52 },
  melbourne: { lat: -37.8136, lng: 144.9631, exposure: 36, risk: 0.58 },
  boston: { lat: 42.3601, lng: -71.0589, exposure: 34, risk: 0.62 },
  chicago: { lat: 41.8781, lng: -87.6298, exposure: 42, risk: 0.65 },
  losangeles: { lat: 34.0522, lng: -118.2437, exposure: 68, risk: 0.72 },
  sanfrancisco: { lat: 37.7749, lng: -122.4194, exposure: 52, risk: 0.78 },
  shanghai: { lat: 31.2304, lng: 121.4737, exposure: 68, risk: 0.82 },
  beijing: { lat: 39.9042, lng: 116.4074, exposure: 58, risk: 0.78 },
  hongkong: { lat: 22.3193, lng: 114.1694, exposure: 48, risk: 0.75 },
  singapore: { lat: 1.3521, lng: 103.8198, exposure: 42, risk: 0.62 },
  dubai: { lat: 25.2048, lng: 55.2708, exposure: 38, risk: 0.68 },
  mumbai: { lat: 19.0760, lng: 72.8777, exposure: 48, risk: 0.82 },
  delhi: { lat: 28.6139, lng: 77.2090, exposure: 42, risk: 0.78 },
  seoul: { lat: 37.5665, lng: 126.9780, exposure: 52, risk: 0.72 },
  taipei: { lat: 25.0330, lng: 121.5654, exposure: 28, risk: 0.78 },
  moscow: { lat: 55.7558, lng: 37.6173, exposure: 52, risk: 0.72 },
  kyiv: { lat: 50.4501, lng: 30.5234, exposure: 12.5, risk: 0.95 },
  warsaw: { lat: 52.2297, lng: 21.0122, exposure: 18.5, risk: 0.55 },
  amsterdam: { lat: 52.3676, lng: 4.9041, exposure: 28.5, risk: 0.62 },
  rotterdam: { lat: 51.9244, lng: 4.4777, exposure: 22.8, risk: 0.68 },
  zurich: { lat: 47.3769, lng: 8.5417, exposure: 42.5, risk: 0.45 },
  geneva: { lat: 46.2044, lng: 6.1432, exposure: 35.8, risk: 0.42 },
  rome: { lat: 41.9028, lng: 12.4964, exposure: 22.5, risk: 0.58 },
  milan: { lat: 45.4642, lng: 9.1900, exposure: 32.5, risk: 0.62 },
  madrid: { lat: 40.4168, lng: -3.7038, exposure: 25.8, risk: 0.65 },
  barcelona: { lat: 41.3851, lng: 2.1734, exposure: 22.5, risk: 0.62 },
  saopaulo: { lat: -23.5505, lng: -46.6333, exposure: 38.5, risk: 0.72 },
  riodejaneiro: { lat: -22.9068, lng: -43.1729, exposure: 28.5, risk: 0.68 },
  mexicocity: { lat: 19.4326, lng: -99.1332, exposure: 32.5, risk: 0.72 },
  cairo: { lat: 30.0444, lng: 31.2357, exposure: 18.5, risk: 0.68 },
  lagos: { lat: 6.5244, lng: 3.3792, exposure: 15.8, risk: 0.78 },
  johannesburg: { lat: -26.2041, lng: 28.0473, exposure: 22.5, risk: 0.65 },
  capetown: { lat: -33.9249, lng: 18.4241, exposure: 18.5, risk: 0.58 },
  tehran: { lat: 35.6892, lng: 51.3890, exposure: 22.8, risk: 0.82 },
  istanbul: { lat: 41.0082, lng: 28.9784, exposure: 28.5, risk: 0.72 },
  telaviv: { lat: 32.0853, lng: 34.7818, exposure: 35.2, risk: 0.85 },
  washington: { lat: 38.9072, lng: -77.0369, exposure: 42.1, risk: 0.48 },
  miami: { lat: 25.7617, lng: -80.1918, exposure: 32.5, risk: 0.78 },
  houston: { lat: 29.7604, lng: -95.3698, exposure: 28.5, risk: 0.72 },
  denver: { lat: 39.7392, lng: -104.9903, exposure: 18.9, risk: 0.45 },
  seattle: { lat: 47.6062, lng: -122.3321, exposure: 28.5, risk: 0.58 },
  vancouver: { lat: 49.2827, lng: -123.1207, exposure: 22.5, risk: 0.52 },
  toronto: { lat: 43.6532, lng: -79.3832, exposure: 32.5, risk: 0.55 },
  montreal: { lat: 45.5017, lng: -73.5673, exposure: 22.4, risk: 0.55 },
  bangkok: { lat: 13.7563, lng: 100.5018, exposure: 28.5, risk: 0.72 },
  jakarta: { lat: -6.2088, lng: 106.8456, exposure: 32.5, risk: 0.82 },
  manila: { lat: 14.5995, lng: 120.9842, exposure: 22.5, risk: 0.75 },
  hochiminh: { lat: 10.8231, lng: 106.6297, exposure: 18.5, risk: 0.72 },
  hanoi: { lat: 21.0285, lng: 105.8542, exposure: 15.8, risk: 0.68 },
  dhaka: { lat: 23.8103, lng: 90.4125, exposure: 12.5, risk: 0.88 },
  karachi: { lat: 24.8607, lng: 67.0011, exposure: 18.5, risk: 0.75 },
  cologne: { lat: 50.9375, lng: 6.9603, exposure: 22.5, risk: 0.72 },
  dusseldorf: { lat: 51.2277, lng: 6.7735, exposure: 18.5, risk: 0.68 },
  athens: { lat: 37.9838, lng: 23.7275, exposure: 15.8, risk: 0.62 },
  brussels: { lat: 50.8503, lng: 4.3517, exposure: 28.5, risk: 0.55 },
  vienna: { lat: 48.2082, lng: 16.3738, exposure: 22.5, risk: 0.52 },
  stockholm: { lat: 59.3293, lng: 18.0686, exposure: 25.8, risk: 0.48 },
  oslo: { lat: 59.9139, lng: 10.7522, exposure: 22.5, risk: 0.45 },
  helsinki: { lat: 60.1699, lng: 24.9384, exposure: 18.5, risk: 0.52 },
  copenhagen: { lat: 55.6761, lng: 12.5683, exposure: 22.5, risk: 0.48 },
  dublin: { lat: 53.3498, lng: -6.2603, exposure: 28.5, risk: 0.52 },
  lisbon: { lat: 38.7223, lng: -9.1393, exposure: 18.5, risk: 0.55 },
  lyon: { lat: 45.7640, lng: 4.8357, exposure: 18.5, risk: 0.58 },
  marseille: { lat: 43.2965, lng: 5.3698, exposure: 15.8, risk: 0.62 },
  // Conflict zones (2024-2025)
  damascus: { lat: 33.5138, lng: 36.2765, exposure: 5.2, risk: 0.98 },
  aleppo: { lat: 36.2021, lng: 37.1343, exposure: 3.5, risk: 0.98 },
  caracas: { lat: 10.4806, lng: -66.9036, exposure: 8.5, risk: 0.95 },
  sanaa: { lat: 15.3694, lng: 44.1910, exposure: 2.5, risk: 0.98 },
  khartoum: { lat: 15.5007, lng: 32.5599, exposure: 4.2, risk: 0.95 },
  tripoli: { lat: 32.8872, lng: 13.1913, exposure: 6.5, risk: 0.88 },
  kabul: { lat: 34.5553, lng: 69.2075, exposure: 3.8, risk: 0.95 },
  minsk: { lat: 53.9006, lng: 27.5590, exposure: 12.5, risk: 0.82 },
  pyongyang: { lat: 39.0392, lng: 125.7625, exposure: 0.5, risk: 0.95 },
  donetskluhansk: { lat: 48.0159, lng: 37.8028, exposure: 5.2, risk: 0.98 },
  kharkiv: { lat: 49.9935, lng: 36.2304, exposure: 8.5, risk: 0.95 },
  odesa: { lat: 46.4825, lng: 30.7233, exposure: 10.5, risk: 0.88 },
  gaza: { lat: 31.5017, lng: 34.4668, exposure: 2.0, risk: 0.99 },
  riyadh: { lat: 24.7136, lng: 46.6753, exposure: 28.5, risk: 0.55 },
  beirut: { lat: 33.8938, lng: 35.5018, exposure: 12.5, risk: 0.75 },
  kolkata: { lat: 22.5726, lng: 88.3639, exposure: 18.5, risk: 0.68 },
  buenosaires: { lat: -34.6037, lng: -58.3816, exposure: 28.5, risk: 0.82 },
  // Additional European cities
  prague: { lat: 50.0755, lng: 14.4378, exposure: 22.5, risk: 0.52 },
  budapest: { lat: 47.4979, lng: 19.0402, exposure: 18.5, risk: 0.55 },
  krakow: { lat: 50.0647, lng: 19.9450, exposure: 12.5, risk: 0.48 },
  bucharest: { lat: 44.4268, lng: 26.1025, exposure: 15.8, risk: 0.62 },
  sofia: { lat: 42.6977, lng: 23.3219, exposure: 12.5, risk: 0.58 },
  tallinn: { lat: 59.4370, lng: 24.7536, exposure: 15.8, risk: 0.45 },
  riga: { lat: 56.9496, lng: 24.1052, exposure: 12.5, risk: 0.48 },
  vilnius: { lat: 54.6872, lng: 25.2797, exposure: 10.5, risk: 0.52 },
  luxembourg: { lat: 49.6116, lng: 6.1319, exposure: 38.5, risk: 0.42 },
  edinburgh: { lat: 55.9533, lng: -3.1883, exposure: 18.5, risk: 0.48 },
  glasgow: { lat: 55.8642, lng: -4.2518, exposure: 15.8, risk: 0.52 },
  manchester: { lat: 53.4808, lng: -2.2426, exposure: 22.5, risk: 0.55 },
  birmingham: { lat: 52.4862, lng: -1.8904, exposure: 18.5, risk: 0.52 },
  naples: { lat: 40.8518, lng: 14.2681, exposure: 15.8, risk: 0.68 },
  turin: { lat: 45.0703, lng: 7.6869, exposure: 18.5, risk: 0.55 },
  valencia: { lat: 39.4699, lng: -0.3763, exposure: 15.8, risk: 0.58 },
  seville: { lat: 37.3891, lng: -5.9845, exposure: 12.5, risk: 0.62 },
  porto: { lat: 41.1579, lng: -8.6291, exposure: 12.5, risk: 0.52 },
  // Additional Asian cities
  bangalore: { lat: 12.9716, lng: 77.5946, exposure: 28.5, risk: 0.65 },
  hyderabad: { lat: 17.3850, lng: 78.4867, exposure: 22.5, risk: 0.68 },
  chennai: { lat: 13.0827, lng: 80.2707, exposure: 22.5, risk: 0.72 },
  pune: { lat: 18.5204, lng: 73.8567, exposure: 18.5, risk: 0.62 },
  ahmedabad: { lat: 23.0225, lng: 72.5714, exposure: 15.8, risk: 0.68 },
  guangzhou: { lat: 23.1291, lng: 113.2644, exposure: 42.5, risk: 0.78 },
  shenzhen: { lat: 22.5431, lng: 114.0579, exposure: 48.5, risk: 0.75 },
  chengdu: { lat: 30.5728, lng: 104.0668, exposure: 28.5, risk: 0.72 },
  wuhan: { lat: 30.5928, lng: 114.3055, exposure: 32.5, risk: 0.75 },
  tianjin: { lat: 39.3434, lng: 117.3616, exposure: 35.2, risk: 0.72 },
  osaka: { lat: 34.6937, lng: 135.5023, exposure: 38.5, risk: 0.85 },
  nagoya: { lat: 35.1815, lng: 136.9066, exposure: 28.5, risk: 0.78 },
  fukuoka: { lat: 33.5904, lng: 130.4017, exposure: 22.5, risk: 0.72 },
  busan: { lat: 35.1796, lng: 129.0756, exposure: 25.8, risk: 0.68 },
  kualalumpur: { lat: 3.1390, lng: 101.6869, exposure: 28.5, risk: 0.62 },
  // Middle East expansion
  doha: { lat: 25.2854, lng: 51.5310, exposure: 32.5, risk: 0.58 },
  abudhabi: { lat: 24.4539, lng: 54.3773, exposure: 28.5, risk: 0.62 },
  kuwait: { lat: 29.3759, lng: 47.9774, exposure: 22.5, risk: 0.68 },
  amman: { lat: 31.9454, lng: 35.9284, exposure: 12.5, risk: 0.72 },
  baku: { lat: 40.4093, lng: 49.8671, exposure: 18.5, risk: 0.75 },
  tbilisi: { lat: 41.7151, lng: 44.8271, exposure: 10.5, risk: 0.68 },
  yerevan: { lat: 40.1792, lng: 44.4991, exposure: 8.5, risk: 0.72 },
  muscat: { lat: 23.5880, lng: 58.3829, exposure: 15.8, risk: 0.58 },
  manama: { lat: 26.2285, lng: 50.5860, exposure: 18.5, risk: 0.62 },
  // Latin America expansion
  lima: { lat: -12.0464, lng: -77.0428, exposure: 22.5, risk: 0.75 },
  bogota: { lat: 4.7110, lng: -74.0721, exposure: 18.5, risk: 0.78 },
  santiago: { lat: -33.4489, lng: -70.6693, exposure: 28.5, risk: 0.68 },
  montevideo: { lat: -34.9011, lng: -56.1645, exposure: 15.8, risk: 0.55 },
  quito: { lat: -0.1807, lng: -78.4678, exposure: 12.5, risk: 0.72 },
  lapaz: { lat: -16.5000, lng: -68.1500, exposure: 8.5, risk: 0.75 },
  asuncion: { lat: -25.2637, lng: -57.5759, exposure: 10.5, risk: 0.68 },
  panama: { lat: 8.9824, lng: -79.5199, exposure: 18.5, risk: 0.65 },
  sanjose: { lat: 9.9281, lng: -84.0907, exposure: 12.5, risk: 0.62 },
  guatemala: { lat: 14.6349, lng: -90.5069, exposure: 10.5, risk: 0.75 },
  havana: { lat: 23.1136, lng: -82.3666, exposure: 12.5, risk: 0.78 },
  santodomingo: { lat: 18.4861, lng: -69.9312, exposure: 15.8, risk: 0.72 },
  // Africa expansion
  nairobi: { lat: -1.2864, lng: 36.8172, exposure: 18.5, risk: 0.72 },
  addisababa: { lat: 9.0320, lng: 38.7469, exposure: 12.5, risk: 0.75 },
  accra: { lat: 5.6037, lng: -0.1870, exposure: 15.8, risk: 0.68 },
  daressalaam: { lat: -6.7924, lng: 39.2083, exposure: 12.5, risk: 0.72 },
  algiers: { lat: 36.7538, lng: 3.0588, exposure: 18.5, risk: 0.68 },
  casablanca: { lat: 33.5731, lng: -7.5898, exposure: 22.5, risk: 0.62 },
  tunis: { lat: 36.8065, lng: 10.1815, exposure: 15.8, risk: 0.65 },
  kampala: { lat: 0.3476, lng: 32.5825, exposure: 10.5, risk: 0.75 },
  lusaka: { lat: -15.3875, lng: 28.3228, exposure: 8.5, risk: 0.72 },
  harare: { lat: -17.8252, lng: 31.0335, exposure: 10.5, risk: 0.78 },
  kinshasa: { lat: -4.4419, lng: 15.2663, exposure: 12.5, risk: 0.82 },
  luanda: { lat: -8.8383, lng: 13.2344, exposure: 15.8, risk: 0.75 },
  // North America expansion
  atlanta: { lat: 33.7490, lng: -84.3880, exposure: 28.5, risk: 0.58 },
  dallas: { lat: 32.7767, lng: -96.7970, exposure: 32.5, risk: 0.62 },
  phoenix: { lat: 33.4484, lng: -112.0740, exposure: 28.5, risk: 0.65 },
  philadelphia: { lat: 39.9526, lng: -75.1652, exposure: 32.5, risk: 0.58 },
  detroit: { lat: 42.3314, lng: -83.0458, exposure: 22.5, risk: 0.68 },
  minneapolis: { lat: 44.9778, lng: -93.2650, exposure: 22.5, risk: 0.52 },
  sandiego: { lat: 32.7157, lng: -117.1611, exposure: 32.5, risk: 0.68 },
  tampa: { lat: 27.9506, lng: -82.4572, exposure: 25.8, risk: 0.75 },
  portland: { lat: 45.5152, lng: -122.6784, exposure: 22.5, risk: 0.58 },
  lasvegas: { lat: 36.1699, lng: -115.1398, exposure: 28.5, risk: 0.62 },
  austin: { lat: 30.2672, lng: -97.7431, exposure: 25.8, risk: 0.58 },
  nashville: { lat: 36.1627, lng: -86.7816, exposure: 22.5, risk: 0.55 },
  charlotte: { lat: 35.2271, lng: -80.8431, exposure: 25.8, risk: 0.58 },
  baltimore: { lat: 39.2904, lng: -76.6122, exposure: 28.5, risk: 0.62 },
  // Oceania expansion
  auckland: { lat: -36.8485, lng: 174.7633, exposure: 28.5, risk: 0.55 },
  wellington: { lat: -41.2865, lng: 174.7762, exposure: 22.5, risk: 0.58 },
  brisbane: { lat: -27.4698, lng: 153.0251, exposure: 28.5, risk: 0.58 },
  perth: { lat: -31.9505, lng: 115.8605, exposure: 25.8, risk: 0.52 },
  adelaide: { lat: -34.9285, lng: 138.6007, exposure: 22.5, risk: 0.55 },
  christchurch: { lat: -43.5321, lng: 172.6362, exposure: 18.5, risk: 0.62 },
  // Additional Southeast Asia
  yangon: { lat: 16.8661, lng: 96.1951, exposure: 12.5, risk: 0.75 },
  phnompenh: { lat: 11.5564, lng: 104.9282, exposure: 10.5, risk: 0.72 },
  vientiane: { lat: 17.9757, lng: 102.6331, exposure: 8.5, risk: 0.68 },
  colombo: { lat: 6.9271, lng: 79.8612, exposure: 15.8, risk: 0.72 },
  kathmandu: { lat: 27.7172, lng: 85.3240, exposure: 8.5, risk: 0.78 },
  // Additional cities for climate markers
  honolulu: { lat: 21.3069, lng: -157.8583, exposure: 18.5, risk: 0.68 },
  ottawa: { lat: 45.4215, lng: -75.6972, exposure: 22.5, risk: 0.52 },
  canberra: { lat: -35.2809, lng: 149.1300, exposure: 18.5, risk: 0.48 },
  baghdad: { lat: 33.3152, lng: 44.3661, exposure: 8.5, risk: 0.92 },
  jerusalem: { lat: 31.7683, lng: 35.2137, exposure: 15.8, risk: 0.85 },
  neworleans: { lat: 29.9511, lng: -90.0715, exposure: 22.5, risk: 0.78 },
}

function findCityCoordinates(cityId: string): { lat: number; lng: number; exposure?: number; risk?: number } | null {
  const normalized = cityId.toLowerCase().replace(/[^a-z]/g, '')
  return CITY_COORDINATES[normalized] || null
}

// Enterprise HQ / legal addresses (approx.) — companies at real locations per city
type ZoneAssetType = ZoneAsset['type']
const ENTERPRISE_ADDRESSES: Record<string, Array<{ name: string; type: ZoneAssetType; lat: number; lng: number }>> = {
  frankfurt: [
    { name: 'Deutsche Bank', type: 'bank', lat: 50.1125, lng: 8.6810 },
    { name: 'Commerzbank', type: 'bank', lat: 50.1098, lng: 8.6755 },
    { name: 'ECB', type: 'government', lat: 50.1105, lng: 8.6921 },
    { name: 'Deutsche Börse', type: 'infrastructure', lat: 50.1132, lng: 8.6680 },
    { name: 'E.ON', type: 'infrastructure', lat: 50.1080, lng: 8.6845 },
    { name: 'DZ Bank', type: 'bank', lat: 50.1118, lng: 8.6788 },
    { name: 'KfW', type: 'bank', lat: 50.1075, lng: 8.6900 },
    { name: 'Allianz Global', type: 'insurer', lat: 50.1090, lng: 8.6865 },
    { name: 'Frankfurt Airport', type: 'infrastructure', lat: 50.0379, lng: 8.5622 },
    { name: 'Siemens Financial', type: 'enterprise', lat: 50.1102, lng: 8.6795 },
    { name: 'Bundesbank', type: 'government', lat: 50.1088, lng: 8.6975 },
    { name: 'DekaBank', type: 'bank', lat: 50.1120, lng: 8.6730 },
  ],
  london: [
    { name: 'Bank of England', type: 'government', lat: 51.5142, lng: -0.0885 },
    { name: 'HSBC HQ', type: 'bank', lat: 51.5070, lng: -0.1272 },
    { name: 'Barclays', type: 'bank', lat: 51.5105, lng: -0.1025 },
    { name: 'Lloyds', type: 'bank', lat: 51.5135, lng: -0.0810 },
    { name: 'LSE', type: 'infrastructure', lat: 51.5143, lng: -0.0995 },
    { name: 'Canary Wharf Group', type: 'developer', lat: 51.5054, lng: -0.0235 },
    { name: 'Lloyd\'s of London', type: 'insurer', lat: 51.5130, lng: -0.0815 },
    { name: 'Standard Chartered', type: 'bank', lat: 51.5078, lng: -0.0750 },
    { name: 'NatWest', type: 'bank', lat: 51.5112, lng: -0.0875 },
    { name: 'Aviva', type: 'insurer', lat: 51.5120, lng: -0.0950 },
  ],
  paris: [
    { name: 'Banque de France', type: 'government', lat: 48.8698, lng: 2.3398 },
    { name: 'BNP Paribas', type: 'bank', lat: 48.8805, lng: 2.3185 },
    { name: 'Société Générale', type: 'bank', lat: 48.8785, lng: 2.3240 },
    { name: 'AXA HQ', type: 'insurer', lat: 48.8750, lng: 2.3210 },
    { name: 'La Défense (Arche)', type: 'infrastructure', lat: 48.8925, lng: 2.2360 },
    { name: 'Crédit Agricole', type: 'bank', lat: 48.8680, lng: 2.3310 },
    { name: 'Natixis', type: 'bank', lat: 48.8765, lng: 2.3180 },
    { name: 'Euronext Paris', type: 'infrastructure', lat: 48.8485, lng: 2.3520 },
    { name: 'Ministry of Finance', type: 'government', lat: 48.8370, lng: 2.3315 },
    { name: 'Ile-de-France Mobilités', type: 'infrastructure', lat: 48.8440, lng: 2.3740 },
  ],
  cologne: [
    { name: 'RWE', type: 'infrastructure', lat: 50.9410, lng: 6.9580 },
    { name: 'Deutsche Telekom', type: 'infrastructure', lat: 50.9350, lng: 6.9720 },
    { name: 'TÜV Rheinland', type: 'enterprise', lat: 50.9385, lng: 6.9650 },
    { name: 'Ford Cologne', type: 'enterprise', lat: 50.9280, lng: 6.9850 },
    { name: 'Uniklinik Köln', type: 'hospital', lat: 50.9245, lng: 6.9120 },
    { name: 'Stadt Köln', type: 'government', lat: 50.9380, lng: 6.9595 },
    { name: 'Lufthansa Technik', type: 'infrastructure', lat: 50.9520, lng: 6.9680 },
    { name: 'Lanxess', type: 'enterprise', lat: 50.9425, lng: 6.9510 },
  ],
  amsterdam: [
    { name: 'ING Group', type: 'bank', lat: 52.3635, lng: 4.9095 },
    { name: 'ABN AMRO', type: 'bank', lat: 52.3680, lng: 4.9010 },
    { name: 'Euronext Amsterdam', type: 'infrastructure', lat: 52.3715, lng: 4.8945 },
    { name: 'Schiphol', type: 'infrastructure', lat: 52.3105, lng: 4.7683 },
    { name: 'Philips', type: 'enterprise', lat: 52.3580, lng: 4.9180 },
    { name: 'Heineken', type: 'enterprise', lat: 52.3575, lng: 4.9280 },
    { name: 'APG', type: 'insurer', lat: 52.3620, lng: 4.9120 },
    { name: 'Port of Amsterdam', type: 'infrastructure', lat: 52.3780, lng: 4.8940 },
  ],
  milan: [
    { name: 'Intesa Sanpaolo', type: 'bank', lat: 45.4615, lng: 9.1905 },
    { name: 'UniCredit', type: 'bank', lat: 45.4630, lng: 9.1885 },
    { name: 'Generali', type: 'insurer', lat: 45.4655, lng: 9.1920 },
    { name: 'Pirelli', type: 'enterprise', lat: 45.4680, lng: 9.1850 },
    { name: 'Borsa Italiana', type: 'infrastructure', lat: 45.4640, lng: 9.1950 },
    { name: 'Eni', type: 'enterprise', lat: 45.4620, lng: 9.1980 },
    { name: 'Comune di Milano', type: 'government', lat: 45.4642, lng: 9.1902 },
    { name: 'Policlinico Milano', type: 'hospital', lat: 45.4580, lng: 9.2120 },
  ],
  berlin: [
    { name: 'Deutsche Bahn', type: 'infrastructure', lat: 52.5205, lng: 13.4045 },
    { name: 'Siemens HQ', type: 'enterprise', lat: 52.5250, lng: 13.3710 },
    { name: 'BMW Berlin', type: 'enterprise', lat: 52.5180, lng: 13.3850 },
    { name: 'Charité', type: 'hospital', lat: 52.5275, lng: 13.3785 },
    { name: 'Bundesrat', type: 'government', lat: 52.5055, lng: 13.3835 },
    { name: 'Berliner Verkehr', type: 'infrastructure', lat: 52.5220, lng: 13.4110 },
    { name: 'Vonovia', type: 'developer', lat: 52.5165, lng: 13.3920 },
    { name: 'Vattenfall Europe', type: 'infrastructure', lat: 52.5130, lng: 13.3980 },
    { name: 'Zalando', type: 'enterprise', lat: 52.5080, lng: 13.4520 },
  ],
  munich: [
    { name: 'Allianz SE', type: 'insurer', lat: 48.1360, lng: 11.5760 },
    { name: 'Munich Re', type: 'insurer', lat: 48.1375, lng: 11.5810 },
    { name: 'BMW Group', type: 'enterprise', lat: 48.1775, lng: 11.5560 },
    { name: 'Siemens', type: 'enterprise', lat: 48.1340, lng: 11.5835 },
    { name: 'Bundesbank Munich', type: 'government', lat: 48.1385, lng: 11.5720 },
    { name: 'Klinikum München', type: 'hospital', lat: 48.1310, lng: 11.5880 },
    { name: 'Bayerische Landesbank', type: 'bank', lat: 48.1355, lng: 11.5795 },
    { name: 'Hipp', type: 'enterprise', lat: 48.1320, lng: 11.5950 },
  ],
  kyiv: [
    { name: 'NBU', type: 'government', lat: 50.4485, lng: 30.5240 },
    { name: 'PrivatBank', type: 'bank', lat: 50.4510, lng: 30.5180 },
    { name: 'Kyiv City Council', type: 'government', lat: 50.4500, lng: 30.5235 },
    { name: 'Ukrenergo', type: 'infrastructure', lat: 50.4470, lng: 30.5300 },
    { name: 'Darnytsia Hospital', type: 'hospital', lat: 50.4550, lng: 30.6120 },
    { name: 'Metro Kyiv', type: 'infrastructure', lat: 50.4495, lng: 30.5225 },
  ],
  warsaw: [
    { name: 'NBP', type: 'government', lat: 52.2295, lng: 21.0115 },
    { name: 'PKO BP', type: 'bank', lat: 52.2310, lng: 21.0140 },
    { name: 'PZU', type: 'insurer', lat: 52.2300, lng: 21.0180 },
    { name: 'Warsaw Stock Exchange', type: 'infrastructure', lat: 52.2285, lng: 21.0205 },
    { name: 'City of Warsaw', type: 'government', lat: 52.2298, lng: 21.0120 },
    { name: 'Metro Warszawskie', type: 'infrastructure', lat: 52.2315, lng: 21.0080 },
  ],
  lyon: [
    { name: 'Crédit Agricole Lyon', type: 'bank', lat: 45.7650, lng: 4.8360 },
    { name: 'Valeo', type: 'enterprise', lat: 45.7620, lng: 4.8420 },
    { name: 'Sanofi Lyon', type: 'enterprise', lat: 45.7680, lng: 4.8300 },
    { name: 'Hospices Civils', type: 'hospital', lat: 45.7645, lng: 4.8380 },
    { name: 'Métropole de Lyon', type: 'government', lat: 45.7642, lng: 4.8358 },
    { name: 'SNCF Lyon', type: 'infrastructure', lat: 45.7670, lng: 4.8320 },
  ],
  zurich: [
    { name: 'UBS HQ', type: 'bank', lat: 47.3770, lng: 8.5395 },
    { name: 'Credit Suisse', type: 'bank', lat: 47.3765, lng: 8.5410 },
    { name: 'Zurich Insurance', type: 'insurer', lat: 47.3780, lng: 8.5430 },
    { name: 'Swiss Re', type: 'insurer', lat: 47.3755, lng: 8.5450 },
    { name: 'SIX Group', type: 'infrastructure', lat: 47.3775, lng: 8.5380 },
    { name: 'ETH Zurich', type: 'school', lat: 47.3762, lng: 8.5485 },
    { name: 'City of Zurich', type: 'government', lat: 47.3768, lng: 8.5415 },
  ],
  losangeles: [
    { name: 'City of LA', type: 'government', lat: 34.0522, lng: -118.2437 },
    { name: 'LA Dept Water & Power', type: 'infrastructure', lat: 34.0530, lng: -118.2450 },
    { name: 'Cedars-Sinai', type: 'hospital', lat: 34.0765, lng: -118.3830 },
    { name: 'LA Metro', type: 'infrastructure', lat: 34.0550, lng: -118.2460 },
    { name: 'LAFD HQ', type: 'government', lat: 34.0515, lng: -118.2420 },
    { name: 'Port of LA', type: 'infrastructure', lat: 33.7540, lng: -118.2710 },
  ],
  sydney: [
    { name: 'Reserve Bank of Australia', type: 'government', lat: -33.8685, lng: 151.2095 },
    { name: 'CBA', type: 'bank', lat: -33.8695, lng: 151.2105 },
    { name: 'Westpac', type: 'bank', lat: -33.8678, lng: 151.2088 },
    { name: 'ASX', type: 'infrastructure', lat: -33.8680, lng: 151.2098 },
    { name: 'QBE Insurance', type: 'insurer', lat: -33.8690, lng: 151.2110 },
    { name: 'Sydney Airport', type: 'infrastructure', lat: -33.9395, lng: 151.1750 },
  ],
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CommandCenter() {
  // Entry animation state
  const [showEntry, setShowEntry] = useState(true)
  const [entryComplete, setEntryComplete] = useState(false)
  
  const navigate = useNavigate()
  // Platform store - shared state with Dashboard
  const store = usePlatformStore()
  const portfolio = usePortfolio()
  
  const [focusedHotspot, setFocusedHotspot] = useState<FocusedHotspot | null>(null)
  const [flyToHotspotId, setFlyToHotspotId] = useState<string | null>(null)
  const [dependencyZoneId, setDependencyZoneId] = useState<string | null>(null)
  const showDependencies = Boolean(dependencyZoneId)
  
  // Active scenario - synced to store for Dashboard
  const activeScenarioState = useActiveScenario()
  const setActiveScenarioState = store.setActiveScenario
  const clearActiveScenarioState = store.clearActiveScenario
  // Convert store state to local format for compatibility
  const activeScenario: ActiveScenario | null = activeScenarioState ? {
    type: activeScenarioState.type,
    severity: activeScenarioState.severity,
    active: true,
  } : null
  const setActiveScenario = (scenario: ActiveScenario | null) => {
    if (scenario) {
      setActiveScenarioState({
        type: scenario.type,
        severity: scenario.severity,
        probability: 0.5,
        started_at: new Date().toISOString(),
      })
    } else {
      clearActiveScenarioState()
    }
  }
  
  const [isSceneReady, setIsSceneReady] = useState(false)
  const [recentAlerts, setRecentAlerts] = useState<RiskUpdate[]>([])
  const recentEvents = useRecentEvents(5)
  
  // Digital Twin panel visibility - synced to store
  const showDigitalTwin = useShowDigitalTwinPanel()
  const setShowDigitalTwin = store.setShowDigitalTwinPanel
  
  // Command Mode - split-view transformation
  const commandMode = useCommandMode()
  const toggleCommandMode = useToggleCommandMode()
  const [showZoneNav, setShowZoneNav] = useState(false)
  const [availableZones, setAvailableZones] = useState<{id: string, name: string, risk: number}[]>([])
  const [resetViewTrigger, setResetViewTrigger] = useState(0)
  // Disaster viz: flood + wind + metro layers (Open-Meteo, no GPU) + water level slider
  const [showFloodLayer, setShowFloodLayer] = useState(false)
  const [showWindLayer, setShowWindLayer] = useState(false)
  const [showMetroFloodLayer, setShowMetroFloodLayer] = useState(false)
  const [showHeatLayer, setShowHeatLayer] = useState(false)
  const [showHeavyRainLayer, setShowHeavyRainLayer] = useState(false)
  const [showDroughtLayer, setShowDroughtLayer] = useState(false)
  const [showUvLayer, setShowUvLayer] = useState(false)
  const [showEarthquakeLayer, setShowEarthquakeLayer] = useState(false)
  const [earthquakeMinMagnitude, setEarthquakeMinMagnitude] = useState(5)
  const [showActiveIncidentsLayer, setShowActiveIncidentsLayer] = useState(false)
  /** When opening Digital Twin from climate zone double-click: which risk type + city for filtering stress tests */
  const [climateTriggerRiskType, setClimateTriggerRiskType] = useState<string | null>(null)
  const [climateTriggerCityId, setClimateTriggerCityId] = useState<string | null>(null)
  const [showGoogle3dLayer, setShowGoogle3dLayer] = useState(false)
  const [showH3Layer, setShowH3Layer] = useState(false)
  const [h3Resolution, setH3Resolution] = useState(5)
  /** Zone Risk Vector: show hexagons colored by a single risk dimension (p_agi, p_bio, etc.). Set only after user selects risk + zone. */
  const [showZoneRiskVectorPanel, setShowZoneRiskVectorPanel] = useState(false)
  const [zoneRiskVectorDimension, setZoneRiskVectorDimension] = useState<string>('p_climate')
  const [zoneRiskVectorResolution, setZoneRiskVectorResolution] = useState(5)
  const [showZoneRiskVector, setShowZoneRiskVector] = useState(false)
  // Time slider for temporal replay (risk-at-time API)
  const [timeSliderValue, setTimeSliderValue] = useState<string | null>(null)
  const [floodDepthOverride, setFloodDepthOverride] = useState<number>(1)
  const FLOOD_LEVELS_M = [0.5, 1, 2, 3, 6, 9] as const
  const [expandedRiskLevel, setExpandedRiskLevel] = useState<'critical' | 'high' | 'medium' | 'low' | null>('critical')
  const [highFidelityScenarioId, setHighFidelityScenarioId] = useState<string | null>(null)
  const [highFidelityScenarioIds, setHighFidelityScenarioIds] = useState<string[]>([])
  /** Top-right icon bar: collapsed = only Dashboard (home) visible; expanded = full layers + quick actions */
  const [topBarExpanded, setTopBarExpanded] = useState(false)

  // ============================================
  // VIEW MODE: Global → Country → City navigation
  // ============================================
  type ViewMode = 'global' | 'country' | 'city'
  const [viewMode, setViewMode] = useState<ViewMode>('global')
  const [selectedCountryCode, setSelectedCountryCode] = useState<string | null>(null)
  const [selectedCountryName, setSelectedCountryName] = useState<string | null>(null)
  const [selectedCountryCity, setSelectedCountryCity] = useState<{ id: string; name: string; lat: number; lng: number } | null>(null)
  const [countrySearchQuery, setCountrySearchQuery] = useState('')
  const [countrySearchOpen, setCountrySearchOpen] = useState(false)
  const [countryRiskData, setCountryRiskData] = useState<{
    composite_risk: number
    risk_level: string
    hazards: Record<string, number>
    top_cities: { id: string; name: string; lat: number; lng: number; risk_score: number; exposure_b: number }[]
    total_exposure_b: number
    cities_count: number
  } | null>(null)
  const [countriesList, setCountriesList] = useState<{ code: string; name: string; lat: number; lng: number; bbox: number[]; population: number; region: string }[]>([])
  const [countryCitiesFromData, setCountryCitiesFromData] = useState<{ id: string; name: string; lat: number; lng: number }[]>([])
  const countrySearchInputRef = useRef<HTMLInputElement>(null)
  const aiAssistantRef = useRef<AIAssistantHandle>(null)

  // Load countries list on mount
  useEffect(() => {
    fetch('/data/countries.json')
      .then(res => res.json())
      .then(data => setCountriesList(data))
      .catch(() => {})
  }, [])

  // Fetch country risk data when country is selected
  useEffect(() => {
    if (!selectedCountryCode) {
      setCountryRiskData(null)
      return
    }
    fetch(`${getCommandApi()}/country-risk/${selectedCountryCode}`)
      .then(res => res.ok ? res.json() : null)
      .then(data => {
        if (data) setCountryRiskData(data)
      })
      .catch(() => {})
  }, [selectedCountryCode])

  // Fetch cities-by-country (top 20 by population) for panel fallback and globe markers
  useEffect(() => {
    if (!selectedCountryCode) {
      setCountryCitiesFromData([])
      return
    }
    fetch('/data/cities-by-country.json')
      .then(res => res.ok ? res.json() : null)
      .then((data: Record<string, Array<{ id: string; name: string; lat: number; lng: number }>>) => {
        const cities = data?.[selectedCountryCode]
        setCountryCitiesFromData(Array.isArray(cities) ? cities : [])
      })
      .catch(() => setCountryCitiesFromData([]))
  }, [selectedCountryCode])

  // Navigate to country
  const navigateToCountry = useCallback((code: string, name: string) => {
    setSelectedCountryCode(code)
    setSelectedCountryName(name)
    setViewMode('country')
    setCountrySearchOpen(false)
    setCountrySearchQuery('')
    setSelectedCountryCity(null)
    rotationEnabledRef.current = false
    store.addEvent(createPlatformEvent(EventTypes.ZONE_SELECTED, 'country', code, { name }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Navigate to city within country
  const navigateToCity = useCallback((city: { id: string; name: string; lat: number; lng: number }) => {
    setSelectedCountryCity(city)
    setViewMode('city')
    // Focus globe on city coordinates
    setFocusCoordinatesForGlobe({ lat: city.lat, lng: city.lng })
    // Open Digital Twin with city data for ClimateShield Local
    setSelectedZoneAsset({
      id: city.id,
      name: city.name,
      type: 'city',
      latitude: city.lat,
      longitude: city.lng,
      exposure: 10,
      impactSeverity: 0.5,
    })
    setShowDigitalTwin(true)
    store.addEvent(createPlatformEvent(EventTypes.ZONE_SELECTED, 'city', city.id, { name: city.name }))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Navigate back to global
  const navigateToGlobal = useCallback(() => {
    setViewMode('global')
    setSelectedCountryCode(null)
    setSelectedCountryName(null)
    setSelectedCountryCity(null)
    setCountryRiskData(null)
    setCountryCitiesFromData([])
  }, [])

  // Navigate back to country from city
  const navigateBackToCountry = useCallback(() => {
    setViewMode('country')
    setSelectedCountryCity(null)
  }, [])

  // Ref for rotation control (shared with globe)
  const rotationEnabledRef = useRef(true)
  
  // Stress Test State (integrated into Risk Zones)
  // Store the full test data locally, but sync ID to store for Dashboard access
  useSelectedStressTestId() // keep hook subscription active — synced to store for Dashboard
  const setSelectedStressTestId = store.setSelectedStressTestId
  const [selectedStressTestData, setSelectedStressTestData] = useState<{
    id: string
    name: string
    type: string
    severity: number
    probability: number
  } | null>(null)
  
  // Wrapper to sync both local data and store ID
  const selectedStressTest = selectedStressTestData
  const setSelectedStressTest = (test: typeof selectedStressTestData) => {
    setSelectedStressTestData(test)
    setSelectedStressTestId(test?.id ?? null)
    if (test) {
      store.addEvent(createPlatformEvent(EventTypes.STRESS_TEST_STARTED, 'stress_test', test.id, { name: test.name }))
    }
  }

  // When stress test panel opens (S key + event select), clear 4D timeline so bottom bar is hidden
  useEffect(() => {
    if (selectedStressTest) setStressTestCzmlUrl(null)
  }, [selectedStressTest])
  
  const [showActionPlans, setShowActionPlans] = useState(false)
  const [showStressTestSelector, setShowStressTestSelector] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const stressTestModalRef = useRef<HTMLDivElement>(null)

  // Focus stress test modal when opened (e.g. via S key) so Escape and clicks work
  useEffect(() => {
    if (showStressTestSelector && stressTestModalRef.current) {
      const t = requestAnimationFrame(() => {
        stressTestModalRef.current?.focus()
      })
      return () => cancelAnimationFrame(t)
    }
  }, [showStressTestSelector])

  // Timeline period index (0=T0, 1=T+1Y, … 4=T+5Y) — advances with elapsed time since scenario start
  const [timelinePeriodIndex, setTimelinePeriodIndex] = useState(0)
  useEffect(() => {
    if (!activeScenarioState?.started_at) {
      setTimelinePeriodIndex(0)
      return
    }
    const startedAt = new Date(activeScenarioState.started_at).getTime()
    const tick = () => {
      const elapsedSec = (Date.now() - startedAt) / 1000
      // Advance period every 8s: 0–8s T0, 8–16s T+1Y, 16–24s T+2Y, 24–32s T+3Y, 32s+ T+5Y
      const index = Math.min(4, Math.floor(elapsedSec / 8))
      setTimelinePeriodIndex(index)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [activeScenarioState?.started_at])
  
  // Selected zone - synced to store for Dashboard
  const selectedZone = useSelectedZone()
  const setSelectedZone = store.setSelectedZone

  // Asset from URL (Assets → View on Globe / Run Stress Test)
  const [searchParams] = useSearchParams()
  const [focusAssetIdFromUrl, setFocusAssetIdFromUrl] = useState<string | null>(null)
  const [focusAssetFromUrl, setFocusAssetFromUrl] = useState<{
    id: string
    name: string
    type: string
    latitude: number
    longitude: number
    exposure: number
    impactSeverity: number
  } | null>(null)
  const [focusCoordinatesForGlobe, setFocusCoordinatesForGlobe] = useState<{ lat: number; lng: number; height?: number } | null>(null)

  const czmlDecisionId = searchParams.get('czmlDecisionId')
  const apiBaseForCzml = getApiBase().replace(/\/+$/, '')
  const czmlUrl = czmlDecisionId
    ? (apiBaseForCzml + replayApi.getCascadeCzmlUrl(czmlDecisionId, 30, 10))
    : null

  const [stressTestCzmlUrl, setStressTestCzmlUrl] = useState<string | null>(null)

  // When opening with czmlDecisionId (e.g. View on Globe with "demo"), fly globe to cascade center and zoom in so animation is visible
  useEffect(() => {
    if (searchParams.get('czmlDecisionId') && !searchParams.get('assetId')) {
      setFocusCoordinatesForGlobe({ lat: 40.7128, lng: -74.006, height: 2500 })
    }
  }, [searchParams])

  useEffect(() => {
    const assetId = searchParams.get('assetId')
    const openTwin = searchParams.get('openTwin')
    const cityId = searchParams.get('cityId')
    const cityName = searchParams.get('cityName')

    if (cityId && openTwin === '1') {
      const coords = findCityCoordinates(cityId)
      const fallback = coords ?? (CITY_COORDINATES[cityId.toLowerCase().replace(/[^a-z]/g, '')] ?? null)
      if (fallback) {
        setSelectedZoneAsset({
          id: cityId,
          name: cityName || cityId,
          type: 'city',
          latitude: fallback.lat,
          longitude: fallback.lng,
          exposure: fallback.exposure ?? 10,
          impactSeverity: fallback.risk ?? 0.5,
        })
        setFocusCoordinatesForGlobe({ lat: fallback.lat, lng: fallback.lng })
        const riskCategory = (fallback.risk ?? 0.5) > 0.8 ? 'conflict' : (fallback.risk ?? 0.5) > 0.6 ? 'climate' : 'financial'
        setSelectedDigitalTwinEvent('stress_test_scenario')
        setSelectedDigitalTwinEventName(cityName ? `Stress Test: ${cityName}` : `Stress Test: ${cityId}`)
        setSelectedDigitalTwinEventCategory(riskCategory)
        setSelectedDigitalTwinTimeHorizon('current')
        setShowDigitalTwin(true)
      }
      return
    }

    if (!assetId) {
      setFocusAssetIdFromUrl(null)
      setFocusAssetFromUrl(null)
      if (!searchParams.get('czmlDecisionId')) setFocusCoordinatesForGlobe(null)
      return
    }
    setFocusAssetIdFromUrl(assetId)
    assetsApi.get(assetId).then((asset) => {
      if (asset.latitude != null && asset.longitude != null) {
        setFocusCoordinatesForGlobe({ lat: asset.latitude, lng: asset.longitude })
      }
      setFocusAssetFromUrl({
        id: asset.id,
        name: asset.name ?? 'Asset',
        type: asset.asset_type ?? 'infrastructure',
        latitude: asset.latitude ?? 0,
        longitude: asset.longitude ?? 0,
        exposure: asset.current_valuation ?? 0,
        impactSeverity: (asset.climate_risk_score ?? 0) / 100,
      })
      if (openTwin === '1') {
        setShowDigitalTwin(true)
      }
    }).catch(() => {
      setFocusAssetFromUrl(null)
      setFocusCoordinatesForGlobe(null)
    })
  }, [searchParams, setShowDigitalTwin])

  // Auto-enable disaster layers when flood-related stress test is selected; sync flood depth from scenario name (e.g. "0.5m")
  useEffect(() => {
    if (!selectedStressTest) return
    const id = selectedStressTest.id.toLowerCase()
    const type = selectedStressTest.type.toLowerCase()
    const name = (selectedStressTest.name ?? '').toLowerCase()
    
    // Flood-related scenarios → enable flood layer
    if (
      id.includes('flood') ||
      id.includes('sea_level') ||
      id.includes('tsunami') ||
      id.includes('heavy_rain') ||
      type === 'flood' ||
      type === 'heavy_rain'
    ) {
      setShowFloodLayer(true)
      // Sync water level from scenario name (e.g. "San Francisco Sea Level 0.5m" -> 0.5)
      const FLOOD_LEVELS_M = [0.5, 1, 2, 3, 6, 9] as const
      for (const m of FLOOD_LEVELS_M) {
        if (name.includes(`${m}m`) || name.includes(`${m} m`) || id.includes(`${m}m`) || id.includes(`${m}_m`)) {
          setFloodDepthOverride(m)
          break
        }
      }
    }
    
    // Metro flood scenarios → enable metro flood layer
    if (id.includes('metro_flood') || type === 'metro_flood') {
      setShowMetroFloodLayer(true)
      setShowFloodLayer(true) // also show main flood
    }
    
    // Wind/hurricane scenarios → enable wind layer
    if (
      id.includes('wind_storm') ||
      id.includes('hurricane') ||
      id.includes('typhoon') ||
      id.includes('cyclone') ||
      type === 'wind'
    ) {
      setShowWindLayer(true)
    }
    
    // Heat scenarios → enable heat layer
    if (
      id.includes('heat_stress') ||
      id.includes('heatwave') ||
      id.includes('heat_wave') ||
      type === 'heat'
    ) {
      setShowHeatLayer(true)
    }
    
    // Heavy rain scenarios → enable heavy rain layer
    if (id.includes('heavy_rain') || type === 'heavy_rain') {
      setShowHeavyRainLayer(true)
    }
    
    // Drought scenarios → enable drought layer
    if (id.includes('drought') || type === 'drought') {
      setShowDroughtLayer(true)
    }
    
    // UV scenarios → enable UV layer
    if (id.includes('uv_extreme') || id.includes('uv_index') || type === 'uv') {
      setShowUvLayer(true)
    }
  }, [selectedStressTest])

  const [selectedZoneAsset, setSelectedZoneAsset] = useState<ZoneAsset | null>(null)
  const [digitalTwinPickerMode, setDigitalTwinPickerMode] = useState(false)
  const [selectedDigitalTwinEvent, setSelectedDigitalTwinEvent] = useState<string | null>(null)
  const [selectedDigitalTwinEventName, setSelectedDigitalTwinEventName] = useState<string | null>(null)
  const [selectedDigitalTwinEventCategory, setSelectedDigitalTwinEventCategory] = useState<string | null>(null)
  const [selectedDigitalTwinTimeHorizon, setSelectedDigitalTwinTimeHorizon] = useState<string | null>(null)
  
  // Historical event state
  const [selectedHistoricalEvent, setSelectedHistoricalEvent] = useState<string | null>(null)
  const [showHistoricalPanel, setShowHistoricalPanel] = useState(false)
  
  // Metric tooltips (Total Exposure, At Risk) — custom hover; native title is unreliable over Cesium
  const [metricTooltip, setMetricTooltip] = useState<'exposure' | 'atRisk' | null>(null)
  
  // Registry scenarios for Focused Zone (Regulatory + Extended)
  const [registryScenariosFlat, setRegistryScenariosFlat] = useState<Array<{ id: string; name: string; severity_numeric?: number; horizon?: number; source?: string; category?: string; library?: string }>>([])
  const [expandedFactorIds, setExpandedFactorIds] = useState<Set<string>>(() => new Set())

  // GPU / NIM / Omniverse / DFM status (visible in bottom bar)
  const [nimHealth, setNimHealth] = useState<{ fourcastnet?: { status: string }; corrdiff?: { status: string } } | null>(null)
  const [dfmStatus, setDfmStatus] = useState<{ use_data_federation_pipelines?: boolean; pipeline_ids?: string[]; adapters_count?: number } | null>(null)
  const [omniverseStatus, setOmniverseStatus] = useState<{ e2cc_configured?: boolean; e2cc_base_url?: string; e2cc_use_port_forward?: boolean } | null>(null)
  const [weatherTestResult, setWeatherTestResult] = useState<string | null>(null)
  const [weatherTestLoading, setWeatherTestLoading] = useState(false)
  const [weatherForecastData, setWeatherForecastData] = useState<{
    forecasts: Array<{ forecast_time: string; lead_hours: number; temperature_k: number; wind_u_ms: number; wind_v_ms: number; precipitation_mm: number }>
    latitude: number
    longitude: number
    model: string
  } | null>(null)
  
  // Generate zone assets: use ENTERPRISE_ADDRESSES (HQ/legal addresses) when zone has cityId, else fallback
  const generateZoneAssets = useCallback((zone: Omit<RiskZone, 'assets'> & { cityId?: string }, count: number): ZoneAsset[] => {
    const cityId = zone.cityId
    const companies = cityId ? ENTERPRISE_ADDRESSES[cityId] : null
    const assetTypes: ZoneAsset['type'][] = ['bank', 'enterprise', 'developer', 'insurer', 'infrastructure', 'hospital', 'government']
    const fallbackNames: Record<ZoneAsset['type'], string[]> = {
      bank: ['Deutsche Bank', 'Commerzbank', 'UBS', 'Credit Suisse', 'ING Group', 'Santander'],
      enterprise: ['Siemens', 'BASF', 'Volkswagen', 'BMW', 'SAP', 'Bayer'],
      developer: ['Vonovia', 'LEG Immobilien', 'Aroundtown', 'Grand City', 'TAG Immobilien'],
      insurer: ['Allianz', 'Munich Re', 'Zurich Insurance', 'AXA', 'Generali'],
      infrastructure: ['E.ON Grid', 'RWE Power', 'Deutsche Bahn', 'Fraport', 'Eurogate'],
      hospital: ['Charité', 'UKE Hamburg', 'Klinikum München', 'Uniklinik Köln'],
      government: ['Bundesbank', 'Federal Ministry', 'State Office', 'Municipal HQ'],
      military: ['NATO Base', 'Bundeswehr HQ', 'Defense Center'],
      school: ['Technical University', 'Business School', 'Research Institute'],
      city: ['City Center', 'Downtown District', 'Metro Area', 'Urban Core'],
    }

    const assets: ZoneAsset[] = []
    for (let i = 0; i < count; i++) {
      let name: string
      let type: ZoneAsset['type']
      let latitude: number
      let longitude: number

      if (companies && companies.length > 0) {
        const c = companies[i % companies.length]
        name = c.name
        type = c.type
        latitude = c.lat
        longitude = c.lng
      } else {
        type = assetTypes[i % assetTypes.length]
        const names = fallbackNames[type]
        name = names[i % names.length]
        const angle = Math.random() * 2 * Math.PI
        const distance = Math.random() * zone.radius_km * 0.8
        const latOffset = (distance / 111) * Math.cos(angle)
        const lngOffset = (distance / 111) * Math.sin(angle) / Math.cos(zone.center_latitude * Math.PI / 180)
        latitude = zone.center_latitude + latOffset
        longitude = zone.center_longitude + lngOffset
      }

      assets.push({
        id: `${zone.id}-asset-${i}`,
        name,
        type,
        latitude,
        longitude,
        exposure: 0.5 + Math.random() * 4.5,
        impactSeverity: zone.risk_score * (0.6 + Math.random() * 0.4),
      })
    }
    return assets
  }, [])

  // Map scenario type/id to zone category (e.g. Flood_Extreme_100y -> climate)
  const scenarioTypeToZoneCategory = useCallback((typeOrId: string): string => {
    const t = (typeOrId || '').toLowerCase()
    if (['climate', 'financial', 'geopolitical', 'pandemic', 'political', 'regulatory', 'civil_unrest', 'fire'].includes(t)) return t
    if (t === 'military') return 'geopolitical'
    if (t === 'protest') return 'civil_unrest'
    if (t.includes('flood') || t.includes('ngfs') || t.includes('ssp') || t.includes('sea_level') || t.includes('heat') ||
        t.includes('drought') || t.includes('wind') || t.includes('hurricane') || t.includes('typhoon') || t.includes('cyclone') ||
        t.includes('uv') || t.includes('heavy_rain') || t.includes('meteo')) return 'climate'
    if (t.includes('fire') || t.includes('wildfire')) return 'fire'
    if (t.includes('bank') || t.includes('basel') || t.includes('credit') || t.includes('liquidity')) return 'financial'
    if (t.includes('pandemic') || t.includes('health')) return 'pandemic'
    if (t.includes('political') || t.includes('election')) return 'political'
    if (t.includes('regulatory') || t.includes('eba') || t.includes('fed') || t.includes('imf')) return 'regulatory'
    return t
  }, [])

  // Risk zones for stress tests: centers from CITY_COORDINATES so enterprises are exactly at real city locations
  const activeRiskZones = useMemo<RiskZone[]>(() => {
    if (!selectedStressTest) return []
    const typeKey = scenarioTypeToZoneCategory(selectedStressTest.type)
    const cc = (cityId: string): { center_latitude: number; center_longitude: number } => {
      const c = CITY_COORDINATES[cityId]
      return c ? { center_latitude: c.lat, center_longitude: c.lng } : { center_latitude: 50, center_longitude: 8 }
    }

    const typeZonesBase: Record<string, Array<Omit<RiskZone, 'assets'> & { cityId: string }>> = {
      climate: [
        // Europe
        { id: 'zone-1', name: 'Rhine Valley (Cologne)', zone_level: 'critical', ...cc('cologne'), radius_km: 80, risk_score: 0.92, affected_assets_count: 12, total_exposure: 12.5, cityId: 'cologne' },
        { id: 'zone-2', name: 'North Sea Coast (Amsterdam)', zone_level: 'high', ...cc('amsterdam'), radius_km: 60, risk_score: 0.75, affected_assets_count: 8, total_exposure: 8.3, cityId: 'amsterdam' },
        { id: 'zone-3', name: 'Po Valley (Milan)', zone_level: 'medium', ...cc('milan'), radius_km: 70, risk_score: 0.55, affected_assets_count: 6, total_exposure: 6.1, cityId: 'milan' },
        { id: 'zone-4', name: 'Thames Basin (London)', zone_level: 'high', ...cc('london'), radius_km: 65, risk_score: 0.68, affected_assets_count: 14, total_exposure: 38.5, cityId: 'london' },
        { id: 'zone-5', name: 'Seine Valley (Paris)', zone_level: 'medium', ...cc('paris'), radius_km: 55, risk_score: 0.62, affected_assets_count: 10, total_exposure: 28.4, cityId: 'paris' },
        { id: 'zone-6', name: 'Danube Region (Vienna)', zone_level: 'medium', ...cc('vienna'), radius_km: 50, risk_score: 0.52, affected_assets_count: 8, total_exposure: 22.5, cityId: 'vienna' },
        { id: 'zone-7', name: 'Baltic Coast (Copenhagen)', zone_level: 'high', ...cc('copenhagen'), radius_km: 45, risk_score: 0.48, affected_assets_count: 7, total_exposure: 22.5, cityId: 'copenhagen' },
        { id: 'zone-8', name: 'Mediterranean Coast (Barcelona)', zone_level: 'medium', ...cc('barcelona'), radius_km: 50, risk_score: 0.62, affected_assets_count: 8, total_exposure: 22.5, cityId: 'barcelona' },
        // Asia
        { id: 'zone-9', name: 'Yangtze Delta (Shanghai)', zone_level: 'critical', ...cc('shanghai'), radius_km: 90, risk_score: 0.82, affected_assets_count: 18, total_exposure: 55.8, cityId: 'shanghai' },
        { id: 'zone-10', name: 'Tokyo Bay Area', zone_level: 'critical', ...cc('tokyo'), radius_km: 85, risk_score: 0.92, affected_assets_count: 20, total_exposure: 45.2, cityId: 'tokyo' },
        { id: 'zone-11', name: 'Pearl River Delta (Guangzhou)', zone_level: 'high', ...cc('guangzhou'), radius_km: 75, risk_score: 0.78, affected_assets_count: 14, total_exposure: 42.5, cityId: 'guangzhou' },
        { id: 'zone-12', name: 'Chao Phraya Basin (Bangkok)', zone_level: 'high', ...cc('bangkok'), radius_km: 70, risk_score: 0.72, affected_assets_count: 10, total_exposure: 28.5, cityId: 'bangkok' },
        { id: 'zone-13', name: 'Jakarta Coastal Zone', zone_level: 'critical', ...cc('jakarta'), radius_km: 65, risk_score: 0.82, affected_assets_count: 12, total_exposure: 32.5, cityId: 'jakarta' },
        { id: 'zone-14', name: 'Mumbai Monsoon Zone', zone_level: 'high', ...cc('mumbai'), radius_km: 60, risk_score: 0.82, affected_assets_count: 12, total_exposure: 28.4, cityId: 'mumbai' },
        { id: 'zone-15', name: 'Dhaka Flood Plain', zone_level: 'critical', ...cc('dhaka'), radius_km: 55, risk_score: 0.88, affected_assets_count: 10, total_exposure: 12.5, cityId: 'dhaka' },
        // Americas
        { id: 'zone-16', name: 'New York Metro Area', zone_level: 'high', ...cc('newyork'), radius_km: 70, risk_score: 0.75, affected_assets_count: 16, total_exposure: 52.3, cityId: 'newyork' },
        { id: 'zone-17', name: 'Miami Hurricane Zone', zone_level: 'critical', ...cc('miami'), radius_km: 60, risk_score: 0.78, affected_assets_count: 12, total_exposure: 32.5, cityId: 'miami' },
        { id: 'zone-18', name: 'Houston Gulf Coast', zone_level: 'high', ...cc('houston'), radius_km: 65, risk_score: 0.72, affected_assets_count: 10, total_exposure: 28.5, cityId: 'houston' },
        { id: 'zone-19', name: 'São Paulo Basin', zone_level: 'medium', ...cc('saopaulo'), radius_km: 55, risk_score: 0.72, affected_assets_count: 12, total_exposure: 38.5, cityId: 'saopaulo' },
        { id: 'zone-20', name: 'Mexico City Valley', zone_level: 'high', ...cc('mexicocity'), radius_km: 60, risk_score: 0.72, affected_assets_count: 11, total_exposure: 32.5, cityId: 'mexicocity' },
        // Africa & Middle East
        { id: 'zone-21', name: 'Nile Delta (Cairo)', zone_level: 'high', ...cc('cairo'), radius_km: 50, risk_score: 0.68, affected_assets_count: 8, total_exposure: 18.5, cityId: 'cairo' },
        { id: 'zone-22', name: 'Lagos Coastal Zone', zone_level: 'critical', ...cc('lagos'), radius_km: 45, risk_score: 0.78, affected_assets_count: 9, total_exposure: 15.8, cityId: 'lagos' },
        { id: 'zone-23', name: 'Nairobi Highlands', zone_level: 'medium', ...cc('nairobi'), radius_km: 40, risk_score: 0.72, affected_assets_count: 7, total_exposure: 18.5, cityId: 'nairobi' },
        { id: 'zone-24', name: 'Dubai Desert Coast', zone_level: 'high', ...cc('dubai'), radius_km: 50, risk_score: 0.68, affected_assets_count: 10, total_exposure: 32.5, cityId: 'dubai' },
        // Oceania
        { id: 'zone-25', name: 'Sydney Harbor Area', zone_level: 'medium', ...cc('sydney'), radius_km: 55, risk_score: 0.52, affected_assets_count: 10, total_exposure: 38.7, cityId: 'sydney' },
        { id: 'zone-26', name: 'Auckland Volcanic Field', zone_level: 'medium', ...cc('auckland'), radius_km: 45, risk_score: 0.55, affected_assets_count: 8, total_exposure: 28.5, cityId: 'auckland' },
      ],
      financial: [
        // Global Financial Hubs
        { id: 'zone-1', name: 'Frankfurt Hub', zone_level: 'critical', ...cc('frankfurt'), radius_km: 40, risk_score: 0.88, affected_assets_count: 15, total_exposure: 45.2, cityId: 'frankfurt' },
        { id: 'zone-2', name: 'London City', zone_level: 'critical', ...cc('london'), radius_km: 50, risk_score: 0.72, affected_assets_count: 18, total_exposure: 48.5, cityId: 'london' },
        { id: 'zone-3', name: 'New York Wall Street', zone_level: 'critical', ...cc('newyork'), radius_km: 45, risk_score: 0.75, affected_assets_count: 20, total_exposure: 62.3, cityId: 'newyork' },
        { id: 'zone-4', name: 'Tokyo Financial District', zone_level: 'critical', ...cc('tokyo'), radius_km: 40, risk_score: 0.92, affected_assets_count: 16, total_exposure: 55.2, cityId: 'tokyo' },
        { id: 'zone-5', name: 'Hong Kong Central', zone_level: 'high', ...cc('hongkong'), radius_km: 35, risk_score: 0.75, affected_assets_count: 14, total_exposure: 42.5, cityId: 'hongkong' },
        { id: 'zone-6', name: 'Singapore CBD', zone_level: 'high', ...cc('singapore'), radius_km: 30, risk_score: 0.62, affected_assets_count: 12, total_exposure: 38.9, cityId: 'singapore' },
        { id: 'zone-7', name: 'Paris La Défense', zone_level: 'high', ...cc('paris'), radius_km: 45, risk_score: 0.62, affected_assets_count: 12, total_exposure: 32.4, cityId: 'paris' },
        { id: 'zone-8', name: 'Zurich Banking District', zone_level: 'high', ...cc('zurich'), radius_km: 35, risk_score: 0.45, affected_assets_count: 10, total_exposure: 42.5, cityId: 'zurich' },
        { id: 'zone-9', name: 'Shanghai Pudong', zone_level: 'high', ...cc('shanghai'), radius_km: 50, risk_score: 0.82, affected_assets_count: 14, total_exposure: 55.8, cityId: 'shanghai' },
        { id: 'zone-10', name: 'Dubai DIFC', zone_level: 'medium', ...cc('dubai'), radius_km: 40, risk_score: 0.68, affected_assets_count: 10, total_exposure: 32.5, cityId: 'dubai' },
        { id: 'zone-11', name: 'Sydney Financial Quarter', zone_level: 'medium', ...cc('sydney'), radius_km: 35, risk_score: 0.52, affected_assets_count: 8, total_exposure: 38.7, cityId: 'sydney' },
        { id: 'zone-12', name: 'Toronto Bay Street', zone_level: 'medium', ...cc('toronto'), radius_km: 40, risk_score: 0.55, affected_assets_count: 10, total_exposure: 32.5, cityId: 'toronto' },
      ],
      geopolitical: [
        // Conflict & High-Risk Zones
        { id: 'zone-1', name: 'Eastern Border (Kyiv)', zone_level: 'critical', ...cc('kyiv'), radius_km: 120, risk_score: 0.95, affected_assets_count: 10, total_exposure: 18.7, cityId: 'kyiv' },
        { id: 'zone-2', name: 'Donbas Region', zone_level: 'critical', ...cc('donetskluhansk'), radius_km: 100, risk_score: 0.98, affected_assets_count: 8, total_exposure: 5.2, cityId: 'donetskluhansk' },
        { id: 'zone-3', name: 'Gaza Strip', zone_level: 'critical', ...cc('gaza'), radius_km: 40, risk_score: 0.99, affected_assets_count: 6, total_exposure: 2.0, cityId: 'gaza' },
        { id: 'zone-4', name: 'Damascus Region', zone_level: 'critical', ...cc('damascus'), radius_km: 80, risk_score: 0.98, affected_assets_count: 7, total_exposure: 5.2, cityId: 'damascus' },
        { id: 'zone-5', name: 'Baltic Corridor (Warsaw)', zone_level: 'high', ...cc('warsaw'), radius_km: 100, risk_score: 0.78, affected_assets_count: 9, total_exposure: 18.5, cityId: 'warsaw' },
        { id: 'zone-6', name: 'Taiwan Strait (Taipei)', zone_level: 'high', ...cc('taipei'), radius_km: 90, risk_score: 0.78, affected_assets_count: 10, total_exposure: 28.9, cityId: 'taipei' },
        { id: 'zone-7', name: 'Korean Peninsula (Seoul)', zone_level: 'high', ...cc('seoul'), radius_km: 85, risk_score: 0.72, affected_assets_count: 12, total_exposure: 38.5, cityId: 'seoul' },
        { id: 'zone-8', name: 'Persian Gulf (Tehran)', zone_level: 'high', ...cc('tehran'), radius_km: 95, risk_score: 0.82, affected_assets_count: 8, total_exposure: 22.8, cityId: 'tehran' },
        { id: 'zone-9', name: 'South China Sea (Manila)', zone_level: 'medium', ...cc('manila'), radius_km: 70, risk_score: 0.75, affected_assets_count: 8, total_exposure: 22.5, cityId: 'manila' },
        { id: 'zone-10', name: 'Black Sea (Istanbul)', zone_level: 'medium', ...cc('istanbul'), radius_km: 75, risk_score: 0.72, affected_assets_count: 10, total_exposure: 28.5, cityId: 'istanbul' },
      ],
      pandemic: [
        // High-Density Urban Centers
        { id: 'zone-1', name: 'Metropolitan Core (Berlin)', zone_level: 'critical', ...cc('berlin'), radius_km: 50, risk_score: 0.85, affected_assets_count: 18, total_exposure: 32.5, cityId: 'berlin' },
        { id: 'zone-2', name: 'Industrial Belt (Cologne)', zone_level: 'high', ...cc('cologne'), radius_km: 60, risk_score: 0.68, affected_assets_count: 12, total_exposure: 18.3, cityId: 'cologne' },
        { id: 'zone-3', name: 'Southern Region (Munich)', zone_level: 'medium', ...cc('munich'), radius_km: 55, risk_score: 0.52, affected_assets_count: 9, total_exposure: 14.1, cityId: 'munich' },
        { id: 'zone-4', name: 'New York Metro', zone_level: 'critical', ...cc('newyork'), radius_km: 65, risk_score: 0.75, affected_assets_count: 20, total_exposure: 52.3, cityId: 'newyork' },
        { id: 'zone-5', name: 'London Greater Area', zone_level: 'critical', ...cc('london'), radius_km: 70, risk_score: 0.68, affected_assets_count: 18, total_exposure: 38.5, cityId: 'london' },
        { id: 'zone-6', name: 'Tokyo Megacity', zone_level: 'critical', ...cc('tokyo'), radius_km: 80, risk_score: 0.92, affected_assets_count: 22, total_exposure: 45.2, cityId: 'tokyo' },
        { id: 'zone-7', name: 'Mumbai Urban Area', zone_level: 'critical', ...cc('mumbai'), radius_km: 60, risk_score: 0.82, affected_assets_count: 16, total_exposure: 28.4, cityId: 'mumbai' },
        { id: 'zone-8', name: 'São Paulo Metro', zone_level: 'high', ...cc('saopaulo'), radius_km: 65, risk_score: 0.72, affected_assets_count: 14, total_exposure: 38.5, cityId: 'saopaulo' },
        { id: 'zone-9', name: 'Lagos Megacity', zone_level: 'critical', ...cc('lagos'), radius_km: 55, risk_score: 0.78, affected_assets_count: 12, total_exposure: 15.8, cityId: 'lagos' },
        { id: 'zone-10', name: 'Jakarta Metro', zone_level: 'high', ...cc('jakarta'), radius_km: 60, risk_score: 0.82, affected_assets_count: 14, total_exposure: 32.5, cityId: 'jakarta' },
      ],
      political: [
        // Capital Cities & Government Centers
        { id: 'zone-1', name: 'Capital Region (Berlin)', zone_level: 'high', ...cc('berlin'), radius_km: 45, risk_score: 0.72, affected_assets_count: 10, total_exposure: 28.5, cityId: 'berlin' },
        { id: 'zone-2', name: 'Financial District (Frankfurt)', zone_level: 'medium', ...cc('frankfurt'), radius_km: 35, risk_score: 0.55, affected_assets_count: 8, total_exposure: 22.1, cityId: 'frankfurt' },
        { id: 'zone-3', name: 'Washington DC Area', zone_level: 'high', ...cc('washington'), radius_km: 50, risk_score: 0.48, affected_assets_count: 12, total_exposure: 42.1, cityId: 'washington' },
        { id: 'zone-4', name: 'Moscow Center', zone_level: 'high', ...cc('moscow'), radius_km: 55, risk_score: 0.72, affected_assets_count: 14, total_exposure: 35.2, cityId: 'moscow' },
        { id: 'zone-5', name: 'Beijing Government District', zone_level: 'high', ...cc('beijing'), radius_km: 60, risk_score: 0.78, affected_assets_count: 16, total_exposure: 48.2, cityId: 'beijing' },
        { id: 'zone-6', name: 'Paris Government Quarter', zone_level: 'medium', ...cc('paris'), radius_km: 40, risk_score: 0.62, affected_assets_count: 10, total_exposure: 28.4, cityId: 'paris' },
        { id: 'zone-7', name: 'London Westminster', zone_level: 'medium', ...cc('london'), radius_km: 35, risk_score: 0.68, affected_assets_count: 12, total_exposure: 38.5, cityId: 'london' },
        { id: 'zone-8', name: 'Brasília Federal District', zone_level: 'medium', ...cc('buenosaires'), radius_km: 45, risk_score: 0.82, affected_assets_count: 8, total_exposure: 28.5, cityId: 'buenosaires' },
      ],
      regulatory: [
        // Banking & Insurance Hubs
        { id: 'zone-1', name: 'Banking Sector (Frankfurt)', zone_level: 'high', ...cc('frankfurt'), radius_km: 40, risk_score: 0.68, affected_assets_count: 12, total_exposure: 42.5, cityId: 'frankfurt' },
        { id: 'zone-2', name: 'Insurance Hub (Munich)', zone_level: 'medium', ...cc('munich'), radius_km: 35, risk_score: 0.52, affected_assets_count: 8, total_exposure: 18.3, cityId: 'munich' },
        { id: 'zone-3', name: 'London Financial Services', zone_level: 'high', ...cc('london'), radius_km: 45, risk_score: 0.68, affected_assets_count: 14, total_exposure: 38.5, cityId: 'london' },
        { id: 'zone-4', name: 'Zurich Banking Center', zone_level: 'high', ...cc('zurich'), radius_km: 35, risk_score: 0.45, affected_assets_count: 10, total_exposure: 42.5, cityId: 'zurich' },
        { id: 'zone-5', name: 'New York Financial District', zone_level: 'critical', ...cc('newyork'), radius_km: 40, risk_score: 0.75, affected_assets_count: 16, total_exposure: 52.3, cityId: 'newyork' },
        { id: 'zone-6', name: 'Singapore Financial Hub', zone_level: 'medium', ...cc('singapore'), radius_km: 30, risk_score: 0.62, affected_assets_count: 10, total_exposure: 38.9, cityId: 'singapore' },
        { id: 'zone-7', name: 'Luxembourg Financial Center', zone_level: 'high', ...cc('luxembourg'), radius_km: 25, risk_score: 0.42, affected_assets_count: 8, total_exposure: 38.5, cityId: 'luxembourg' },
      ],
      civil_unrest: [
        // Urban Protest-Prone Areas
        { id: 'zone-1', name: 'Urban Center (Paris)', zone_level: 'critical', ...cc('paris'), radius_km: 25, risk_score: 0.88, affected_assets_count: 14, total_exposure: 35.2, cityId: 'paris' },
        { id: 'zone-2', name: 'Industrial Zone (Lyon)', zone_level: 'high', ...cc('lyon'), radius_km: 40, risk_score: 0.72, affected_assets_count: 9, total_exposure: 18.5, cityId: 'lyon' },
        { id: 'zone-3', name: 'Hong Kong Central', zone_level: 'high', ...cc('hongkong'), radius_km: 30, risk_score: 0.75, affected_assets_count: 12, total_exposure: 42.5, cityId: 'hongkong' },
        { id: 'zone-4', name: 'Santiago Downtown', zone_level: 'high', ...cc('santiago'), radius_km: 35, risk_score: 0.68, affected_assets_count: 10, total_exposure: 28.5, cityId: 'santiago' },
        { id: 'zone-5', name: 'Caracas Urban Area', zone_level: 'critical', ...cc('caracas'), radius_km: 40, risk_score: 0.95, affected_assets_count: 8, total_exposure: 8.5, cityId: 'caracas' },
        { id: 'zone-6', name: 'Beirut City Center', zone_level: 'high', ...cc('beirut'), radius_km: 30, risk_score: 0.75, affected_assets_count: 8, total_exposure: 12.5, cityId: 'beirut' },
      ],
      fire: [
        // Wildfire-Prone Regions
        { id: 'zone-1', name: 'Wildland-Urban Interface (LA)', zone_level: 'critical', ...cc('losangeles'), radius_km: 45, risk_score: 0.9, affected_assets_count: 14, total_exposure: 28.5, cityId: 'losangeles' },
        { id: 'zone-2', name: 'Forest Corridor (Zurich)', zone_level: 'high', ...cc('zurich'), radius_km: 50, risk_score: 0.72, affected_assets_count: 8, total_exposure: 12.3, cityId: 'zurich' },
        { id: 'zone-3', name: 'Coastal Bushland (Sydney)', zone_level: 'medium', ...cc('sydney'), radius_km: 55, risk_score: 0.58, affected_assets_count: 10, total_exposure: 38.7, cityId: 'sydney' },
        { id: 'zone-4', name: 'San Francisco Bay Hills', zone_level: 'high', ...cc('sanfrancisco'), radius_km: 40, risk_score: 0.78, affected_assets_count: 12, total_exposure: 48.5, cityId: 'sanfrancisco' },
        { id: 'zone-5', name: 'Athens Forest Ring', zone_level: 'critical', ...cc('athens'), radius_km: 45, risk_score: 0.62, affected_assets_count: 8, total_exposure: 15.8, cityId: 'athens' },
        { id: 'zone-6', name: 'Perth Bushfire Zone', zone_level: 'high', ...cc('perth'), radius_km: 50, risk_score: 0.52, affected_assets_count: 8, total_exposure: 25.8, cityId: 'perth' },
        { id: 'zone-7', name: 'Cape Town Mountain Fire', zone_level: 'medium', ...cc('capetown'), radius_km: 45, risk_score: 0.58, affected_assets_count: 7, total_exposure: 18.5, cityId: 'capetown' },
      ],
      // Polar Vortex — US/Canada subset (arctic_vortex scenario)
      arctic_vortex: [
        { id: 'zone-1', name: 'Chicago Metro (Polar)', zone_level: 'critical', ...cc('chicago'), radius_km: 70, risk_score: 0.78, affected_assets_count: 14, total_exposure: 42.0, cityId: 'chicago' },
        { id: 'zone-2', name: 'Minneapolis–St Paul', zone_level: 'critical', ...cc('minneapolis'), radius_km: 55, risk_score: 0.78, affected_assets_count: 10, total_exposure: 22.5, cityId: 'minneapolis' },
        { id: 'zone-3', name: 'Detroit Metro', zone_level: 'high', ...cc('detroit'), radius_km: 60, risk_score: 0.72, affected_assets_count: 12, total_exposure: 28.5, cityId: 'detroit' },
        { id: 'zone-4', name: 'Toronto GTA', zone_level: 'high', ...cc('toronto'), radius_km: 65, risk_score: 0.72, affected_assets_count: 12, total_exposure: 32.5, cityId: 'toronto' },
        { id: 'zone-5', name: 'Montreal Region', zone_level: 'high', ...cc('montreal'), radius_km: 50, risk_score: 0.72, affected_assets_count: 10, total_exposure: 22.4, cityId: 'montreal' },
        { id: 'zone-6', name: 'New York Metro (Polar)', zone_level: 'high', ...cc('newyork'), radius_km: 70, risk_score: 0.75, affected_assets_count: 16, total_exposure: 52.3, cityId: 'newyork' },
        { id: 'zone-7', name: 'Boston Metro', zone_level: 'medium', ...cc('boston'), radius_km: 50, risk_score: 0.68, affected_assets_count: 10, total_exposure: 34.0, cityId: 'boston' },
      ],
    }
    const baseZones = typeZonesBase[typeKey] ?? []
    return baseZones.map(zone => {
      const { cityId: _cityId, ...zoneRest } = zone
      return {
        ...zoneRest,
        assets: generateZoneAssets(zone, zone.affected_assets_count || 8),
      } as RiskZone
    })
  }, [selectedStressTest, generateZoneAssets, scenarioTypeToZoneCategory])

  // Disaster viz center for flood/wind/metro/heat layers: use selected zone or first active zone; fallback NYC when no stress test
  const disasterCenter = useMemo(() => {
    if (activeRiskZones.length > 0) {
      const zone = selectedZone && activeRiskZones.some(z => z.id === selectedZone.id) ? selectedZone : activeRiskZones[0]
      return { lat: zone.center_latitude, lng: zone.center_longitude }
    }
    return { lat: 40.7128, lng: -74.0060 }
  }, [activeRiskZones, selectedZone])

  // For flood/sea_level stress tests: use scenario city when detectable so flood zone shows at the right city (e.g. San Francisco)
  const floodCenter = useMemo(() => {
    if (!showFloodLayer || !selectedStressTest) return disasterCenter
    const t = (selectedStressTest.type || '').toLowerCase()
    const id = (selectedStressTest.id || '').toLowerCase()
    const name = (selectedStressTest.name || '').toLowerCase()
    const isFloodRelated =
      t.includes('flood') || t.includes('sea_level') || t.includes('tsunami') || t.includes('heavy_rain') ||
      id.includes('flood') || id.includes('sea_level') || id.includes('sea-level') || id.includes('tsunami') ||
      name.includes('flood') || name.includes('sea level') || name.includes('sea-level') || name.includes('water level')
    if (!isFloodRelated) return disasterCenter
    // Resolve city from scenario name or id (e.g. "San Francisco Sea Level 0.5m" -> sanfrancisco)
    const normalizedName = (selectedStressTest.name?.trim() ?? '').toLowerCase()
    const displayKey = Object.keys(CLIMATE_CITY_DISPLAY_TO_ID).find((k) => normalizedName.includes(k.toLowerCase()))
    const cityIdFromDisplay = displayKey ? CLIMATE_CITY_DISPLAY_TO_ID[displayKey] : null
    const cityIdFromId = selectedStressTest.id
      ? (Object.keys(CITY_COORDINATES).find((cid) => (selectedStressTest.id ?? '').toLowerCase().includes(cid)) ?? null)
      : null
    const cityId = cityIdFromDisplay ?? cityIdFromId ?? (CITY_COORDINATES[selectedStressTest.id?.toLowerCase().replace(/\s+/g, '') ?? ''] ? selectedStressTest.id?.toLowerCase().replace(/\s+/g, '') : null)
    if (cityId && CITY_COORDINATES[cityId]) {
      return { lat: CITY_COORDINATES[cityId].lat, lng: CITY_COORDINATES[cityId].lng }
    }
    return disasterCenter
  }, [showFloodLayer, selectedStressTest, disasterCenter])

  const windCenter = disasterCenter
  const metroCenter = disasterCenter
  
  // Universal stress test action plan template (dateCreated refreshed when modal opens)
  const actionPlanTemplate = useMemo(
    () => ({
      ...UNIVERSAL_ACTION_PLAN_TEMPLATE,
      dateCreated: new Date().toISOString().slice(0, 10),
    }),
    [showActionPlans]
  )

  // Handle entry animation complete
  const handleEntryComplete = useCallback(() => {
    setShowEntry(false)
    setEntryComplete(true)
  }, [])
  
  // WebSocket for real-time updates
  const { status: wsStatus } = useWebSocket({
    url: '/api/v1/streaming/ws/stream',
    onMessage: (msg) => {
      if (msg.type !== 'risk_update') return
      const update = msg as RiskUpdate
      setRecentAlerts((prev) => [update, ...prev.slice(0, 2)])

      // Optional: light portfolio drift for UI feedback, based on real stream deltas
      if (Math.abs(update.risk_score - update.previous_score) > 0.05) {
        const currentWeightedRisk = store.portfolioConfirmed.weightedRisk
        store.updatePortfolio({
          weightedRisk: currentWeightedRisk + (update.risk_score - update.previous_score) * 0.1,
        })
      }
    },
  })

  // Recent Activity: log when Digital Twin is opened (once per open)
  const prevTwinOpenRef = useRef(false)
  useEffect(() => {
    if (showDigitalTwin && !prevTwinOpenRef.current) {
      prevTwinOpenRef.current = true
      const name = focusedHotspot?.name || selectedZoneAsset?.name || 'Digital Twin'
      const id = focusedHotspot?.id || selectedZoneAsset?.id || 'twin'
      store.addEvent(createPlatformEvent(EventTypes.TWIN_OPENED, 'twin', id, { name }))
    }
    if (!showDigitalTwin) prevTwinOpenRef.current = false
  }, [showDigitalTwin, focusedHotspot?.name, focusedHotspot?.id, selectedZoneAsset?.name, selectedZoneAsset?.id, store])

  // Load portfolio summary (initial + periodic refresh every 5 min).
  // Use getState() inside callback to avoid dependency on store — prevents re-running effect on every store update (no request storm / ERR_INSUFFICIENT_RESOURCES).
  // Fetch risk-velocity only when summary did not return MoM to avoid flicker and extra request.
  const fetchPortfolioSummary = useCallback(async (noCache = false) => {
    try {
      const url = noCache ? `${getCommandApi()}/geodata/summary?t=${Date.now()}` : `${getCommandApi()}/geodata/summary`
      const res = await fetch(url, noCache ? { cache: 'no-store' } : undefined)
      if (res.ok) {
        const data = await res.json()
        const momFromSummary = data.risk_velocity_mom_pct != null ? data.risk_velocity_mom_pct : null
        usePlatformStore.getState().setPortfolioConfirmed({
          totalExposure: data.total_exposure ?? 0,
          atRisk: data.at_risk_exposure ?? 0,
          totalExpectedLoss: data.total_expected_loss,
          criticalCount: data.critical_count ?? 0,
          highCount: data.high_count ?? 0,
          mediumCount: data.medium_count ?? 0,
          lowCount: data.low_count ?? 0,
          weightedRisk: data.weighted_risk ?? 0,
          riskVelocityMomPct: momFromSummary,
          riskModelVersion: data.risk_model_version,
          dataSourcesFreshness: data.data_sources_freshness,
        })
        // Only fetch risk-velocity when summary did not return MoM (avoids flicker + reduces requests)
        if (momFromSummary == null) {
          const velRes = await fetch(`${getCommandApi()}/risk-engine/risk-velocity`)
          if (velRes.ok) {
            const velData = await velRes.json()
            const momPct = velData?.risk_velocity?.mom_pct
            if (typeof momPct === 'number') {
              usePlatformStore.getState().updatePortfolio({ riskVelocityMomPct: momPct })
            }
          }
        }
      }
    } catch {
      // Use store defaults
    }
  }, [])

  useEffect(() => {
    fetchPortfolioSummary().finally(() => setIsSceneReady(true))
    const interval = setInterval(fetchPortfolioSummary, 5 * 60 * 1000) // every 5 min
    return () => clearInterval(interval)
  }, [fetchPortfolioSummary])

  // Refetch portfolio when tab/window gains focus so server shows fresh data (not stale cache)
  useEffect(() => {
    const onFocus = () => { fetchPortfolioSummary(true) }
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [fetchPortfolioSummary])

  // Hotspot data for cities - auto-generated from CITY_COORDINATES
  const HOTSPOT_DATA: Record<string, FocusedHotspot> = useMemo(() => {
    const data: Record<string, FocusedHotspot> = {}
    const coastalIds = new Set(['miami', 'amsterdam', 'rotterdam', 'bangkok', 'cologne', 'hochiminh', 'dhaka', 'neworleans', 'singapore', 'hongkong'])
    const seismicIds = new Set(['tokyo', 'sanfrancisco', 'istanbul', 'lima', 'santiago', 'losangeles', 'jakarta'])
    const fireIds = new Set(['sydney', 'losangeles', 'sanfrancisco', 'barcelona', 'athens', 'cairo'])
    const conflictIds = new Set(['kyiv', 'gaza', 'damascus', 'kharkiv', 'telaviv', 'tehran', 'warsaw', 'taipei', 'odesa', 'aleppo', 'sanaa'])
    
    // Generate from CITY_COORDINATES
    Object.entries(CITY_COORDINATES).forEach(([id, coords]) => {
      const risk = coords.risk || 0.5
      const isConflict = risk > 0.9
      const isHighRisk = risk > 0.7
      const fid = id.toLowerCase()
      data[id] = {
        id,
        name: id.charAt(0).toUpperCase() + id.slice(1).replace(/([A-Z])/g, ' $1'),
        region: getRegionForCity(id),
        risk,
        exposure: coords.exposure || 10,
        trend: isHighRisk ? 'up' : 'down',
        factors: {
          climate: isConflict ? 0.3 : (risk * 0.8),
          credit: isConflict ? 0.2 : (risk * 0.6),
          operational: isConflict ? 0.95 : (risk * 0.5),
          geopolitical: isConflict ? 0.9 : (conflictIds.has(fid) ? 0.55 + risk * 0.35 : risk * 0.4),
          flood: coastalIds.has(fid) ? 0.5 + risk * 0.35 : risk * 0.35,
          earthquake: seismicIds.has(fid) ? 0.55 + risk * 0.3 : risk * 0.25,
          fire: fireIds.has(fid) ? 0.5 + risk * 0.35 : risk * 0.3,
          structural: risk * 0.4,
        },
      }
    })
    
    // Override with specific known data (all 7 factors)
    const overrides: Partial<Record<string, Partial<FocusedHotspot>>> = {
      newyork: { name: 'New York City', region: 'North America' },
      tokyo: { name: 'Tokyo', region: 'Asia Pacific', factors: { climate: 0.4, credit: 0.5, operational: 0.5, geopolitical: 0.2, flood: 0.35, earthquake: 0.92, fire: 0.4, structural: 0.45 } },
      london: { name: 'London', region: 'Europe' },
      kyiv: { name: 'Kyiv', region: 'Eastern Europe', factors: { climate: 0.2, credit: 0.1, operational: 0.95, geopolitical: 0.95, flood: 0.25, earthquake: 0.1, fire: 0.2, structural: 0.35 } },
      gaza: { name: 'Gaza City', region: 'Middle East', factors: { climate: 0.1, credit: 0.05, operational: 0.99, geopolitical: 0.99, flood: 0.1, earthquake: 0.1, fire: 0.15, structural: 0.4 } },
      damascus: { name: 'Damascus', region: 'Middle East', factors: { climate: 0.2, credit: 0.1, operational: 0.95, geopolitical: 0.95, flood: 0.2, earthquake: 0.25, fire: 0.2, structural: 0.4 } },
      caracas: { name: 'Caracas', region: 'South America', factors: { climate: 0.3, credit: 0.9, operational: 0.85, geopolitical: 0.4, flood: 0.3, earthquake: 0.2, fire: 0.25, structural: 0.4 } },
      taipei: { name: 'Taipei', region: 'Asia Pacific', factors: { climate: 0.85, credit: 0.4, operational: 0.75, geopolitical: 0.75, flood: 0.7, earthquake: 0.65, fire: 0.5, structural: 0.45 } },
      kharkiv: { name: 'Kharkiv', region: 'Eastern Europe', factors: { climate: 0.2, credit: 0.1, operational: 0.92, geopolitical: 0.92, flood: 0.2, earthquake: 0.1, fire: 0.2, structural: 0.35 } },
      telaviv: { name: 'Tel Aviv', region: 'Middle East', factors: { climate: 0.3, credit: 0.5, operational: 0.85, geopolitical: 0.85, flood: 0.2, earthquake: 0.35, fire: 0.3, structural: 0.4 } },
      sanfrancisco: { factors: { climate: 0.35, credit: 0.5, operational: 0.5, geopolitical: 0.2, flood: 0.3, earthquake: 0.92, fire: 0.45, structural: 0.38 } },
      miami: { factors: { climate: 0.65, credit: 0.45, operational: 0.5, geopolitical: 0.25, flood: 0.82, earthquake: 0.15, fire: 0.35, structural: 0.35 } },
    }
    
    Object.entries(overrides).forEach(([id, override]) => {
      if (data[id]) {
        data[id] = { ...data[id], ...override }
      }
    })
    
    return data
  }, [])
  
  // Helper function to get region for a city
  function getRegionForCity(cityId: string): string {
    const regionMap: Record<string, string> = {
      // North America
      newyork: 'North America', losangeles: 'North America', chicago: 'North America',
      sanfrancisco: 'North America', boston: 'North America', washington: 'North America',
      miami: 'North America', houston: 'North America', denver: 'North America',
      seattle: 'North America', vancouver: 'North America', toronto: 'North America',
      montreal: 'North America', mexicocity: 'North America',
      // Europe
      london: 'Europe', paris: 'Europe', frankfurt: 'Europe', berlin: 'Europe',
      munich: 'Europe', amsterdam: 'Europe', brussels: 'Europe', zurich: 'Europe',
      geneva: 'Europe', rome: 'Europe', milan: 'Europe', madrid: 'Europe',
      barcelona: 'Europe', lisbon: 'Europe', vienna: 'Europe', stockholm: 'Europe',
      oslo: 'Europe', helsinki: 'Europe', copenhagen: 'Europe', dublin: 'Europe',
      athens: 'Europe', warsaw: 'Europe', lyon: 'Europe', marseille: 'Europe',
      cologne: 'Europe', dusseldorf: 'Europe', rotterdam: 'Europe',
      // Eastern Europe
      moscow: 'Eastern Europe', kyiv: 'Eastern Europe', minsk: 'Eastern Europe',
      kharkiv: 'Eastern Europe', odesa: 'Eastern Europe', donetskluhansk: 'Eastern Europe',
      // Asia Pacific
      tokyo: 'Asia Pacific', shanghai: 'Asia Pacific', beijing: 'Asia Pacific',
      hongkong: 'Asia Pacific', singapore: 'Asia Pacific', seoul: 'Asia Pacific',
      taipei: 'Asia Pacific', bangkok: 'Asia Pacific', jakarta: 'Asia Pacific',
      manila: 'Asia Pacific', hochiminh: 'Asia Pacific', hanoi: 'Asia Pacific',
      mumbai: 'Asia Pacific', delhi: 'Asia Pacific', dhaka: 'Asia Pacific',
      karachi: 'Asia Pacific', pyongyang: 'Asia Pacific',
      // Middle East
      dubai: 'Middle East', tehran: 'Middle East', istanbul: 'Middle East',
      telaviv: 'Middle East', cairo: 'Middle East', damascus: 'Middle East',
      aleppo: 'Middle East', sanaa: 'Middle East', gaza: 'Middle East',
      // Africa
      lagos: 'Africa', johannesburg: 'Africa', capetown: 'Africa',
      khartoum: 'Africa', tripoli: 'Africa',
      // South America
      saopaulo: 'South America', riodejaneiro: 'South America', caracas: 'South America',
      // Central Asia
      kabul: 'Central Asia',
      // Australia
      sydney: 'Australia', melbourne: 'Australia',
    }
    return regionMap[cityId] || 'Global'
  }

  // Handle hotspot focus
  const handleHotspotFocus = useCallback((hotspotId: string | null) => {
    console.log('handleHotspotFocus:', hotspotId)
    if (!hotspotId) {
      setFocusedHotspot(null)
      return
    }
    
    // Get real data for this hotspot
    const data = HOTSPOT_DATA[hotspotId.toLowerCase()]
    if (data) {
      console.log('Found hotspot data:', data.name)
      setFocusedHotspot(data)
      store.addEvent(createPlatformEvent(EventTypes.ZONE_SELECTED, 'zone', hotspotId, { name: data.name }))
    } else {
      console.log('Hotspot not found, using default')
      setFocusedHotspot({
        id: hotspotId,
        name: hotspotId,
        region: 'Unknown',
        risk: 0.5,
        exposure: 10,
        trend: 'up',
        factors: { climate: 0.5, credit: 0.5, operational: 0.5, geopolitical: 0.5, flood: 0.5, earthquake: 0.5, fire: 0.5, structural: 0.5 },
      })
      store.addEvent(createPlatformEvent(EventTypes.ZONE_SELECTED, 'zone', hotspotId, { name: hotspotId }))
    }
  }, [store])

  // Handle scenario activation (keyboard shortcut in future)
  const activateScenario = useCallback((type: string, severity: number) => {
    setActiveScenario({ type, severity, active: true })
  }, [])

  const deactivateScenario = useCallback(() => {
    setActiveScenario(null)
    setSelectedStressTest(null)
    setSelectedZone(null)
  }, [])

  // Omniverse / E2CC: open launch URL; if localhost, user needs port-forward 8010 on their machine
  const handleOmniverseOpen = useCallback(async (launchParams?: URLSearchParams) => {
    try {
      const statusRes = await fetch(`${getCommandApi()}/omniverse/status`)
      const status = await statusRes.json()
      const url = launchParams ? `${getCommandApi()}/omniverse/launch?${launchParams}` : `${getCommandApi()}/omniverse/launch`
      const res = await fetch(url)
      const data = await res.json()
      if (data?.launch_url) {
        window.open(data.launch_url, '_blank', 'noopener,noreferrer')
        if (status?.e2cc_use_port_forward) {
          console.info('E2CC: if tab is empty, on Mac run port-forward 8010: brev port-forward saaaliance → 8010, 8010')
        }
      }
    } catch (e) {
      console.warn('Omniverse launch failed:', e)
    }
  }, [])

  // Track if user manually deselected zone (to prevent auto-zoom loop)
  const userDeselectedZoneRef = useRef(false)
  
  // Stress test selection is handled via Digital Twin panel
  
  // Auto-zoom to first zone when a stress test is selected (so globe zooms to a zone with entities).
  // Zones are generated from scenario type: climate → Rhine/North Sea/Po; financial → Frankfurt/London/Paris;
  // regulatory → Banking Sector/Insurance Hub; geopolitical → Eastern Border/Baltic; etc.
  // If user had previously deselected a zone, we still allow zoom on next scenario pick by resetting the ref when scenario changes (see onSelect below).
  useEffect(() => {
    if (activeRiskZones.length > 0 && selectedStressTest && !selectedZone && !userDeselectedZoneRef.current) {
      const timer = setTimeout(() => {
        setSelectedZone(activeRiskZones[0])
        console.log('Auto-zooming to first zone:', activeRiskZones[0].name)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [activeRiskZones, selectedStressTest])

  // Ensure main container can receive focus for keyboard events
  const containerRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    // Focus the container on mount to enable keyboard shortcuts
    if (containerRef.current) {
      containerRef.current.focus()
    }
  }, [])

  // Fetch registry scenarios (library + extended) for Focused Zone panel
  useEffect(() => {
    Promise.all([
      fetch(`${getCommandApi()}/stress-tests/scenarios/library`).then((r) => (r.ok ? r.json() : [])),
      fetch(`${getCommandApi()}/stress-tests/scenarios/extended`).then((r) => (r.ok ? r.json() : { categories: [] })),
    ])
      .then(([lib, ext]) => {
        const flat = Array.isArray(lib) ? lib : []
        const cats = ext?.categories ?? []
        const fromExt = cats.flatMap((c: { scenarios?: unknown[] }) => c.scenarios ?? [])
        setRegistryScenariosFlat([...flat, ...fromExt])
      })
      .catch(() => {})
  }, [])

  // Fetch high-fidelity scenario IDs (WRF/ADCIRC) for disaster layer source option
  useEffect(() => {
    fetch(`${getCommandApi()}/climate/high-fidelity/scenarios`)
      .then((r) => (r.ok ? r.json() : { scenario_ids: [] }))
      .then((data: { scenario_ids?: string[] }) => {
        const ids = data?.scenario_ids ?? []
        setHighFidelityScenarioIds(ids)
        // Clear selection if current value is not in the list (avoids "ghost" value / dash in select)
        setHighFidelityScenarioId((prev) => (prev && ids.length && ids.includes(prev) ? prev : null))
      })
      .catch(() => {})
  }, [])

  // Fetch GPU / NIM / Omniverse / DFM status for bottom bar
  useEffect(() => {
    Promise.all([
      fetch(`${getCommandApi()}/nvidia/nim/health`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${getCommandApi()}/data-federation/status`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch(`${getCommandApi()}/omniverse/status`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([nim, dfm, omni]) => {
      setNimHealth(nim)
      setDfmStatus(dfm)
      setOmniverseStatus(omni)
    })
  }, [])

  // Run weather_forecast pipeline (FourCastNet NIM) for visibility
  const handleTestWeatherNim = useCallback(async () => {
    setWeatherTestLoading(true)
    setWeatherTestResult(null)
    setWeatherForecastData(null)
    try {
      const res = await fetch(`${getCommandApi()}/data-federation/pipelines/weather_forecast/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          region: { lat: 25.76, lon: -80.19, radius_km: 100 },
          time_range: { days_back: 0 },
          options: { simulation_length: 4 },
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setWeatherTestResult(`Error: ${data?.detail || res.status}`)
        return
      }
      const forecast = data?.artifacts?.forecast
      const list = forecast?.forecasts
      if (Array.isArray(list) && list.length > 0) {
        setWeatherForecastData({
          forecasts: list,
          latitude: forecast.latitude ?? 25.76,
          longitude: forecast.longitude ?? -80.19,
          model: forecast.model ?? 'fourcastnet-nim',
        })
      }
      const steps = list?.length ?? data?.meta?.steps ?? 0
      setWeatherTestResult(steps ? `${steps} steps from FourCastNet NIM ✓` : 'No forecast data')
      setTimeout(() => setWeatherTestResult(null), 6000)
    } catch (e) {
      setWeatherTestResult(`Failed: ${e instanceof Error ? e.message : 'network'}`)
      setTimeout(() => setWeatherTestResult(null), 5000)
    } finally {
      setWeatherTestLoading(false)
    }
  }, [])

  return (
    <div 
      ref={containerRef}
      className="fixed inset-0 overflow-hidden font-sans scene-bg-quantum"
      style={{ fontFamily: "'JetBrains Mono', monospace" }}
      tabIndex={0}
      onKeyDown={() => {
        // This is a fallback - main handler is in KeyboardHandler component
        // But we ensure the container can receive focus
      }}
    >
      {/* ============================================ */}
      {/* ENTRY ANIMATION - Shows on first load */}
      {/* ============================================ */}
      <AnimatePresence>
        {showEntry && (
          <EntryAnimation onComplete={handleEntryComplete} />
        )}
      </AnimatePresence>
      
      {/* ============================================ */}
      {/* SCENE LAYER - Full screen, Earth dominates */}
      {/* Paused when Digital Twin is open to prevent WebGL context conflicts */}
      {/* Animates to left 40% when Command Mode is active */}
      {/* ============================================ */}
      <motion.div 
        className={`absolute top-0 left-0 transition-opacity duration-300 ${
          showDigitalTwin ? 'opacity-0 pointer-events-none' : 'opacity-100'
        } ${commandMode ? 'overflow-hidden rounded-md border border-zinc-700 shadow-2xl bg-zinc-900' : ''}`}
        animate={{
          width: commandMode ? '40%' : '100%',
          height: commandMode ? '55%' : '100%',
        }}
        transition={{ duration: 0.5, ease: 'easeInOut' }}
      >
        <CesiumGlobe 
          onAssetSelect={handleHotspotFocus}
          selectedAsset={flyToHotspotId}
          scenario={activeScenario?.type}
          resetViewTrigger={resetViewTrigger}
          onHotspotsLoaded={(spots) => setAvailableZones(spots.map(s => ({ id: s.id, name: s.name, risk: s.risk })))}
          riskZones={activeRiskZones}
          selectedZone={selectedZone}
          onZoneClick={(zone) => {
            if (zone) {
              console.log('Zone selected:', zone.name, 'with', zone.assets?.length, 'assets')
              setSelectedZone(zone)
            }
          }}
          showDependencies={showDependencies}
          selectedZoneForDependencies={dependencyZoneId}
          onZoneAssetClick={(asset) => {
            if (asset) {
              console.log('Asset clicked:', asset.name, '- opening Digital Twin with OSM Buildings')
              // Save asset for Digital Twin and open panel
              setSelectedZoneAsset(asset)
              setShowDigitalTwin(true)
            }
          }}
          paused={showDigitalTwin}
          activeRiskFilter={expandedRiskLevel}
          focusedHotspotId={focusedHotspot?.id}
          showFloodLayer={showFloodLayer}
          floodCenter={floodCenter}
          floodDepthOverride={floodDepthOverride}
          showWindLayer={showWindLayer}
          windCenter={windCenter}
          showMetroFloodLayer={showMetroFloodLayer}
          metroCenter={metroCenter}
          showHeatLayer={showHeatLayer}
          showHeavyRainLayer={showHeavyRainLayer}
          showDroughtLayer={showDroughtLayer}
          showUvLayer={showUvLayer}
          showEarthquakeLayer={showEarthquakeLayer}
          earthquakeMinMagnitude={earthquakeMinMagnitude}
          showActiveIncidentsLayer={showActiveIncidentsLayer}
          anomalyCenter={floodCenter}
          highFidelityFloodScenarioId={highFidelityScenarioId}
          highFidelityWindScenarioId={highFidelityScenarioId}
          showGoogle3dLayer={showGoogle3dLayer}
          showH3Layer={showZoneRiskVector ? true : showH3Layer}
          h3Resolution={showZoneRiskVector ? zoneRiskVectorResolution : h3Resolution}
          h3VectorDimension={showZoneRiskVector ? zoneRiskVectorDimension : null}
          timeSliderValue={timeSliderValue}
          onTimeSliderChange={(iso) => setTimeSliderValue(iso)}
          czmlUrl={czmlUrl}
          stressTestCzmlUrl={stressTestCzmlUrl}
          onClimateZoneDoubleClick={(info) => {
            const cityId = CLIMATE_CITY_DISPLAY_TO_ID[info.cityName] ?? info.cityName.toLowerCase().replace(/\s+/g, '').replace(/,/g, '')
            const coords = CITY_COORDINATES[cityId]
            const hotspotData = HOTSPOT_DATA[cityId]
            const hotspot: FocusedHotspot = hotspotData ?? {
              id: cityId,
              name: info.cityName,
              region: '',
              risk: coords?.risk ?? 0.5,
              exposure: coords?.exposure ?? 10,
              trend: 'up',
              factors: {
                climate: 0.5,
                credit: 0.5,
                operational: 0.5,
                geopolitical: 0.5,
                flood: 0.5,
                earthquake: 0.5,
                fire: 0.5,
                structural: 0.5,
              },
            }
            setFocusedHotspot(hotspot)
            store.addEvent(createPlatformEvent(EventTypes.ZONE_SELECTED, 'zone', cityId, { name: info.cityName }))
            const lat = coords?.lat ?? info.lat
            const lng = coords?.lng ?? info.lng
            setSelectedZoneAsset({
              id: cityId,
              name: info.cityName,
              type: 'city',
              latitude: lat,
              longitude: lng,
              exposure: coords?.exposure ?? 10,
              impactSeverity: coords?.risk ?? 0.5,
            })
            // Set layer for the risk type clicked so Digital Twin shows impact zone
            const rt = info.riskType
            if (rt === 'flood') setShowFloodLayer(true)
            else if (rt === 'metro') { setShowMetroFloodLayer(true); setShowFloodLayer(true) }
            else if (rt === 'wind') setShowWindLayer(true)
            else if (rt === 'heat') setShowHeatLayer(true)
            else if (rt === 'heavy_rain') setShowHeavyRainLayer(true)
            else if (rt === 'drought') setShowDroughtLayer(true)
            else if (rt === 'uv') setShowUvLayer(true)
            else if (rt === 'earthquake') setShowEarthquakeLayer(true)
            setClimateTriggerRiskType(rt ?? null)
            setClimateTriggerCityId(cityId)
            setShowDigitalTwin(true)
          }}
          focusCoordinates={focusCoordinatesForGlobe}
          viewMode={viewMode}
          selectedCountryCode={selectedCountryCode}
          countryCompositeRisk={countryRiskData?.composite_risk}
          onCountryClick={(country) => navigateToCountry(country.code, country.name)}
          onCityClick={(city) => navigateToCity(city)}
        />
      </motion.div>
      
      {/* ============================================ */}
      {/* COMMAND MODE PANEL - Shows when toggled */}
      {/* 4-panel grid with live stress test data */}
      {/* ============================================ */}
      <AnimatePresence>
        {commandMode && !showDigitalTwin && (
          <CommandModePanel
            stressTest={store.activeStressTest}
            selectedZone={selectedZone}
            portfolio={portfolio}
            onClose={toggleCommandMode}
          />
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* UI LAYER - HUD overlay, minimal, no frames */}
      {/* ============================================ */}
      <AnimatePresence>
        {isSceneReady && entryComplete && (
          <>
            {/* ============================================ */}
            {/* TOP LEFT - Search + Breadcrumb (hidden when Digital Twin is open so it does not overlay the panel) */}
            {/* ============================================ */}
            {!showDigitalTwin && (
            <motion.div
              className="absolute top-5 left-8 z-[60] pointer-events-auto max-w-[320px]"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
            >
              <div className="flex flex-col gap-2">
                {/* Fixed row: Global + Search (never shifts) */}
                <div className="flex items-center gap-3">
                  <button
                    onClick={navigateToGlobal}
                    className={`px-2 py-0.5 rounded-full transition-all shrink-0 ${viewMode === 'global' ? 'bg-zinc-700 text-zinc-100' : 'text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800'}`}
                  >
                    Global
                  </button>
                  {/* Search input */}
                  <div className="relative">
                    <input
                      ref={countrySearchInputRef}
                      type="text"
                      value={countrySearchQuery}
                      onChange={(e) => {
                        setCountrySearchQuery(e.target.value)
                        setCountrySearchOpen(e.target.value.length > 0)
                      }}
                      onFocus={() => { if (countrySearchQuery.length > 0) setCountrySearchOpen(true) }}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') {
                          setCountrySearchOpen(false)
                          setCountrySearchQuery('')
                          countrySearchInputRef.current?.blur()
                        }
                      }}
                      placeholder="Search country…"
                      className="w-36 sm:w-40 pl-6 pr-2.5 py-1 rounded-full bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs placeholder:text-zinc-600 focus:outline-none focus:ring-1 focus:ring-zinc-500/50 focus:border-zinc-500/50"
                    />
                    <svg className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
                    </svg>

                    {/* Search dropdown */}
                    {countrySearchOpen && countrySearchQuery.length > 0 && (
                      <>
                        {/* Invisible backdrop to close on outside click */}
                        <div className="fixed inset-0 z-[99]" onClick={() => setCountrySearchOpen(false)} />
                      <div className="absolute top-full mt-1 left-0 w-64 max-h-64 overflow-y-auto rounded-md bg-zinc-900/95 border border-zinc-700 shadow-2xl z-[100]">
                        {countriesList
                          .filter(c => c.name.toLowerCase().includes(countrySearchQuery.toLowerCase()) || c.code.toLowerCase().includes(countrySearchQuery.toLowerCase()))
                          .slice(0, 12)
                          .map(c => (
                            <button
                              key={c.code}
                              onClick={() => navigateToCountry(c.code, c.name)}
                              className="w-full text-left px-3 py-2 text-xs text-zinc-200 hover:bg-zinc-700 hover:text-zinc-100 flex items-center justify-between transition-colors"
                            >
                              <span className="font-medium">{c.name}</span>
                              <span className="text-zinc-600 text-[10px]">{c.code} · {c.region}</span>
                            </button>
                          ))
                        }
                        {countriesList.filter(c => c.name.toLowerCase().includes(countrySearchQuery.toLowerCase())).length === 0 && (
                          <div className="px-3 py-3 text-xs text-zinc-500 text-center">No countries found</div>
                        )}
                      </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Dynamic row: selected country/city chips */}
                {(selectedCountryName || selectedCountryCity) && viewMode !== 'country' && (
                  <div className="flex items-center gap-1.5 text-[11px] font-medium flex-wrap min-h-[20px]">
                    {selectedCountryName && (
                      <button
                        onClick={navigateBackToCountry}
                        className="px-2 py-0.5 rounded-full transition-all shrink-0 truncate max-w-[140px] text-zinc-500 hover:text-zinc-200 hover:bg-zinc-800"
                      >
                        {selectedCountryName}
                      </button>
                    )}
                    {selectedCountryCity && (
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shrink-0 truncate max-w-[120px]">
                        {selectedCountryCity.name}
                      </span>
                    )}
                  </div>
                )}

              </div>
            </motion.div>
            )}

            <CommandCenterTopBar
              commandMode={commandMode}
              topBarExpanded={topBarExpanded}
              setTopBarExpanded={setTopBarExpanded}
              highFidelityScenarioId={highFidelityScenarioId}
              setHighFidelityScenarioId={setHighFidelityScenarioId}
              highFidelityScenarioIds={highFidelityScenarioIds}
              selectedCountryCode={selectedCountryCode}
              selectedCountryCity={selectedCountryCity}
              showGoogle3dLayer={showGoogle3dLayer}
              setShowGoogle3dLayer={setShowGoogle3dLayer}
              showZoneRiskVector={showZoneRiskVector}
              showH3Layer={showH3Layer}
              setShowH3Layer={setShowH3Layer}
              setShowZoneRiskVector={setShowZoneRiskVector}
              showZoneRiskVectorPanel={showZoneRiskVectorPanel}
              setShowZoneRiskVectorPanel={setShowZoneRiskVectorPanel}
              zoneRiskVectorDimension={zoneRiskVectorDimension}
              setZoneRiskVectorDimension={setZoneRiskVectorDimension}
              zoneRiskVectorResolution={zoneRiskVectorResolution}
              setZoneRiskVectorResolution={setZoneRiskVectorResolution}
              timeSliderValue={timeSliderValue}
              setTimeSliderValue={setTimeSliderValue}
              h3Resolution={h3Resolution}
              setH3Resolution={setH3Resolution}
              showFloodLayer={showFloodLayer}
              setShowFloodLayer={setShowFloodLayer}
              showWindLayer={showWindLayer}
              setShowWindLayer={setShowWindLayer}
              showMetroFloodLayer={showMetroFloodLayer}
              setShowMetroFloodLayer={setShowMetroFloodLayer}
              showHeatLayer={showHeatLayer}
              setShowHeatLayer={setShowHeatLayer}
              showHeavyRainLayer={showHeavyRainLayer}
              setShowHeavyRainLayer={setShowHeavyRainLayer}
              showDroughtLayer={showDroughtLayer}
              setShowDroughtLayer={setShowDroughtLayer}
              showUvLayer={showUvLayer}
              setShowUvLayer={setShowUvLayer}
              showActiveIncidentsLayer={showActiveIncidentsLayer}
              setShowActiveIncidentsLayer={setShowActiveIncidentsLayer}
              showEarthquakeLayer={showEarthquakeLayer}
              setShowEarthquakeLayer={setShowEarthquakeLayer}
              earthquakeMinMagnitude={earthquakeMinMagnitude}
              setEarthquakeMinMagnitude={setEarthquakeMinMagnitude}
              floodDepthOverride={floodDepthOverride}
              setFloodDepthOverride={setFloodDepthOverride}
            />
            
            {/* TOP LEFT - Institutional KPIs (Board-level, € denominated) */}
            {/* CITY MODE: ClimateShield Local label with back button */}
            {!commandMode && viewMode === 'city' && selectedCountryCity && (
              <motion.div
                className="absolute top-16 left-8 pointer-events-auto z-50"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.4 }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <button onClick={navigateBackToCountry} className="text-zinc-500 hover:text-zinc-200 transition-colors" title="Back to Country">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                  </button>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 flex items-center gap-1">
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" /></svg>
                      ClimateShield Local
                    </div>
                    <div className="text-zinc-100 text-lg font-bold tracking-wide">{selectedCountryCity.name}</div>
                    {selectedCountryName && <div className="text-zinc-600 text-xs">{selectedCountryName}</div>}
                  </div>
                </div>
                <div className="text-zinc-500 text-[10px] px-2 py-1 rounded bg-zinc-800 border border-zinc-700 inline-block">
                  Risk Assessment · Adaptation · Grants · Early Warning
                </div>
              </motion.div>
            )}

            {/* COUNTRY MODE: Country KPIs + City list */}
            {!commandMode && viewMode === 'country' && countryRiskData && (
              <motion.div 
                className="absolute top-16 left-8 pointer-events-auto max-h-[80vh] overflow-y-auto"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.5 }}
              >
                {/* Country name + back button */}
                <div className="flex items-center gap-2 mb-4">
                  <button onClick={navigateToGlobal} className="text-zinc-500 hover:text-zinc-200 transition-colors" title="Back to Globe">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" /></svg>
                  </button>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">Country Mode</div>
                    <div className="text-zinc-100 text-lg font-bold tracking-wide">{selectedCountryName}</div>
                  </div>
                </div>

                {/* Country Risk Score */}
                <div className="mb-4">
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Country Risk Posture</div>
                  <div className={`text-2xl font-bold tracking-wide ${
                    countryRiskData.risk_level === 'critical' ? 'text-red-400/80' :
                    countryRiskData.risk_level === 'high' ? 'text-orange-400/80' :
                    countryRiskData.risk_level === 'medium' ? 'text-yellow-400/80' :
                    'text-emerald-400/80'
                  }`}>
                    {(countryRiskData.composite_risk * 100).toFixed(0)}%
                    <span className="text-sm ml-2 font-normal uppercase">{countryRiskData.risk_level}</span>
                  </div>
                </div>

                {/* Country Stats */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Cities Monitored</div>
                    <div className="text-zinc-100 text-lg font-extralight">
                      {countryCitiesFromData.length > 0 ? countryCitiesFromData.length : countryRiskData.cities_count}
                    </div>
                  </div>
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-0.5">Total Exposure</div>
                    <div className="text-zinc-100 text-lg font-extralight">${countryRiskData.total_exposure_b}B</div>
                  </div>
                </div>

                {/* Hazard Breakdown */}
                {Object.keys(countryRiskData.hazards).length > 0 && (
                  <div className="mb-4">
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Hazard Breakdown</div>
                    <div className="space-y-1.5">
                      {Object.entries(countryRiskData.hazards).sort(([,a], [,b]) => b - a).map(([hazard, score]) => (
                        <div key={hazard} className="flex items-center gap-2">
                          <div className="text-zinc-500 text-[10px] capitalize w-20 truncate">{hazard}</div>
                          <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                score > 0.7 ? 'bg-red-400/80' : score > 0.5 ? 'bg-orange-400/80' : score > 0.3 ? 'bg-yellow-400/80' : 'bg-emerald-400/80'
                              }`}
                              style={{ width: `${Math.min(score * 100, 100)}%` }}
                            />
                          </div>
                          <div className="text-zinc-400 text-[10px] font-mono w-8 text-right">{(score * 100).toFixed(0)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Cities — prefer 20 from cities-by-country; fallback to API top_cities */}
                {((countryRiskData.top_cities.length > 0) || (countryCitiesFromData.length > 0)) && (
                  <div>
                    <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                      Major Cities {countryCitiesFromData.length > 0 ? '(by population)' : '(risk from system)'}
                    </div>
                    <div className="space-y-1">
                      {(
                        countryCitiesFromData.length > 0
                          ? countryCitiesFromData
                          : countryRiskData.top_cities
                      ).slice(0, 20).map((city, i) => {
                        const riskCity = city as { risk_score?: number; exposure_b?: number }
                        // Build API risk lookup from top_cities
                        const apiCity = countryRiskData.top_cities.find(
                          tc => tc.name.toLowerCase() === city.name.toLowerCase()
                        )
                        let risk: number
                        if (typeof riskCity.risk_score === 'number') {
                          risk = riskCity.risk_score
                        } else if (apiCity) {
                          risk = apiCity.risk_score
                        } else {
                          // Deterministic variation based on city name (same hash as CesiumGlobe)
                          let hash = 0
                          for (let j = 0; j < city.name.length; j++) {
                            hash = ((hash << 5) - hash + city.name.charCodeAt(j)) | 0
                          }
                          const offset = ((hash % 40) - 20) / 100
                          risk = Math.max(0.05, Math.min(0.98, countryRiskData.composite_risk + offset))
                        }
                        return (
                          <button
                            key={city.id}
                            onClick={() => navigateToCity(city)}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-zinc-800 transition-colors group text-left"
                          >
                            <span className="text-zinc-600 text-[10px] w-4">{i + 1}</span>
                            <span className="flex-1 text-zinc-300 text-xs group-hover:text-zinc-100 transition-colors truncate">{city.name}</span>
                            <span className={`text-[10px] font-mono ${
                              risk >= 0.75 ? 'text-red-400/80' : risk >= 0.55 ? 'text-orange-400/80' : risk >= 0.35 ? 'text-yellow-400/80' : 'text-emerald-400/80'
                            }`}>{(risk * 100).toFixed(0)}%</span>
                            {typeof riskCity.exposure_b === 'number' && (
                              <span className="text-zinc-600 text-[10px]">${riskCity.exposure_b}B</span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Country Stress Test Button */}
                <div className="mt-4 pt-3 border-t border-white/5">
                  <button
                    onClick={() => setShowStressTestSelector(true)}
                    className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-300 text-xs font-medium hover:bg-zinc-700 transition-all"
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
                    </svg>
                    Run Stress Test for {selectedCountryName}
                  </button>
                  {selectedStressTest && (
                    <div className="mt-2 px-2 py-1.5 rounded bg-zinc-800 border border-zinc-700">
                      <div className="flex items-center justify-between">
                        <span className="text-zinc-500 text-[10px]">Active:</span>
                        <span className="text-zinc-300 text-[10px] truncate ml-1">{selectedStressTest.name}</span>
                      </div>
                      <div className="flex items-center justify-between mt-0.5">
                        <span className="text-zinc-500 text-[10px]">Severity:</span>
                        <span className="text-zinc-300 text-[10px]">{(selectedStressTest.severity * 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            )}

            {/* GLOBAL MODE: Standard KPIs (below breadcrumb) */}
            {!commandMode && viewMode === 'global' && (
              <motion.div 
                className="absolute top-14 left-8 pointer-events-auto min-w-[220px]"
                initial={{ opacity: 0, x: -30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8, delay: 0.3 }}
              >
              {/* GLOBAL RISK POSTURE - Hero metric */}
              <div className="mb-5">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                  Global Risk Posture
                </div>
                <div className={`text-2xl font-bold tracking-wide ${getRiskPosture(portfolio.weightedRisk).color}`}>
                  {getRiskPosture(portfolio.weightedRisk).level} {getRiskPosture(portfolio.weightedRisk).arrow}
                </div>
                <div className="text-zinc-500 text-[10px] mt-1" title="Data refresh / risk model">
                  Data: {portfolio.dataSourcesFreshness ?? '—'} · Risk model v{portfolio.riskModelVersion ?? 1}
                  {portfolio.riskModelVersion === 2 && ' (live)'}
                </div>
              </div>
              
              {/* Capital at Risk (30d) */}
              <div className="mb-4">
                <div
                  className="relative"
                  onMouseEnter={() => setMetricTooltip('exposure')}
                  onMouseLeave={() => setMetricTooltip(null)}
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
                    Capital at Risk (30d)
                    <InformationCircleIcon className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  </div>
                  {metricTooltip === 'exposure' && (
                    <div className="absolute left-0 bottom-full mb-1 z-[100] min-w-[240px] max-w-[300px] px-3 py-2 rounded-md bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-xs shadow-xl pointer-events-auto">
                      30-day Capital at Risk (CaR). Based on simulated loss scenarios across all monitored assets.
                      <span className="block mt-2 pt-2 border-t border-zinc-700 text-cyan-300/90">90% CI: {formatEur((portfolio.atRisk ?? 0) * 0.93, 'millions')}–{formatEur((portfolio.atRisk ?? 0) * 1.07, 'millions')} <span className="text-zinc-500">(illustrative)</span></span>
                    </div>
                  )}
                </div>
                <div className="text-zinc-100 text-3xl font-extralight tracking-tight">
                  {formatEur(portfolio.atRisk ?? 0, 'millions')}
                </div>
                <div className="text-zinc-500 text-[10px] mt-0.5 font-mono">± ~7% interval</div>
              </div>
              
              {/* Stress Loss P95 */}
              <div className="mb-4">
                <div
                  className="relative"
                  onMouseEnter={() => setMetricTooltip('atRisk')}
                  onMouseLeave={() => setMetricTooltip(null)}
                >
                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1 flex items-center gap-1">
                    Stress Loss (P95)
                    <InformationCircleIcon className="w-3 h-3 text-zinc-600 flex-shrink-0" />
                  </div>
                  {metricTooltip === 'atRisk' && (
                    <div className="absolute left-0 bottom-full mb-1 z-[100] min-w-[240px] max-w-[300px] px-3 py-2 rounded-md bg-zinc-900/95 border border-zinc-700 text-zinc-100 text-xs shadow-xl pointer-events-auto">
                      95th percentile loss under severe but plausible scenarios. Used for capital allocation decisions.
                      <span className="block mt-2 pt-2 border-t border-zinc-700 text-cyan-300/90">90% CI: {formatEur(((typeof portfolio.totalExpectedLoss === 'number' && portfolio.totalExpectedLoss > 0) ? portfolio.totalExpectedLoss : (portfolio.atRisk ?? 0) * 0.75) * 0.9, 'millions')}–{formatEur(((typeof portfolio.totalExpectedLoss === 'number' && portfolio.totalExpectedLoss > 0) ? portfolio.totalExpectedLoss : (portfolio.atRisk ?? 0) * 0.75) * 1.1, 'millions')} <span className="text-zinc-500">(illustrative)</span></span>
                    </div>
                  )}
                </div>
                <div className={`text-2xl font-extralight ${getRiskColor(portfolio.weightedRisk)}`}>
                  {formatEur(
                    (typeof portfolio.totalExpectedLoss === 'number' && portfolio.totalExpectedLoss > 0)
                      ? portfolio.totalExpectedLoss
                      : (portfolio.atRisk ?? 0) * 0.75,
                    'millions'
                  )}
                </div>
                <div className="text-zinc-500 text-[10px] mt-0.5 font-mono">± ~10% interval</div>
              </div>
              
              {/* Risk Velocity */}
              <div className="mb-4">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-1">
                  Risk Velocity
                </div>
                <div className="text-xl font-extralight text-zinc-500">
                  {typeof portfolio.riskVelocityMomPct === 'number'
                    ? `${portfolio.riskVelocityMomPct >= 0 ? '+' : ''}${Number(portfolio.riskVelocityMomPct).toFixed(1)}% MoM`
                    : '—'}
                  {typeof portfolio.riskVelocityMomPct === 'number' && portfolio.riskVelocityMomPct === 0 && (
                    <span className="text-zinc-600 text-sm ml-2">(no change)</span>
                  )}
                  {typeof portfolio.riskVelocityMomPct !== 'number' && (
                    <span className="text-zinc-600 text-sm ml-2">MoM (from posture snapshots)</span>
                  )}
                </div>
                {typeof portfolio.riskVelocityMomPct !== 'number' && (
                  <p className="text-zinc-600 text-[10px] mt-1">Run stress tests or save posture to see change vs last month.</p>
                )}
              </div>
              
              {/* Risk Level Indicators - Clickable */}
              <div className="flex items-center justify-between mb-2">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                  Risk Zones
                </div>
              </div>
              <div className="space-y-1.5">
                {/* Critical */}
                <RiskLevelRow
                  level="critical"
                  label="Critical"
                  color="red"
                  zones={availableZones.filter(z => z.risk > 0.8)}
                  countOverride={portfolio.criticalCount}
                  isExpanded={expandedRiskLevel === 'critical'}
                  onToggle={() => setExpandedRiskLevel('critical')}
                  onZoneClick={(id) => { handleHotspotFocus(id) }}
                  onZoneLinksClick={(id) => {
                    handleHotspotFocus(id)
                    setDependencyZoneId((prev) => (prev === id ? null : id))
                  }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel('critical')
                  }}
                  onOpenDigitalTwin={(cityId, cityName, eventId, eventName, eventCategory, timeHorizon) => {
                    // Find city coordinates from affectedRegions or use default
                    const cityCoords = findCityCoordinates(cityId)
                    console.log('onOpenDigitalTwin called:', { cityId, cityName, eventName, eventCategory, timeHorizon })
                    if (cityCoords) {
                      // Clear focused hotspot to avoid conflicts
                      setFocusedHotspot(null)
                      setSelectedZoneAsset({
                        id: cityId,
                        name: cityName,
                        type: 'city',
                        latitude: cityCoords.lat,
                        longitude: cityCoords.lng,
                        exposure: cityCoords.exposure || 10,
                        impactSeverity: cityCoords.risk || 0.8,
                      })
                    } else {
                      console.warn('City coordinates not found for:', cityId)
                    }
                    setSelectedDigitalTwinEvent(eventId || null)
                    setSelectedDigitalTwinEventName(eventName || null)
                    setSelectedDigitalTwinEventCategory(eventCategory || null)
                    setSelectedDigitalTwinTimeHorizon(timeHorizon || null)
                    setShowDigitalTwin(true)
                    setExpandedRiskLevel('critical')
                  }}
                />
                {/* High */}
                <RiskLevelRow
                  level="high"
                  label="High"
                  color="orange"
                  zones={availableZones.filter(z => z.risk > 0.6 && z.risk <= 0.8)}
                  countOverride={portfolio.highCount}
                  isExpanded={expandedRiskLevel === 'high'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'high' ? 'critical' : 'high')}
                  onZoneClick={(id) => { handleHotspotFocus(id) }}
                  onZoneLinksClick={(id) => {
                    handleHotspotFocus(id)
                    setDependencyZoneId((prev) => (prev === id ? null : id))
                  }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel('critical')
                  }}
                  onOpenDigitalTwin={(cityId, cityName, eventId, eventName, eventCategory, timeHorizon) => {
                    const cityCoords = findCityCoordinates(cityId)
                    console.log('onOpenDigitalTwin (High):', { cityId, cityName, eventName })
                    if (cityCoords) {
                      setFocusedHotspot(null)
                      setSelectedZoneAsset({
                        id: cityId,
                        name: cityName,
                        type: 'city',
                        latitude: cityCoords.lat,
                        longitude: cityCoords.lng,
                        exposure: cityCoords.exposure || 10,
                        impactSeverity: cityCoords.risk || 0.7,
                      })
                    }
                    setSelectedDigitalTwinEvent(eventId || null)
                    setSelectedDigitalTwinEventName(eventName || null)
                    setSelectedDigitalTwinEventCategory(eventCategory || null)
                    setSelectedDigitalTwinTimeHorizon(timeHorizon || null)
                    setShowDigitalTwin(true)
                    setExpandedRiskLevel('critical')
                  }}
                />
                {/* Medium */}
                <RiskLevelRow
                  level="medium"
                  label="Medium"
                  color="yellow"
                  zones={availableZones.filter(z => z.risk > 0.4 && z.risk <= 0.6)}
                  countOverride={portfolio.mediumCount}
                  isExpanded={expandedRiskLevel === 'medium'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'medium' ? 'critical' : 'medium')}
                  onZoneClick={(id) => { handleHotspotFocus(id) }}
                  onZoneLinksClick={(id) => {
                    handleHotspotFocus(id)
                    setDependencyZoneId((prev) => (prev === id ? null : id))
                  }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel('critical')
                  }}
                  onOpenDigitalTwin={(cityId, cityName, eventId, eventName, eventCategory, timeHorizon) => {
                    const cityCoords = findCityCoordinates(cityId)
                    console.log('onOpenDigitalTwin (Medium):', { cityId, cityName, eventName })
                    if (cityCoords) {
                      setFocusedHotspot(null)
                      setSelectedZoneAsset({
                        id: cityId,
                        name: cityName,
                        type: 'city',
                        latitude: cityCoords.lat,
                        longitude: cityCoords.lng,
                        exposure: cityCoords.exposure || 10,
                        impactSeverity: cityCoords.risk || 0.5,
                      })
                    }
                    setSelectedDigitalTwinEvent(eventId || null)
                    setSelectedDigitalTwinEventName(eventName || null)
                    setSelectedDigitalTwinEventCategory(eventCategory || null)
                    setSelectedDigitalTwinTimeHorizon(timeHorizon || null)
                    setShowDigitalTwin(true)
                    setExpandedRiskLevel('critical')
                  }}
                />
                {/* Low */}
                <RiskLevelRow
                  level="low"
                  label="Low"
                  color="green"
                  zones={availableZones.filter(z => z.risk <= 0.4)}
                  countOverride={portfolio.lowCount}
                  isExpanded={expandedRiskLevel === 'low'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'low' ? 'critical' : 'low')}
                  onZoneClick={(id) => { handleHotspotFocus(id) }}
                  onZoneLinksClick={(id) => {
                    handleHotspotFocus(id)
                    setDependencyZoneId((prev) => (prev === id ? null : id))
                  }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel('critical')
                  }}
                  onOpenDigitalTwin={(cityId, cityName, eventId, eventName, eventCategory, timeHorizon) => {
                    const cityCoords = findCityCoordinates(cityId)
                    console.log('onOpenDigitalTwin (Low):', { cityId, cityName, eventName })
                    if (cityCoords) {
                      setFocusedHotspot(null)
                      setSelectedZoneAsset({
                        id: cityId,
                        name: cityName,
                        type: 'city',
                        latitude: cityCoords.lat,
                        longitude: cityCoords.lng,
                        exposure: cityCoords.exposure || 10,
                        impactSeverity: cityCoords.risk || 0.3,
                      })
                    }
                    setSelectedDigitalTwinEvent(eventId || null)
                    setSelectedDigitalTwinEventName(eventName || null)
                    setSelectedDigitalTwinEventCategory(eventCategory || null)
                    setSelectedDigitalTwinTimeHorizon(timeHorizon || null)
                    setShowDigitalTwin(true)
                    setExpandedRiskLevel('critical')
                  }}
                />
              </div>

              {/* Stress Lab removed - integrated into Risk Zones */}
              </motion.div>
            )}

            {/* TOP RIGHT - Unified Stress Test + Zone Panel (single panel when stress test active) */}
            <AnimatePresence>
              {activeScenario && !commandMode && (
                <motion.div
                  className="absolute top-8 right-8 pointer-events-auto panel-glow-quantum-violet rounded-lg"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                >
                  <UnifiedStressTestPanel
                    activeScenario={activeScenario}
                    portfolio={{ atRisk: portfolio.atRisk, criticalCount: portfolio.criticalCount }}
                    zone={selectedZone && activeScenario ? {
                      id: selectedZone.id,
                      name: selectedZone.name || 'Risk Zone',
                      level: selectedZone.zone_level,
                      stressTestName: activeScenario.type,
                      metrics: {
                        totalExposure: selectedZone.total_exposure || 10,
                        expectedLoss: (selectedZone.total_exposure || 10) * selectedZone.risk_score * 0.3,
                        recoveryMonths: Math.ceil(12 + selectedZone.risk_score * 24),
                        affectedCount: selectedZone.assets?.length || selectedZone.affected_assets_count || 0,
                        riskScore: selectedZone.risk_score,
                      },
                      entities: (selectedZone.assets || []).map(asset => ({
                        id: asset.id,
                        name: asset.name,
                        type: asset.type,
                        exposure: asset.exposure,
                        impactSeverity: asset.impactSeverity,
                        location: selectedZone.name || 'Zone',
                      })),
                    } : null}
                    onCloseScenario={deactivateScenario}
                    onCloseZone={() => { userDeselectedZoneRef.current = true; setSelectedZone(null); }}
                    onViewActionPlans={() => setShowActionPlans(true)}
                    onExportPdf={async () => {
                      setIsExportingPdf(true)
                      try {
                        const stressTestData = {
                          name: activeScenario.type,
                          type: 'climate',
                          scenario_name: activeScenario.type,
                          severity: activeScenario.severity,
                          nvidia_enhanced: true,
                        }
                        const zones = [
                          { name: 'Critical Zone', zone_level: 'critical' as const, expected_loss: portfolio.atRisk * 0.4, affected_assets_count: portfolio.criticalCount, population_affected: 50000 },
                          { name: 'High Risk Zone', zone_level: 'high' as const, expected_loss: portfolio.atRisk * 0.3, affected_assets_count: portfolio.highCount, population_affected: 30000 },
                          { name: 'Medium Risk Zone', zone_level: 'medium' as const, expected_loss: portfolio.atRisk * 0.2, affected_assets_count: portfolio.mediumCount, population_affected: 15000 },
                        ]
                        await exportStressTestPdf(stressTestData, zones)
                        console.log('✅ PDF exported successfully')
                      } catch (error) {
                        console.error('❌ PDF export failed:', error)
                      } finally {
                        setIsExportingPdf(false)
                      }
                    }}
                    isExportingPdf={isExportingPdf}
                    onEntityClick={(entity) => {
                      const fullAsset = selectedZone?.assets?.find(a => a.id === entity.id)
                      if (fullAsset) {
                        setSelectedZoneAsset(fullAsset)
                      } else {
                        setSelectedZoneAsset({
                          id: entity.id,
                          name: entity.name,
                          type: entity.type as ZoneAsset['type'],
                          latitude: selectedZone?.center_latitude || 50,
                          longitude: selectedZone?.center_longitude || 8,
                          exposure: entity.exposure,
                          impactSeverity: entity.impactSeverity,
                        })
                      }
                      setShowDigitalTwin(true)
                    }}
                    onOpenCascade={selectedStressTest ? () => navigate(`/analytics?tab=cascade&scenario=${encodeURIComponent(mapEventIdToCascadeScenarioId(selectedStressTest.id))}`) : undefined}
                    eventIdForCascade={selectedStressTest?.id}
                  />
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTTOM BAR - one row: [Live · time] | [Scenario Timeline when active] | [1-8 Jump …] | Omniverse */}
            <motion.div
              className="absolute bottom-8 left-0 right-0 flex items-end justify-between gap-2 px-6 pointer-events-none z-50"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              {/* LEFT: Agent Alerts + Full assessment + NIM/E2CC/DFM + Overseer + Agents + Live + time */}
              {!commandMode ? (
                <div className="pointer-events-auto flex flex-col items-start gap-2 shrink-0">
                  <div className="w-[340px] mb-1">
                    <AlertFeedPanel compact title="Agent Alerts" limit={6} />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const params = new URLSearchParams()
                        if (selectedCountryCode) params.set('country', selectedCountryCode)
                        if (selectedCountryName) params.set('country_name', selectedCountryName)
                        if (selectedCountryCity?.id) params.set('city_id', String(selectedCountryCity.id))
                        if (selectedCountryCity?.name) params.set('city', selectedCountryCity.name)
                        const qs = params.toString()
                        const url = `${window.location.origin}/unified-stress${qs ? `?${qs}` : ''}`
                        window.open(url, '_blank', 'noopener,noreferrer')
                      }}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-600/20 text-emerald-300 border border-emerald-500/30 hover:bg-emerald-600/30 text-[10px] font-medium transition-colors"
                      title="Run full stress assessment for this location (opens in new window)"
                    >
                      <DocumentTextIcon className="w-3.5 h-3.5 shrink-0" />
                      Full assessment
                    </button>
                    <span className="text-zinc-600">·</span>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${wsStatus === 'connected' ? 'bg-emerald-500' : 'bg-red-500/50'} animate-pulse`} />
                      <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">{wsStatus === 'connected' ? 'Live' : 'Offline'}</span>
                    </div>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500 text-[10px] font-mono tabular-nums">{new Date().toLocaleTimeString()}</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-1 rounded bg-zinc-800 border border-zinc-700">
                    {nimHealth?.fourcastnet?.status === 'healthy' && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-medium bg-emerald-500/20 text-emerald-400/80 border border-emerald-500/30" title="Stress tests use FourCastNet NIM on GPU">GPU mode</span>
                    )}
                    <span className="text-[10px] text-zinc-500" title="FourCastNet NIM on GPU">NIM:</span>
                    <span className={`text-[10px] ${nimHealth?.fourcastnet?.status === 'healthy' ? 'text-emerald-400/80' : 'text-amber-500/80'}`}>{nimHealth?.fourcastnet?.status === 'healthy' ? '✓ FourCastNet' : (nimHealth ? '✗' : '…')}</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-[10px] text-zinc-500" title="Earth-2 Command Center">E2CC:</span>
                    <span className={`text-[10px] ${omniverseStatus?.e2cc_configured ? 'text-emerald-400/80' : 'text-amber-500/80'}`}>{omniverseStatus ? (omniverseStatus.e2cc_configured ? '✓' : 'not deployed') : '…'}</span>
                    <span className="text-zinc-600">|</span>
                    <span className="text-[10px] text-zinc-500">DFM:</span>
                    <span className={`text-[10px] ${dfmStatus?.use_data_federation_pipelines ? 'text-emerald-400/80' : 'text-zinc-500'}`}>{dfmStatus ? (dfmStatus.use_data_federation_pipelines ? 'on' : 'off') : '…'}</span>
                    <button type="button" onClick={handleTestWeatherNim} disabled={weatherTestLoading || nimHealth?.fourcastnet?.status !== 'healthy'} className="ml-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/20 text-amber-400/80 hover:bg-amber-500/30 disabled:opacity-50 disabled:cursor-not-allowed" title="Run weather_forecast pipeline (FourCastNet NIM on GPU)">
                      {weatherTestLoading ? '…' : 'Test weather (NIM)'}
                    </button>
                    {weatherTestResult && <span className="text-[10px] text-emerald-400/90 max-w-[140px] truncate" title={weatherTestResult}>{weatherTestResult}</span>}
                  </div>
                  {weatherForecastData && weatherForecastData.forecasts.length > 0 && (
                    <div className="mt-2 rounded border border-emerald-500/30 bg-zinc-900/95 px-3 py-2 max-w-md">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[11px] font-medium text-emerald-400/90">FourCastNet NIM — данные прогноза</span>
                        <button type="button" onClick={() => setWeatherForecastData(null)} className="text-zinc-500 hover:text-zinc-300 text-[10px] px-1" aria-label="Закрыть">✕</button>
                      </div>
                      <p className="text-[10px] text-zinc-500 mb-2">Широта {weatherForecastData.latitude.toFixed(2)}°, долгота {weatherForecastData.longitude.toFixed(2)}° · {weatherForecastData.model}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-[10px] text-left">
                          <thead>
                            <tr className="border-b border-zinc-700 text-zinc-400">
                              <th className="py-1 pr-2">Шаг</th>
                              <th className="py-1 pr-2">Время</th>
                              <th className="py-1 pr-2">T °C</th>
                              <th className="py-1 pr-2">Осадки мм</th>
                              <th className="py-1">Ветер м/с</th>
                            </tr>
                          </thead>
                          <tbody>
                            {weatherForecastData.forecasts.map((row, i) => {
                              const tC = row.temperature_k != null ? (row.temperature_k - 273.15).toFixed(1) : '—'
                              const wind = (row.wind_u_ms != null && row.wind_v_ms != null)
                                ? (Math.sqrt(row.wind_u_ms ** 2 + row.wind_v_ms ** 2)).toFixed(1)
                                : (row.wind_u_ms != null || row.wind_v_ms != null ? Number(row.wind_u_ms ?? row.wind_v_ms ?? 0).toFixed(1) : '—')
                              const timeStr = row.forecast_time ? new Date(row.forecast_time).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : `+${row.lead_hours ?? i * 6}h`
                              return (
                                <tr key={i} className="border-b border-zinc-800 text-zinc-300">
                                  <td className="py-0.5 pr-2">{i + 1}</td>
                                  <td className="py-0.5 pr-2">{timeStr}</td>
                                  <td className="py-0.5 pr-2">{tC}</td>
                                  <td className="py-0.5 pr-2">{row.precipitation_mm != null ? Number(row.precipitation_mm).toFixed(2) : '—'}</td>
                                  <td className="py-0.5">{wind}</td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3 flex-wrap">
                    <SystemOverseerWidget compact />
                    <span className="text-zinc-600">·</span>
                    <AgentMonitoringWidget compact />
                    <span className="text-zinc-600">·</span>
                    <SendToARINButton
                      sourceModule="command_center"
                      objectType="portfolio"
                      objectId="portfolio_global"
                      inputData={{
                        total_exposure_b: portfolio?.totalExposure,
                        at_risk_b: portfolio?.atRisk,
                        critical_count: portfolio?.criticalCount,
                      }}
                      exportEntityId={selectedZone ? `zone_${selectedZone.name?.toLowerCase().replace(/\s+/g, '_')}_${activeScenario?.type || 'general'}` : 'portfolio_global'}
                      exportEntityType={selectedZone ? 'zone' : 'portfolio'}
                      exportAnalysisType="global_risk_assessment"
                      exportData={{
                        risk_score: (portfolio?.weightedRisk ?? 0.5) * 100,
                        risk_level: (portfolio?.weightedRisk ?? 0) >= 0.7 ? 'HIGH' : (portfolio?.weightedRisk ?? 0) >= 0.5 ? 'MEDIUM' : 'LOW',
                        summary: `Command Center: ${portfolio?.totalExposure ?? 0}B exposure, ${portfolio?.criticalCount ?? 0} critical.`,
                        recommendations: ['Review hotspots', 'Update risk limits'],
                        indicators: {
                          total_exposure_b: portfolio?.totalExposure,
                          at_risk_b: portfolio?.atRisk,
                          critical_count: portfolio?.criticalCount,
                        },
                      }}
                      captureRef={containerRef}
                      dataSources={['FEMA', 'NOAA', 'CMIP6', 'local_sensors']}
                      size="sm"
                      compactPill
                    />
                  </div>
                </div>
              ) : (
                <div className="w-64 shrink-0" aria-hidden="true" />
              )}

              {/* CENTER: Scenario Timeline (when stress test active) — strictly between left and right */}
              <div className="flex-1 min-w-0 flex justify-center items-end pointer-events-auto">
                <AnimatePresence>
                  {activeScenario && (
                    <motion.div
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 20 }}
                      className="mb-4 px-6 py-3 bg-black/50 rounded-md border border-zinc-700"
                    >
                      <div className="flex items-center gap-8">
                        {['T0', 'T+1Y', 'T+2Y', 'T+3Y', 'T+5Y'].map((marker, i) => {
                          const isActive = i === timelinePeriodIndex
                          return (
                            <div key={marker} className="flex flex-col items-center">
                              <div
                                className={`w-3 h-3 rounded-full mb-1 transition-all ${
                                  isActive ? 'bg-amber-400/80 ring-2 ring-amber-400/30' : 'bg-white/20 hover:bg-white/40'
                                }`}
                              />
                              <span className={`text-[10px] ${isActive ? 'text-amber-400/80' : 'text-zinc-600'}`}>
                                {marker}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                      <div className="relative mt-1 -mb-1">
                        <div className="absolute top-0 left-0 right-0 h-0.5 bg-zinc-700" style={{ marginLeft: '6px', marginRight: '6px', top: '-18px' }} />
                        <motion.div
                          className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-amber-300/40 to-transparent"
                          style={{ marginLeft: '6px', top: '-18px' }}
                          initial={false}
                          animate={{ width: `${((timelinePeriodIndex + 1) / 5) * 100}%` }}
                          transition={{ duration: 0.5 }}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* RIGHT: ARIN · Live · time + Keyboard shortcuts + Omniverse */}
              <div className="pointer-events-none shrink-0">
                <div className="flex items-center gap-3 px-4 py-2.5 bg-black/60 rounded-md border border-zinc-700 pointer-events-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-zinc-600">·</span>
                    <ARINVerdictBadge entityId={selectedZone ? `zone_${selectedZone.name?.toLowerCase().replace(/\s+/g, '_')}_${activeScenario?.type || 'general'}` : 'portfolio_global'} compact />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>1-8</Keycap>
                    <span className="text-zinc-500 text-[10px]">Jump</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>Z</Keycap>
                    <span className="text-zinc-500 text-[10px]">Zones</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>S</Keycap>
                    <span className="text-zinc-500 text-[10px]">Stress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>D</Keycap>
                    <span className="text-zinc-500 text-[10px]">Twin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>A</Keycap>
                    <span className="text-zinc-500 text-[10px]">Agents</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>R</Keycap>
                    <span className="text-zinc-500 text-[10px]">Reset</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Keycap>ESC</Keycap>
                    <span className="text-zinc-500 text-[10px]">Back</span>
                  </div>
                  <span className="pointer-events-auto" title={omniverseStatus?.e2cc_use_port_forward ? 'Open E2CC. If tab is empty, on Mac: brev port-forward saaaliance → 8010, 8010' : 'Open Earth-2 Command Center'}>
                    <button
                      onClick={() => handleOmniverseOpen()}
                      className="flex items-center gap-1.5 text-zinc-500 hover:text-amber-400/80 text-[10px] transition-colors"
                    >
                      <span>Omniverse</span>
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </button>
                  </span>
                </div>
              </div>
            </motion.div>

            {/* Under top bar (quick icons / layers) - Active Incidents table, collapsed by default */}
            {showActiveIncidentsLayer && (
              <motion.div
                className="absolute top-20 right-8 pointer-events-auto z-50 w-[532px]"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <ActiveIncidentsPanel
                  visible={showActiveIncidentsLayer}
                  defaultCollapsed={true}
                  maxHeight="280px"
                />
              </motion.div>
            )}


            {/* RIGHT SIDE - AI Assistant (same icon as other pages) above Recent Activity */}
            <motion.div 
              className="absolute bottom-24 right-8 min-w-[180px]"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex flex-col items-end gap-3">
                <button
                  type="button"
                  onClick={() => aiAssistantRef.current?.open()}
                  className="pointer-events-auto p-3 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-400 shadow-lg hover:border-zinc-500 hover:bg-zinc-700 transition-all"
                  title="Open AI Assistant"
                >
                  <CpuChipIcon className="w-5 h-5" />
                </button>
              </div>
              <div className="text-right pointer-events-none mt-3">
                <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Recent Activity</div>
                {(recentAlerts.length > 0 || recentEvents.length > 0) ? (
                  <div className="space-y-1.5">
                    <AnimatePresence key="recent-alerts" mode="popLayout">
                      {recentAlerts.slice(0, 2).map((alert, i) => (
                        <motion.div
                          key={`alert-${i}-${alert.hotspot_id}-${alert.timestamp}`}
                          initial={{ opacity: 0, x: 20 }}
                          animate={{ opacity: 1 - i * 0.2, x: 0 }}
                          exit={{ opacity: 0, x: 20 }}
                          className="flex items-center gap-2 text-[11px] justify-end"
                        >
                          <span className="text-zinc-500 capitalize truncate max-w-[80px]">{alert.hotspot_id}</span>
                          <span className="text-zinc-300 font-mono">{(alert.risk_score * 100).toFixed(0)}%</span>
                          <span className={`font-medium ${alert.risk_score > alert.previous_score ? 'text-red-400/80' : 'text-emerald-400/80'}`}>
                            {alert.risk_score > alert.previous_score ? '↑' : '↓'}
                          </span>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {recentEvents.slice(0, 3).map((ev, i) => (
                      <motion.div
                        key={ev.event_id ?? `event-${i}-${ev.timestamp}`}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center gap-2 text-[11px] justify-end"
                      >
                        <span className="text-zinc-500 truncate max-w-[100px]" title={ev.event_type}>
                          {ev.data?.name || ev.event_type.replace(/_/g, ' ').replace(/\./g, ': ')}
                        </span>
                        <span className="text-zinc-500 text-[10px]">
                          {formatRecentTime(ev.timestamp)}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[11px] text-zinc-500 italic">No recent activity</p>
                )}
              </div>
            </motion.div>

            {/* AI Assistant — same icon as other pages; panel opens at top so not under bottom bar */}
            <AIAssistant ref={aiAssistantRef} floatingButton={false} placement="top" />

            {/* ============================================ */}
            {/* CONTEXT PANEL - Appears on hotspot focus */}
            {/* ============================================ */}
            <AnimatePresence>
              {focusedHotspot && (
                <motion.div 
                  className="absolute top-0 right-0 bottom-0 w-80 pointer-events-auto panel-glow-quantum rounded-l-lg"
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.98 }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  style={{ transformOrigin: 'right center' }}
                >
                  {/* Gradient fade on left edge */}
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent to-black/60" />
                  
                  {/* Panel content */}
                  <div className="absolute inset-0 bg-black/60 p-6 overflow-y-auto">
                    {/* Close hint */}
                    <div className="flex justify-between items-center mb-6">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500">
                        Focused Zone
                      </div>
                      <button
                        onClick={() => handleHotspotFocus(null)}
                        className="text-zinc-600 hover:text-zinc-100 transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Zone name */}
                    <div className="mb-6">
                      <h2 className="text-zinc-100 text-xl font-display font-light mb-1">
                        {focusedHotspot.name}
                      </h2>
                      <div className="text-zinc-500 text-sm">
                        {focusedHotspot.region}
                      </div>
                    </div>
                    
                    {/* Risk score - dominant */}
                    <div className="mb-8">
                      <div className="flex items-end gap-3">
                        <span className={`text-5xl font-extralight ${getRiskColor(focusedHotspot.risk)}`}>
                          {(focusedHotspot.risk * 100).toFixed(0)}
                        </span>
                        <span className="text-zinc-600 text-lg mb-2">%</span>
                        <span className={`text-sm mb-2 ${
                          focusedHotspot.trend === 'up' ? 'text-red-400/80' : 'text-emerald-400/80'
                        }`}>
                          {focusedHotspot.trend === 'up' ? '↑' : '↓'}
                        </span>
                      </div>
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mt-1">
                        Composite Risk Score
                      </div>
                    </div>
                    
                    {/* Exposure */}
                    <div className="mb-8">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">
                        Exposure
                      </div>
                      <div className="text-zinc-100 text-2xl font-extralight">
                        ${formatBillions(focusedHotspot.exposure)}
                      </div>
                    </div>
                    
                    {/* Risk factors — each expands to show registry scenarios for that factor */}
                    <div className="mb-8">
                      <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-4">
                        Risk Factors
                      </div>
                      <div className="space-y-2">
                        {Object.entries(focusedHotspot.factors).map(([key, value]) => {
                          const isExp = expandedFactorIds.has(key)
                          const scenarioIds = FACTOR_TO_SCENARIO_IDS[key] ?? []
                          const scenarios = scenarioIds.map(id => registryScenariosFlat.find(s => s.id === id)).filter((s): s is NonNullable<typeof s> => Boolean(s))
                          return (
                            <div key={key} className="border border-zinc-700 rounded-md overflow-hidden">
                              <button
                                onClick={() => setExpandedFactorIds(prev => { const n = new Set(prev); if (n.has(key)) n.delete(key); else n.add(key); return n })}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-zinc-800 transition-colors"
                              >
                                <svg className={`w-3.5 h-3.5 text-zinc-500 shrink-0 transition-transform ${isExp ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                <div className="flex-1 min-w-0">
                                  <div className="flex justify-between text-xs">
                                    <span className="text-zinc-300 capitalize">{key}</span>
                                    <span className="font-mono text-zinc-200 shrink-0 ml-2">{(value * 100).toFixed(0)}%</span>
                                  </div>
                                  <div className="h-1 bg-amber-500/15 rounded-full overflow-hidden mt-1">
                                    <motion.div className="h-full rounded-full bg-amber-400/65" initial={{ width: 0 }} animate={{ width: `${value * 100}%` }} transition={{ duration: 0.4 }} />
                                  </div>
                                </div>
                              </button>
                              {isExp && (
                                <div className="border-t border-zinc-700 px-3 pb-3 pt-2">
                                  <div className="font-mono text-[10px] uppercase tracking-widest text-zinc-500 mb-2">Scenarios (Registry)</div>
                                  {scenarios.length === 0 ? (
                                    <div className="text-zinc-600 text-xs py-1">{scenarioIds.length === 0 ? 'No scenarios' : 'Loading…'}</div>
                                  ) : (
                                    <div className="space-y-1 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
                                      {scenarios.map((s) => {
                                        const sev = (s.severity_numeric ?? 0.5)
                                        return (
                                          <div key={s.id} className="flex items-center justify-between gap-2 py-1.5 px-2 rounded bg-zinc-800 text-[11px]">
                                            <span className="text-zinc-200 truncate flex-1">{s.name}</span>
                                            <span className="font-mono text-zinc-300 shrink-0">{(sev * 100).toFixed(0)}%</span>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                    
                    {/* Actions - Single button to open Digital Twin with context */}
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          if (!focusedHotspot) return
                          const params = new URLSearchParams()
                          params.set('openTwin', '1')
                          params.set('cityId', focusedHotspot.id)
                          params.set('cityName', focusedHotspot.name || focusedHotspot.id)
                          const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`
                          window.open(url, '_blank', 'noopener,noreferrer')
                        }}
                        className="w-full py-2.5 px-4 bg-amber-500/20 border border-amber-500/40 rounded-md
                          text-amber-400/80 text-sm hover:bg-amber-500/30 hover:text-amber-300 transition-all
                          flex items-center justify-between font-medium"
                      >
                        <span>Open Digital Twin & Stress Test</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => {
                          const params = new URLSearchParams()
                          if (focusedHotspot?.id) params.set('region', focusedHotspot.id)
                          if (selectedStressTest?.id) params.set('scenario', selectedStressTest.id)
                          const coords = focusedHotspot ? findCityCoordinates(focusedHotspot.id) : null
                          if (coords) {
                            params.set('lat', String(coords.lat))
                            params.set('lon', String(coords.lng))
                          }
                          handleOmniverseOpen(params)
                        }}
                        className="w-full py-2.5 px-4 bg-zinc-800 border border-white/20 rounded-md
                          text-zinc-300 text-sm hover:bg-zinc-700 hover:text-zinc-100 transition-all
                          flex items-center justify-between font-medium"
                      >
                        <span>Open in Omniverse</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* QUICK ZONE NAVIGATION (Z key) */}
      {/* ============================================ */}
      <AnimatePresence>
        {showZoneNav && (
          <motion.div
            className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 pointer-events-auto"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.2 }}
          >
            <div className="bg-black/90 rounded-md border border-white/20 p-6 min-w-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-zinc-100 text-lg font-display font-light">Quick Navigation</h3>
                <button
                  onClick={() => setShowZoneNav(false)}
                  className="text-zinc-500 hover:text-zinc-100"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              {/* Scrollable zones list */}
              <div className="max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                <div className="grid grid-cols-2 gap-2">
                  {availableZones.sort((a, b) => b.risk - a.risk).map((zone, idx) => (
                    <div
                      key={zone.id}
                      className="flex items-center gap-2 p-2 bg-zinc-800 hover:bg-zinc-800 rounded-md transition-all text-left group"
                    >
                      <button
                        onClick={() => {
                          handleHotspotFocus(zone.id)
                          setFlyToHotspotId(zone.id)
                          setShowZoneNav(false)
                        }}
                        className="flex items-center gap-3 flex-1 min-w-0"
                        title="Focus zone"
                      >
                        <span className="text-zinc-600 text-xs font-mono w-5 flex-shrink-0">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <div className="text-zinc-100 text-sm truncate">{zone.name}</div>
                          <div className="text-xs text-zinc-400">
                            Risk: {(zone.risk * 100).toFixed(0)}%
                          </div>
                        </div>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${getRiskDotColor(zone.risk)}`} />
                      </button>

                      <button
                        onClick={() => {
                          handleHotspotFocus(zone.id)
                          setDependencyZoneId((prev) => (prev === zone.id ? null : zone.id))
                          setShowZoneNav(false)
                        }}
                        className="p-2 rounded-md border border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 transition-colors flex-shrink-0"
                        title="Show dependency links for this zone"
                      >
                        <LinkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="mt-4 pt-4 border-t border-zinc-700 flex justify-center gap-4 text-zinc-600 text-[11px]">
                <span className="flex items-center gap-2"><Keycap>1-8</Keycap> Quick Jump</span>
                <span className="flex items-center gap-2"><Keycap>ESC</Keycap> Close</span>
                <span className="flex items-center gap-2"><Keycap>R</Keycap> Reset View</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* HISTORICAL EVENT PANEL */}
      {/* ============================================ */}
      <HistoricalEventPanel
        isOpen={showHistoricalPanel}
        onClose={() => {
          setShowHistoricalPanel(false)
          setSelectedHistoricalEvent(null)
          // Keep the menu expanded for user to continue browsing
          setExpandedRiskLevel(expandedRiskLevel)
        }}
        eventId={selectedHistoricalEvent}
        onEventChange={(eventId) => {
          setSelectedHistoricalEvent(eventId)
        }}
      />
      
      {/* ============================================ */}
      {/* DIGITAL TWIN PANEL */}
      {/* ============================================ */}
      <DigitalTwinPanel
        isOpen={showDigitalTwin}
        onClose={() => {
          setShowDigitalTwin(false)
          setSelectedZoneAsset(null)
          setDigitalTwinPickerMode(false)
          setSelectedDigitalTwinEvent(null)
          setSelectedDigitalTwinEventName(null)
          setSelectedDigitalTwinEventCategory(null)
          setSelectedDigitalTwinTimeHorizon(null)
          setClimateTriggerRiskType(null)
          setClimateTriggerCityId(null)
          // If closing from city mode, navigate back to country
          if (viewMode === 'city') {
            navigateBackToCountry()
          }
        }}
        pickerMode={digitalTwinPickerMode && !selectedZoneAsset}
        onCitySelected={(asset) => {
          setSelectedZoneAsset(asset as ZoneAsset)
          setDigitalTwinPickerMode(false)
        }}
        assetId={focusAssetIdFromUrl || focusedHotspot?.id}
        dynamicAsset={(selectedZoneAsset || focusAssetFromUrl) ?? undefined}
        eventId={selectedDigitalTwinEvent}
        eventName={selectedDigitalTwinEventName}
        eventCategory={selectedDigitalTwinEventCategory}
        timeHorizon={selectedDigitalTwinTimeHorizon}
        showFloodLayer={showFloodLayer}
        showWindLayer={showWindLayer}
        showMetroFloodLayer={showMetroFloodLayer}
        floodDepthOverride={floodDepthOverride}
        showHeatLayer={showHeatLayer}
        showHeavyRainLayer={showHeavyRainLayer}
        showDroughtLayer={showDroughtLayer}
        showUvLayer={showUvLayer}
        showEarthquakeLayer={showEarthquakeLayer}
        climateTriggerRiskType={climateTriggerRiskType}
        climateTriggerCityId={climateTriggerCityId}
        zoneTotalExposure={selectedZoneAsset && selectedZone ? selectedZone.total_exposure : undefined}
      />

      {/* Zone detail is now inside UnifiedStressTestPanel when a zone is selected */}

      {/* ============================================ */}
      {/* ACTION PLANS MODAL */}
      {/* ============================================ */}
      <ActionPlanModal
        isOpen={showActionPlans}
        onClose={() => setShowActionPlans(false)}
        stressTestName={selectedStressTest?.name || activeScenario?.type || 'Stress Test'}
        zoneName={selectedZone?.name || focusedHotspot?.name}
        template={actionPlanTemplate}
        onOpenDetailedPlans={() => {
          setShowActionPlans(false)
          navigate('/action-plans')
        }}
        onOpenStressPlanner={() => {
          setShowActionPlans(false)
          navigate('/stress-planner')
        }}
      />
      
      {/* ============================================ */}
      {/* STRESS TEST SELECTOR MODAL */}
      {/* ============================================ */}
      <AnimatePresence>
        {showStressTestSelector && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/80 z-50"
              onClick={() => setShowStressTestSelector(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-8 pointer-events-none"
            >
              <div 
                ref={stressTestModalRef}
                tabIndex={-1}
                className="bg-zinc-950 border border-zinc-700 rounded-md p-6 max-w-md w-full pointer-events-auto shadow-2xl outline-none"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h2 className="text-zinc-100 text-lg font-display font-medium">Select Stress Test</h2>
                    <p className="text-zinc-500 text-xs mt-1">
                      {viewMode === 'country' && selectedCountryName
                        ? `Scenarios filtered for ${selectedCountryName}`
                        : 'Choose a scenario to analyze'}
                    </p>
                  </div>
                  <button
                    onClick={() => setShowStressTestSelector(false)}
                    className="text-zinc-500 hover:text-zinc-100 transition-colors p-1"
                    title="Close (ESC)"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <UnifiedStressTestSelector
                  selectedScenarioId={selectedStressTest?.id ?? null}
                  onSelect={(scenario) => {
                    userDeselectedZoneRef.current = false
                    setSelectedStressTest({
                      id: scenario.id,
                      name: scenario.name,
                      type: scenario.type,
                      severity: scenario.severity,
                      probability: scenario.probability,
                    })
                    activateScenario(scenario.name, scenario.severity)
                    setShowStressTestSelector(false)
                    console.log(
                      '✅ Stress Test selected:',
                      scenario.name,
                      `(${scenario.type}, ${(scenario.severity * 100).toFixed(0)}%)`
                    )
                  }}
                  onClear={() => {
                    setSelectedStressTest(null)
                    deactivateScenario()
                  }}
                  filterByCountryCode={viewMode === 'country' ? selectedCountryCode : null}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* ============================================ */}
      {/* KEYBOARD SHORTCUTS */}
      {/* ============================================ */}
      <KeyboardHandler
        onStressTest={() => {
          console.log('Action: Stress Test - Opening selector')
          setShowStressTestSelector(true)
        }}
        onCommandMode={() => {
          toggleCommandMode()
        }}
        onDigitalTwin={() => {
          console.log('Action: Digital Twin')
          if (selectedZoneAsset || focusedHotspot) {
            if (!selectedZoneAsset && focusedHotspot) {
              const coords = findCityCoordinates(focusedHotspot.id)
              if (coords) {
                setSelectedZoneAsset({
                  id: focusedHotspot.id,
                  name: focusedHotspot.name,
                  type: 'city',
                  latitude: coords.lat,
                  longitude: coords.lng,
                  exposure: coords.exposure ?? 10,
                  impactSeverity: focusedHotspot.risk ?? coords.risk ?? 0.5,
                })
              }
            }
            setShowDigitalTwin(true)
          } else {
            setShowDigitalTwin(true)
            setDigitalTwinPickerMode(true)
          }
        }}
        onResetView={() => {
          console.log('Action: Reset View (R)')
          // Stepwise back: City → Country → Global (two presses from city to global)
          if (viewMode === 'city') {
            setShowDigitalTwin(false)
            navigateBackToCountry()
          } else if (viewMode === 'country') {
            handleHotspotFocus(null)
            deactivateScenario()
            setShowZoneNav(false)
            setResetViewTrigger(prev => prev + 1)
            navigateToGlobal()
          } else {
            // Already global: reset camera, clear selection
            handleHotspotFocus(null)
            deactivateScenario()
            setShowDigitalTwin(false)
            setShowZoneNav(false)
            setResetViewTrigger(prev => prev + 1)
          }
        }}
        onAgents={async () => {
          console.log('Action: Agents Monitoring - Starting agents')
          try {
            // Start agents when hotkey is pressed
            const res = await fetch(`${getCommandApi()}/agents/monitoring/start`, { method: 'POST' })
            if (res.ok) {
              // Navigate to agents page after starting
              navigate('/agents')
            } else {
              // Still navigate even if start fails
              navigate('/agents')
            }
          } catch (e) {
            // Navigate anyway
            navigate('/agents')
          }
        }}
        onEscape={() => {
          console.log('Action: Escape')
          if (showStressTestSelector) {
            setShowStressTestSelector(false)
          } else if (countrySearchOpen) {
            setCountrySearchOpen(false)
            setCountrySearchQuery('')
          } else if (showActionPlans) {
            setShowActionPlans(false)
          } else if (selectedZone) {
            userDeselectedZoneRef.current = true
            setSelectedZone(null)
          } else if (showDigitalTwin) {
            setShowDigitalTwin(false)
            if (viewMode === 'city') navigateBackToCountry()
          } else if (viewMode === 'city') {
            navigateBackToCountry()
          } else if (viewMode === 'country') {
            navigateToGlobal()
          } else if (showZoneNav) {
            setShowZoneNav(false)
          } else if (activeScenario) {
            deactivateScenario()
          } else if (focusedHotspot) {
            handleHotspotFocus(null)
            setResetViewTrigger(prev => prev + 1) // Also reset globe view
          }
        }}
        onZoneNav={() => {
          console.log('Action: Zone Navigation')
          setShowZoneNav(prev => !prev)
        }}
        onZoneSelectByNumber={(n) => {
          const sorted = availableZones.slice().sort((a, b) => b.risk - a.risk)
          const z = sorted[n - 1]
          if (z) handleHotspotFocus(z.id)
        }}
        onSearchFocus={() => {
          countrySearchInputRef.current?.focus()
        }}
      />
    </div>
  )
}

// ============================================
// KEYBOARD HANDLER COMPONENT
// ============================================

function KeyboardHandler({ 
  onStressTest, 
  onCommandMode,
  onDigitalTwin,
  onResetView, 
  onEscape,
  onZoneNav,
  onZoneSelectByNumber,
  onAgents,
  onSearchFocus,
}: { 
  onStressTest: () => void
  onCommandMode: () => void
  onDigitalTwin: () => void
  onResetView: () => void
  onEscape: () => void
  onZoneNav: () => void
  onZoneSelectByNumber?: (num: number) => void
  onAgents: () => void
  onSearchFocus?: () => void
}) {
  const ref = useRef({ onStressTest, onCommandMode, onDigitalTwin, onResetView, onEscape, onZoneNav, onZoneSelectByNumber, onAgents, onSearchFocus })
  ref.current = { onStressTest, onCommandMode, onDigitalTwin, onResetView, onEscape, onZoneNav, onZoneSelectByNumber, onAgents, onSearchFocus }

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in input, textarea, or contenteditable
      const target = e.target as HTMLElement
      if (
        target instanceof HTMLInputElement || 
        target instanceof HTMLTextAreaElement ||
        target.isContentEditable ||
        target.closest('input, textarea, [contenteditable="true"]')
      ) {
        return
      }
      
      if (e.key === 'Escape' || e.key === 'Esc') {
        e.preventDefault()
        e.stopPropagation()
        ref.current.onEscape()
        return
      }
      
      const key = e.key.toLowerCase()
      const isSimpleKey = /^[a-z0-9]$/.test(key)
      if (isSimpleKey && (e.ctrlKey || e.metaKey || e.altKey)) return
      
      switch (key) {
        case 's':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onStressTest()
          break
        case 'd':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onDigitalTwin()
          break
        case 'r':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onResetView()
          break
        case 'a':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onAgents()
          break
        case '/':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onSearchFocus?.()
          break
        case 'z':
        case 'n':
          e.preventDefault()
          e.stopPropagation()
          ref.current.onZoneNav()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
        case '9':
          e.preventDefault()
          e.stopPropagation()
          const num = Number(key)
          if (num >= 1 && num <= 9) ref.current.onZoneSelectByNumber?.(num)
          break
        default:
          break
      }
    }
    
    // Use capture on window so we get the key before Cesium canvas or other handlers
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [])

  return null
}
