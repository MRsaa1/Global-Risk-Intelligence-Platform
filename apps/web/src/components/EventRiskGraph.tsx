/**
 * Event Risk Graph
 * ================
 * 
 * Contextual risk graph that generates based on specific event/scenario.
 * Used in Historical Events, Current Events, and Forecast panels.
 */
import { useRef, useCallback, useMemo, useEffect, useState } from 'react'
import ForceGraph3D, { ForceGraphMethods } from 'react-force-graph-3d'
import * as THREE from 'three'

interface GraphNode {
  id: string
  name: string
  type: string
  value: number
  risk: number
  x?: number
  y?: number
  z?: number
}

interface GraphLink {
  source: string
  target: string
  strength: number
  type: 'supply' | 'financial' | 'operational' | 'geographic'
}

interface GraphData {
  nodes: GraphNode[]
  links: GraphLink[]
}

interface EventRiskGraphProps {
  eventId: string
  eventType: 'historical' | 'current' | 'forecast'
  eventName: string
  eventCategory?: string | null
  cityName?: string
  width?: number
  height?: number
  compact?: boolean
  fullWidth?: boolean  // Use container width instead of fixed width
  /** When set with scenarioId, fetch graph from stress/cascade pipeline; else fallback to static template. */
  stressTestId?: string
  scenarioId?: string
  /** City ID for cascade build-from-context; uses 'default' when omitted. */
  cityId?: string
  /** Show expanded legend (link types, risk levels) under the graph. */
  showLegend?: boolean
  /** Show summary (Nodes, Links, Exposure) under the graph. */
  showSummary?: boolean
}

// Map stress-test and risk-zone eventIds to template keys (fukushima2011, lehman2008, ukraine2022, covid2020, eurozone2011)
const EVENT_ID_TO_TEMPLATE: Record<string, string> = {
  Sovereign_Debt_Crisis: 'eurozone2011',
  debt_crisis: 'eurozone2011',
  eurozone2011: 'eurozone2011',
  seismic_shock: 'fukushima2011',
  flood_event: 'fukushima2011',
  hurricane: 'fukushima2011',
  climate_5yr: 'fukushima2011',
  climate_10yr: 'fukushima2011',
  climate_25yr: 'fukushima2011',
  sea_level_10yr: 'fukushima2011',
  sea_level_25yr: 'fukushima2011',
  credit_crunch: 'lehman2008',
  market_crash: 'lehman2008',
  liquidity_crisis: 'lehman2008',
  financial_stress_5yr: 'lehman2008',
  conflict_escalation: 'ukraine2022',
  sanctions_escalation: 'ukraine2022',
  regional_conflict_spillover: 'ukraine2022',
  trade_war_supply: 'ukraine2022',
  energy_shock: 'ukraine2022',
  supply_chain: 'fukushima2011',
  cyber_attack: 'fukushima2011',
  tech_disruption_10yr: 'fukushima2011',
  tech_disruption_25yr: 'fukushima2011',
  demographic_25yr: 'fukushima2011',
  pandemic: 'covid2020',
}

