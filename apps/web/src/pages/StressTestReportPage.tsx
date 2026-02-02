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

  const onExportPDF = useCallback(async () => {
    if (!report) return
    setIsExportingPDF(true)
    try {
      const pdfRequest = {
        test_name: report.eventName,
        city_name: report.cityName,
        test_type: report.eventType,
        severity: report.zones.length > 0
          ? Math.max(...report.zones.map(z =>
              z.riskLevel === 'critical' ? 0.9 : z.riskLevel === 'high' ? 0.7 : z.riskLevel === 'medium' ? 0.5 : 0.3
            ))
          : 0.5,
        zones: report.zones.map(z => ({
          name: z.label,
          zone_level: z.riskLevel,
          affected_assets_count: z.affectedBuildings,
          expected_loss: z.estimatedLoss,
          population_affected: z.populationAffected,
        })),
        actions: report.mitigationActions.map(a => ({
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
      }
      const response = await fetch('/api/v1/stress/report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pdfRequest),
      })
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
      console.error('PDF export failed:', e)
      alert('PDF export failed. Please try again.')
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
      <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-center p-8">
        <h1 className="text-xl font-medium mb-2">No report data</h1>
        <p className="text-white/60 text-sm text-center max-w-md mb-6">
          Complete a stress test in Digital Twin and click View Report to open the report here.
        </p>
        <Link
          to="/command"
          className="px-4 py-2 bg-amber-500/20 text-amber-400 rounded-lg text-sm hover:bg-amber-500/30 transition-colors"
        >
          Go to Command Center
        </Link>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col">
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 shrink-0">
        <div>
          <h1 className="text-white text-lg font-medium">Stress Test Report</h1>
          <p className="text-white/50 text-sm">{report.cityName} • {report.eventName}</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/command"
            className="px-3 py-1.5 text-white/60 hover:text-white/80 text-sm transition-colors"
          >
            Command Center
          </Link>
          <button
            onClick={onClose}
            className="p-2 bg-white/10 rounded-lg hover:bg-white/20 transition-colors"
            title="Close"
          >
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Report body */}
      <div className="flex-1 overflow-hidden">
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
