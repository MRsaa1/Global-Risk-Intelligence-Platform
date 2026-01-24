/**
 * Virtual List Components
 * 
 * Provides virtualized list rendering for large datasets.
 * Uses @tanstack/react-virtual for efficient rendering of only visible items.
 */
import { useRef, ReactNode, forwardRef, useImperativeHandle } from 'react'
import { useVirtualizer, VirtualItem } from '@tanstack/react-virtual'
import { motion } from 'framer-motion'

// ==================== BASE VIRTUAL LIST ====================

export interface VirtualListProps<T> {
  /** Array of items to render */
  items: T[]
  /** Estimated height of each item in pixels */
  estimatedItemHeight?: number
  /** Height of the scrollable container */
  containerHeight?: number | string
  /** Render function for each item */
  renderItem: (item: T, index: number, virtualItem: VirtualItem) => ReactNode
  /** Optional class name for container */
  className?: string
  /** Number of items to render outside visible area (overscan) */
  overscan?: number
  /** Key extractor function */
  getItemKey?: (item: T, index: number) => string | number
  /** Optional empty state content */
  emptyState?: ReactNode
  /** Optional loading indicator */
  isLoading?: boolean
  /** Loading skeleton renderer */
  renderSkeleton?: () => ReactNode
  /** Number of skeleton items to show while loading */
  skeletonCount?: number
}

export interface VirtualListHandle {
  scrollToIndex: (index: number) => void
  scrollToTop: () => void
  scrollToBottom: () => void
}

