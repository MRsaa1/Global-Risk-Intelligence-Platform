/**
 * Unified Quick Actions config — shared by Dashboard and Command Center.
 * Same links, colors, and order for consistent UX.
 */
import {
  HomeIcon,
  BuildingOffice2Icon,
  BuildingLibraryIcon,
  ArrowsRightLeftIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
  ServerStackIcon,
  Square3Stack3DIcon,
  CpuChipIcon,
  ChartBarIcon,
  BriefcaseIcon,
  BanknotesIcon,
  ShieldExclamationIcon,
  BeakerIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CubeTransparentIcon,
  CheckCircleIcon,
  SparklesIcon,
  ShieldCheckIcon,
  MapIcon,
  Cog6ToothIcon,
  ArrowTrendingUpIcon,
  UserCircleIcon,
} from '@heroicons/react/24/outline'

export type QuickActionColor = 'amber' | 'emerald' | 'red' | 'purple' | 'slate' | 'cyan'

export interface QuickActionItem {
  path: string
  label: string
  subtitle?: string
  icon: React.ComponentType<{ className?: string }>
  color: QuickActionColor
}

/** Shared color classes for card borders and icons */
export const quickActionColors: Record<QuickActionColor, { border: string; hover: string; icon: string }> = {
  amber: { border: 'border-zinc-500/20', hover: 'hover:border-zinc-500/50 hover:bg-zinc-500/5', icon: 'text-zinc-400' },
  emerald: { border: 'border-zinc-500/20', hover: 'hover:border-zinc-500/50 hover:bg-zinc-500/5', icon: 'text-zinc-400' },
  red: { border: 'border-red-500/20', hover: 'hover:border-red-500/50 hover:bg-red-500/5', icon: 'text-red-400' },
  purple: { border: 'border-zinc-500/20', hover: 'hover:border-zinc-500/50 hover:bg-zinc-500/5', icon: 'text-zinc-400' },
  slate: { border: 'border-zinc-500/20', hover: 'hover:border-zinc-500/50 hover:bg-zinc-500/5', icon: 'text-zinc-400' },
  cyan: { border: 'border-zinc-500/20', hover: 'hover:border-zinc-500/50 hover:bg-zinc-500/5', icon: 'text-zinc-400' },
}

/** Icon-bar colors for Command Center compact nav */
export const quickActionIconColors: Record<QuickActionColor, string> = {
  amber: 'hover:text-zinc-400 hover:bg-zinc-500/20',
  emerald: 'hover:text-zinc-400 hover:bg-zinc-500/20',
  red: 'hover:text-red-400 hover:bg-red-500/20',
  purple: 'hover:text-zinc-400 hover:bg-zinc-500/20',
  slate: 'hover:text-zinc-400 hover:bg-zinc-500/20',
  cyan: 'hover:text-zinc-400 hover:bg-zinc-500/20',
}

/** Core actions — shown in both Dashboard and Command Center */
export const quickActionsCore: QuickActionItem[] = [
  { path: '/projects', label: 'Project Finance', subtitle: 'IRR/NPV, Phases, CAPEX/OPEX', icon: BriefcaseIcon, color: 'amber' },
  { path: '/portfolios', label: 'Portfolios & REIT', subtitle: 'NAV, FFO, Yield, Stress Tests', icon: BanknotesIcon, color: 'emerald' },
  { path: '/fraud', label: 'Fraud Detection', subtitle: 'Claims, 3D Compare, Verification', icon: ShieldExclamationIcon, color: 'red' },
  { path: '/action-plans', label: 'STRESS TEST ACTION PLAN', subtitle: 'Template: 5 sectors, phases, metrics', icon: DocumentTextIcon, color: 'amber' },
  { path: '/stress-planner', label: 'Stress Planner', subtitle: 'All scenario types, Monte Carlo, real API', icon: BeakerIcon, color: 'amber' },
  { path: '/board-mode', label: 'Board Mode', subtitle: '5-slide executive presentation', icon: CubeTransparentIcon, color: 'purple' },
  { path: '/regulator-mode', label: 'Regulator Mode', subtitle: 'ECB / DORA / ISO 22301 view', icon: CheckCircleIcon, color: 'slate' },
  { path: '/compliance', label: 'Compliance Dashboard', subtitle: 'Basel, TCFD, DORA, EU AI Act, GDPR', icon: ShieldCheckIcon, color: 'slate' },
  { path: '/modules', label: 'Strategic Modules', subtitle: 'CIP • SCSS • SRO • Cross-module simulations', icon: Square3Stack3DIcon, color: 'cyan' },
]

