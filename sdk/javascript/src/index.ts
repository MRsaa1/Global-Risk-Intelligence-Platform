/**
 * @pfrp/sdk - TypeScript SDK for the Physical-Financial Risk Platform.
 *
 * Usage:
 *   import { PFRPClient } from '@pfrp/sdk';
 *   const client = new PFRPClient('https://api.example.com', { apiKey: 'pfrp_...' });
 *   const assets = await client.assets.list();
 */

export interface PFRPConfig {
  apiKey?: string;
  token?: string;
  timeout?: number;
}

class BaseResource {
  constructor(protected client: PFRPClient) {}

  protected async get<T = any>(path: string, params?: Record<string, string>): Promise<T> {
    return this.client.request<T>('GET', path, { params });
  }

  protected async post<T = any>(path: string, body?: any): Promise<T> {
    return this.client.request<T>('POST', path, { body });
  }

  protected async patch<T = any>(path: string, body?: any): Promise<T> {
    return this.client.request<T>('PATCH', path, { body });
  }

  protected async del<T = any>(path: string): Promise<T> {
    return this.client.request<T>('DELETE', path);
  }
}

export class Assets extends BaseResource {
  list(params?: { limit?: number; offset?: number }) {
    return this.get('/api/v1/assets', params as any);
  }
  get(id: string) { return this.get(`/api/v1/assets/${id}`); }
  create(data: any) { return this.post('/api/v1/assets', data); }
}

export class StressTests extends BaseResource {
  run(scenarioType: string, params?: Record<string, any>) {
    return this.post('/api/v1/stress-tests/run', { scenario_type: scenarioType, params });
  }
  listRuns(limit = 50) { return this.get('/api/v1/stress-tests/runs', { limit: String(limit) }); }
}

export class PARS extends BaseResource {
  export(limit = 10000) { return this.get('/api/v1/pars/export/assets', { limit: String(limit) }); }
  validate(doc: any) { return this.post('/api/v1/pars/validate', doc); }
  import(items: any[], upsert = false) {
    return this.post('/api/v1/pars/import', { items, upsert });
  }
  schema() { return this.get('/api/v1/pars/schema'); }
}

export class SRS extends BaseResource {
  listFunds(countryCode?: string) {
    const params: any = {};
    if (countryCode) params.country_code = countryCode;
    return this.get('/api/v1/srs/funds', params);
  }
  runScenario(scenarioType: string, countryCode?: string, params?: any) {
    return this.post('/api/v1/srs/scenarios/run', {
      scenario_type: scenarioType, country_code: countryCode, params,
    });
  }
  heatmap() { return this.get('/api/v1/srs/heatmap'); }
}

export class Workflows extends BaseResource {
  listTemplates() { return this.get('/api/v1/developer/workflows/templates'); }
  start(templateId: string, context?: any) {
    return this.post('/api/v1/developer/workflows/run', { template_id: templateId, context });
  }
  getRun(runId: string) { return this.get(`/api/v1/developer/workflows/runs/${runId}`); }
}

export class PFRPClient {
  private baseUrl: string;
  private config: PFRPConfig;

  assets: Assets;
  stressTests: StressTests;
  pars: PARS;
  srs: SRS;
  workflows: Workflows;

  constructor(baseUrl: string, config: PFRPConfig = {}) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.config = config;

    this.assets = new Assets(this);
    this.stressTests = new StressTests(this);
    this.pars = new PARS(this);
    this.srs = new SRS(this);
    this.workflows = new Workflows(this);
  }

  async request<T = any>(
    method: string,
    path: string,
    options?: { params?: Record<string, string>; body?: any },
  ): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    if (options?.params) {
      for (const [k, v] of Object.entries(options.params)) {
        url.searchParams.set(k, v);
      }
    }
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (this.config.token) headers['Authorization'] = `Bearer ${this.config.token}`;
    else if (this.config.apiKey) headers['X-API-Key'] = this.config.apiKey;

    const res = await fetch(url.toString(), {
      method,
      headers,
      body: options?.body ? JSON.stringify(options.body) : undefined,
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    return res.json();
  }
}
