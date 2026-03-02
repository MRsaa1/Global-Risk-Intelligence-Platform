import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '../test/test-utils'
import CommandCenter from './CommandCenter'

vi.mock('../components/CesiumGlobe', () => ({
  default: () => React.createElement('div', { 'data-testid': 'cesium-globe-mock' }, 'Globe'),
  RiskZone: {},
  ZoneAsset: {},
}))
vi.mock('../lib/useWebSocket', () => ({
  useWebSocket: () => ({ lastUpdate: null, connected: false }),
}))
vi.mock('../components/DigitalTwinPanel', () => ({ default: () => null }))
vi.mock('../components/EventRiskGraph', () => ({ default: () => null }))

describe('CommandCenter', () => {
  it('renders without crashing (smoke)', () => {
    render(<CommandCenter />)
    expect(screen.getByTestId('cesium-globe-mock')).toBeInTheDocument()
  })
})