/** Dashboard — все разделы (карточки с горизонтальным скроллом). Command Center доступен через Layout/sidebar — дублирующая карточка с глобусом убрана. */
export const quickActionsDashboard: QuickActionItem[] = [
  { path: '/assets', label: 'Assets', subtitle: 'Digital Twins, 3D view', icon: BuildingOffice2Icon, color: 'slate' },
  { path: '/modules', label: 'Strategic Modules', subtitle: 'CIP • SCSS • SRO', icon: Square3Stack3DIcon, color: 'cyan' },
  { path: '/municipal', label: 'Municipal', subtitle: 'Local government', icon: BuildingLibraryIcon, color: 'slate' },
  { path: '/cross-track', label: 'Cross-Track', subtitle: 'Cross-module', icon: ArrowsRightLeftIcon, color: 'slate' },
  { path: '/replay', label: 'Scenario Replay', subtitle: 'Temporal replay', icon: ArrowPathIcon, color: 'slate' },
  { path: '/municipal?tab=regulatory', label: 'Regulatory Export', subtitle: 'TCFD, OSFI B-15, EBA — Municipal', icon: ArrowDownTrayIcon, color: 'slate' },
  { path: '/analytics', label: 'Advanced Analytics', subtitle: 'Risk trends, VaR', icon: CpuChipIcon, color: 'slate' },
  { path: '/visualizations', label: 'Risk Flow', subtitle: 'Cascade diagrams', icon: ChartBarIcon, color: 'slate' },
  { path: '/projects', label: 'Project Finance', subtitle: 'IRR/NPV, Phases', icon: BriefcaseIcon, color: 'amber' },
  { path: '/portfolios', label: 'Portfolios & REIT', subtitle: 'NAV, FFO, Stress Tests', icon: BanknotesIcon, color: 'emerald' },
  { path: '/fraud', label: 'Fraud Detection', subtitle: 'Claims, 3D Compare', icon: ShieldExclamationIcon, color: 'red' },
  { path: '/agents', label: 'AI Agents', subtitle: 'NeMo monitoring', icon: SparklesIcon, color: 'purple' },
  { path: '/arin', label: 'ARIN', subtitle: 'Risk & Intelligence OS', icon: ShieldCheckIcon, color: 'amber' },
  { path: '/lpr', label: 'LPR', subtitle: 'Leader/Persona Risk', icon: UserCircleIcon, color: 'purple' },
  { path: '/risk-zones-analysis', label: 'Risk Zones', subtitle: 'Dependencies analysis', icon: MapIcon, color: 'cyan' },
  { path: '/action-plans', label: 'Action Plans', subtitle: 'Sector plans', icon: DocumentTextIcon, color: 'amber' },
  { path: '/stress-planner', label: 'Stress Planner', subtitle: 'Monte Carlo, scenarios', icon: BeakerIcon, color: 'amber' },
  { path: '/bcp-generator', label: 'BCP Generator', subtitle: 'Business continuity', icon: ClipboardDocumentListIcon, color: 'amber' },
  { path: '/board-mode', label: 'Board Mode', subtitle: '5-slide presentation', icon: CubeTransparentIcon, color: 'purple' },
  { path: '/regulator-mode', label: 'Regulator Mode', subtitle: 'ECB / DORA / ISO 22301', icon: CheckCircleIcon, color: 'slate' },
  { path: '/compliance', label: 'Compliance Dashboard', subtitle: 'Basel, TCFD, DORA, EU AI Act, GDPR', icon: ShieldCheckIcon, color: 'slate' },
  { path: '/nvidia-services', label: 'NVIDIA Services', subtitle: 'Status, health', icon: ServerStackIcon, color: 'slate' },
  { path: '/settings', label: 'Settings', subtitle: 'Preferences', icon: Cog6ToothIcon, color: 'slate' },
]

/** Command Center icon bar — full nav, dividerBefore marks group start */
export interface QuickActionCommandItem extends QuickActionItem {
  dividerBefore?: boolean
}

export const quickActionsCommandCenter: QuickActionCommandItem[] = [
  { path: '/dashboard', label: 'Dashboard', icon: HomeIcon, color: 'slate' },
  { path: '/assets', label: 'Assets', icon: BuildingOffice2Icon, color: 'slate' },
  { path: '/modules', label: 'Strategic Modules', icon: Square3Stack3DIcon, color: 'cyan' },
  { path: '/analytics', label: 'Advanced Analytics', icon: CpuChipIcon, color: 'slate' },
  { path: '/visualizations', label: 'Visualizations & Risk Flow', icon: ChartBarIcon, color: 'slate' },
  { path: '/projects', label: 'Project Finance', icon: BriefcaseIcon, color: 'amber', dividerBefore: true },
  { path: '/portfolios', label: 'Portfolios & REIT', icon: BanknotesIcon, color: 'emerald' },
  { path: '/fraud', label: 'Fraud Detection', icon: ShieldExclamationIcon, color: 'red' },
  { path: '/agents', label: 'AI Agents (NeMo)', icon: SparklesIcon, color: 'purple', dividerBefore: true },
  { path: '/arin', label: 'ARIN — Risk OS', icon: ShieldCheckIcon, color: 'amber' },
  { path: '/lpr', label: 'LPR — Leader/Persona Risk', icon: UserCircleIcon, color: 'purple' },
  { path: '/risk-zones-analysis', label: 'Risk Zones Dependencies', icon: MapIcon, color: 'cyan', dividerBefore: true },
  { path: '/action-plans', label: 'Action Plans', icon: DocumentTextIcon, color: 'amber', dividerBefore: true },
  { path: '/stress-planner', label: 'Stress Planner', icon: BeakerIcon, color: 'amber' },
  { path: '/bcp-generator', label: 'BCP Generator', icon: ClipboardDocumentListIcon, color: 'amber' },
  { path: '/settings', label: 'Settings', icon: Cog6ToothIcon, color: 'slate', dividerBefore: true },
]
