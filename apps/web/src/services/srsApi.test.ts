import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import {
  listFunds,
  getSRSStatus,
  listScenarioTypes,
  getHeatmapData,
  getCountrySummary,
} from './srsApi'

function ok(body: unknown) {
  return { ok: true, json: () => Promise.resolve(body) } as Response
}

function notOk(status: number) {
  return { ok: false, statusText: 'Bad Request', status, json: () => Promise.resolve({ detail: 'fail' }) } as unknown as Response
}

describe('srsApi', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('listFunds makes GET request', async () => {
    const funds = [{ id: '1', name: 'Fund A' }]
    mockFetch.mockResolvedValueOnce(ok(funds))
    const result = await listFunds({ country_code: 'NO' })
    expect(mockFetch).toHaveBeenCalledWith(
      '/api/v1/srs/funds?country_code=NO',
      expect.objectContaining({ headers: expect.objectContaining({ 'Content-Type': 'application/json' }) }),
    )
    expect(result).toEqual(funds)
  })

  it('getSRSStatus returns status', async () => {
    mockFetch.mockResolvedValueOnce(ok({ module: 'srs', enabled: true, funds_count: 5 }))
    const status = await getSRSStatus()
    expect(status.module).toBe('srs')
    expect(status.enabled).toBe(true)
  })

  it('listScenarioTypes returns types', async () => {
    const types = { scenario_types: [{ id: 'solvency_stress', name: 'Solvency', description: 'test' }] }
    mockFetch.mockResolvedValueOnce(ok(types))
    const result = await listScenarioTypes()
    expect(result.scenario_types).toHaveLength(1)
  })

  it('getHeatmapData returns entries', async () => {
    mockFetch.mockResolvedValueOnce(ok([{ country_code: 'NO', total_wealth_usd: 1e12 }]))
    const data = await getHeatmapData()
    expect(data[0].country_code).toBe('NO')
  })

  it('getCountrySummary returns summary', async () => {
    mockFetch.mockResolvedValueOnce(ok({ country_code: 'SA', funds_count: 2, total_wealth_usd: 5e11 }))
    const result = await getCountrySummary('SA')
    expect(result.country_code).toBe('SA')
  })

  it('throws on non-ok response', async () => {
    mockFetch.mockResolvedValueOnce(notOk(400))
    await expect(listFunds()).rejects.toThrow('fail')
  })
})
