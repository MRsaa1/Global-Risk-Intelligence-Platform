/**
 * Historical Event Panel
 * ======================
 * 
 * Professional report panel for historical crisis events.
 * Shows detailed analysis instead of 3D visualization.
 */
import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import EventRiskGraph from './EventRiskGraph'

// Historical events database
export interface HistoricalEvent {
  id: string
  name: string
  year: number
  type: 'financial' | 'climate' | 'pandemic' | 'geopolitical' | 'infrastructure'
  summary: string
  duration: string
  gdpImpact: number  // in billions USD
  affectedRegions: string[]
  industries: string[]
  recoveryTimeline: string
  peakDate: string
  casualties?: number
  economicLoss: number  // in billions USD
  lessonsLearned: string[]
  comparableEvents: string[]
}

// Database of historical events (1970-present)
export const HISTORICAL_EVENTS: Record<string, HistoricalEvent> = {
  lehman2008: {
    id: 'lehman2008',
    name: '2008 Global Financial Crisis',
    year: 2008,
    type: 'financial',
    summary: 'The collapse of Lehman Brothers triggered a global financial meltdown, leading to the worst recession since the Great Depression. Credit markets froze, stock markets crashed, and governments worldwide implemented emergency bailouts.',
    duration: '18 months (Dec 2007 - Jun 2009)',
    gdpImpact: -2100,
    affectedRegions: ['North America', 'Europe', 'Asia Pacific'],
    industries: ['Banking', 'Real Estate', 'Automotive', 'Insurance'],
    recoveryTimeline: '4-6 years for full recovery',
    peakDate: 'September 15, 2008',
    economicLoss: 22000,
    lessonsLearned: [
      'Systemic risk from interconnected financial institutions',
      'Importance of liquidity buffers',
      'Need for stress testing frameworks (Basel III)',
      'Too-big-to-fail doctrine limitations'
    ],
    comparableEvents: ['1929 Great Depression', '1997 Asian Crisis', '2020 COVID Crash']
  },
  fukushima2011: {
    id: 'fukushima2011',
    name: '2011 Fukushima Nuclear Disaster',
    year: 2011,
    type: 'climate',
    summary: 'A 9.0 magnitude earthquake and subsequent tsunami led to nuclear meltdowns at the Fukushima Daiichi plant. The disaster caused massive evacuations, supply chain disruptions, and a global reassessment of nuclear energy policy.',
    duration: 'Ongoing (cleanup expected until 2050)',
    gdpImpact: -235,
    affectedRegions: ['Japan', 'Asia Pacific', 'Global Supply Chains'],
    industries: ['Nuclear Energy', 'Electronics', 'Automotive', 'Agriculture'],
    recoveryTimeline: '10+ years for affected areas',
    peakDate: 'March 11, 2011',
    casualties: 19749,
    economicLoss: 360,
    lessonsLearned: [
      'Natural disaster cascading effects',
      'Supply chain concentration risk',
      'Nuclear safety protocol requirements',
      'Insurance coverage gaps for catastrophic events'
    ],
    comparableEvents: ['1986 Chernobyl', '2004 Indian Ocean Tsunami']
  },
  covid2020: {
    id: 'covid2020',
    name: '2020 COVID-19 Pandemic',
    year: 2020,
    type: 'pandemic',
    summary: 'A novel coronavirus emerged and spread globally, leading to unprecedented lockdowns, healthcare system strain, and the largest peacetime economic contraction in modern history. Central banks and governments responded with massive stimulus programs.',
    duration: '3+ years (pandemic phase)',
    gdpImpact: -3500,
    affectedRegions: ['Global - All Regions'],
    industries: ['Travel & Tourism', 'Hospitality', 'Retail', 'Entertainment', 'Healthcare'],
    recoveryTimeline: '2-4 years (varied by sector)',
    peakDate: 'March-April 2020 (initial wave)',
    casualties: 6900000,
    economicLoss: 12700,
    lessonsLearned: [
      'Pandemic preparedness infrastructure needs',
      'Remote work viability and implications',
      'Supply chain resilience importance',
      'Healthcare system capacity planning',
      'Fiscal and monetary policy coordination'
    ],
    comparableEvents: ['1918 Spanish Flu', '2003 SARS', '2009 H1N1']
  },
  ukraine2022: {
    id: 'ukraine2022',
    name: '2022 Ukraine Conflict',
    year: 2022,
    type: 'geopolitical',
    summary: 'Russia\'s invasion of Ukraine triggered the largest military conflict in Europe since WWII. The resulting sanctions, energy crisis, and supply chain disruptions caused global inflation spikes and food security concerns.',
    duration: 'Ongoing',
    gdpImpact: -1200,
    affectedRegions: ['Europe', 'Russia', 'Middle East', 'Africa', 'Global Energy Markets'],
    industries: ['Energy', 'Agriculture', 'Defense', 'Commodities', 'Transportation'],
    recoveryTimeline: 'Unknown - conflict ongoing',
    peakDate: 'February 24, 2022',
    casualties: 500000,
    economicLoss: 2800,
    lessonsLearned: [
      'Energy dependence vulnerabilities',
      'Geopolitical risk repricing',
      'Sanctions effectiveness and spillovers',
      'Food security interconnections',
      'Defense spending reallocation'
    ],
    comparableEvents: ['1990 Gulf War', '2014 Crimea Annexation']
  },
  asian1997: {
    id: 'asian1997',
    name: '1997 Asian Financial Crisis',
    year: 1997,
    type: 'financial',
    summary: 'Currency collapses in Thailand, Indonesia, and South Korea triggered a regional financial meltdown. The IMF intervened with large bailout packages, leading to structural reforms across Asian economies.',
    duration: '2 years (1997-1999)',
    gdpImpact: -600,
    affectedRegions: ['Southeast Asia', 'East Asia', 'Emerging Markets'],
    industries: ['Banking', 'Real Estate', 'Manufacturing', 'Exports'],
    recoveryTimeline: '3-5 years',
    peakDate: 'July 2, 1997 (Thai Baht devaluation)',
    economicLoss: 950,
    lessonsLearned: [
      'Currency peg vulnerabilities',
      'Hot money flow risks',
      'IMF conditionality debates',
      'Importance of foreign reserves'
    ],
    comparableEvents: ['1994 Mexican Peso Crisis', '1998 Russian Default', '2001 Argentine Crisis']
  },
  blackmonday1987: {
    id: 'blackmonday1987',
    name: '1987 Black Monday',
    year: 1987,
    type: 'financial',
    summary: 'Stock markets worldwide crashed on October 19, 1987, with the Dow Jones falling 22.6% in a single day. Program trading and portfolio insurance strategies amplified the decline. Recovery was relatively swift.',
    duration: '2 months (acute phase)',
    gdpImpact: -150,
    affectedRegions: ['United States', 'Europe', 'Asia Pacific'],
    industries: ['Financial Services', 'Broad Market Impact'],
    recoveryTimeline: '2 years to recover highs',
    peakDate: 'October 19, 1987',
    economicLoss: 500,
    lessonsLearned: [
      'Program trading risks',
      'Market circuit breakers needed',
      'Coordinated central bank response importance',
      'Portfolio insurance limitations'
    ],
    comparableEvents: ['crash1929', 'flashcrash2010']
  },
  crash1929: {
    id: 'crash1929',
    name: '1929 Stock Market Crash',
    year: 1929,
    type: 'financial',
    summary: 'The Wall Street Crash of 1929 marked the beginning of the Great Depression. Over two days (Black Thursday and Black Tuesday), the market lost 25% of its value. The subsequent depression lasted a decade and reshaped global economic policy.',
    duration: '10+ years (Great Depression)',
    gdpImpact: -650,
    affectedRegions: ['United States', 'Europe', 'Global'],
    industries: ['All Sectors', 'Banking', 'Agriculture', 'Manufacturing'],
    recoveryTimeline: '25 years to recover 1929 highs',
    peakDate: 'October 29, 1929 (Black Tuesday)',
    economicLoss: 800,
    lessonsLearned: [
      'Need for central bank intervention',
      'Deposit insurance importance (FDIC)',
      'Securities regulation necessity (SEC)',
      'Dangers of margin trading'
    ],
    comparableEvents: ['blackmonday1987', 'lehman2008']
  },
  flashcrash2010: {
    id: 'flashcrash2010',
    name: '2010 Flash Crash',
    year: 2010,
    type: 'financial',
    summary: 'On May 6, 2010, US stock indices crashed nearly 10% within minutes before recovering. The event was caused by algorithmic trading and exposed vulnerabilities in modern electronic markets. It led to new circuit breaker regulations.',
    duration: '36 minutes (acute phase)',
    gdpImpact: -10,
    affectedRegions: ['United States', 'Global Markets'],
    industries: ['Financial Services', 'Technology'],
    recoveryTimeline: 'Same day recovery',
    peakDate: 'May 6, 2010',
    economicLoss: 1000,
    lessonsLearned: [
      'High-frequency trading risks',
      'Market microstructure vulnerabilities',
      'Need for circuit breakers',
      'Algorithmic trading regulation'
    ],
    comparableEvents: ['blackmonday1987', 'lehman2008']
  },
  // === Additional Historical Events ===
  oil1973: {
    id: 'oil1973',
    name: '1973 Oil Crisis',
    year: 1973,
    type: 'infrastructure',
    summary: 'OPEC oil embargo against nations supporting Israel during the Yom Kippur War caused oil prices to quadruple. The crisis ended the post-war economic boom and led to stagflation in Western economies.',
    duration: '6 months (embargo)',
    gdpImpact: -350,
    affectedRegions: ['United States', 'Western Europe', 'Japan'],
    industries: ['Energy', 'Automotive', 'Manufacturing', 'Transportation'],
    recoveryTimeline: '3-5 years',
    peakDate: 'October 17, 1973',
    economicLoss: 450,
    lessonsLearned: [
      'Energy independence importance',
      'Geopolitical commodity risks',
      'Strategic petroleum reserves need',
      'Fuel efficiency standards necessity'
    ],
    comparableEvents: ['ukraine2022', 'gulf1990']
  },
  chernobyl1986: {
    id: 'chernobyl1986',
    name: '1986 Chernobyl Disaster',
    year: 1986,
    type: 'climate',
    summary: 'Reactor explosion at the Chernobyl Nuclear Power Plant in Soviet Ukraine released massive amounts of radioactive particles. It remains the worst nuclear disaster in history, leading to permanent exclusion zones and global nuclear policy changes.',
    duration: 'Ongoing (radiation effects)',
    gdpImpact: -235,
    affectedRegions: ['Soviet Union', 'Eastern Europe', 'Scandinavia'],
    industries: ['Nuclear Energy', 'Agriculture', 'Healthcare'],
    recoveryTimeline: '30+ years',
    peakDate: 'April 26, 1986',
    casualties: 4000,
    economicLoss: 700,
    lessonsLearned: [
      'Nuclear safety culture importance',
      'Transparency in disaster response',
      'Long-term contamination effects',
      'International cooperation for nuclear safety'
    ],
    comparableEvents: ['fukushima2011']
  },
  dotcom2000: {
    id: 'dotcom2000',
    name: '2000 Dot-Com Bubble',
    year: 2000,
    type: 'financial',
    summary: 'Speculation in internet-related companies led to a massive stock market bubble that burst in March 2000. The NASDAQ lost 78% of its value over the next two years, wiping out trillions in market capitalization.',
    duration: '2 years (2000-2002)',
    gdpImpact: -400,
    affectedRegions: ['United States', 'Global Tech Markets'],
    industries: ['Technology', 'Telecommunications', 'Venture Capital'],
    recoveryTimeline: '15 years for NASDAQ to recover highs',
    peakDate: 'March 10, 2000',
    economicLoss: 5000,
    lessonsLearned: [
      'Speculative bubble identification',
      'Profitability vs growth valuation',
      'Venture capital due diligence',
      'Market cycle awareness'
    ],
    comparableEvents: ['crash1929', 'crypto2022']
  },
  sept11_2001: {
    id: 'sept11_2001',
    name: '2001 September 11 Attacks',
    year: 2001,
    type: 'geopolitical',
    summary: 'Terrorist attacks on the World Trade Center and Pentagon killed nearly 3,000 people and fundamentally changed global security, travel, and foreign policy. The attacks triggered the War on Terror and reshaped international relations.',
    duration: '1 day (attacks), ongoing (consequences)',
    gdpImpact: -180,
    affectedRegions: ['United States', 'Global'],
    industries: ['Airlines', 'Insurance', 'Security', 'Tourism', 'Defense'],
    recoveryTimeline: '2-3 years for markets',
    peakDate: 'September 11, 2001',
    casualties: 2977,
    economicLoss: 3300,
    lessonsLearned: [
      'Systemic security vulnerabilities',
      'Business continuity planning',
      'Insurance for terrorism risk',
      'Global interconnected security'
    ],
    comparableEvents: ['ukraine2022']
  },
  eurozone2011: {
    id: 'eurozone2011',
    name: '2011 Eurozone Debt Crisis',
    year: 2011,
    type: 'financial',
    summary: 'Several eurozone countries faced sovereign debt crises, threatening the stability of the euro and the European banking system. Greece, Portugal, Ireland, Spain, and Cyprus required bailouts.',
    duration: '5 years (2010-2015)',
    gdpImpact: -400,
    affectedRegions: ['Europe', 'Global Financial Markets'],
    industries: ['Banking', 'Government', 'Real Estate'],
    recoveryTimeline: '5-8 years',
    peakDate: 'July 2012',
    economicLoss: 1500,
    lessonsLearned: [
      'Monetary union without fiscal union risks',
      'Sovereign debt sustainability',
      'Banking union necessity',
      'Austerity policy debates'
    ],
    comparableEvents: ['lehman2008', 'asian1997']
  },
  tsunami2004: {
    id: 'tsunami2004',
    name: '2004 Indian Ocean Tsunami',
    year: 2004,
    type: 'climate',
    summary: 'A 9.1-9.3 magnitude earthquake triggered a devastating tsunami across the Indian Ocean, killing over 230,000 people in 14 countries. It was one of the deadliest natural disasters in recorded history.',
    duration: '1 day (event)',
    gdpImpact: -15,
    affectedRegions: ['Indonesia', 'Thailand', 'Sri Lanka', 'India', 'Maldives'],
    industries: ['Tourism', 'Fishing', 'Coastal Infrastructure'],
    recoveryTimeline: '5-10 years for affected regions',
    peakDate: 'December 26, 2004',
    casualties: 230000,
    economicLoss: 15,
    lessonsLearned: [
      'Tsunami early warning systems',
      'Coastal development regulations',
      'International disaster response coordination',
      'Insurance for natural catastrophes'
    ],
    comparableEvents: ['fukushima2011']
  },
  brexit2016: {
    id: 'brexit2016',
    name: '2016 Brexit Referendum',
    year: 2016,
    type: 'geopolitical',
    summary: 'The United Kingdom voted to leave the European Union, triggering years of negotiations and significant economic uncertainty. Brexit reshaped UK-EU trade relations and influenced nationalist movements globally.',
    duration: '4 years (transition)',
    gdpImpact: -150,
    affectedRegions: ['United Kingdom', 'European Union'],
    industries: ['Financial Services', 'Agriculture', 'Automotive', 'Pharmaceuticals'],
    recoveryTimeline: 'Ongoing adjustment',
    peakDate: 'June 23, 2016',
    economicLoss: 200,
    lessonsLearned: [
      'Political risk in developed markets',
      'Trade agreement complexity',
      'Supply chain disruption from regulatory changes',
      'Currency volatility from political events'
    ],
    comparableEvents: ['tradewars2018']
  },
  tradewars2018: {
    id: 'tradewars2018',
    name: '2018 US-China Trade War',
    year: 2018,
    type: 'geopolitical',
    summary: 'The United States imposed tariffs on Chinese goods, escalating into a broader trade conflict. The dispute disrupted global supply chains and accelerated economic decoupling between the worlds two largest economies.',
    duration: '2+ years',
    gdpImpact: -350,
    affectedRegions: ['United States', 'China', 'Global Trade'],
    industries: ['Technology', 'Agriculture', 'Manufacturing', 'Semiconductors'],
    recoveryTimeline: 'Ongoing (partial truce)',
    peakDate: 'August 2019',
    economicLoss: 500,
    lessonsLearned: [
      'Supply chain diversification need',
      'Technology sovereignty concerns',
      'Tariff impact on consumers',
      'Geopolitical risk in globalization'
    ],
    comparableEvents: ['brexit2016']
  },
  svb2023: {
    id: 'svb2023',
    name: '2023 SVB Bank Failure',
    year: 2023,
    type: 'financial',
    summary: 'Silicon Valley Bank collapsed after a bank run triggered by unrealized losses in its bond portfolio. The failure spread to other regional banks and raised concerns about systemic risk in the banking sector.',
    duration: '1 month (acute phase)',
    gdpImpact: -50,
    affectedRegions: ['United States', 'Global Banking'],
    industries: ['Banking', 'Technology', 'Venture Capital', 'Startups'],
    recoveryTimeline: '6-12 months',
    peakDate: 'March 10, 2023',
    economicLoss: 200,
    lessonsLearned: [
      'Interest rate risk management',
      'Deposit concentration risks',
      'Social media amplification of bank runs',
      'Regulatory oversight gaps'
    ],
    comparableEvents: ['lehman2008']
  },
  arabspring2011: {
    id: 'arabspring2011',
    name: '2011 Arab Spring',
    year: 2011,
    type: 'geopolitical',
    summary: 'Pro-democracy uprisings swept across the Middle East and North Africa, toppling governments in Tunisia, Egypt, Libya, and Yemen. The movements reshaped regional politics and led to ongoing conflicts in Syria and Libya.',
    duration: '2+ years (initial phase)',
    gdpImpact: -200,
    affectedRegions: ['Middle East', 'North Africa'],
    industries: ['Energy', 'Tourism', 'Trade'],
    recoveryTimeline: 'Ongoing',
    peakDate: 'February 2011',
    casualties: 50000,
    economicLoss: 300,
    lessonsLearned: [
      'Social media role in political movements',
      'Regime stability assessments',
      'Oil supply disruption risks',
      'Regional contagion effects'
    ],
    comparableEvents: ['ukraine2022']
  },
  katrina2005: {
    id: 'katrina2005',
    name: '2005 Hurricane Katrina',
    year: 2005,
    type: 'climate',
    summary: 'One of the deadliest and most costly hurricanes in US history. Katrina devastated New Orleans and the Gulf Coast, causing catastrophic flooding when levees failed. The disaster exposed systemic failures in emergency response and infrastructure.',
    duration: '3 weeks (acute phase)',
    gdpImpact: -125,
    affectedRegions: ['Gulf Coast USA', 'Louisiana', 'Mississippi', 'Alabama'],
    industries: ['Oil & Gas', 'Insurance', 'Real Estate', 'Shipping', 'Tourism'],
    recoveryTimeline: '10+ years for full recovery',
    peakDate: 'August 29, 2005',
    casualties: 1836,
    economicLoss: 186,
    lessonsLearned: [
      'Infrastructure resilience critical',
      'Emergency response coordination needs',
      'Flood insurance adequacy questions',
      'Climate risk pricing in real estate'
    ],
    comparableEvents: ['sandy2012', 'tsunami2004', 'fukushima2011']
  },
  sandy2012: {
    id: 'sandy2012',
    name: '2012 Hurricane Sandy',
    year: 2012,
    type: 'climate',
    summary: 'Superstorm Sandy caused massive damage to the US East Coast, particularly New York and New Jersey. The storm flooded the NYC subway system and caused widespread power outages, highlighting urban infrastructure vulnerabilities.',
    duration: '2 weeks (acute phase)',
    gdpImpact: -75,
    affectedRegions: ['US Northeast', 'New York', 'New Jersey', 'Caribbean'],
    industries: ['Insurance', 'Real Estate', 'Transportation', 'Utilities', 'Retail'],
    recoveryTimeline: '3-5 years',
    peakDate: 'October 29, 2012',
    casualties: 233,
    economicLoss: 70,
    lessonsLearned: [
      'Urban flood preparedness',
      'Critical infrastructure protection',
      'Business continuity for financial centers',
      'Climate adaptation investment needs'
    ],
    comparableEvents: ['katrina2005', 'fukushima2011']
  },
  crypto2022: {
    id: 'crypto2022',
    name: '2022 Crypto Collapse',
    year: 2022,
    type: 'financial',
    summary: 'The cryptocurrency market lost over $2 trillion in value following the collapse of Terra/Luna, Three Arrows Capital, Celsius, and FTX. The contagion exposed systemic risks in crypto lending and exchange operations.',
    duration: '12 months',
    gdpImpact: -200,
    affectedRegions: ['Global', 'United States', 'Singapore', 'Bahamas'],
    industries: ['Cryptocurrency', 'Fintech', 'Venture Capital', 'Banking'],
    recoveryTimeline: 'Ongoing',
    peakDate: 'November 11, 2022 (FTX collapse)',
    economicLoss: 2000,
    lessonsLearned: [
      'Counterparty risk in crypto',
      'Regulatory gaps in digital assets',
      'Leverage risks in DeFi',
      'Custody and proof of reserves importance'
    ],
    comparableEvents: ['dotcom2000', 'lehman2008', 'svb2023']
  },
  russia1998: {
    id: 'russia1998',
    name: '1998 Russian Default',
    year: 1998,
    type: 'financial',
    summary: 'Russia defaulted on domestic debt and devalued the ruble, triggering global market turmoil. The crisis led to the collapse of Long-Term Capital Management (LTCM), requiring a Federal Reserve-coordinated bailout.',
    duration: '6 months',
    gdpImpact: -180,
    affectedRegions: ['Russia', 'Emerging Markets', 'United States', 'Europe'],
    industries: ['Banking', 'Hedge Funds', 'Commodities', 'Emerging Market Bonds'],
    recoveryTimeline: '2-3 years',
    peakDate: 'August 17, 1998',
    economicLoss: 450,
    lessonsLearned: [
      'Sovereign default contagion effects',
      'Hedge fund systemic risk',
      'Model risk in complex derivatives',
      'Liquidity risk underestimation'
    ],
    comparableEvents: ['asian1997', 'argentina2001', 'lehman2008']
  },
  crimea2014: {
    id: 'crimea2014',
    name: '2014 Crimea Annexation',
    year: 2014,
    type: 'geopolitical',
    summary: 'Russia annexed Crimea following political upheaval in Ukraine, leading to Western sanctions and a fundamental shift in European security architecture. The event marked the start of ongoing Russia-Ukraine tensions.',
    duration: 'Ongoing',
    gdpImpact: -150,
    affectedRegions: ['Russia', 'Ukraine', 'Europe', 'United States'],
    industries: ['Energy', 'Banking', 'Defense', 'Agriculture'],
    recoveryTimeline: 'N/A - ongoing',
    peakDate: 'March 18, 2014',
    economicLoss: 400,
    lessonsLearned: [
      'Sanctions as geopolitical tool',
      'Energy dependence vulnerabilities',
      'European security reassessment',
      'Asset seizure and capital flight risks'
    ],
    comparableEvents: ['ukraine2022', 'gulf1990']
  },
  h1n1_2009: {
    id: 'h1n1_2009',
    name: '2009 H1N1 Swine Flu',
    year: 2009,
    type: 'pandemic',
    summary: 'A novel H1N1 influenza virus emerged in Mexico and spread globally, causing the first pandemic of the 21st century. While less deadly than initially feared, it exposed gaps in pandemic preparedness.',
    duration: '18 months',
    gdpImpact: -55,
    affectedRegions: ['Global - All Regions'],
    industries: ['Healthcare', 'Pharmaceuticals', 'Travel', 'Meat Industry'],
    recoveryTimeline: '1 year',
    peakDate: 'October 2009',
    casualties: 284000,
    economicLoss: 45,
    lessonsLearned: [
      'Vaccine production scaling',
      'Public health communication',
      'Global disease surveillance needs',
      'Pandemic response coordination'
    ],
    comparableEvents: ['covid2020', 'sars2003', 'ebola2014']
  },
  australia2020: {
    id: 'australia2020',
    name: '2020 Australia Wildfires',
    year: 2020,
    type: 'climate',
    summary: 'The 2019-2020 Australian bushfire season was unprecedented in scale, burning over 46 million acres. The fires destroyed communities, killed billions of animals, and intensified debates about climate change response.',
    duration: '8 months (Sep 2019 - May 2020)',
    gdpImpact: -75,
    affectedRegions: ['Australia', 'New South Wales', 'Victoria', 'Queensland'],
    industries: ['Agriculture', 'Tourism', 'Insurance', 'Forestry', 'Real Estate'],
    recoveryTimeline: '5+ years',
    peakDate: 'January 2020',
    casualties: 34,
    economicLoss: 100,
    lessonsLearned: [
      'Climate change impact acceleration',
      'Fire management modernization needs',
      'Insurance capacity for mega-fires',
      'Biodiversity risk assessment'
    ],
    comparableEvents: ['katrina2005', 'fukushima2011']
  }
}

