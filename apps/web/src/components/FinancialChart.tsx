/**
 * Financial Charts using Plotly for 3D visualizations.
 * 
 * Supports:
 * - 3D scatter plots (risk vs return)
 * - Surface plots (scenario analysis)
 * - Efficient frontier charts
 */
import { useMemo } from 'react'
import Plot from 'react-plotly.js'
import { motion } from 'framer-motion'

interface FinancialChartProps {
  type: 'scatter3d' | 'surface' | 'efficient_frontier' | 'mesh3d'
  data: any
  title?: string
  height?: number
}

export default function FinancialChart({
  type,
  data,
  title,
  height = 400,
}: FinancialChartProps) {
  const plotData = useMemo(() => {
    // If data is already a Plotly trace object, use it directly
    if (data && data.type) {
      return [data]
    }
    
    // If data is array of trace objects
    if (Array.isArray(data) && data[0]?.type) {
      return data
    }
    
    switch (type) {
      case 'scatter3d':
        // Check if raw Plotly data
        if (data.x && data.y && data.z) {
          return [{
            type: 'scatter3d',
            mode: data.mode || 'markers',
            x: data.x,
            y: data.y,
            z: data.z,
            marker: data.marker || { size: 5, colorscale: 'Viridis' },
          }]
        }
        // Standard data format
        return [
          {
            type: 'scatter3d',
            mode: 'markers',
            x: data.map((d: any) => d.climate_risk),
            y: data.map((d: any) => d.physical_risk),
            z: data.map((d: any) => d.valuation),
            marker: {
              size: 5,
              color: data.map((d: any) => d.composite_risk),
              colorscale: 'RdYlGn',
              reversescale: true,
              colorbar: {
                title: 'Risk Score',
              },
            },
            text: data.map((d: any) => d.name),
            hovertemplate: '<b>%{text}</b><br>' +
              'Climate: %{x}<br>' +
              'Physical: %{y}<br>' +
              'Valuation: €%{z:,.0f}<br>' +
              '<extra></extra>',
          },
        ]
      
      case 'surface':
        // Check if raw Plotly data
        if (data.z && !Array.isArray(data.z[0]?.value)) {
          return [{
            type: 'surface',
            z: data.z,
            colorscale: 'Viridis',
            showscale: true,
          }]
        }
        // Surface plot for scenario analysis
        return [
          {
            type: 'surface',
            z: data.map((row: any) => row.map((cell: any) => typeof cell === 'object' ? cell.value : cell)),
            colorscale: 'Viridis',
            showscale: true,
          },
        ]
      
      case 'mesh3d':
        return [{
          type: 'mesh3d',
          x: data.x,
          y: data.y,
          z: data.z,
          intensity: data.z,
          colorscale: 'Viridis',
          opacity: 0.8,
        }]
      
      case 'efficient_frontier':
        // Efficient frontier for portfolio optimization
        return [
          {
            type: 'scatter',
            mode: 'lines',
            x: data.map((d: any) => d.risk),
            y: data.map((d: any) => d.return),
            name: 'Efficient Frontier',
            line: { color: '#0056e6', width: 2 },
          },
          {
            type: 'scatter',
            mode: 'markers',
            x: data.map((d: any) => d.risk),
            y: data.map((d: any) => d.return),
            marker: { size: 8, color: '#00e6b8' },
            name: 'Portfolio',
          },
        ]
      
      default:
        return []
    }
  }, [type, data])

  const layout = useMemo(() => ({
    title: title || '',
    paper_bgcolor: 'rgba(10, 15, 26, 0)',
    plot_bgcolor: 'rgba(10, 15, 26, 0)',
    font: { color: '#e5e7eb' },
    scene: type === 'scatter3d' || type === 'surface' ? {
      xaxis: { title: 'Climate Risk', gridcolor: '#1f2937' },
      yaxis: { title: 'Physical Risk', gridcolor: '#1f2937' },
      zaxis: { title: 'Valuation', gridcolor: '#1f2937' },
      bgcolor: 'rgba(10, 15, 26, 0)',
    } : undefined,
    xaxis: type === 'efficient_frontier' ? {
      title: 'Risk',
      gridcolor: '#1f2937',
    } : undefined,
    yaxis: type === 'efficient_frontier' ? {
      title: 'Return',
      gridcolor: '#1f2937',
    } : undefined,
    margin: { l: 50, r: 50, t: 50, b: 50 },
    height,
  }), [type, title, height])

  const config = {
    displayModeBar: true,
    displaylogo: false,
    modeBarButtonsToRemove: ['pan2d', 'lasso2d'],
    responsive: true,
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full glass rounded-xl p-4"
    >
      <Plot
        data={plotData}
        layout={layout}
        config={config}
        style={{ width: '100%', height: '100%' }}
      />
    </motion.div>
  )
}
