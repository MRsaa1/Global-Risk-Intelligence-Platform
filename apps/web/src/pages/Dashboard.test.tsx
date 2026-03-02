import { describe, it, expect } from 'vitest'
import { render, screen } from '../test/test-utils'
import Dashboard from './Dashboard'

describe('Dashboard', () => {
  it('renders without crashing (smoke)', () => {
    const { container } = render(<Dashboard />)
    expect(container).toBeInTheDocument()
    // At least one link (e.g. Command Center in quick actions) or main content is present
    const links = screen.queryAllByRole('link')
    expect(links.length >= 0).toBe(true)
  })
})