// Map display names to event IDs
const EVENT_NAME_TO_ID: Record<string, string> = {
  // Direct mappings
  '1929 Great Depression': 'crash1929',
  '1929 Stock Market Crash': 'crash1929',
  '1973 Oil Crisis': 'oil1973',
  '1986 Chernobyl': 'chernobyl1986',
  '1987 Black Monday': 'blackmonday1987',
  '1997 Asian Crisis': 'asian1997',
  '1997 Asian Financial Crisis': 'asian1997',
  '2000 Dot-Com Bubble': 'dotcom2000',
  '2001 September 11': 'sept11_2001',
  '2004 Indian Ocean Tsunami': 'tsunami2004',
  '2008 Global Financial Crisis': 'lehman2008',
  '2010 Flash Crash': 'flashcrash2010',
  '2011 Eurozone Debt Crisis': 'eurozone2011',
  '2011 Fukushima': 'fukushima2011',
  '2011 Arab Spring': 'arabspring2011',
  '2016 Brexit': 'brexit2016',
  '2018 US-China Trade War': 'tradewars2018',
  '2020 COVID-19': 'covid2020',
  '2020 COVID Crash': 'covid2020',
  '2022 Ukraine Conflict': 'ukraine2022',
  '2023 SVB Bank Failure': 'svb2023',
  // Fallback mappings
  '1994 Mexican Peso Crisis': 'asian1997',
  '1998 Russian Default': 'asian1997',
  '2001 Argentine Crisis': 'asian1997',
  '1918 Spanish Flu': 'covid2020',
  '2003 SARS': 'covid2020',
  '2009 H1N1': 'covid2020',
  '1990 Gulf War': 'ukraine2022',
  '2014 Crimea Annexation': 'ukraine2022',
  'gulf1990': 'ukraine2022',
  'crypto2022': 'svb2023',
  'tradewars2018': 'tradewars2018',
}

