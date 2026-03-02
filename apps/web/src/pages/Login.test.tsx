import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '../test/test-utils'
import Login from './Login'

vi.mock('@react-three/fiber', () => ({
  Canvas: ({ children }: { children?: React.ReactNode }) => (
    <div data-testid="canvas-mock">{children}</div>
  ),
  useFrame: () => {},
}))
vi.mock('@react-three/drei', () => ({
  Sphere: () => null,
  Stars: () => null,
}))

describe('Login', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders login form (smoke)', async () => {
    render(<Login />)
    expect(screen.getByTestId('canvas-mock')).toBeInTheDocument()
    // Login form has Enter Command Center button
    expect(screen.getByRole('button', { name: /enter command center/i })).toBeInTheDocument()
  })
})