// Generate graph data based on event type, ID, and category fallback
function generateEventGraph(
  eventId: string,
  _eventType: string,
  eventCategory?: string | null,
  _cityName?: string
): GraphData {
  // Different graph structures for different event types
  const eventGraphs: Record<string, GraphData> = {
    // Financial Crisis 2008
    lehman2008: {
      nodes: [
        { id: 'lehman', name: 'Lehman Brothers', type: 'bank', value: 65, risk: 1.0 },
        { id: 'aig', name: 'AIG', type: 'insurance', value: 85, risk: 0.95 },
        { id: 'bear', name: 'Bear Stearns', type: 'bank', value: 45, risk: 0.92 },
        { id: 'merrill', name: 'Merrill Lynch', type: 'bank', value: 55, risk: 0.88 },
        { id: 'goldman', name: 'Goldman Sachs', type: 'bank', value: 70, risk: 0.72 },
        { id: 'morgan', name: 'Morgan Stanley', type: 'bank', value: 68, risk: 0.75 },
        { id: 'citi', name: 'Citigroup', type: 'bank', value: 90, risk: 0.85 },
        { id: 'realestate', name: 'Real Estate Market', type: 'market', value: 150, risk: 0.95 },
        { id: 'mortgages', name: 'Mortgage Securities', type: 'security', value: 120, risk: 0.98 },
        { id: 'consumers', name: 'Consumer Credit', type: 'market', value: 80, risk: 0.78 },
      ],
      links: [
        { source: 'mortgages', target: 'lehman', strength: 0.95, type: 'financial' },
        { source: 'mortgages', target: 'bear', strength: 0.92, type: 'financial' },
        { source: 'realestate', target: 'mortgages', strength: 0.98, type: 'operational' },
        { source: 'lehman', target: 'aig', strength: 0.88, type: 'financial' },
        { source: 'lehman', target: 'merrill', strength: 0.82, type: 'financial' },
        { source: 'aig', target: 'goldman', strength: 0.75, type: 'financial' },
        { source: 'aig', target: 'morgan', strength: 0.72, type: 'financial' },
        { source: 'bear', target: 'citi', strength: 0.78, type: 'financial' },
        { source: 'consumers', target: 'realestate', strength: 0.85, type: 'operational' },
        { source: 'citi', target: 'consumers', strength: 0.68, type: 'financial' },
      ]
    },
    // Fukushima 2011
    fukushima2011: {
      nodes: [
        { id: 'plant', name: 'Fukushima Daiichi', type: 'energy', value: 40, risk: 1.0 },
        { id: 'tepco', name: 'TEPCO', type: 'utility', value: 65, risk: 0.95 },
        { id: 'grid', name: 'Power Grid', type: 'infrastructure', value: 80, risk: 0.88 },
        { id: 'toyota', name: 'Toyota Production', type: 'manufacturing', value: 55, risk: 0.72 },
        { id: 'semiconductor', name: 'Semiconductor Plants', type: 'manufacturing', value: 45, risk: 0.78 },
        { id: 'ports', name: 'Coastal Ports', type: 'transport', value: 35, risk: 0.85 },
        { id: 'agriculture', name: 'Agricultural Zone', type: 'agriculture', value: 25, risk: 0.65 },
        { id: 'supply', name: 'Global Supply Chain', type: 'logistics', value: 100, risk: 0.68 },
      ],
      links: [
        { source: 'plant', target: 'tepco', strength: 0.98, type: 'operational' },
        { source: 'plant', target: 'grid', strength: 0.92, type: 'operational' },
        { source: 'grid', target: 'toyota', strength: 0.85, type: 'supply' },
        { source: 'grid', target: 'semiconductor', strength: 0.88, type: 'supply' },
        { source: 'ports', target: 'supply', strength: 0.82, type: 'supply' },
        { source: 'toyota', target: 'supply', strength: 0.78, type: 'supply' },
        { source: 'semiconductor', target: 'supply', strength: 0.85, type: 'supply' },
        { source: 'plant', target: 'agriculture', strength: 0.72, type: 'geographic' },
      ]
    },
    // COVID 2020
    covid2020: {
      nodes: [
        { id: 'healthcare', name: 'Healthcare System', type: 'healthcare', value: 80, risk: 0.95 },
        { id: 'travel', name: 'Travel & Airlines', type: 'transport', value: 65, risk: 0.98 },
        { id: 'hospitality', name: 'Hotels & Tourism', type: 'hospitality', value: 55, risk: 0.95 },
        { id: 'retail', name: 'Retail Stores', type: 'retail', value: 70, risk: 0.82 },
        { id: 'ecommerce', name: 'E-Commerce', type: 'tech', value: 60, risk: 0.25 },
        { id: 'pharma', name: 'Pharmaceutical', type: 'pharma', value: 75, risk: 0.35 },
        { id: 'supply', name: 'Supply Chains', type: 'logistics', value: 85, risk: 0.78 },
        { id: 'oil', name: 'Oil & Energy', type: 'energy', value: 90, risk: 0.85 },
        { id: 'remote', name: 'Remote Work Tech', type: 'tech', value: 45, risk: 0.15 },
      ],
      links: [
        { source: 'healthcare', target: 'pharma', strength: 0.92, type: 'supply' },
        { source: 'travel', target: 'hospitality', strength: 0.95, type: 'operational' },
        { source: 'travel', target: 'oil', strength: 0.85, type: 'supply' },
        { source: 'retail', target: 'supply', strength: 0.78, type: 'supply' },
        { source: 'retail', target: 'ecommerce', strength: 0.72, type: 'operational' },
        { source: 'supply', target: 'oil', strength: 0.68, type: 'operational' },
        { source: 'ecommerce', target: 'remote', strength: 0.55, type: 'operational' },
        { source: 'pharma', target: 'supply', strength: 0.82, type: 'supply' },
      ]
    },
    // Ukraine 2022
    ukraine2022: {
      nodes: [
        { id: 'energy', name: 'European Energy', type: 'energy', value: 95, risk: 0.92 },
        { id: 'gas', name: 'Natural Gas Supply', type: 'energy', value: 80, risk: 0.95 },
        { id: 'grain', name: 'Grain Exports', type: 'agriculture', value: 55, risk: 0.88 },
        { id: 'defense', name: 'Defense Industry', type: 'defense', value: 70, risk: 0.35 },
        { id: 'metals', name: 'Metals & Mining', type: 'mining', value: 45, risk: 0.78 },
        { id: 'fertilizer', name: 'Fertilizer Supply', type: 'agriculture', value: 40, risk: 0.82 },
        { id: 'inflation', name: 'Global Inflation', type: 'market', value: 100, risk: 0.75 },
        { id: 'banking', name: 'Russian Banks', type: 'bank', value: 60, risk: 0.95 },
      ],
      links: [
        { source: 'gas', target: 'energy', strength: 0.95, type: 'supply' },
        { source: 'energy', target: 'inflation', strength: 0.85, type: 'financial' },
        { source: 'grain', target: 'inflation', strength: 0.78, type: 'supply' },
        { source: 'fertilizer', target: 'grain', strength: 0.72, type: 'supply' },
        { source: 'metals', target: 'defense', strength: 0.68, type: 'supply' },
        { source: 'banking', target: 'inflation', strength: 0.62, type: 'financial' },
        { source: 'gas', target: 'banking', strength: 0.55, type: 'financial' },
      ]
    },
    // 1929 Great Depression
    crash1929: {
      nodes: [
        { id: 'stocks', name: 'Stock Market', type: 'market', value: 100, risk: 1.0 },
        { id: 'banks', name: 'Banking System', type: 'bank', value: 90, risk: 0.95 },
        { id: 'industry', name: 'Industrial Output', type: 'manufacturing', value: 80, risk: 0.88 },
        { id: 'agriculture', name: 'Agriculture', type: 'agriculture', value: 60, risk: 0.82 },
        { id: 'unemployment', name: 'Employment', type: 'social', value: 70, risk: 0.92 },
        { id: 'trade', name: 'International Trade', type: 'trade', value: 55, risk: 0.78 },
      ],
      links: [
        { source: 'stocks', target: 'banks', strength: 0.95, type: 'financial' },
        { source: 'banks', target: 'industry', strength: 0.88, type: 'financial' },
        { source: 'industry', target: 'unemployment', strength: 0.92, type: 'operational' },
        { source: 'banks', target: 'agriculture', strength: 0.72, type: 'financial' },
        { source: 'industry', target: 'trade', strength: 0.78, type: 'supply' },
      ]
    },
    // Dot-Com Bubble 2000
    dotcom2000: {
      nodes: [
        { id: 'nasdaq', name: 'NASDAQ Index', type: 'market', value: 100, risk: 1.0 },
        { id: 'startups', name: 'Internet Startups', type: 'tech', value: 85, risk: 0.98 },
        { id: 'vc', name: 'Venture Capital', type: 'finance', value: 75, risk: 0.88 },
        { id: 'telecom', name: 'Telecom Sector', type: 'tech', value: 70, risk: 0.85 },
        { id: 'advertising', name: 'Online Advertising', type: 'media', value: 45, risk: 0.72 },
        { id: 'employment', name: 'Tech Employment', type: 'social', value: 55, risk: 0.78 },
      ],
      links: [
        { source: 'nasdaq', target: 'startups', strength: 0.95, type: 'financial' },
        { source: 'vc', target: 'startups', strength: 0.92, type: 'financial' },
        { source: 'startups', target: 'advertising', strength: 0.75, type: 'operational' },
        { source: 'telecom', target: 'startups', strength: 0.82, type: 'operational' },
        { source: 'startups', target: 'employment', strength: 0.78, type: 'operational' },
      ]
    },
    // September 11 2001
    sept11_2001: {
      nodes: [
        { id: 'airlines', name: 'Airlines Industry', type: 'transport', value: 80, risk: 0.98 },
        { id: 'insurance', name: 'Insurance Sector', type: 'insurance', value: 90, risk: 0.92 },
        { id: 'tourism', name: 'Tourism Industry', type: 'hospitality', value: 65, risk: 0.88 },
        { id: 'defense', name: 'Defense Sector', type: 'defense', value: 70, risk: 0.25 },
        { id: 'security', name: 'Security Services', type: 'security', value: 45, risk: 0.22 },
        { id: 'markets', name: 'Financial Markets', type: 'market', value: 100, risk: 0.72 },
      ],
      links: [
        { source: 'airlines', target: 'tourism', strength: 0.92, type: 'operational' },
        { source: 'airlines', target: 'insurance', strength: 0.88, type: 'financial' },
        { source: 'tourism', target: 'markets', strength: 0.65, type: 'financial' },
        { source: 'defense', target: 'security', strength: 0.72, type: 'operational' },
        { source: 'insurance', target: 'markets', strength: 0.78, type: 'financial' },
      ]
    },
    // Oil Crisis 1973
    oil1973: {
      nodes: [
        { id: 'opec', name: 'OPEC Embargo', type: 'energy', value: 100, risk: 1.0 },
        { id: 'oilprice', name: 'Oil Prices', type: 'commodity', value: 90, risk: 0.98 },
        { id: 'automotive', name: 'Automotive Industry', type: 'manufacturing', value: 75, risk: 0.88 },
        { id: 'transport', name: 'Transportation', type: 'transport', value: 70, risk: 0.85 },
        { id: 'inflation', name: 'Inflation', type: 'market', value: 80, risk: 0.82 },
        { id: 'industry', name: 'Manufacturing', type: 'manufacturing', value: 65, risk: 0.72 },
      ],
      links: [
        { source: 'opec', target: 'oilprice', strength: 0.98, type: 'supply' },
        { source: 'oilprice', target: 'transport', strength: 0.92, type: 'supply' },
        { source: 'oilprice', target: 'automotive', strength: 0.88, type: 'supply' },
        { source: 'oilprice', target: 'inflation', strength: 0.85, type: 'financial' },
        { source: 'transport', target: 'industry', strength: 0.72, type: 'operational' },
      ]
    },
    // Asian Crisis 1997
    asian1997: {
      nodes: [
        { id: 'thb', name: 'Thai Baht', type: 'currency', value: 50, risk: 1.0 },
        { id: 'krw', name: 'Korean Won', type: 'currency', value: 60, risk: 0.95 },
        { id: 'idr', name: 'Indonesian Rupiah', type: 'currency', value: 55, risk: 0.92 },
        { id: 'banks', name: 'Asian Banks', type: 'bank', value: 80, risk: 0.88 },
        { id: 'imf', name: 'IMF Intervention', type: 'institution', value: 100, risk: 0.35 },
        { id: 'exports', name: 'Export Industries', type: 'trade', value: 70, risk: 0.78 },
        { id: 'realestate', name: 'Real Estate', type: 'realestate', value: 65, risk: 0.85 },
      ],
      links: [
        { source: 'thb', target: 'banks', strength: 0.92, type: 'financial' },
        { source: 'krw', target: 'banks', strength: 0.88, type: 'financial' },
        { source: 'idr', target: 'banks', strength: 0.85, type: 'financial' },
        { source: 'banks', target: 'realestate', strength: 0.82, type: 'financial' },
        { source: 'banks', target: 'exports', strength: 0.75, type: 'financial' },
        { source: 'imf', target: 'banks', strength: 0.68, type: 'financial' },
      ]
    },
    // Black Monday 1987
    blackmonday1987: {
      nodes: [
        { id: 'djia', name: 'Dow Jones', type: 'market', value: 100, risk: 1.0 },
        { id: 'program', name: 'Program Trading', type: 'tech', value: 60, risk: 0.95 },
        { id: 'insurance', name: 'Portfolio Insurance', type: 'finance', value: 55, risk: 0.92 },
        { id: 'global', name: 'Global Markets', type: 'market', value: 90, risk: 0.88 },
        { id: 'fed', name: 'Federal Reserve', type: 'institution', value: 80, risk: 0.25 },
      ],
      links: [
        { source: 'program', target: 'djia', strength: 0.95, type: 'operational' },
        { source: 'insurance', target: 'program', strength: 0.88, type: 'operational' },
        { source: 'djia', target: 'global', strength: 0.92, type: 'financial' },
        { source: 'fed', target: 'djia', strength: 0.65, type: 'financial' },
      ]
    },
    // Brexit 2016
    brexit2016: {
      nodes: [
        { id: 'gbp', name: 'British Pound', type: 'currency', value: 70, risk: 0.88 },
        { id: 'finance', name: 'Financial Services', type: 'bank', value: 90, risk: 0.75 },
        { id: 'trade', name: 'EU Trade', type: 'trade', value: 80, risk: 0.82 },
        { id: 'auto', name: 'Automotive', type: 'manufacturing', value: 55, risk: 0.72 },
        { id: 'pharma', name: 'Pharmaceuticals', type: 'pharma', value: 50, risk: 0.68 },
        { id: 'property', name: 'London Property', type: 'realestate', value: 75, risk: 0.58 },
      ],
      links: [
        { source: 'gbp', target: 'finance', strength: 0.85, type: 'financial' },
        { source: 'trade', target: 'auto', strength: 0.78, type: 'supply' },
        { source: 'trade', target: 'pharma', strength: 0.72, type: 'supply' },
        { source: 'finance', target: 'property', strength: 0.68, type: 'financial' },
        { source: 'gbp', target: 'trade', strength: 0.82, type: 'financial' },
      ]
    },
    // SVB 2023
    svb2023: {
      nodes: [
        { id: 'svb', name: 'Silicon Valley Bank', type: 'bank', value: 50, risk: 1.0 },
        { id: 'bonds', name: 'Bond Portfolio', type: 'security', value: 60, risk: 0.95 },
        { id: 'startups', name: 'Tech Startups', type: 'tech', value: 70, risk: 0.82 },
        { id: 'vc', name: 'Venture Capital', type: 'finance', value: 65, risk: 0.75 },
        { id: 'regional', name: 'Regional Banks', type: 'bank', value: 80, risk: 0.88 },
        { id: 'fdic', name: 'FDIC', type: 'institution', value: 90, risk: 0.25 },
      ],
      links: [
        { source: 'bonds', target: 'svb', strength: 0.95, type: 'financial' },
        { source: 'svb', target: 'startups', strength: 0.88, type: 'financial' },
        { source: 'vc', target: 'startups', strength: 0.72, type: 'financial' },
        { source: 'svb', target: 'regional', strength: 0.85, type: 'financial' },
        { source: 'fdic', target: 'svb', strength: 0.65, type: 'financial' },
      ]
    },
    // 2011 Eurozone Debt Crisis / Sovereign Debt Crisis
    eurozone2011: {
      nodes: [
        { id: 'greece', name: 'Greek Sovereign Debt', type: 'government', value: 90, risk: 1.0 },
        { id: 'ecb', name: 'ECB', type: 'institution', value: 100, risk: 0.3 },
        { id: 'eurobanks', name: 'Eurozone Banks', type: 'bank', value: 85, risk: 0.92 },
        { id: 'realestate', name: 'Real Estate', type: 'realestate', value: 70, risk: 0.85 },
        { id: 'spread', name: 'Bond Spreads', type: 'market', value: 75, risk: 0.88 },
        { id: 'italy', name: 'Italian Debt', type: 'government', value: 80, risk: 0.78 },
        { id: 'spain', name: 'Spanish Banks', type: 'bank', value: 65, risk: 0.82 },
        { id: 'imf', name: 'IMF / Troika', type: 'institution', value: 95, risk: 0.25 },
      ],
      links: [
        { source: 'greece', target: 'eurobanks', strength: 0.95, type: 'financial' },
        { source: 'greece', target: 'spread', strength: 0.92, type: 'financial' },
        { source: 'spread', target: 'italy', strength: 0.88, type: 'financial' },
        { source: 'spread', target: 'spain', strength: 0.85, type: 'financial' },
        { source: 'eurobanks', target: 'realestate', strength: 0.78, type: 'financial' },
        { source: 'ecb', target: 'eurobanks', strength: 0.72, type: 'financial' },
        { source: 'imf', target: 'greece', strength: 0.68, type: 'financial' },
        { source: 'eurobanks', target: 'spain', strength: 0.75, type: 'financial' },
      ]
    },
  }

  // 1) Exact match (historic keys)
  if (eventGraphs[eventId]) return eventGraphs[eventId]

  // 2) Stress/risk eventId → template
  const templateKey = EVENT_ID_TO_TEMPLATE[eventId] ??
    (eventId.startsWith('tech_disruption') || eventId.startsWith('sea_level') ? 'fukushima2011' : null)
  if (templateKey && eventGraphs[templateKey]) return eventGraphs[templateKey]

  // 3) Fallback by eventCategory
  const cat = (eventCategory || '').toLowerCase()
  if (cat === 'climate' || cat === 'natural') return eventGraphs.fukushima2011
  if (cat === 'financial') return eventGraphs.lehman2008
  if (cat === 'geopolitical') return eventGraphs.ukraine2022
  if (cat === 'operational' || cat === 'supply_chain') return eventGraphs.fukushima2011

  return generateDefaultGraph()
}

