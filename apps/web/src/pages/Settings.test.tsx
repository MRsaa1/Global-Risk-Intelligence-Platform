import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '../test/test-utils'
import Settings from './Settings'

vi.mock('../lib/auth', () => ({
  authService: {
    isGuest: () => true,
    getCurrentUser: () => Promise.resolve({ email: 'test@corp.com', full_name: 'Test User', role: 'admin' }),
  },
}))

vi.mock('../lib/api', () => ({
  preferencesApi: {
    getSettings: () => Promise.resolve({
      theme: 'dark', language: 'en', timezone: 'UTC',
      date_format: 'YYYY-MM-DD', number_format: 'en-US',
      email_alerts: true, push_notifications: true,
      alert_severity_threshold: 'warning', default_dashboard: 'main',
    }),
    updateSettings: vi.fn(() => Promise.resolve({ status: 'ok' })),
  },
  auditApi: {
    queryLogs: () => Promise.resolve({ items: [] }),
  },
}))

vi.mock('framer-motion', () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
  },
}))

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders without crashing (smoke)', () => {
    const { container } = render(<Settings />)
    expect(container).toBeInTheDocument()
  })

  it('renders all 8 section navigation items', () => {
    render(<Settings />)
    expect(screen.getByText('User Profile & Identity')).toBeInTheDocument()
    expect(screen.getByText('API & Integrations')).toBeInTheDocument()
    expect(screen.getByText('Security & Access Control')).toBeInTheDocument()
    expect(screen.getByText('Notifications & Alerts')).toBeInTheDocument()
    expect(screen.getByText('Data Configuration')).toBeInTheDocument()
    expect(screen.getByText('Display & Workspace')).toBeInTheDocument()
    expect(screen.getByText('Compliance & Audit')).toBeInTheDocument()
    expect(screen.getByText('Platform Administration')).toBeInTheDocument()
  })

  it('shows Settings heading', () => {
    render(<Settings />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('shows Save All button', () => {
    render(<Settings />)
    expect(screen.getByText('Save All')).toBeInTheDocument()
  })

  it('switches section on nav click', () => {
    render(<Settings />)
    fireEvent.click(screen.getByText('Security & Access Control'))
    expect(screen.getByText('2FA (TOTP)')).toBeInTheDocument()
    expect(screen.getByText('SSO / SAML')).toBeInTheDocument()
  })

  it('shows API providers on default section', () => {
    render(<Settings />)
    expect(screen.getByText('Climate Data API')).toBeInTheDocument()
    expect(screen.getByText('Satellite Imagery API')).toBeInTheDocument()
  })

  it('shows RBAC matrix in security section', () => {
    render(<Settings />)
    fireEvent.click(screen.getByText('Security & Access Control'))
    expect(screen.getByText('Role-Based Access Control (RBAC)')).toBeInTheDocument()
    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Viewer')).toBeInTheDocument()
  })

  it('shows notification toggles', () => {
    render(<Settings />)
    fireEvent.click(screen.getByText('Notifications & Alerts'))
    expect(screen.getByText('Climate risk alerts')).toBeInTheDocument()
    expect(screen.getByText('Weekly digest')).toBeInTheDocument()
  })

  it('shows platform admin system health', () => {
    render(<Settings />)
    fireEvent.click(screen.getByText('Platform Administration'))
    expect(screen.getByText('API Gateway')).toBeInTheDocument()
    expect(screen.getByText('Database')).toBeInTheDocument()
  })
})
