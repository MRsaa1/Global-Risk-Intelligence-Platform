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
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { CubeTransparentIcon, ChartBarIcon, Cog6ToothIcon, HomeIcon } from '@heroicons/react/24/outline'
import CesiumGlobe, { RiskZone, ZoneAsset } from '../components/CesiumGlobe'
import DigitalTwinPanel from '../components/DigitalTwinPanel'
import { useSimulatedWebSocket, RiskUpdate } from '../lib/useWebSocket'
import { StressTestSelector, ActionPlanModal, ZoneDetailPanel } from '../components/stress'
import HistoricalEventPanel from '../components/HistoricalEventPanel'
import { RiskFlowMini } from '../components/RiskFlowDiagram'

const API_BASE = '/api/v1'

// ============================================
// TYPES
// ============================================

interface PortfolioState {
  totalExposure: number      // in billions
  atRisk: number             // in billions
  criticalCount: number      // number of critical hotspots
  weightedRisk: number       // 0-1
}

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

function getRiskLevel(risk: number): 'critical' | 'high' | 'medium' | 'low' {
  if (risk > 0.8) return 'critical'
  if (risk > 0.6) return 'high'
  if (risk > 0.4) return 'medium'
  return 'low'
}

function getRiskColor(risk: number): string {
  if (risk > 0.8) return 'text-red-400'
  if (risk > 0.6) return 'text-orange-400'
  if (risk > 0.4) return 'text-yellow-400'
  return 'text-emerald-400'
}