function generateDefaultGraph(): GraphData {
  return {
    nodes: [
      { id: 'core', name: 'Core Impact', type: 'core', value: 50, risk: 0.9 },
      { id: 'finance', name: 'Financial Sector', type: 'bank', value: 40, risk: 0.75 },
      { id: 'industry', name: 'Industrial', type: 'factory', value: 35, risk: 0.65 },
      { id: 'supply', name: 'Supply Chain', type: 'logistics', value: 30, risk: 0.55 },
      { id: 'consumer', name: 'Consumer', type: 'retail', value: 25, risk: 0.45 },
    ],
    links: [
      { source: 'core', target: 'finance', strength: 0.9, type: 'financial' },
      { source: 'core', target: 'industry', strength: 0.8, type: 'operational' },
      { source: 'finance', target: 'supply', strength: 0.7, type: 'financial' },
      { source: 'industry', target: 'supply', strength: 0.75, type: 'supply' },
      { source: 'supply', target: 'consumer', strength: 0.6, type: 'supply' },
    ]
  }
}

function getRiskColor(risk: number): string {
  if (risk > 0.8) return '#ef4444'
  if (risk > 0.6) return '#f97316'
  if (risk > 0.4) return '#eab308'
  return '#22c55e'
}

function getLinkColor(type: string, strength: number): string {
  const alpha = Math.min(strength * 0.8 + 0.2, 1)
  switch (type) {
    case 'supply': return `rgba(59, 130, 246, ${alpha})`
    case 'financial': return `rgba(168, 85, 247, ${alpha})`
    case 'operational': return `rgba(249, 115, 22, ${alpha})`
    case 'geographic': return `rgba(34, 197, 94, ${alpha})`
    default: return `rgba(156, 163, 175, ${alpha})`
  }
}

