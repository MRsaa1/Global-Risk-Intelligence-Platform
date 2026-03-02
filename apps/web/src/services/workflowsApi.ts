/**
 * Agent OS Workflows API — /api/v1/developer/workflows
 */

const API_BASE = '/api/v1/developer/workflows'

export interface WorkflowStep {
  name: string
  agent: string
  action: string
  timeout_seconds?: number
  depends_on?: string[]
  condition?: string
}

export interface WorkflowTemplate {
  id: string
  name: string
  description: string
  steps?: WorkflowStep[]
  steps_count?: number
  tags?: string[]
  version?: string
}

export interface WorkflowRun {
  id?: string
  run_id?: string
  template_id: string
  status: 'pending' | 'running' | 'completed' | 'failed'
  steps_completed: number | string[]
  steps_failed: number | string[]
  started_at: number | string
  completed_at?: number | string | null
  results?: Record<string, unknown>
  duration_seconds?: number
}

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new Error((err as { detail?: string }).detail || res.statusText)
  }
  return res.json()
}

export async function listTemplates(): Promise<{ templates: WorkflowTemplate[] }> {
  return request<{ templates: WorkflowTemplate[] }>('/templates')
}

export async function getTemplate(templateId: string): Promise<WorkflowTemplate> {
  return request<WorkflowTemplate>(`/templates/${encodeURIComponent(templateId)}`)
}

export async function startWorkflow(
  templateId: string,
  params?: Record<string, unknown>,
): Promise<WorkflowRun> {
  return request<WorkflowRun>('/run', {
    method: 'POST',
    body: JSON.stringify({ template_id: templateId, params }),
  })
}

export async function listRuns(limit?: number): Promise<{ runs: WorkflowRun[] }> {
  const q = limit != null ? `?limit=${limit}` : ''
  return request<{ runs: WorkflowRun[] }>(`/runs${q}`)
}

export async function getRunStatus(runId: string): Promise<WorkflowRun> {
  return request<WorkflowRun>(`/runs/${encodeURIComponent(runId)}`)
}