function formatBillions(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}T`
  return `${value.toFixed(1)}B`
}

// ============================================
// RISK LEVEL ROW COMPONENT
// ============================================

// View mode for risk indicators
type RiskViewMode = 'menu' | 'historical' | 'current' | 'forecast'

interface RiskLevelRowProps {
  level: 'critical' | 'high' | 'medium' | 'low'
  label: string
  color: 'red' | 'orange' | 'yellow' | 'green'
  zones: { id: string; name: string; risk: number }[]
  isExpanded: boolean
  onToggle: () => void
  onZoneClick: (id: string) => void
  onHistoricalSelect?: (eventId: string) => void
  onCurrentSelect?: (zoneId: string, category: string) => void
  onForecastSelect?: (zoneId: string, horizon: number) => void
  onOpenDigitalTwin?: (cityId: string, cityName: string, eventId?: string, eventName?: string, eventCategory?: string, timeHorizon?: string) => void
}

function RiskLevelRow({ level, label, color, zones, isExpanded, onToggle, onZoneClick, onHistoricalSelect, onCurrentSelect, onForecastSelect, onOpenDigitalTwin }: RiskLevelRowProps) {
  const [viewMode, setViewMode] = useState<RiskViewMode>('menu')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [selectedHorizon, setSelectedHorizon] = useState<number | null>(null)
  // New states for event → country → city flow
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null)
  const [selectedCountry, setSelectedCountry] = useState<string | null>(null)
  const [selectedCity, setSelectedCity] = useState<{ id: string; name: string; risk: number } | null>(null)
  
  const colorClasses = {
    red: { text: 'text-red-400', bg: 'bg-red-500', border: 'border-red-500/30', hover: 'hover:bg-red-500/20' },
    orange: { text: 'text-orange-400', bg: 'bg-orange-500', border: 'border-orange-500/30', hover: 'hover:bg-orange-500/20' },
    yellow: { text: 'text-yellow-400', bg: 'bg-yellow-500', border: 'border-yellow-500/30', hover: 'hover:bg-yellow-500/20' },
    green: { text: 'text-emerald-400', bg: 'bg-emerald-500', border: 'border-emerald-500/30', hover: 'hover:bg-emerald-500/20' },
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
  }
  
  // Current events (0-1 year) with specific ongoing situations
  // Includes all scenarios from Stress Lab integrated here
  const currentEvents = [
    { id: 'climate', name: 'Climate Events', events: [
      // Stress Lab scenarios
      { id: 'flood-rhine', name: 'Rhine Valley Flood', risk: 0.85 },
      { id: 'heatwave-eu', name: 'European Heatwave', risk: 0.75 },
      // Current events
      { id: 'drought2024', name: 'European Drought 2024', risk: 0.72 },
      { id: 'flood_asia', name: 'Southeast Asia Flooding', risk: 0.68 },
      { id: 'wildfire_canada', name: 'Canadian Wildfires', risk: 0.65 },
      { id: 'wildfire_aus', name: 'Australian Bushfires', risk: 0.62 },
      { id: 'elnino', name: 'El Niño Impact', risk: 0.58 },
      { id: 'hurricane_atlantic', name: 'Atlantic Hurricane Season', risk: 0.55 },
      { id: 'arctic_vortex', name: 'Polar Vortex Disruption', risk: 0.48 },
      { id: 'monsoon_fail', name: 'Indian Monsoon Failure', risk: 0.52 },
    ]},
    { id: 'geopolitical', name: 'Geopolitical', events: [
      // Stress Lab scenarios
      { id: 'conflict-east', name: 'Eastern Europe Escalation', risk: 0.95 },
      { id: 'blockade', name: 'Trade Route Blockade', risk: 0.70 },
      { id: 'sanctions', name: 'Major Sanctions Package', risk: 0.65 },
      { id: 'regime-change', name: 'Regime Transition Risk', risk: 0.75 },
      // Current events
      { id: 'ukraine_ongoing', name: 'Ukraine Conflict (Ongoing)', risk: 0.88 },
      { id: 'israel_gaza', name: 'Israel-Gaza Conflict', risk: 0.85 },
      { id: 'redsea_shipping', name: 'Red Sea Shipping Crisis', risk: 0.75 },
      { id: 'taiwan_strait', name: 'Taiwan Strait Tensions', risk: 0.72 },
      { id: 'korea_tensions', name: 'Korean Peninsula', risk: 0.55 },
      { id: 'iran_israel', name: 'Iran-Israel Tensions', risk: 0.78 },
      { id: 'nato_expansion', name: 'NATO Expansion Fallout', risk: 0.52 },
      { id: 'south_china_sea', name: 'South China Sea Dispute', risk: 0.68 },
      { id: 'india_pakistan', name: 'India-Pakistan Tensions', risk: 0.58 },
      { id: 'venezuela_guyana', name: 'Venezuela-Guyana Dispute', risk: 0.45 },
    ]},
    { id: 'financial', name: 'Financial Stress', events: [
      // Stress Lab scenarios
      { id: 'liquidity-eu', name: 'Eurozone Liquidity Crisis', risk: 0.90 },
      { id: 'credit-crunch', name: 'Credit Crunch', risk: 0.75 },
      { id: 'basel-full', name: 'Basel IV Implementation', risk: 0.50 },
      // Current events
      { id: 'rate_hikes', name: 'Central Bank Rate Hikes', risk: 0.68 },
      { id: 'commercial_re', name: 'Commercial Real Estate Crisis', risk: 0.72 },
      { id: 'china_property', name: 'China Property Sector', risk: 0.78 },
      { id: 'em_debt', name: 'Emerging Market Debt', risk: 0.62 },
      { id: 'bank_stress', name: 'Regional Bank Stress', risk: 0.58 },
      { id: 'dollar_dominance', name: 'Dollar Dominance Challenge', risk: 0.48 },
      { id: 'crypto_contagion', name: 'Crypto Market Contagion', risk: 0.42 },
      { id: 'pension_shortfall', name: 'Pension Fund Shortfall', risk: 0.55 },
      { id: 'insurance_crisis', name: 'Insurance Sector Stress', risk: 0.52 },
      { id: 'bond_volatility', name: 'Government Bond Volatility', risk: 0.65 },
    ]},
    { id: 'pandemic', name: 'Pandemic & Health', events: [
      // Stress Lab scenarios
      { id: 'pandemic-x', name: 'Pandemic Variant X', risk: 0.80 },
      // Current events
      { id: 'covid_variants', name: 'COVID Variants Monitoring', risk: 0.35 },
      { id: 'avian_flu', name: 'H5N1 Avian Flu Risk', risk: 0.45 },
      { id: 'disease_x', name: 'Disease X Preparedness', risk: 0.28 },
      { id: 'mpox_spread', name: 'Mpox Outbreak', risk: 0.38 },
      { id: 'antibiotic_resist', name: 'Antibiotic Resistance', risk: 0.55 },
      { id: 'zoonotic_spillover', name: 'Zoonotic Spillover Risk', risk: 0.42 },
      { id: 'healthcare_collapse', name: 'Healthcare System Stress', risk: 0.48 },
    ]},
    { id: 'civil_unrest', name: 'Civil Unrest', events: [
      // Stress Lab scenarios
      { id: 'mass-protest', name: 'Mass Civil Unrest', risk: 0.60 },
      { id: 'general-strike', name: 'General Strike', risk: 0.55 },
      // Additional scenarios
      { id: 'farmer_protests', name: 'Farmer Protests (EU)', risk: 0.52 },
      { id: 'cost_living', name: 'Cost of Living Protests', risk: 0.58 },
      { id: 'political_polarization', name: 'Political Polarization', risk: 0.62 },
      { id: 'election_unrest', name: 'Election-Related Unrest', risk: 0.48 },
      { id: 'labor_disputes', name: 'Major Labor Disputes', risk: 0.45 },
    ]},
    { id: 'supply', name: 'Supply Chain', events: [
      { id: 'chip_shortage', name: 'Semiconductor Shortage', risk: 0.55 },
      { id: 'rare_earth', name: 'Rare Earth Dependencies', risk: 0.62 },
      { id: 'energy_transition', name: 'Energy Transition Stress', risk: 0.48 },
      { id: 'suez_blockage', name: 'Suez Canal Disruption', risk: 0.52 },
      { id: 'port_congestion', name: 'Major Port Congestion', risk: 0.45 },
      { id: 'lithium_shortage', name: 'Lithium Supply Constraints', risk: 0.58 },
      { id: 'food_supply', name: 'Global Food Supply Disruption', risk: 0.65 },
      { id: 'pharmaceutical', name: 'Pharmaceutical Supply Risk', risk: 0.48 },
    ]},
    { id: 'regulatory', name: 'Regulatory & Legal', events: [
      // Stress Lab scenarios
      { id: 'basel-iv', name: 'Basel IV Full Implementation', risk: 0.50 },
      // Additional scenarios
      { id: 'eu_ai_act', name: 'EU AI Act Compliance', risk: 0.45 },
      { id: 'carbon_border', name: 'Carbon Border Tax', risk: 0.52 },
      { id: 'antitrust', name: 'Big Tech Antitrust Actions', risk: 0.48 },
      { id: 'data_sovereignty', name: 'Data Sovereignty Rules', risk: 0.42 },
      { id: 'esg_mandates', name: 'ESG Disclosure Mandates', risk: 0.55 },
      { id: 'tax_reform', name: 'Global Tax Reform', risk: 0.40 },
    ]},
    { id: 'technology', name: 'Technology Risks', events: [
      { id: 'ai_disruption_now', name: 'AI Job Displacement', risk: 0.58 },
      { id: 'cyber_infrastructure', name: 'Critical Infrastructure Cyberattack', risk: 0.72 },
      { id: 'ransomware_wave', name: 'Ransomware Wave', risk: 0.65 },
      { id: 'cloud_outage', name: 'Major Cloud Outage', risk: 0.48 },
      { id: 'quantum_threat', name: 'Quantum Crypto Threat', risk: 0.35 },
      { id: 'deepfake_fraud', name: 'Deepfake Fraud Rise', risk: 0.52 },
    ]},
    { id: 'energy', name: 'Energy Crisis', events: [
      { id: 'oil_shock', name: 'Oil Price Shock', risk: 0.68 },
      { id: 'gas_shortage_eu', name: 'EU Gas Shortage', risk: 0.62 },
      { id: 'power_grid', name: 'Power Grid Instability', risk: 0.55 },
      { id: 'opec_action', name: 'OPEC Supply Cuts', risk: 0.58 },
      { id: 'nuclear_phase_out', name: 'Nuclear Phase-Out Impact', risk: 0.45 },
      { id: 'renewable_intermittency', name: 'Renewable Intermittency', risk: 0.42 },
    ]},
  ]
  
  // Forecast scenarios (5-30 years) with specific projected events
  // Includes Sea Level Rise from Stress Lab
  const forecastScenarios = [
    { horizon: 5, name: '5 Year Outlook', scenarios: [
      { id: 'ai_disruption', name: 'AI Labor Disruption', risk: 0.65, type: 'technology' },
      { id: 'climate_migration', name: 'Climate Migration Wave', risk: 0.58, type: 'climate' },
      { id: 'debt_crisis', name: 'Sovereign Debt Crisis', risk: 0.52, type: 'financial' },
      { id: 'cyber_attack', name: 'Major Cyber Attack', risk: 0.48, type: 'technology' },
      { id: 'credit_crunch_5yr', name: 'Credit Crunch Scenario', risk: 0.55, type: 'financial' },
      { id: 'supply_chain_breakdown', name: 'Supply Chain Breakdown', risk: 0.62, type: 'supply' },
      { id: 'energy_shock', name: 'Energy Price Shock', risk: 0.58, type: 'energy' },
      { id: 'banking_crisis', name: 'Systemic Banking Crisis', risk: 0.68, type: 'financial' },
      { id: 'regional_conflict', name: 'Regional Conflict Escalation', risk: 0.72, type: 'geopolitical' },
      { id: 'pandemic_outbreak', name: 'New Pandemic Outbreak', risk: 0.45, type: 'pandemic' },
    ]},
    { horizon: 10, name: '10 Year Outlook', scenarios: [
      // Stress Lab scenario
      { id: 'sea-level-10', name: 'Sea Level Rise +0.5m', risk: 0.60, type: 'climate' },
      { id: 'water_scarcity', name: 'Water Scarcity Crisis', risk: 0.72, type: 'climate' },
      { id: 'biodiversity', name: 'Biodiversity Collapse', risk: 0.62, type: 'climate' },
      { id: 'deglobalization', name: 'Deglobalization Peak', risk: 0.55, type: 'geopolitical' },
      { id: 'pandemic_novel', name: 'Novel Pandemic', risk: 0.45, type: 'pandemic' },
      { id: 'energy_crisis', name: 'Energy Transition Crisis', risk: 0.68, type: 'energy' },
      { id: 'ai_governance', name: 'AI Governance Crisis', risk: 0.58, type: 'technology' },
      { id: 'infrastructure_decay', name: 'Infrastructure Decay', risk: 0.52, type: 'infrastructure' },
      { id: 'financial_decoupling', name: 'Financial Decoupling', risk: 0.65, type: 'financial' },
      { id: 'mass_migration', name: 'Mass Migration Event', risk: 0.70, type: 'social' },
      { id: 'antibiotic_failure', name: 'Antibiotic Resistance Crisis', risk: 0.55, type: 'pandemic' },
    ]},
    { horizon: 15, name: '15 Year Outlook', scenarios: [
      { id: 'sea_level', name: 'Sea Level Rise +1m Impact', risk: 0.78, type: 'climate' },
      { id: 'food_security', name: 'Global Food Security Crisis', risk: 0.72, type: 'climate' },
      { id: 'agi_emergence', name: 'AGI Economic Shift', risk: 0.58, type: 'technology' },
      { id: 'nuclear_proliferation', name: 'Nuclear Proliferation', risk: 0.42, type: 'geopolitical' },
      { id: 'permafrost_methane', name: 'Permafrost Methane Release', risk: 0.68, type: 'climate' },
      { id: 'coastal_flooding', name: 'Coastal City Flooding', risk: 0.75, type: 'climate' },
      { id: 'currency_collapse', name: 'Major Currency Collapse', risk: 0.52, type: 'financial' },
      { id: 'autonomous_warfare', name: 'Autonomous Warfare', risk: 0.48, type: 'geopolitical' },
      { id: 'genetic_engineering', name: 'Genetic Engineering Risk', risk: 0.45, type: 'technology' },
    ]},
    { horizon: 20, name: '20 Year Outlook', scenarios: [
      { id: 'arctic_collapse', name: 'Arctic Ice Collapse', risk: 0.82, type: 'climate' },
      { id: 'demographic_crisis', name: 'Demographic Crisis (Aging)', risk: 0.75, type: 'social' },
      { id: 'resource_wars', name: 'Resource Conflict', risk: 0.65, type: 'geopolitical' },
      { id: 'automation_unemployment', name: 'Mass Automation Unemployment', risk: 0.68, type: 'technology' },
      { id: 'amazon_dieback', name: 'Amazon Rainforest Dieback', risk: 0.72, type: 'climate' },
      { id: 'ocean_acidification', name: 'Ocean Acidification Crisis', risk: 0.70, type: 'climate' },
      { id: 'superintelligence', name: 'Superintelligence Emergence', risk: 0.55, type: 'technology' },
      { id: 'global_water_wars', name: 'Global Water Wars', risk: 0.62, type: 'geopolitical' },
      { id: 'mass_urbanization', name: 'Mass Urbanization Stress', risk: 0.58, type: 'social' },
    ]},
    { horizon: 30, name: '30 Year Outlook', scenarios: [
      { id: 'climate_tipping', name: 'Climate Tipping Points', risk: 0.88, type: 'climate' },
      { id: 'mass_extinction', name: 'Mass Extinction Event', risk: 0.72, type: 'climate' },
      { id: 'global_governance', name: 'Global Governance Shift', risk: 0.55, type: 'geopolitical' },
      { id: 'space_economy', name: 'Space Economy Disruption', risk: 0.38, type: 'technology' },
      { id: 'synthetic_bio', name: 'Synthetic Biology Risk', risk: 0.52, type: 'pandemic' },
      { id: 'fusion_revolution', name: 'Fusion Energy Revolution', risk: 0.35, type: 'energy' },
      { id: 'post_scarcity', name: 'Post-Scarcity Transition', risk: 0.42, type: 'economic' },
      { id: 'human_enhancement', name: 'Human Enhancement Divide', risk: 0.48, type: 'social' },
      { id: 'geoengineering', name: 'Geoengineering Conflict', risk: 0.58, type: 'geopolitical' },
      { id: 'biosphere_collapse', name: 'Biosphere Collapse', risk: 0.78, type: 'climate' },
    ]},
  ]
  
  // Event categories for Current events (with SVG icons)
  const eventCategories = currentEvents
  
  // Category icon component
  const CategoryIcon = ({ id }: { id: string }) => {
    const iconClass = "w-3.5 h-3.5 text-white/50"
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
        return <div className="w-3.5 h-3.5 rounded-full bg-white/20" />
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
  
  if (zones.length === 0) return null
  
  return (
    <div className="relative">
      {/* Main row - clickable */}
      <button
        onClick={onToggle}
        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg transition-all ${colors.hover} ${isExpanded ? 'bg-white/5' : ''}`}
      >
        {/* Indicator dots */}
        <div className="flex gap-0.5">
          {zones.slice(0, 5).map((_, i) => (
            <div 
              key={i}
              className={`w-1.5 h-1.5 rounded-full ${colors.bg} ${level === 'critical' ? 'animate-pulse' : ''}`}
              style={{ animationDelay: `${i * 150}ms` }}
            />
          ))}
          {zones.length > 5 && <span className="text-white/30 text-[8px] ml-0.5">+{zones.length - 5}</span>}
        </div>
        
        {/* Count */}
        <span className={`${colors.text} text-lg font-light min-w-[20px]`}>
          {zones.length}
        </span>
        
        {/* Label */}
        <span className="text-white/50 text-xs flex-1 text-left">
          {label}
        </span>
        
        {/* Expand icon */}
        <svg 
          className={`w-3 h-3 text-white/30 transition-transform ${isExpanded ? 'rotate-180' : ''}`} 
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
                  {/* Option 1: Historical */}
                  <button
                    onClick={() => setViewMode('historical')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-white/70 text-xs group-hover:text-white flex-1">Historical Events</span>
                    <span className="text-white/30 text-[10px]">1970+</span>
                  </button>
                  
                  {/* Option 2: Current */}
                  <button
                    onClick={() => setViewMode('current')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    <span className="text-white/70 text-xs group-hover:text-white flex-1">Current Events</span>
                    <span className="text-white/30 text-[10px]">0-1yr</span>
                  </button>
                  
                  {/* Option 3: Forecast */}
                  <button
                    onClick={() => setViewMode('forecast')}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                  >
                    <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    <span className="text-white/70 text-xs group-hover:text-white flex-1">Forecast</span>
                    <span className="text-white/30 text-[10px]">5-30yr</span>
                  </button>
                </div>
              )}
              
              {/* ===== HISTORICAL SUBMENU ===== */}
              {viewMode === 'historical' && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    Historical Events (1970-Present)
                  </div>
                  {historicalEvents.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => {
                        onHistoricalSelect?.(event.id)
                        // Historical events open report, not 3D view
                      }}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${colors.bg}`} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {event.name}
                      </span>
                      <span className="text-white/30 text-[10px]">{event.type}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* ===== CURRENT SUBMENU ===== */}
              {viewMode === 'current' && !selectedCategory && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setViewMode('menu')}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    Current Event Categories
                  </div>
                  {currentEvents.map((cat) => (
                    <button
                      key={cat.id}
                      onClick={() => setSelectedCategory(cat.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <CategoryIcon id={cat.id} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {cat.name}
                      </span>
                      <span className="text-white/30 text-[10px]">{cat.events.length}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* CURRENT - Events list after category selected */}
              {viewMode === 'current' && selectedCategory && !selectedEventId && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedCategory(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to categories
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    {currentEvents.find(c => c.id === selectedCategory)?.name || 'Events'}
                  </div>
                  {currentEvents.find(c => c.id === selectedCategory)?.events.map((event) => (
                    <button
                      key={event.id}
                      onClick={() => setSelectedEventId(event.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${event.risk > 0.7 ? 'bg-red-500' : event.risk > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {event.name}
                      </span>
                      <span className={`text-[10px] font-mono ${event.risk > 0.7 ? 'text-red-400' : event.risk > 0.5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                        {(event.risk * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* CURRENT - Countries list after event selected */}
              {viewMode === 'current' && selectedEventId && !selectedCountry && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to events
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    Affected Countries
                  </div>
                  {(affectedRegions[selectedEventId]?.countries || []).map((country) => (
                    <button
                      key={country.id}
                      onClick={() => setSelectedCountry(country.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <span className="text-sm">{country.flag}</span>
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {country.name}
                      </span>
                      <span className="text-white/30 text-[10px]">{country.cities.length} cities</span>
                    </button>
                  ))}
                  {!affectedRegions[selectedEventId] && (
                    <div className="text-white/30 text-xs px-2 py-2">
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
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to countries
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.name || 'Cities'}
                  </div>
                  {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.cities.map((city) => {
                    // Find event name from currentEvents
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
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${city.risk > 0.7 ? 'bg-red-500' : city.risk > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {city.name}
                      </span>
                      <span className={`text-[10px] font-mono ${city.risk > 0.7 ? 'text-red-400' : city.risk > 0.5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                        {(city.risk * 100).toFixed(0)}%
                      </span>
                    </button>
                  )})}
                </div>
              )}
              
              {/* CURRENT - City selected - Digital Twin is open */}
              {viewMode === 'current' && selectedEventId && selectedCountry && selectedCity && (
                <div className="space-y-2 py-1">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to cities
                  </button>
                  
                  {/* Selected city info - Digital Twin is open */}
                  <div className="px-2 py-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="text-cyan-400 text-sm font-medium">{selectedCity.name}</span>
                    </div>
                    <div className="text-white/50 text-[10px] mb-1">
                      Event: {currentEvents.flatMap(c => c.events).find(e => e.id === selectedEventId)?.name || selectedEventId}
                    </div>
                    <div className="text-cyan-400/70 text-[10px]">
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
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    Forecast Horizon
                  </div>
                  {forecastScenarios.map((period) => (
                    <button
                      key={period.horizon}
                      onClick={() => setSelectedHorizon(period.horizon)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <svg className="w-3.5 h-3.5 text-white/50 group-hover:text-white/70" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
                      </svg>
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {period.name}
                      </span>
                      <span className="text-white/30 text-[10px]">{period.scenarios.length} scenarios</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* FORECAST - Scenarios list after horizon selected */}
              {viewMode === 'forecast' && selectedHorizon && !selectedEventId && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedHorizon(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to horizons
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    {forecastScenarios.find(f => f.horizon === selectedHorizon)?.name || `${selectedHorizon}yr Scenarios`}
                  </div>
                  {forecastScenarios.find(f => f.horizon === selectedHorizon)?.scenarios.map((scenario) => (
                    <button
                      key={scenario.id}
                      onClick={() => setSelectedEventId(scenario.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${scenario.risk > 0.7 ? 'bg-red-500' : scenario.risk > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {scenario.name}
                      </span>
                      <span className={`text-[10px] font-mono ${scenario.risk > 0.7 ? 'text-red-400' : scenario.risk > 0.5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                        {(scenario.risk * 100).toFixed(0)}%
                      </span>
                      <span className="text-white/20 text-[9px] ml-1">{scenario.type}</span>
                    </button>
                  ))}
                </div>
              )}
              
              {/* FORECAST - Countries list after scenario selected */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && !selectedCountry && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedEventId(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to scenarios
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    Affected Countries
                  </div>
                  {(affectedRegions[selectedEventId]?.countries || []).map((country) => (
                    <button
                      key={country.id}
                      onClick={() => setSelectedCountry(country.id)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <span className="text-sm">{country.flag}</span>
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {country.name}
                      </span>
                      <span className="text-white/30 text-[10px]">{country.cities.length} cities</span>
                    </button>
                  ))}
                  {!affectedRegions[selectedEventId] && (
                    <div className="text-white/30 text-xs px-2 py-2">
                      Region data for forecast...
                    </div>
                  )}
                </div>
              )}
              
              {/* FORECAST - Cities list after country selected */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && selectedCountry && !selectedCity && (
                <div className="space-y-1 py-1">
                  <button
                    onClick={() => setSelectedCountry(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to countries
                  </button>
                  <div className="text-white/30 text-[10px] px-2 py-1 uppercase tracking-wider">
                    {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.name || 'Cities'} - {selectedHorizon}yr
                  </div>
                  {affectedRegions[selectedEventId]?.countries.find(c => c.id === selectedCountry)?.cities.map((city) => {
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
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded hover:bg-white/10 transition-all text-left group"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${city.risk > 0.7 ? 'bg-red-500' : city.risk > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'}`} />
                      <span className="text-white/70 text-xs group-hover:text-white flex-1">
                        {city.name}
                      </span>
                      <span className={`text-[10px] font-mono ${city.risk > 0.7 ? 'text-red-400' : city.risk > 0.5 ? 'text-orange-400' : 'text-yellow-400'}`}>
                        {(city.risk * 100).toFixed(0)}%
                      </span>
                    </button>
                  )})}
                </div>
              )}
              
              {/* FORECAST - City selected - Digital Twin is open */}
              {viewMode === 'forecast' && selectedHorizon && selectedEventId && selectedCountry && selectedCity && (
                <div className="space-y-2 py-1">
                  <button
                    onClick={() => setSelectedCity(null)}
                    className="w-full flex items-center gap-1 px-2 py-1 text-white/40 text-[10px] hover:text-white/60"
                  >
                    ← Back to cities
                  </button>
                  
                  {/* Selected city info - Digital Twin is open */}
                  <div className="px-2 py-2 bg-cyan-500/10 rounded-lg border border-cyan-500/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-500 animate-pulse" />
                      <span className="text-cyan-400 text-sm font-medium">{selectedCity.name}</span>
                    </div>
                    <div className="text-white/50 text-[10px] mb-1">
                      Scenario: {forecastScenarios.flatMap(h => h.scenarios).find(s => s.id === selectedEventId)?.name || selectedEventId}
                    </div>
                    <div className="text-white/40 text-[10px] mb-1">
                      Horizon: {selectedHorizon} years
                    </div>
                    <div className="text-cyan-400/70 text-[10px]">
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
      style={{ background: '#030810' }}
      initial={{ opacity: 1 }}
      animate={{ opacity: phase === 'entering' ? 0 : 1 }}
      transition={{ duration: 1.5 }}
    >
      <div className="text-center">
        {/* Logo */}
        <motion.div
          className="w-24 h-24 mx-auto mb-8 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/30 flex items-center justify-center"
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
          <CubeTransparentIcon className="w-12 h-12 text-cyan-400" />
        </motion.div>
        
        {/* Title */}
        <motion.h1
          className="text-white text-2xl font-light mb-2 tracking-wide"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          Global Risk Command Center
        </motion.h1>
        
        <motion.p
          className="text-white/40 text-sm mb-8"
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
                className="text-cyan-400/60 text-xs uppercase tracking-[0.2em]"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                Initializing Global View
              </motion.div>
            </>
          )}
          {phase === 'entering' && (
            <motion.div
              className="text-cyan-400 text-xs uppercase tracking-[0.2em]"
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
              className="w-1.5 h-1.5 rounded-full bg-cyan-400"
              animate={{ opacity: [0.2, 1, 0.2] }}
              transition={{ duration: 1, repeat: Infinity, delay: i * 0.2 }}
            />
          ))}
        </motion.div>
      </div>
      
      {/* Radial gradient overlay */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-gradient-to-t from-[#030810] via-transparent to-[#030810]/50" />
        <motion.div
          className="absolute inset-0"
          style={{
            background: 'radial-gradient(circle at center, transparent 0%, #030810 70%)',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'entering' ? 0 : 0.5 }}
        />
      </div>
    </motion.div>
  )
}

// ============================================
// CITY COORDINATES DATABASE FOR DIGITAL TWIN
// ============================================
const CITY_COORDINATES: Record<string, { lat: number; lng: number; exposure?: number; risk?: number }> = {
  // Major cities with coordinates for Digital Twin
  newyork: { lat: 40.7128, lng: -74.0060, exposure: 52.3, risk: 0.75 },
  tokyo: { lat: 35.6762, lng: 139.6503, exposure: 45.2, risk: 0.92 },
  london: { lat: 51.5074, lng: -0.1278, exposure: 38.5, risk: 0.68 },
  paris: { lat: 48.8566, lng: 2.3522, exposure: 28.4, risk: 0.62 },
  frankfurt: { lat: 50.1109, lng: 8.6821, exposure: 35.2, risk: 0.58 },
  berlin: { lat: 52.5200, lng: 13.4050, exposure: 22.8, risk: 0.55 },
  munich: { lat: 48.1351, lng: 11.5820, exposure: 18.5, risk: 0.52 },
  sydney: { lat: -33.8688, lng: 151.2093, exposure: 38.7, risk: 0.52 },
  melbourne: { lat: -37.8136, lng: 144.9631, exposure: 28.5, risk: 0.58 },
  boston: { lat: 42.3601, lng: -71.0589, exposure: 31.2, risk: 0.62 },
  chicago: { lat: 41.8781, lng: -87.6298, exposure: 25.4, risk: 0.65 },
  losangeles: { lat: 34.0522, lng: -118.2437, exposure: 42.1, risk: 0.72 },
  sanfrancisco: { lat: 37.7749, lng: -122.4194, exposure: 48.5, risk: 0.78 },
  shanghai: { lat: 31.2304, lng: 121.4737, exposure: 55.8, risk: 0.82 },
  beijing: { lat: 39.9042, lng: 116.4074, exposure: 48.2, risk: 0.78 },
  hongkong: { lat: 22.3193, lng: 114.1694, exposure: 42.5, risk: 0.75 },
  singapore: { lat: 1.3521, lng: 103.8198, exposure: 38.9, risk: 0.62 },
  dubai: { lat: 25.2048, lng: 55.2708, exposure: 32.5, risk: 0.68 },
  mumbai: { lat: 19.0760, lng: 72.8777, exposure: 28.4, risk: 0.82 },
  delhi: { lat: 28.6139, lng: 77.2090, exposure: 22.8, risk: 0.78 },
  seoul: { lat: 37.5665, lng: 126.9780, exposure: 38.5, risk: 0.72 },
  taipei: { lat: 25.0330, lng: 121.5654, exposure: 28.9, risk: 0.78 },
  moscow: { lat: 55.7558, lng: 37.6173, exposure: 35.2, risk: 0.72 },
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
}

function findCityCoordinates(cityId: string): { lat: number; lng: number; exposure?: number; risk?: number } | null {
  const normalized = cityId.toLowerCase().replace(/[^a-z]/g, '')
  return CITY_COORDINATES[normalized] || null
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function CommandCenter() {
  // Entry animation state
  const [showEntry, setShowEntry] = useState(true)
  const [entryComplete, setEntryComplete] = useState(false)
  
  // Core state
  const [portfolio, setPortfolio] = useState<PortfolioState>({
    totalExposure: 247.3,
    atRisk: 52.1,
    criticalCount: 4,
    weightedRisk: 0.68,
  })
  
  const [focusedHotspot, setFocusedHotspot] = useState<FocusedHotspot | null>(null)
  const [activeScenario, setActiveScenario] = useState<ActiveScenario | null>(null)
  const [isSceneReady, setIsSceneReady] = useState(false)
  const [recentAlerts, setRecentAlerts] = useState<RiskUpdate[]>([])
  const [showDigitalTwin, setShowDigitalTwin] = useState(false)
  const [showZoneNav, setShowZoneNav] = useState(false)
  const [availableZones, setAvailableZones] = useState<{id: string, name: string, risk: number}[]>([])
  const [resetViewTrigger, setResetViewTrigger] = useState(0)
  const [expandedRiskLevel, setExpandedRiskLevel] = useState<'critical' | 'high' | 'medium' | 'low' | null>(null)
  
  // Stress Test State (integrated into Risk Zones)
  const [selectedStressTest, setSelectedStressTest] = useState<{
    id: string
    name: string
    type: string
    severity: number
    probability: number
  } | null>(null)
  const [showActionPlans, setShowActionPlans] = useState(false)
  const [selectedZone, setSelectedZone] = useState<RiskZone | null>(null)
  const [selectedZoneAsset, setSelectedZoneAsset] = useState<ZoneAsset | null>(null)
  const [selectedDigitalTwinEvent, setSelectedDigitalTwinEvent] = useState<string | null>(null)
  const [selectedDigitalTwinEventName, setSelectedDigitalTwinEventName] = useState<string | null>(null)
  const [selectedDigitalTwinEventCategory, setSelectedDigitalTwinEventCategory] = useState<string | null>(null)
  const [selectedDigitalTwinTimeHorizon, setSelectedDigitalTwinTimeHorizon] = useState<string | null>(null)
  
  // Historical event state
  const [selectedHistoricalEvent, setSelectedHistoricalEvent] = useState<string | null>(null)
  const [showHistoricalPanel, setShowHistoricalPanel] = useState(false)
  
  // Helper to generate random assets within a zone
  const generateZoneAssets = useCallback((zone: Omit<RiskZone, 'assets'>, count: number): ZoneAsset[] => {
    const assetTypes: ZoneAsset['type'][] = ['bank', 'enterprise', 'developer', 'insurer', 'infrastructure', 'hospital', 'government']
    const assetNames: Record<ZoneAsset['type'], string[]> = {
      bank: ['Deutsche Bank', 'Commerzbank', 'UBS', 'Credit Suisse', 'ING Group', 'Santander'],
      enterprise: ['Siemens', 'BASF', 'Volkswagen', 'BMW', 'SAP', 'Bayer'],
      developer: ['Vonovia', 'LEG Immobilien', 'Aroundtown', 'Grand City', 'TAG Immobilien'],
      insurer: ['Allianz', 'Munich Re', 'Zurich Insurance', 'AXA', 'Generali'],
      infrastructure: ['E.ON Grid', 'RWE Power', 'Deutsche Bahn', 'Fraport', 'Eurogate'],
      hospital: ['Charité', 'UKE Hamburg', 'Klinikum München', 'Uniklinik Köln'],
      government: ['Bundesbank', 'Federal Ministry', 'State Office', 'Municipal HQ'],
      military: ['NATO Base', 'Bundeswehr HQ', 'Defense Center'],
      school: ['Technical University', 'Business School', 'Research Institute'],
    }
    
    const assets: ZoneAsset[] = []
    for (let i = 0; i < count; i++) {
      const type = assetTypes[i % assetTypes.length]
      const names = assetNames[type]
      const name = names[i % names.length]
      
      // Random position within zone radius
      const angle = Math.random() * 2 * Math.PI
      const distance = Math.random() * zone.radius_km * 0.8 // 80% of radius
      const latOffset = (distance / 111) * Math.cos(angle)
      const lngOffset = (distance / 111) * Math.sin(angle) / Math.cos(zone.center_latitude * Math.PI / 180)
      
      assets.push({
        id: `${zone.id}-asset-${i}`,
        name: `${name} ${zone.name?.split(' ')[0] || ''}`,
        type,
        latitude: zone.center_latitude + latOffset,
        longitude: zone.center_longitude + lngOffset,
        exposure: 0.5 + Math.random() * 4.5, // 0.5-5B
        impactSeverity: zone.risk_score * (0.6 + Math.random() * 0.4), // 60-100% of zone risk
      })
    }
    return assets
  }, [])

  // Demo risk zones (generated when stress test is active)
  const activeRiskZones = useMemo<RiskZone[]>(() => {
    if (!selectedStressTest) return []
    
    // Generate demo zones based on stress test type
    const typeZonesBase: Record<string, Omit<RiskZone, 'assets'>[]> = {
      climate: [
        { id: 'zone-1', name: 'Rhine Valley', zone_level: 'critical', center_latitude: 50.1, center_longitude: 8.7, radius_km: 150, risk_score: 0.92, affected_assets_count: 12, total_exposure: 12.5 },
        { id: 'zone-2', name: 'North Sea Coast', zone_level: 'high', center_latitude: 53.5, center_longitude: 8.0, radius_km: 200, risk_score: 0.75, affected_assets_count: 8, total_exposure: 8.3 },
        { id: 'zone-3', name: 'Po Valley', zone_level: 'medium', center_latitude: 45.0, center_longitude: 11.0, radius_km: 180, risk_score: 0.55, affected_assets_count: 6, total_exposure: 6.1 },
      ],
      financial: [
        { id: 'zone-1', name: 'Frankfurt Hub', zone_level: 'critical', center_latitude: 50.1, center_longitude: 8.7, radius_km: 80, risk_score: 0.88, affected_assets_count: 15, total_exposure: 45.2 },
        { id: 'zone-2', name: 'London City', zone_level: 'high', center_latitude: 51.5, center_longitude: -0.1, radius_km: 100, risk_score: 0.72, affected_assets_count: 12, total_exposure: 38.5 },
        { id: 'zone-3', name: 'Paris District', zone_level: 'medium', center_latitude: 48.9, center_longitude: 2.35, radius_km: 90, risk_score: 0.58, affected_assets_count: 10, total_exposure: 22.1 },
      ],
      geopolitical: [
        { id: 'zone-1', name: 'Eastern Border', zone_level: 'critical', center_latitude: 50.5, center_longitude: 24.0, radius_km: 300, risk_score: 0.95, affected_assets_count: 10, total_exposure: 18.7 },
        { id: 'zone-2', name: 'Baltic Corridor', zone_level: 'high', center_latitude: 56.0, center_longitude: 24.0, radius_km: 250, risk_score: 0.78, affected_assets_count: 7, total_exposure: 9.2 },
      ],
      pandemic: [
        { id: 'zone-1', name: 'Metropolitan Core', zone_level: 'critical', center_latitude: 52.5, center_longitude: 13.4, radius_km: 120, risk_score: 0.85, affected_assets_count: 18, total_exposure: 32.5 },
        { id: 'zone-2', name: 'Industrial Belt', zone_level: 'high', center_latitude: 51.2, center_longitude: 7.0, radius_km: 200, risk_score: 0.68, affected_assets_count: 12, total_exposure: 18.3 },
        { id: 'zone-3', name: 'Southern Region', zone_level: 'medium', center_latitude: 48.1, center_longitude: 11.6, radius_km: 150, risk_score: 0.52, affected_assets_count: 9, total_exposure: 14.1 },
      ],
      political: [
        { id: 'zone-1', name: 'Capital Region', zone_level: 'high', center_latitude: 52.5, center_longitude: 13.4, radius_km: 100, risk_score: 0.72, affected_assets_count: 10, total_exposure: 28.5 },
        { id: 'zone-2', name: 'Financial District', zone_level: 'medium', center_latitude: 50.1, center_longitude: 8.7, radius_km: 80, risk_score: 0.55, affected_assets_count: 8, total_exposure: 22.1 },
      ],
      regulatory: [
        { id: 'zone-1', name: 'Banking Sector', zone_level: 'high', center_latitude: 50.1, center_longitude: 8.7, radius_km: 100, risk_score: 0.68, affected_assets_count: 12, total_exposure: 42.5 },
        { id: 'zone-2', name: 'Insurance Hub', zone_level: 'medium', center_latitude: 48.1, center_longitude: 11.6, radius_km: 80, risk_score: 0.52, affected_assets_count: 8, total_exposure: 18.3 },
      ],
      civil_unrest: [
        { id: 'zone-1', name: 'Urban Center', zone_level: 'critical', center_latitude: 48.9, center_longitude: 2.35, radius_km: 50, risk_score: 0.88, affected_assets_count: 14, total_exposure: 35.2 },
        { id: 'zone-2', name: 'Industrial Zone', zone_level: 'high', center_latitude: 49.5, center_longitude: 2.1, radius_km: 80, risk_score: 0.72, affected_assets_count: 9, total_exposure: 18.5 },
      ],
    }
    
    const baseZones = typeZonesBase[selectedStressTest.type] || typeZonesBase.climate
    
    // Add assets to each zone
    return baseZones.map(zone => ({
      ...zone,
      assets: generateZoneAssets(zone, zone.affected_assets_count || 8),
    }))
  }, [selectedStressTest, generateZoneAssets])
  
  // Sample action plans for demo
  const demoActionPlans = [
    {
      id: '1',
      organizationType: 'developer',
      actions: ['Review all projects within risk zone perimeter', 'Update construction insurance coverage', 'Develop site evacuation procedures'],
      priority: 'high' as const,
      timeline: '72h',
      riskReduction: 0.3,
      estimatedCost: 500000,
    },
    {
      id: '2',
      organizationType: 'insurer',
      actions: ['Increase claims reserves allocation', 'Activate reinsurance treaties', 'Deploy damage assessment teams'],
      priority: 'critical' as const,
      timeline: '24h',
      riskReduction: 0.25,
    },
    {
      id: '3',
      organizationType: 'bank',
      actions: ['Review credit limits for borrowers in zone', 'Reassess collateral valuations', 'Prepare loan restructuring programs'],
      priority: 'high' as const,
      timeline: '1 week',
      riskReduction: 0.2,
    },
    {
      id: '4',
      organizationType: 'enterprise',
      actions: ['Activate business continuity plan', 'Secure critical equipment and assets', 'Establish backup communication channels'],
      priority: 'high' as const,
      timeline: 'immediate',
      riskReduction: 0.35,
    },
    {
      id: '5',
      organizationType: 'military',
      actions: ['Prepare civil support operations', 'Secure critical infrastructure perimeter', 'Coordinate with civilian emergency services'],
      priority: 'high' as const,
      timeline: '24h',
      riskReduction: 0.15,
    },
  ]
  
  // Handle entry animation complete
  const handleEntryComplete = useCallback(() => {
    setShowEntry(false)
    setEntryComplete(true)
  }, [])
  
  // WebSocket for real-time updates
  const { status: wsStatus } = useSimulatedWebSocket((msg) => {
    if (msg.type === 'risk_update') {
      const update = msg as RiskUpdate
      setRecentAlerts(prev => [update, ...prev.slice(0, 2)])
      
      // Update portfolio if significant change
      if (Math.abs(update.risk_score - update.previous_score) > 0.05) {
        setPortfolio(prev => ({
          ...prev,
          weightedRisk: prev.weightedRisk + (update.risk_score - update.previous_score) * 0.1,
        }))
      }
    }
  })

  // Load initial data
  useEffect(() => {
    async function loadData() {
      try {
        const res = await fetch(`${API_BASE}/geodata/summary`)
        if (res.ok) {
          const data = await res.json()
          setPortfolio({
            totalExposure: data.total_exposure || 247.3,
            atRisk: data.at_risk_exposure || 52.1,
            criticalCount: data.critical_count || 4,
            weightedRisk: data.weighted_risk || 0.68,
          })
        }
      } catch (e) {
        // Use defaults
      }
      setIsSceneReady(true)
    }
    loadData()
  }, [])

  // Hotspot data for cities - auto-generated from CITY_COORDINATES
  const HOTSPOT_DATA: Record<string, FocusedHotspot> = useMemo(() => {
    const data: Record<string, FocusedHotspot> = {}
    
    // Generate from CITY_COORDINATES
    Object.entries(CITY_COORDINATES).forEach(([id, coords]) => {
      const risk = coords.risk || 0.5
      const isConflict = risk > 0.9
      const isHighRisk = risk > 0.7
      
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
        },
      }
    })
    
    // Override with specific known data
    const overrides: Partial<Record<string, Partial<FocusedHotspot>>> = {
      newyork: { name: 'New York City', region: 'North America' },
      tokyo: { name: 'Tokyo', region: 'Asia Pacific' },
      london: { name: 'London', region: 'Europe' },
      kyiv: { name: 'Kyiv', region: 'Eastern Europe', factors: { climate: 0.2, credit: 0.1, operational: 0.95 } },
      gaza: { name: 'Gaza City', region: 'Middle East', factors: { climate: 0.1, credit: 0.05, operational: 0.99 } },
      damascus: { name: 'Damascus', region: 'Middle East', factors: { climate: 0.2, credit: 0.1, operational: 0.95 } },
      caracas: { name: 'Caracas', region: 'South America', factors: { climate: 0.3, credit: 0.9, operational: 0.85 } },
      taipei: { name: 'Taipei', region: 'Asia Pacific', factors: { climate: 0.85, credit: 0.4, operational: 0.75 } },
      kharkiv: { name: 'Kharkiv', region: 'Eastern Europe', factors: { climate: 0.2, credit: 0.1, operational: 0.92 } },
      telaviv: { name: 'Tel Aviv', region: 'Middle East', factors: { climate: 0.3, credit: 0.5, operational: 0.85 } },
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
    } else {
      console.log('Hotspot not found, using default')
      setFocusedHotspot({
        id: hotspotId,
        name: hotspotId,
        region: 'Unknown',
        risk: 0.5,
        exposure: 10,
        trend: 'up',
        factors: { climate: 0.5, credit: 0.5, operational: 0.5 },
      })
    }
  }, [])

  // Handle scenario activation (keyboard shortcut in future)
  const activateScenario = useCallback((type: string, severity: number) => {
    setActiveScenario({ type, severity, active: true })
  }, [])

  const deactivateScenario = useCallback(() => {
    setActiveScenario(null)
    setSelectedStressTest(null)
    setSelectedZone(null)
  }, [])

  // Track if user manually deselected zone (to prevent auto-zoom loop)
  const userDeselectedZoneRef = useRef(false)
  
  // Handle stress test selection from StressTestSelector
  const handleStressTestSelect = useCallback((scenario: typeof selectedStressTest) => {
    userDeselectedZoneRef.current = false  // Reset on new selection
    setSelectedStressTest(scenario)
    if (scenario) {
      setActiveScenario({
        type: scenario.name,
        severity: scenario.severity,
        active: true,
      })
    } else {
      setActiveScenario(null)
      setSelectedZone(null)
    }
  }, [])
  
  // Auto-zoom to first zone ONLY when stress test is first selected
  useEffect(() => {
    // Only auto-zoom if:
    // 1. We have zones
    // 2. Stress test is selected
    // 3. No zone is selected
    // 4. User didn't manually deselect
    if (activeRiskZones.length > 0 && selectedStressTest && !selectedZone && !userDeselectedZoneRef.current) {
      const timer = setTimeout(() => {
        setSelectedZone(activeRiskZones[0])
        console.log('Auto-zooming to first zone:', activeRiskZones[0].name)
      }, 300)
      return () => clearTimeout(timer)
    }
  }, [activeRiskZones, selectedStressTest]) // Removed selectedZone from deps!

  return (
    <div className="fixed inset-0 bg-[#030810] overflow-hidden">
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
      {/* ============================================ */}
      <div className={`absolute inset-0 transition-opacity duration-300 ${showDigitalTwin ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}>
        <CesiumGlobe 
          onAssetSelect={handleHotspotFocus}
          selectedAsset={focusedHotspot?.id || null}
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
        />
      </div>

      {/* ============================================ */}
      {/* UI LAYER - HUD overlay, minimal, no frames */}
      {/* ============================================ */}
      <AnimatePresence>
        {isSceneReady && entryComplete && (
          <>
            {/* TOP RIGHT - Quick Navigation */}
            <motion.div 
              className="absolute top-6 right-8 pointer-events-auto z-50"
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <div className="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-full px-2 py-1.5 border border-white/10">
                <Link 
                  to="/"
                  className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  title="Dashboard"
                >
                  <HomeIcon className="w-4 h-4" />
                </Link>
                <Link 
                  to="/visualizations"
                  className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  title="Visualizations & Risk Flow"
                >
                  <ChartBarIcon className="w-4 h-4" />
                </Link>
                <Link 
                  to="/settings"
                  className="p-2 rounded-full text-white/50 hover:text-white hover:bg-white/10 transition-all"
                  title="Settings"
                >
                  <Cog6ToothIcon className="w-4 h-4" />
                </Link>
              </div>
            </motion.div>
            
            {/* TOP LEFT - Core Metrics (HUD style, clickable) */}
            <motion.div 
              className="absolute top-8 left-8 pointer-events-auto"
              initial={{ opacity: 0, x: -30 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              {/* Total Exposure */}
              <div className="mb-4">
                <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-1">
                  Total Exposure
                </div>
                <div className="text-white text-3xl font-extralight tracking-tight">
                  ${formatBillions(portfolio.totalExposure)}
                </div>
              </div>
              
              {/* At Risk */}
              <div className="mb-4">
                <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-1">
                  At Risk
                </div>
                <div className={`text-2xl font-extralight ${getRiskColor(portfolio.weightedRisk)}`}>
                  ${formatBillions(portfolio.atRisk)}
                  <span className="text-white/30 text-sm ml-2">
                    ({(portfolio.atRisk / portfolio.totalExposure * 100).toFixed(1)}%)
                  </span>
                </div>
              </div>
              
              {/* Risk Level Indicators - Clickable */}
              <div className="text-white/30 text-[10px] uppercase tracking-[0.2em] mb-2">
                Risk Zones
              </div>
              <div className="space-y-1.5">
                {/* Critical */}
                <RiskLevelRow
                  level="critical"
                  label="Critical"
                  color="red"
                  zones={availableZones.filter(z => z.risk > 0.8)}
                  isExpanded={expandedRiskLevel === 'critical'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'critical' ? null : 'critical')}
                  onZoneClick={(id) => { handleHotspotFocus(id); setExpandedRiskLevel(null); }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel(null)
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
                    setExpandedRiskLevel(null)
                  }}
                />
                {/* High */}
                <RiskLevelRow
                  level="high"
                  label="High"
                  color="orange"
                  zones={availableZones.filter(z => z.risk > 0.6 && z.risk <= 0.8)}
                  isExpanded={expandedRiskLevel === 'high'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'high' ? null : 'high')}
                  onZoneClick={(id) => { handleHotspotFocus(id); setExpandedRiskLevel(null); }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel(null)
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
                    setExpandedRiskLevel(null)
                  }}
                />
                {/* Medium */}
                <RiskLevelRow
                  level="medium"
                  label="Medium"
                  color="yellow"
                  zones={availableZones.filter(z => z.risk > 0.4 && z.risk <= 0.6)}
                  isExpanded={expandedRiskLevel === 'medium'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'medium' ? null : 'medium')}
                  onZoneClick={(id) => { handleHotspotFocus(id); setExpandedRiskLevel(null); }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel(null)
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
                    setExpandedRiskLevel(null)
                  }}
                />
                {/* Low */}
                <RiskLevelRow
                  level="low"
                  label="Low"
                  color="green"
                  zones={availableZones.filter(z => z.risk <= 0.4)}
                  isExpanded={expandedRiskLevel === 'low'}
                  onToggle={() => setExpandedRiskLevel(expandedRiskLevel === 'low' ? null : 'low')}
                  onZoneClick={(id) => { handleHotspotFocus(id); setExpandedRiskLevel(null); }}
                  onHistoricalSelect={(eventId) => {
                    setSelectedHistoricalEvent(eventId)
                    setShowHistoricalPanel(true)
                    setExpandedRiskLevel(null)
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
                    setExpandedRiskLevel(null)
                  }}
                />
              </div>

              {/* Stress Lab removed - integrated into Risk Zones */}
            </motion.div>

            {/* TOP RIGHT - Stress Test Results Panel (when active) */}
            <AnimatePresence>
              {activeScenario && (
                <motion.div 
                  className="absolute top-8 right-8 pointer-events-auto w-72"
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 50, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                >
                  <div className="bg-black/70 backdrop-blur-xl border border-red-500/30 rounded-xl overflow-hidden">
                    {/* Header */}
                    <div className="px-4 py-3 bg-red-500/10 border-b border-red-500/20 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                        <span className="text-red-400 text-xs uppercase tracking-wider font-medium">
                          Stress Test Active
                        </span>
                      </div>
                      <button
                        onClick={deactivateScenario}
                        className="text-white/40 hover:text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Scenario Info */}
                    <div className="px-4 py-3 border-b border-white/5">
                      <div className="text-white text-sm font-medium mb-1">
                        {activeScenario.type}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                          <motion.div 
                            className="h-full bg-gradient-to-r from-yellow-500 via-orange-500 to-red-500 rounded-full"
                            initial={{ width: 0 }}
                            animate={{ width: `${activeScenario.severity * 100}%` }}
                            transition={{ duration: 0.6 }}
                          />
                        </div>
                        <span className="text-white/60 text-xs font-mono">
                          {(activeScenario.severity * 100).toFixed(0)}%
                        </span>
                      </div>
                    </div>
                    
                    {/* Stress Results - Monte Carlo Risk Metrics */}
                    <div className="p-4 space-y-3">
                      {/* VaR 99% - Monte Carlo */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/50 text-xs">VaR 99%</span>
                          <span className="text-[8px] text-cyan-400/50 bg-cyan-400/10 px-1 rounded">MC</span>
                        </div>
                        <motion.span 
                          className="text-red-400 font-mono text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.2 }}
                        >
                          ${(portfolio.atRisk * activeScenario.severity * 0.15).toFixed(1)}B
                        </motion.span>
                      </div>
                      
                      {/* Expected Shortfall (CVaR) */}
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <span className="text-white/50 text-xs">ES (CVaR)</span>
                          <span className="text-[8px] text-cyan-400/50 bg-cyan-400/10 px-1 rounded">Copula</span>
                        </div>
                        <motion.span 
                          className="text-orange-400 font-mono text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.3 }}
                        >
                          ${(portfolio.atRisk * activeScenario.severity * 0.22).toFixed(1)}B
                        </motion.span>
                      </div>
                      
                      {/* Max Loss */}
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-xs">Max Drawdown</span>
                        <motion.span 
                          className="text-red-500 font-mono text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.4 }}
                        >
                          ${(portfolio.atRisk * activeScenario.severity * 0.35).toFixed(1)}B
                        </motion.span>
                      </div>
                      
                      {/* Affected Assets */}
                      <div className="flex justify-between items-center pt-2 border-t border-white/5">
                        <span className="text-white/50 text-xs">Affected Zones</span>
                        <motion.span 
                          className="text-yellow-400 font-mono text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.5 }}
                        >
                          {Math.ceil(portfolio.criticalCount * (1 + activeScenario.severity))}
                        </motion.span>
                      </div>
                      
                      {/* Recovery Time */}
                      <div className="flex justify-between items-center">
                        <span className="text-white/50 text-xs">Est. Recovery</span>
                        <motion.span 
                          className="text-cyan-400 font-mono text-sm"
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.6 }}
                        >
                          {(1.5 + activeScenario.severity * 3).toFixed(1)} yrs
                        </motion.span>
                      </div>
                    </div>
                    
                    {/* Risk Flow Mini */}
                    <div className="px-3 py-2 border-t border-white/5">
                      <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">Impact Flow</div>
                      <RiskFlowMini 
                        riskZones={availableZones.slice(0, 4).map(z => ({
                          name: z.name,
                          risk: z.risk,
                          exposure: 10 + z.risk * 40,
                        }))}
                        height={120}
                      />
                    </div>
                    
                    {/* Simulation Info - Monte Carlo Details */}
                    <div className="px-3 py-2 bg-white/5 border-t border-white/5">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-white/40 text-[10px] uppercase tracking-wider">Monte Carlo Engine</span>
                        <div className="flex items-center gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                          <span className="text-emerald-400/70 text-[9px]">Active</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-[10px]">
                        <div className="flex justify-between">
                          <span className="text-white/40">Simulations</span>
                          <span className="text-white/60 font-mono">10,000</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Copula</span>
                          <span className="text-cyan-400/70 font-mono">Gaussian</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Confidence</span>
                          <span className="text-white/60 font-mono">99%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-white/40">Engine</span>
                          <span className="text-cyan-400/70 font-mono">NumPy</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Action Plans Button */}
                    <div className="p-3 border-t border-white/5">
                      <button
                        onClick={() => setShowActionPlans(true)}
                        className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/30 transition-all text-xs text-cyan-400 hover:text-cyan-300"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        View Action Plans
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* BOTTOM LEFT - System Status (minimal) */}
            <motion.div 
              className="absolute bottom-8 left-8 pointer-events-none"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-1.5 h-1.5 rounded-full ${
                    wsStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400'
                  } animate-pulse`} />
                  <span className="text-white/20 text-[10px] uppercase tracking-wider">
                    {wsStatus === 'connected' ? 'Live' : 'Offline'}
                  </span>
                </div>
                <div className="text-white/10 text-[10px]">
                  {new Date().toLocaleTimeString()}
                </div>
              </div>
            </motion.div>

            {/* BOTTOM CENTER - Timeline & Quick Actions */}
            <motion.div 
              className="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-auto"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
            >
              {/* Scenario Timeline (when stress test active) */}
              <AnimatePresence>
                {activeScenario && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="mb-4 px-6 py-3 bg-black/50 backdrop-blur-md rounded-xl border border-white/10"
                  >
                    <div className="flex items-center gap-8">
                      {/* Timeline markers */}
                      {['T0', 'T+1Y', 'T+2Y', 'T+3Y', 'T+5Y'].map((marker, i) => (
                        <div key={marker} className="flex flex-col items-center">
                          <div 
                            className={`w-3 h-3 rounded-full mb-1 transition-all ${
                              i === 0 
                                ? 'bg-cyan-400 ring-2 ring-cyan-400/30' 
                                : 'bg-white/20 hover:bg-white/40'
                            }`}
                          />
                          <span className={`text-[10px] ${
                            i === 0 ? 'text-cyan-400' : 'text-white/30'
                          }`}>
                            {marker}
                          </span>
                        </div>
                      ))}
                    </div>
                    {/* Progress line */}
                    <div className="relative mt-1 -mb-1">
                      <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10" 
                           style={{ marginLeft: '6px', marginRight: '6px', top: '-18px' }} />
                      <motion.div 
                        className="absolute top-0 left-0 h-0.5 bg-gradient-to-r from-cyan-400 to-transparent"
                        style={{ marginLeft: '6px', top: '-18px' }}
                        initial={{ width: 0 }}
                        animate={{ width: '20%' }}
                        transition={{ duration: 1, delay: 0.5 }}
                      />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              
            </motion.div>
            
            {/* BOTTOM RIGHT - Keyboard shortcuts */}
            <motion.div 
              className="absolute bottom-8 right-8 pointer-events-none"
              style={{ right: '2rem', marginRight: '0' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              <div className="flex gap-3 px-4 py-2.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10">
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-[10px] text-cyan-400 font-medium">Z</kbd>
                    <span className="text-white/60 text-xs">Zones</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-[10px] text-cyan-400 font-medium">S</kbd>
                    <span className="text-white/60 text-xs">Stress</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-cyan-500/20 border border-cyan-500/30 rounded text-[10px] text-cyan-400 font-medium">D</kbd>
                    <span className="text-white/60 text-xs">Twin</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded text-[10px] text-orange-400 font-medium">R</kbd>
                    <span className="text-white/40 text-xs">Reset</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <kbd className="px-2 py-1 bg-white/10 border border-white/20 rounded text-[10px] text-white/70 font-medium">ESC</kbd>
                    <span className="text-white/40 text-xs">Back</span>
                  </div>
              </div>
            </motion.div>

            {/* RIGHT SIDE - Recent Alerts (above keyboard shortcuts) */}
            <motion.div 
              className="absolute bottom-24 right-8 pointer-events-none"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
            >
              <div className="text-right">
                <div className="text-white/30 text-[9px] uppercase tracking-wider mb-2">Recent Activity</div>
                <AnimatePresence mode="popLayout">
                  {recentAlerts.slice(0, 3).map((alert, i) => (
                    <motion.div
                      key={`${alert.hotspot_id}-${alert.timestamp}`}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1 - i * 0.25, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center gap-2 text-[11px] mb-1.5 justify-end"
                    >
                      <span className="text-white/50 capitalize">{alert.hotspot_id}</span>
                      <span className="text-white/70 font-mono">
                        {(alert.risk_score * 100).toFixed(0)}%
                      </span>
                      <span className={`font-medium ${alert.risk_score > alert.previous_score ? 'text-red-400' : 'text-emerald-400'}`}>
                        {alert.risk_score > alert.previous_score ? '↑' : '↓'}
                      </span>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.div>

            {/* ============================================ */}
            {/* CONTEXT PANEL - Appears on hotspot focus */}
            {/* ============================================ */}
            <AnimatePresence>
              {focusedHotspot && (
                <motion.div 
                  className="absolute top-0 right-0 bottom-0 w-80 pointer-events-auto"
                  initial={{ opacity: 0, x: 100 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 100 }}
                  transition={{ duration: 0.4, ease: 'easeOut' }}
                >
                  {/* Gradient fade on left edge */}
                  <div className="absolute inset-y-0 left-0 w-16 bg-gradient-to-r from-transparent to-black/60" />
                  
                  {/* Panel content */}
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-xl p-6 overflow-y-auto">
                    {/* Close hint */}
                    <div className="flex justify-between items-center mb-6">
                      <div className="text-white/30 text-[10px] uppercase tracking-wider">
                        Focused Zone
                      </div>
                      <button
                        onClick={() => handleHotspotFocus(null)}
                        className="text-white/30 hover:text-white transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                    
                    {/* Zone name */}
                    <div className="mb-6">
                      <h2 className="text-white text-xl font-light mb-1">
                        {focusedHotspot.name}
                      </h2>
                      <div className="text-white/40 text-sm">
                        {focusedHotspot.region}
                      </div>
                    </div>
                    
                    {/* Risk score - dominant */}
                    <div className="mb-8">
                      <div className="flex items-end gap-3">
                        <span className={`text-5xl font-extralight ${getRiskColor(focusedHotspot.risk)}`}>
                          {(focusedHotspot.risk * 100).toFixed(0)}
                        </span>
                        <span className="text-white/30 text-lg mb-2">%</span>
                        <span className={`text-sm mb-2 ${
                          focusedHotspot.trend === 'up' ? 'text-red-400' : 'text-emerald-400'
                        }`}>
                          {focusedHotspot.trend === 'up' ? '↑' : '↓'}
                        </span>
                      </div>
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mt-1">
                        Composite Risk Score
                      </div>
                    </div>
                    
                    {/* Exposure */}
                    <div className="mb-8">
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mb-2">
                        Exposure
                      </div>
                      <div className="text-white text-2xl font-extralight">
                        ${formatBillions(focusedHotspot.exposure)}
                      </div>
                    </div>
                    
                    {/* Risk factors - minimal bars */}
                    <div className="mb-8">
                      <div className="text-white/30 text-[10px] uppercase tracking-wider mb-4">
                        Risk Factors
                      </div>
                      <div className="space-y-3">
                        {Object.entries(focusedHotspot.factors).map(([key, value]) => (
                          <div key={key}>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-white/50 capitalize">{key}</span>
                              <span className={`font-mono ${getRiskColor(value)}`}>
                                {(value * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="h-1 bg-white/10 rounded-full overflow-hidden">
                              <motion.div 
                                className={`h-full rounded-full ${
                                  value > 0.7 ? 'bg-red-500' :
                                  value > 0.5 ? 'bg-orange-500' :
                                  value > 0.3 ? 'bg-yellow-500' : 'bg-emerald-500'
                                }`}
                                initial={{ width: 0 }}
                                animate={{ width: `${value * 100}%` }}
                                transition={{ duration: 0.6, delay: 0.2 }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {/* Actions - Single button to open Digital Twin with context */}
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          // Open Digital Twin with stress test ready to run
                          if (focusedHotspot) {
                            console.log('Opening Digital Twin for stress test:', focusedHotspot.id, focusedHotspot.name)
                            const coords = findCityCoordinates(focusedHotspot.id)
                            if (coords) {
                              setSelectedZoneAsset({
                                id: focusedHotspot.id,
                                name: focusedHotspot.name,
                                type: 'city' as const,
                                latitude: coords.lat,
                                longitude: coords.lng,
                                exposure: focusedHotspot.exposure || 10,
                                impactSeverity: focusedHotspot.risk || 0.5,
                              })
                            } else {
                              const normalizedId = focusedHotspot.id.toLowerCase().replace(/[^a-z]/g, '')
                              const fallbackCoords = CITY_COORDINATES[normalizedId]
                              if (fallbackCoords) {
                                setSelectedZoneAsset({
                                  id: focusedHotspot.id,
                                  name: focusedHotspot.name,
                                  type: 'city',
                                  latitude: fallbackCoords.lat,
                                  longitude: fallbackCoords.lng,
                                  exposure: focusedHotspot.exposure || 10,
                                  impactSeverity: focusedHotspot.risk || 0.5,
                                })
                              }
                            }
                            // Determine event category based on city risk factors
                            const riskCategory = focusedHotspot.risk > 0.8 ? 'conflict' : 
                              focusedHotspot.risk > 0.6 ? 'climate' : 'financial'
                            
                            setSelectedDigitalTwinEvent('stress_test_scenario')
                            setSelectedDigitalTwinEventName(`Stress Test: ${focusedHotspot.name}`)
                            setSelectedDigitalTwinEventCategory(riskCategory)
                            setSelectedDigitalTwinTimeHorizon('current')
                          }
                          setShowDigitalTwin(true)
                        }}
                        className="w-full py-2.5 px-4 bg-amber-500/20 border border-amber-500/40 rounded-lg
                          text-amber-400 text-sm hover:bg-amber-500/30 hover:text-amber-300 transition-all
                          flex items-center justify-between font-medium"
                      >
                        <span>Open Digital Twin & Stress Test</span>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
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
            <div className="bg-black/90 backdrop-blur-xl rounded-2xl border border-white/20 p-6 min-w-[400px]">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-white text-lg font-light">Quick Navigation</h3>
                <button
                  onClick={() => setShowZoneNav(false)}
                  className="text-white/40 hover:text-white"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                {availableZones.sort((a, b) => b.risk - a.risk).map((zone, idx) => (
                  <button
                    key={zone.id}
                    onClick={() => {
                      handleHotspotFocus(zone.id)
                      setShowZoneNav(false)
                    }}
                    className="flex items-center gap-3 p-3 bg-white/5 hover:bg-white/10 rounded-lg transition-all text-left group"
                  >
                    <span className="text-white/30 text-xs font-mono w-5">{idx + 1}</span>
                    <div className="flex-1">
                      <div className="text-white text-sm">{zone.name}</div>
                      <div className={`text-xs ${getRiskColor(zone.risk)}`}>
                        Risk: {(zone.risk * 100).toFixed(0)}%
                      </div>
                    </div>
                    <div className={`w-2 h-2 rounded-full ${
                      zone.risk > 0.7 ? 'bg-red-500' : zone.risk > 0.5 ? 'bg-orange-500' : 'bg-yellow-500'
                    }`} />
                  </button>
                ))}
              </div>
              
              <div className="mt-4 pt-4 border-t border-white/10 flex justify-center gap-4 text-white/30 text-xs">
                <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">ESC</kbd> Close</span>
                <span><kbd className="px-1.5 py-0.5 bg-white/10 rounded">R</kbd> Reset View</span>
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
          setSelectedDigitalTwinEvent(null)
          setSelectedDigitalTwinEventName(null)
          setSelectedDigitalTwinEventCategory(null)
          setSelectedDigitalTwinTimeHorizon(null)
        }}
        assetId={focusedHotspot?.id}
        dynamicAsset={selectedZoneAsset}
        eventId={selectedDigitalTwinEvent}
        eventName={selectedDigitalTwinEventName}
        eventCategory={selectedDigitalTwinEventCategory}
        timeHorizon={selectedDigitalTwinTimeHorizon}
      />

      {/* ============================================ */}
      {/* ZONE DETAIL PANEL */}
      {/* ============================================ */}
      <AnimatePresence>
        {selectedZone && activeScenario && (
          <motion.div
            className="absolute top-24 right-8 z-50 pointer-events-auto"
            initial={{ opacity: 0, x: 50 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 50 }}
            transition={{ duration: 0.3 }}
          >
            <ZoneDetailPanel
              zone={{
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
                // Use real assets from zone
                entities: (selectedZone.assets || []).map(asset => ({
                  id: asset.id,
                  name: asset.name,
                  type: asset.type,
                  exposure: asset.exposure,
                  impactSeverity: asset.impactSeverity,
                  location: selectedZone.name || 'Zone',
                })),
              }}
              onClose={() => { userDeselectedZoneRef.current = true; setSelectedZone(null); }}
              onViewReport={() => {
                console.log('View report for zone:', selectedZone.id)
              }}
              onViewActionPlans={() => setShowActionPlans(true)}
              onEntityClick={(entity) => {
                console.log('Entity clicked:', entity.name, '- opening Digital Twin with OSM Buildings')
                // Find the full asset data from zone
                const fullAsset = selectedZone?.assets?.find(a => a.id === entity.id)
                if (fullAsset) {
                  setSelectedZoneAsset(fullAsset)
                } else {
                  // Create synthetic asset from entity
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
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ============================================ */}
      {/* ACTION PLANS MODAL */}
      {/* ============================================ */}
      <ActionPlanModal
        isOpen={showActionPlans}
        onClose={() => setShowActionPlans(false)}
        stressTestName={selectedStressTest?.name || activeScenario?.type || 'Stress Test'}
        zoneName={selectedZone?.name || focusedHotspot?.name}
        actionPlans={demoActionPlans}
      />
      
      {/* ============================================ */}
      {/* KEYBOARD SHORTCUTS */}
      {/* ============================================ */}
      <KeyboardHandler
        onStressTest={() => {
          console.log('Action: Stress Test')
          activateScenario('Climate Physical', 0.8)
        }}
        onDigitalTwin={() => {
          console.log('Action: Digital Twin')
          setShowDigitalTwin(true)
        }}
        onResetView={() => {
          console.log('Action: Reset View')
          handleHotspotFocus(null)
          deactivateScenario()
          setShowDigitalTwin(false)
          setShowZoneNav(false)
          setResetViewTrigger(prev => prev + 1) // Trigger globe reset
        }}
        onEscape={() => {
          console.log('Action: Escape')
          if (showActionPlans) {
            setShowActionPlans(false)
          } else if (selectedZone) {
            userDeselectedZoneRef.current = true
            setSelectedZone(null)
          } else if (showDigitalTwin) {
            setShowDigitalTwin(false)
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
      />
    </div>
  )
}

// ============================================
// KEYBOARD HANDLER COMPONENT
// ============================================

function KeyboardHandler({ 
  onStressTest, 
  onDigitalTwin,
  onResetView, 
  onEscape,
  onZoneNav
}: { 
  onStressTest: () => void
  onDigitalTwin: () => void
  onResetView: () => void
  onEscape: () => void
  onZoneNav: () => void
}) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }
      // Allow Escape even with modifiers
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        console.log('Keyboard: ESC pressed')
        onEscape()
        return
      }
      // Ignore other keys if modifier keys are pressed
      if (e.ctrlKey || e.metaKey || e.altKey) {
        return
      }
      
      const key = e.key.toLowerCase()
      
      switch(key) {
        case 's':
          e.preventDefault()
          e.stopPropagation()
          console.log('Keyboard: S - Stress Test')
          onStressTest()
          break
        case 'd':
          e.preventDefault()
          e.stopPropagation()
          console.log('Keyboard: D - Digital Twin')
          onDigitalTwin()
          break
        case 'r':
          e.preventDefault()
          e.stopPropagation()
          console.log('Keyboard: R - Reset View')
          onResetView()
          break
        case 'z':
        case 'n':
          e.preventDefault()
          e.stopPropagation()
          console.log('Keyboard: Z/N - Zone Navigation')
          onZoneNav()
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
        case '6':
        case '7':
        case '8':
          // Quick jump to zone by number
          e.preventDefault()
          e.stopPropagation()
          console.log('Keyboard: Quick jump to zone', key)
          break
      }
    }
    
    // Use capture phase for highest priority
    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [onStressTest, onDigitalTwin, onResetView, onEscape, onZoneNav])
  
  return null
}
