import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { listScenarios, runScenario, listRuns, getFSTStatus } from './fstApi'

function ok(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) } as Response
}

describe('fstApi', () => {
  beforeEach(() => mockFetch.mockReset())
  afterEach(() => vi.restoreAllMocks())

  it('listScenarios fetches scenarios', async () => {
    const scenarios = [{ id: 'eba_2024', name: 'EBA 2024', description: 'test' }]
    mockFetch.mockResolvedValueOnce(ok(scenarios))
    const result = await listScenarios()
    expect(result).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/fst/scenarios', expect.anything())
  })

  it('runScenario posts scenario', async () => {
    const response = { fst_run_id: 'run-1', report: { loss: 1e9 } }
    mockFetch.mockResolvedValueOnce(ok(response))
    const result = await runScenario({ scenario_id: 'eba_2024' })
    expect(result.fst_run_id).toBe('run-1')
  })

  it('listRuns with pagination', async () => {
    mockFetch.mockResolvedValueOnce(ok([{ id: 'run-1' }]))
    const runs = await listRuns({ limit: 10, offset: 0 })
    expect(runs).toHaveLength(1)
    expect(mockFetch).toHaveBeenCalledWith('/api/v1/fst/runs?limit=10&offset=0', expect.anything())
  })

  it('getFSTStatus returns module status', async () => {
    mockFetch.mockResolvedValueOnce(ok({ module: 'fst', enabled: true, scenarios_count: 25 }))
    const status = await getFSTStatus()
    expect(status.module).toBe('fst')
    expect(status.scenarios_count).toBe(25)
  })
})
