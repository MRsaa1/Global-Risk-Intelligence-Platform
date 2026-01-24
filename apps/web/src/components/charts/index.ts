/**
 * Charts Module - Export all chart components
 * =============================================
 */

// Core chart components
export { default as TimeSeriesChart } from './TimeSeriesChart'
export type { TimeSeriesSeries, TimeSeriesDataPoint } from './TimeSeriesChart'

export { default as BarChart } from './BarChart'
export type { BarDataPoint, BarSeries } from './BarChart'

export { default as PieChart } from './PieChart'
export type { PieDataPoint } from './PieChart'

export { default as ComparisonChart, StressTestComparison } from './ComparisonChart'
export type { ComparisonMetric, ComparisonScenario } from './ComparisonChart'

// Controls and utilities
export { default as ChartControls, QuickChartControls } from './ChartControls'
export type { TimeRange } from './ChartControls'

export { default as InteractiveTooltip, useTooltip, Crosshair } from './InteractiveTooltip'
export type { TooltipDataPoint, TooltipPosition } from './InteractiveTooltip'

export { 
  default as AnimationWrapper, 
  ChartSkeleton,
  StaggerContainer,
  StaggerItem,
  CounterAnimation,
  ProgressBar,
  PulseIndicator,
} from './AnimationWrapper'

// Re-export chart colors
export { 
  chartColors,
  riskColors,
  seriesColors,
  pieColors,
  getRiskColor,
  getRiskLevel,
} from '../../lib/chartColors'