export default function EventRiskGraph({ 
  eventId, 
  eventType, 
  eventName,
  eventCategory,
  cityName,
  width = 500, 
  height = 350,
  compact = false,
  fullWidth = false,
  stressTestId,
  scenarioId,
  cityId,
  showLegend = false,
  showSummary = false,
}: EventRiskGraphProps) {
  const graphRef = useRef<ForceGraphMethods>()
  const containerRef = useRef<HTMLDivElement>(null)
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)
  const [containerSize, setContainerSize] = useState({ width: width, height: height })
  
  // Calculate stats
  const stats = useMemo(() => {
    const totalRisk = graphData.nodes.reduce((sum, n) => sum + n.value * n.risk, 0)
    const criticalNodes = graphData.nodes.filter(n => n.risk > 0.8).length
    const criticalLinks = graphData.links.filter(l => l.strength > 0.8).length
    return { totalRisk, criticalNodes, criticalLinks }
  }, [graphData])
  
  // Load graph: when scenarioId is set, try stress/cascade API; on fail use static template
  useEffect(() => {
    if (scenarioId) {
      const city = cityId || 'default'
      fetch(`/api/v1/whatif/cascade/event-graph?scenario_id=${encodeURIComponent(scenarioId)}&city_id=${encodeURIComponent(city)}`)
        .then((r) => {
          if (!r.ok) throw new Error(`event-graph ${r.status}`)
          return r.json()
        })
        .then((data: { nodes?: Array<{ id: string; name: string; type: string; value: number; risk: number }>; links?: Array<{ source: string; target: string; strength: number; type: 'supply' | 'financial' | 'operational' | 'geographic' }> }) => {
          const nodes: GraphNode[] = (data.nodes || []).map((n) => ({
            id: n.id,
            name: n.name,
            type: n.type || 'asset',
            value: n.value,
            risk: n.risk,
          }))
          const links: GraphLink[] = (data.links || []).map((l) => ({
            source: l.source,
            target: l.target,
            strength: l.strength,
            type: l.type || 'operational',
          }))
          setGraphData({ nodes, links })
        })
        .catch(() => {
          setGraphData(generateEventGraph(eventId, eventType, eventCategory, cityName))
        })
    } else {
      setGraphData(generateEventGraph(eventId, eventType, eventCategory, cityName))
    }
  }, [eventId, eventType, eventCategory, cityName, scenarioId, cityId])
  
  // Configure force simulation to spread nodes further apart
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0) {
      // Increase repulsion force to spread nodes even further
      graphRef.current.d3Force('charge')?.strength(-1600)  // Stronger repulsion for more spacing
      graphRef.current.d3Force('link')?.distance(350)  // Longer link distance to spread nodes
      graphRef.current.d3Force('center')?.strength(0.05)
    }
  }, [graphData])
  
  // Track container size for fullWidth mode
  useEffect(() => {
    if (!fullWidth || !containerRef.current) return
    
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect()
        // Use container width but FIXED height (720px - 20% smaller) to prevent infinite growth
        setContainerSize({ 
          width: rect.width || width, 
          height: 720  // Fixed height - 20% smaller for better fit
        })
      }
    }
    
    updateSize()
    const resizeObserver = new ResizeObserver(updateSize)
    resizeObserver.observe(containerRef.current)
    
    return () => resizeObserver.disconnect()
  }, [fullWidth, width])
  
  // Custom node rendering
  const nodeThreeObject = useCallback((node: GraphNode) => {
    const group = new THREE.Group()
    
    const size = compact ? Math.sqrt(node.value) * 0.5 + 2 : Math.sqrt(node.value) * 0.6 + 3
    const geometry = new THREE.SphereGeometry(size, 16, 16)
    const material = new THREE.MeshPhongMaterial({
      color: getRiskColor(node.risk),
      emissive: getRiskColor(node.risk),
      emissiveIntensity: 0.3,
      transparent: true,
      opacity: 0.9,
    })
    const sphere = new THREE.Mesh(geometry, material)
    group.add(sphere)
    
    // Glow for high risk
    if (node.risk > 0.7) {
      const ringGeometry = new THREE.RingGeometry(size + 2, size + 3, 32)
      const ringMaterial = new THREE.MeshBasicMaterial({
        color: getRiskColor(node.risk),
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide,
      })
      const ring = new THREE.Mesh(ringGeometry, ringMaterial)
      ring.rotation.x = Math.PI / 2
      group.add(ring)
    }
    
    // Label (only in non-compact mode)
    if (!compact) {
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')!
      canvas.width = 256
      canvas.height = 48
      ctx.fillStyle = 'rgba(0,0,0,0.6)'
      ctx.fillRect(0, 0, 256, 48)
      ctx.fillStyle = 'white'
      ctx.font = 'bold 16px "Space Grotesk", system-ui, sans-serif'
      ctx.textAlign = 'center'
      ctx.fillText(node.name, 128, 30)
      
      const texture = new THREE.CanvasTexture(canvas)
      const labelMaterial = new THREE.SpriteMaterial({ map: texture, transparent: true })
      const label = new THREE.Sprite(labelMaterial)
      label.scale.set(30, 6, 1)
      label.position.y = size + 8
      group.add(label)
    }
    
    return group
  }, [compact])
  
  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(node)
    if (graphRef.current) {
      graphRef.current.cameraPosition(
        { x: node.x! + 60, y: node.y! + 30, z: node.z! + 60 },
        { x: node.x!, y: node.y!, z: node.z! },
        800
      )
    }
  }, [])
  
  // Determine actual dimensions
  const graphWidth = fullWidth ? containerSize.width : width
  const graphHeight = fullWidth ? containerSize.height : height
  const exposure = graphData.nodes.reduce((s, n) => s + n.value * n.risk, 0)
  
  return (
    <div className="space-y-2">
    <div 
      ref={containerRef}
      className={`relative rounded-xl overflow-hidden border border-white/10 bg-black/40 ${fullWidth ? 'w-full' : ''}`}
      style={fullWidth ? { height: 576, minHeight: 576 } : undefined}
    >
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 z-10 p-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-white/50 text-[10px] uppercase tracking-wider">Cascade Analysis</div>
            <div className="text-white text-sm font-light">
              {eventName}{cityName ? ` · ${cityName}` : ''}
            </div>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="text-center">
              <div className="text-red-400 font-medium">{stats.criticalNodes}</div>
              <div className="text-white/40 text-[10px]">Critical</div>
            </div>
            <div className="text-center">
              <div className="text-orange-400 font-medium">{stats.criticalLinks}</div>
              <div className="text-white/40 text-[10px]">Links</div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Graph */}
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        width={graphWidth}
        height={graphHeight}
        nodeThreeObject={nodeThreeObject}
        nodeThreeObjectExtend={false}
        linkColor={(link: GraphLink) => getLinkColor(link.type, link.strength)}
        linkWidth={(link: GraphLink) => link.strength * 2}
        linkOpacity={0.5}
        linkDirectionalParticles={1}
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.006}
        backgroundColor="rgba(0,0,0,0)"
        onNodeClick={handleNodeClick}
        enableNodeDrag={false}
        enableNavigationControls={true}
        showNavInfo={false}
      />
      
      {/* Selected Node Info */}
      {selectedNode && (
        <div className="absolute bottom-3 left-3 bg-black/70 backdrop-blur-sm rounded-lg p-2 border border-white/10 text-xs">
          <div className="text-white font-medium">{selectedNode.name}</div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-white/40">Exposure:</span>
            <span className="text-white">${selectedNode.value}B</span>
            <span className="text-white/40 ml-2">Risk:</span>
            <span className={selectedNode.risk > 0.7 ? 'text-red-400' : 'text-orange-400'}>
              {(selectedNode.risk * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      )}
      
      {/* Legend */}
      <div className="absolute bottom-3 right-3 bg-black/50 rounded p-2 text-[10px]">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-blue-500 rounded" />
            <span className="text-white/50">Supply</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-purple-500 rounded" />
            <span className="text-white/50">Financial</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-2 h-0.5 bg-orange-500 rounded" />
            <span className="text-white/50">Operational</span>
          </div>
        </div>
      </div>
    </div>

    {/* Expanded legend and summary under the graph */}
    {(showLegend || showSummary) && (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-white/50">
        {showLegend && (
          <>
            <div className="flex items-center gap-2">
              <span className="text-white/40">Links:</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-blue-500 rounded" />Supply</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-purple-500 rounded" />Financial</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-orange-500 rounded" />Operational</span>
              <span className="flex items-center gap-1"><span className="inline-block w-3 h-0.5 bg-green-500 rounded" />Geographic</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-white/40">Risk:</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500" />&gt;80%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500" />&gt;60%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500" />&gt;40%</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500" />≤40%</span>
            </div>
          </>
        )}
        {showSummary && graphData.nodes.length > 0 && (
          <span>Nodes: {graphData.nodes.length}, Links: {graphData.links.length}, Exposure ≈ ${exposure.toFixed(1)}B</span>
        )}
      </div>
    )}
    </div>
  )
}
