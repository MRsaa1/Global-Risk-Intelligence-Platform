/**
 * Heatmap visualization using D3.js.
 * 
 * Displays:
 * - Risk correlation matrices
 * - Portfolio heatmaps
 * - Time-series heatmaps
 */
import { useEffect, useRef } from 'react'
import * as d3 from 'd3'
import { motion } from 'framer-motion'

interface HeatmapChartProps {
  data: Array<{ x: string; y: string; value: number }>
  xLabels: string[]
  yLabels: string[]
  title?: string
  colorScale?: 'RdYlGn' | 'Viridis' | 'Blues'
  width?: number
  height?: number
}

export default function HeatmapChart({
  data,
  xLabels,
  yLabels,
  title,
  colorScale = 'RdYlGn',
  width = 600,
  height = 400,
}: HeatmapChartProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return

    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()

    const margin = { top: 40, right: 40, bottom: 60, left: 60 }
    const chartWidth = width - margin.left - margin.right
    const chartHeight = height - margin.top - margin.bottom

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`)

    // Color scale
    const maxValue = d3.max(data, (d) => d.value) || 100
    const color = d3
      .scaleSequential()
      .domain([0, maxValue])
      .interpolator(
        colorScale === 'RdYlGn'
          ? d3.interpolateRdYlGn
          : colorScale === 'Viridis'
          ? d3.interpolateViridis
          : d3.interpolateBlues
      )

    // X scale
    const xScale = d3
      .scaleBand()
      .domain(xLabels)
      .range([0, chartWidth])
      .padding(0.05)

    // Y scale
    const yScale = d3
      .scaleBand()
      .domain(yLabels)
      .range([0, chartHeight])
      .padding(0.05)

    // Create cells
    g.selectAll('rect')
      .data(data)
      .enter()
      .append('rect')
      .attr('x', (d) => xScale(d.x) || 0)
      .attr('y', (d) => yScale(d.y) || 0)
      .attr('width', xScale.bandwidth())
      .attr('height', yScale.bandwidth())
      .attr('fill', (d) => color(d.value))
      .attr('stroke', '#1f2937')
      .attr('stroke-width', 1)
      .append('title')
      .text((d) => `${d.x} × ${d.y}: ${d.value?.toFixed(1) ?? 'N/A'}`)

    // X axis
    g.append('g')
      .attr('transform', `translate(0,${chartHeight})`)
      .call(d3.axisBottom(xScale))
      .selectAll('text')
      .style('fill', '#9ca3af')
      .style('font-size', '12px')

    // Y axis
    g.append('g')
      .call(d3.axisLeft(yScale))
      .selectAll('text')
      .style('fill', '#9ca3af')
      .style('font-size', '12px')

    // Title
    if (title) {
      svg
        .append('text')
        .attr('x', width / 2)
        .attr('y', 20)
        .attr('text-anchor', 'middle')
        .style('fill', '#e5e7eb')
        .style('font-size', '16px')
        .style('font-weight', 'bold')
        .text(title)
    }

    // Color legend
    const legendWidth = 200
    const legendHeight = 20
    const legend = svg
      .append('g')
      .attr('transform', `translate(${width - legendWidth - 20},${height - 40})`)

    const legendScale = d3
      .scaleLinear()
      .domain([0, maxValue])
      .range([0, legendWidth])

    const legendAxis = d3.axisBottom(legendScale).ticks(5)

    const defs = svg.append('defs')
    const gradient = defs
      .append('linearGradient')
      .attr('id', 'heatmap-gradient')
      .attr('x1', '0%')
      .attr('x2', '100%')

    gradient
      .selectAll('stop')
      .data(
        d3.range(0, 1.01, 0.1).map((t) => ({
          offset: `${t * 100}%`,
          color: color(t * maxValue),
        }))
      )
      .enter()
      .append('stop')
      .attr('offset', (d) => d.offset)
      .attr('stop-color', (d) => d.color)

    legend
      .append('rect')
      .attr('width', legendWidth)
      .attr('height', legendHeight)
      .style('fill', 'url(#heatmap-gradient)')

    legend
      .append('g')
      .attr('transform', `translate(0,${legendHeight})`)
      .call(legendAxis)
      .selectAll('text')
      .style('fill', '#9ca3af')
      .style('font-size', '10px')
  }, [data, xLabels, yLabels, title, colorScale, width, height])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="w-full h-full glass rounded-xl p-4"
    >
      <svg ref={svgRef} width={width} height={height} />
    </motion.div>
  )
}
