/**
 * API service for communicating with backend
 */

import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:9002/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export interface Scenario {
  scenario_id: string;
  name: string;
  description?: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Calculation {
  calculation_id: string;
  scenario_id: string;
  portfolio_id: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  results?: any;
  created_at?: string;
  completed_at?: string;
}

export interface Portfolio {
  portfolio_id: string;
  portfolio_name: string;
  as_of_date: string;
  total_notional: number;
  total_market_value: number;
  total_rwa: number;
  position_count: number;
}

export const scenariosApi = {
  list: () => api.get<Scenario[]>('/v1/scenarios'),
  get: (id: string) => api.get<Scenario>(`/v1/scenarios/${id}`),
  create: (scenario: Partial<Scenario>) => api.post<Scenario>('/v1/scenarios', scenario),
  update: (id: string, scenario: Partial<Scenario>) =>
    api.put<Scenario>(`/v1/scenarios/${id}`, scenario),
  delete: (id: string) => api.delete(`/v1/scenarios/${id}`),
};

export const calculationsApi = {
  list: () => api.get<Calculation[]>('/v1/calculations'),
  get: (id: string) => api.get<Calculation>(`/v1/calculations/${id}`),
  create: (calculation: { scenario_id: string; portfolio_id: string }) =>
    api.post<Calculation>('/v1/calculate', calculation),
  cancel: (id: string) => api.post(`/v1/calculations/${id}/cancel`),
};

export const portfoliosApi = {
  list: () => api.get<Portfolio[]>('/v1/portfolios'),
  get: (id: string) => api.get<Portfolio>(`/v1/portfolios/${id}`),
};

export default api;

