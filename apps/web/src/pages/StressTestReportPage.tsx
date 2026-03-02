/**
 * StressTestReportPage
 * Standalone report page opened in a new tab from Digital Twin "View Report".
 * Reads report from localStorage, fetches cities, renders StressTestReportContent.
 */
import { useEffect, useState, useCallback, useRef } from 'react'
import { Link } from 'react-router-dom'
import StressTestReportContent from '../components/StressTestReportContent'
import type { StressTestReport } from '../components/StressTestReportContent'
const STORAGE_KEY = 'pfrp-stress-report'

export default function StressTestReportPage() {
  const [report, setReport] = useState<StressTestReport | null>(null)
  const [cities, setCities] = useState<Array<{ id: string; name: string; country?: string }>>([])
  const [isExportingPDF, setIsExportingPDF] = useState(false)

  // Read report from localStorage and clear; fetch cities
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      const data = raw ? JSON.parse(raw) : null
      if (data) {
        setReport(data as StressTestReport)
        localStorage.removeItem(STORAGE_KEY)
      }
    } catch {
      setReport(null)
    }

    fetch('/api/v1/geodata/cities')
      .then((res) => (res.ok ? res.json() : { cities: [] }))
      .then((body: { cities?: Array<{ id: string; name: string; country?: string }> }) => {
        setCities(body?.cities ?? [])
      })
      .catch(() => setCities([]))
  }, [])

  const PDF_EXPORT_TIMEOUT_MS = 2 * 60 * 1000 // 2 minutes

  const onExportPDF = useCallback(async () => {
    if (!report) return
    setIsExportingPDF(true)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PDF_EXPORT_TIMEOUT_MS)
    try {
      const pdfRequest = {
        test_name: report.eventName,
        city_name: report.cityName,
        test_type: report.eventType,
        severity: (report.zones?.length ?? 0) > 0
          ? Math.max(...(report.zones ?? []).map(z =>
              z.riskLevel === 'critical' ? 0.9 : z.riskLevel === 'high' ? 0.7 : z.riskLevel === 'medium' ? 0.5 : 0.3
            ))
          : 0.5,
        zones: (report.zones ?? []).map(z => ({
          name: z.label,
          zone_level: z.riskLevel,
          affected_assets_count: z.affectedBuildings,
          expected_loss: z.estimatedLoss,
          population_affected: z.populationAffected,
          radius: z.radius,
          recommendations: z.recommendations,
        })),
        actions: (report.mitigationActions ?? []).map(a => ({
          title: a.action,
          priority: a.priority,
          estimated_cost: a.cost,
          risk_reduction: a.riskReduction,
          timeline: a.priority === 'urgent' ? 'Immediate' : a.priority === 'high' ? '1-2 months' : '3-6 months',
        })),
        executive_summary: report.executiveSummary,
        cascade_simulations: report.cascadeSimulations ?? [],
        region_action_plan: report.regionActionPlan ?? undefined,
        historical_comparisons: report.historicalComparisons ?? [],
        concluding_summary: report.concludingSummary ?? undefined,
        report_v2: report.reportV2 ?? undefined,
        currency: report.currency ?? undefined,
        decision_object: report.decisionObject ?? undefined,
        event_name: report.eventName ?? undefined,
        disclosure_draft: report.disclosureDraft ?? undefined,
        data_sources_used: report.dataSourcesUsed ?? undefined,
      }
      const response = await fetch('/api/v1/stress/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfRequest),
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (!response.ok) throw new Error(`PDF generation failed: ${response.statusText}`)
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `stress_test_${report.cityName.replace(/\s+/g, '_')}_${report.eventType}.pdf`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (e) {
      clearTimeout(timeoutId)
      const isTimeout = e instanceof Error && e.name === 'AbortError'
      console.error('PDF export failed:', e)
      alert(isTimeout
        ? 'PDF generation is taking too long. The server may be busy. Please try again in a moment.'
        : 'PDF export failed. Please try again.')
    } finally {
      setIsExportingPDF(false)
    }
  }, [report])

  const cascadeSectionRef = useRef<HTMLDivElement | null>(null)

  const onOpenInCascade = useCallback(() => {
    cascadeSectionRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const onClose = useCallback(() => {
    window.close()
  }, [])

  if (report === null) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-display font-medium mb-2">No report data</h1>
        <p className="text-zinc-400 text-sm text-center max-w-md mb-6">
          Complete a stress test in Digital Twin and click View Report to open the report here.
        </p>
        <Link
          to="/command"
          className="px-4 py-2 bg-zinc-700 text-zinc-400 rounded-md text-sm hover:bg-zinc-600 transition-colors"
        >
          Go to Command Center
        </Link>
      </div>
    )
  }

  return (
    <div className="h-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-700 shrink-0">
        <div>
          <h1 className="text-zinc-100 text-lg font-display font-medium">Stress Test Report</h1>
          <p className="text-zinc-500 text-sm">{report.cityName} • {report.eventName}</p>
          <p className="text-zinc-600 text-xs mt-0.5">Scenario applied as hazard/severity template to selected location.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/command"
            className="px-3 py-1.5 text-zinc-400 hover:text-zinc-200 text-sm transition-colors"
          >
            Command Center
          </Link>
          <button
            onClick={onClose}
            className="p-2 bg-zinc-700 rounded-md hover:bg-zinc-600 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-zinc-100" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Report body — scrollable so full report can be read; explicit scrollbar */}
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden" style={{ scrollbarGutter: 'stable' }}>
        <StressTestReportContent
          report={report}
          cities={cities}
          onUpdateReport={(updates) => {
            setReport((prev) => (prev ? { ...prev, ...updates } : prev))
          }}
          onExportPDF={onExportPDF}
          onOpenInCascade={onOpenInCascade}
          onCascadeSectionRef={(el) => { cascadeSectionRef.current = el }}
          onClose={onClose}
          isExportingPDF={isExportingPDF}
        />
      </div>
    </div>
  )
}