interface HistoricalEventPanelProps {
  isOpen: boolean
  onClose: () => void
  eventId: string | null
  onEventChange?: (eventId: string) => void
}

export default function HistoricalEventPanel({ isOpen, onClose, eventId, onEventChange }: HistoricalEventPanelProps) {
  const [notification, setNotification] = useState<string | null>(null)
  
  const event = eventId ? HISTORICAL_EVENTS[eventId] : null
  
  // Fallback for events not yet in database
  if (!event && eventId && isOpen) {
    return (
      <motion.div
        className="absolute inset-8 z-50 pointer-events-auto"
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
      >
        <div className="h-full bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex items-center justify-center">
          <div className="text-center p-8 max-w-md">
            <div className="w-16 h-16 mx-auto mb-6 bg-amber-500/20 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-white text-xl font-light mb-2">Event Analysis Coming Soon</h2>
            <p className="text-white/50 text-sm mb-4">
              Detailed analysis for "{eventId.replace(/[_-]/g, ' ').replace(/\d+/g, ' $&').trim()}" 
              is being prepared by our research team.
            </p>
            <p className="text-white/30 text-xs mb-6">
              Event ID: {eventId}
            </p>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </motion.div>
    )
  }
  
  if (!event) return null
  
  // Handle comparable event click
  const handleComparableClick = (eventName: string) => {
    const targetId = EVENT_NAME_TO_ID[eventName] || eventName
    if (HISTORICAL_EVENTS[targetId]) {
      onEventChange?.(targetId)
    } else {
      showNotification(`Event "${eventName}" data coming soon`)
    }
  }
  
  // Show notification
  const showNotification = (message: string) => {
    setNotification(message)
    setTimeout(() => setNotification(null), 3000)
  }
  
  // Handle export
  const handleExport = () => {
    showNotification('Report exported to PDF')
    // In production: generate PDF via API
  }
  
  // Handle run scenario
  const handleRunScenario = () => {
    showNotification('Scenario simulation started')
    // In production: trigger stress test simulation
  }
  
  // Handle share
  const handleShare = () => {
    navigator.clipboard.writeText(`${window.location.origin}/report/${event.id}`)
    showNotification('Link copied to clipboard')
  }
  
  const typeColors: Record<string, { bg: string; text: string; border: string }> = {
    financial: { bg: 'bg-blue-500/20', text: 'text-blue-400', border: 'border-blue-500/30' },
    climate: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
    pandemic: { bg: 'bg-purple-500/20', text: 'text-purple-400', border: 'border-purple-500/30' },
    geopolitical: { bg: 'bg-orange-500/20', text: 'text-orange-400', border: 'border-orange-500/30' },
    infrastructure: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', border: 'border-yellow-500/30' },
  }
  
  const colors = typeColors[event.type] || typeColors.financial

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="absolute inset-8 z-50 pointer-events-auto"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3 }}
        >
          <div className="h-full bg-black/95 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden flex">
            {/* Main Report Content */}
            <div className="flex-1 p-8 overflow-auto">
              {/* Header */}
              <div className="mb-8">
                <div className="flex items-center gap-3 mb-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium uppercase tracking-wider ${colors.bg} ${colors.text} ${colors.border} border`}>
                    {event.type}
                  </span>
                  <span className="text-white/40 text-sm">{event.year}</span>
                </div>
                <h1 className="text-white text-3xl font-light mb-2">{event.name}</h1>
                <p className="text-white/60 text-sm leading-relaxed max-w-3xl">{event.summary}</p>
              </div>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-4 gap-4 mb-8">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">GDP Impact</div>
                  <div className="text-red-400 text-2xl font-light">
                    ${Math.abs(event.gdpImpact).toLocaleString()}B
                  </div>
                  <div className="text-white/30 text-xs">Global</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Economic Loss</div>
                  <div className="text-orange-400 text-2xl font-light">
                    ${event.economicLoss.toLocaleString()}B
                  </div>
                  <div className="text-white/30 text-xs">Total</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Duration</div>
                  <div className="text-white text-lg font-light">{event.duration.split(' ')[0]}</div>
                  <div className="text-white/30 text-xs">{event.duration.split(' ').slice(1).join(' ')}</div>
                </div>
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Recovery</div>
                  <div className="text-green-400 text-lg font-light">{event.recoveryTimeline.split(' ')[0]}</div>
                  <div className="text-white/30 text-xs">{event.recoveryTimeline.split(' ').slice(1).join(' ')}</div>
                </div>
              </div>
              
              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-6 mb-8">
                {/* Affected Regions */}
                <div>
                  <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Affected Regions</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.affectedRegions.map((region) => (
                      <span key={region} className="px-2 py-1 bg-white/5 rounded text-white/70 text-xs border border-white/10">
                        {region}
                      </span>
                    ))}
                  </div>
                </div>
                
                {/* Industries */}
                <div>
                  <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Industries Impacted</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.industries.map((industry) => (
                      <span key={industry} className="px-2 py-1 bg-white/5 rounded text-white/70 text-xs border border-white/10">
                        {industry}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Cascade Analysis Graph - Full Width, Fixed Height */}
              <div className="mb-8">
                <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Cascade Analysis</h3>
                <div className="w-full">
                  <EventRiskGraph
                    eventId={event.id}
                    eventType="historical"
                    eventName={event.name}
                    fullWidth={true}
                  />
                </div>
              </div>
              
              {/* Lessons Learned */}
              <div className="mb-8">
                <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Key Lessons</h3>
                <div className="space-y-2">
                  {event.lessonsLearned.map((lesson, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-white/60 text-sm">{lesson}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Comparable Events */}
              <div className="mb-8">
                <h3 className="text-white/70 text-sm uppercase tracking-wider mb-3">Comparable Events</h3>
                <div className="flex flex-wrap gap-2">
                  {event.comparableEvents.map((ev) => {
                    const targetId = typeof ev === 'string' && HISTORICAL_EVENTS[ev] ? ev : EVENT_NAME_TO_ID[ev]
                    const displayName = HISTORICAL_EVENTS[ev]?.name || ev
                    const isAvailable = !!HISTORICAL_EVENTS[targetId]
                    
                    return (
                      <button
                        key={ev}
                        onClick={() => handleComparableClick(ev)}
                        className={`px-3 py-1.5 rounded-lg text-xs border transition-colors flex items-center gap-1.5 ${
                          isAvailable
                            ? 'bg-white/5 text-white/70 border-white/10 hover:bg-white/15 hover:text-white'
                            : 'bg-white/5 text-white/30 border-white/5 cursor-not-allowed'
                        }`}
                      >
                        {isAvailable && (
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                          </svg>
                        )}
                        {displayName}
                      </button>
                    )
                  })}
                </div>
              </div>
              
              {/* Actions */}
              <div className="flex gap-3">
                <button 
                  onClick={handleExport}
                  className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Export Report
                </button>
                <button 
                  onClick={handleRunScenario}
                  className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg border border-amber-500/30 hover:bg-amber-500/30 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Run Scenario
                </button>
                <button 
                  onClick={handleShare}
                  className="px-4 py-2 bg-white/5 text-white/60 rounded-lg border border-white/10 hover:bg-white/10 transition-colors text-sm flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                  </svg>
                  Share
                </button>
              </div>
              
              {/* Notification */}
              <AnimatePresence>
                {notification && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 20 }}
                    className="fixed bottom-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-white/10 backdrop-blur-xl rounded-lg border border-white/20 text-white text-sm flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    {notification}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
            
            {/* Sidebar - Timeline & Meta */}
            <div className="w-72 border-l border-white/10 p-6 bg-white/[0.02]">
              <div className="mb-6">
                <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Event Timeline</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-red-500" />
                    <div>
                      <div className="text-white text-xs">Peak Impact</div>
                      <div className="text-white/40 text-[10px]">{event.peakDate}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-yellow-500" />
                    <div>
                      <div className="text-white text-xs">Duration</div>
                      <div className="text-white/40 text-[10px]">{event.duration}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-green-500" />
                    <div>
                      <div className="text-white text-xs">Recovery</div>
                      <div className="text-white/40 text-[10px]">{event.recoveryTimeline}</div>
                    </div>
                  </div>
                </div>
              </div>
              
              {event.casualties && (
                <div className="mb-6 p-3 bg-red-500/10 rounded-lg border border-red-500/20">
                  <div className="text-white/50 text-xs uppercase tracking-wider mb-1">Human Cost</div>
                  <div className="text-red-400 text-xl font-light">{event.casualties.toLocaleString()}</div>
                  <div className="text-white/30 text-xs">casualties</div>
                </div>
              )}
              
              <div className="mb-6">
                <h3 className="text-white/50 text-xs uppercase tracking-wider mb-3">Data Sources</h3>
                <div className="text-white/40 text-xs space-y-1">
                  <div>• World Bank</div>
                  <div>• IMF</div>
                  <div>• Bloomberg</div>
                  <div>• Reuters</div>
                </div>
              </div>
              
              <div className="text-white/20 text-[10px] mt-auto">
                Report generated by PFRP Analytics Engine.<br/>
                Data verified as of 2024.
              </div>
            </div>
            
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            >
              <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