function VirtualListInner<T>(
  {
    items,
    estimatedItemHeight = 60,
    containerHeight = 400,
    renderItem,
    className = '',
    overscan = 5,
    getItemKey,
    emptyState,
    isLoading = false,
    renderSkeleton,
    skeletonCount = 5,
  }: VirtualListProps<T>,
  ref: React.Ref<VirtualListHandle>
) {
  const parentRef = useRef<HTMLDivElement>(null)
  
  const virtualizer = useVirtualizer({
    count: isLoading ? skeletonCount : items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => estimatedItemHeight,
    overscan,
    getItemKey: getItemKey 
      ? (index) => getItemKey(items[index], index)
      : undefined,
  })
  
  useImperativeHandle(ref, () => ({
    scrollToIndex: (index: number) => {
      virtualizer.scrollToIndex(index, { align: 'start' })
    },
    scrollToTop: () => {
      virtualizer.scrollToOffset(0)
    },
    scrollToBottom: () => {
      virtualizer.scrollToOffset(virtualizer.getTotalSize())
    },
  }))
  
  const virtualItems = virtualizer.getVirtualItems()
  
  // Empty state
  if (!isLoading && items.length === 0 && emptyState) {
    return (
      <div 
        className={`flex items-center justify-center ${className}`}
        style={{ height: containerHeight }}
      >
        {emptyState}
      </div>
    )
  }
  
  return (
    <div
      ref={parentRef}
      className={`overflow-auto ${className}`}
      style={{ height: containerHeight }}
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualItems.map((virtualItem) => (
          <div
            key={virtualItem.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualItem.size}px`,
              transform: `translateY(${virtualItem.start}px)`,
            }}
          >
            {isLoading && renderSkeleton 
              ? renderSkeleton()
              : renderItem(items[virtualItem.index], virtualItem.index, virtualItem)
            }
          </div>
        ))}
      </div>
    </div>
  )
}

export const VirtualList = forwardRef(VirtualListInner) as <T>(
  props: VirtualListProps<T> & { ref?: React.Ref<VirtualListHandle> }
) => ReturnType<typeof VirtualListInner>


// ==================== VIRTUAL ASSET LIST ====================

export interface Asset {
  id: string
  name: string
  city?: string
  asset_type?: string
  climate_risk_score?: number
  physical_risk_score?: number
  network_risk_score?: number
  current_valuation?: number
}

interface VirtualAssetListProps {
  assets: Asset[]
  height?: number | string
  onAssetClick?: (asset: Asset) => void
  isLoading?: boolean
  selectedAssetId?: string
}

export function VirtualAssetList({
  assets,
  height = 400,
  onAssetClick,
  isLoading = false,
  selectedAssetId,
}: VirtualAssetListProps) {
  const getRiskLevel = (score?: number): { color: string; label: string } => {
    if (!score) return { color: 'text-white/30', label: '-' }
    if (score >= 80) return { color: 'text-red-400', label: 'Critical' }
    if (score >= 60) return { color: 'text-orange-400', label: 'High' }
    if (score >= 40) return { color: 'text-yellow-400', label: 'Medium' }
    return { color: 'text-emerald-400', label: 'Low' }
  }
  
  const getCombinedRisk = (asset: Asset): number => {
    const scores = [
      asset.climate_risk_score || 0,
      asset.physical_risk_score || 0,
      asset.network_risk_score || 0,
    ]
    return scores.reduce((a, b) => a + b, 0) / 3
  }
  
  return (
    <VirtualList
      items={assets}
      containerHeight={height}
      estimatedItemHeight={72}
      isLoading={isLoading}
      skeletonCount={6}
      getItemKey={(asset) => asset.id}
      emptyState={
        <div className="text-center text-white/40 py-8">
          <p>No assets found</p>
        </div>
      }
      renderSkeleton={() => (
        <div className="p-3 mx-2 my-1 bg-white/5 rounded-lg animate-pulse">
          <div className="h-4 bg-white/10 rounded w-3/4 mb-2" />
          <div className="h-3 bg-white/10 rounded w-1/2" />
        </div>
      )}
      renderItem={(asset, index) => {
        const combinedRisk = getCombinedRisk(asset)
        const riskLevel = getRiskLevel(combinedRisk)
        const isSelected = asset.id === selectedAssetId
        
        return (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: Math.min(index * 0.02, 0.2) }}
            className={`
              p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all
              ${isSelected 
                ? 'bg-blue-500/20 border border-blue-500/30' 
                : 'bg-white/5 hover:bg-white/10 border border-transparent'
              }
            `}
            onClick={() => onAssetClick?.(asset)}
          >
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-medium text-white truncate">
                  {asset.name}
                </h4>
                <div className="flex items-center gap-2 mt-0.5">
                  {asset.city && (
                    <span className="text-xs text-white/40">{asset.city}</span>
                  )}
                  {asset.asset_type && (
                    <span className="text-xs text-white/30">
                      • {asset.asset_type.replace(/_/g, ' ')}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-3 ml-2">
                {asset.current_valuation && (
                  <span className="text-xs text-white/50">
                    €{(asset.current_valuation / 1_000_000).toFixed(1)}M
                  </span>
                )}
                <div className="flex flex-col items-end">
                  <span className={`text-xs font-medium ${riskLevel.color}`}>
                    {riskLevel.label}
                  </span>
                  <span className="text-[10px] text-white/30">
                    {combinedRisk.toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        )
      }}
    />
  )
}


// ==================== VIRTUAL ALERT LIST ====================

export interface Alert {
  id: string
  title: string
  message: string
  severity: 'info' | 'warning' | 'error' | 'critical'
  timestamp: string | Date
  read?: boolean
}

interface VirtualAlertListProps {
  alerts: Alert[]
  height?: number | string
  onAlertClick?: (alert: Alert) => void
  isLoading?: boolean
}

export function VirtualAlertList({
  alerts,
  height = 300,
  onAlertClick,
  isLoading = false,
}: VirtualAlertListProps) {
  const getSeverityStyles = (severity: Alert['severity']) => {
    switch (severity) {
      case 'critical':
        return { bg: 'bg-red-500/10', border: 'border-red-500/30', dot: 'bg-red-500' }
      case 'error':
        return { bg: 'bg-orange-500/10', border: 'border-orange-500/30', dot: 'bg-orange-500' }
      case 'warning':
        return { bg: 'bg-yellow-500/10', border: 'border-yellow-500/30', dot: 'bg-yellow-500' }
      default:
        return { bg: 'bg-blue-500/10', border: 'border-blue-500/30', dot: 'bg-blue-500' }
    }
  }
  
  const formatTimestamp = (timestamp: string | Date): string => {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    
    if (diff < 60000) return 'Just now'
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
    return date.toLocaleDateString()
  }
  
  return (
    <VirtualList
      items={alerts}
      containerHeight={height}
      estimatedItemHeight={80}
      isLoading={isLoading}
      skeletonCount={4}
      getItemKey={(alert) => alert.id}
      emptyState={
        <div className="text-center text-white/40 py-8">
          <p>No alerts</p>
        </div>
      }
      renderSkeleton={() => (
        <div className="p-3 mx-2 my-1 bg-white/5 rounded-lg animate-pulse">
          <div className="flex gap-2">
            <div className="w-2 h-2 bg-white/10 rounded-full mt-1.5" />
            <div className="flex-1">
              <div className="h-4 bg-white/10 rounded w-1/2 mb-2" />
              <div className="h-3 bg-white/10 rounded w-3/4" />
            </div>
          </div>
        </div>
      )}
      renderItem={(alert) => {
        const styles = getSeverityStyles(alert.severity)
        
        return (
          <div
            className={`
              p-3 mx-2 my-1 rounded-lg cursor-pointer transition-all
              ${styles.bg} border ${styles.border}
              hover:bg-opacity-20
              ${alert.read ? 'opacity-60' : ''}
            `}
            onClick={() => onAlertClick?.(alert)}
          >
            <div className="flex gap-2">
              <div className={`w-2 h-2 ${styles.dot} rounded-full mt-1.5 flex-shrink-0`} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-sm font-medium text-white truncate">
                    {alert.title}
                  </h4>
                  <span className="text-[10px] text-white/40 flex-shrink-0">
                    {formatTimestamp(alert.timestamp)}
                  </span>
                </div>
                <p className="text-xs text-white/60 mt-0.5 line-clamp-2">
                  {alert.message}
                </p>
              </div>
            </div>
          </div>
        )
      }}
    />
  )
}

export default VirtualList
