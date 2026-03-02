/**
 * AI Models — NeMo Customizer model registry and fine-tuning job management.
 */
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { motion } from 'framer-motion'
import {
  CpuChipIcon,
  ArrowPathIcon,
  PlayIcon,
  TrashIcon,
  CheckCircleIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline'

const API = '/api/v1/agents/fine-tuning'
const CC_CARD = 'rounded-md bg-zinc-900 border border-zinc-800 p-5'
const CC_LABEL = 'font-mono text-[10px] uppercase tracking-widest text-zinc-500'
const BTN = 'px-4 py-2 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-sm hover:bg-zinc-700 transition-colors'

interface Dataset {
  id: string
  name: string
  records: number
  quality_score?: number
  created_at: string
}

interface FineTuneJob {
  job_id: string
  dataset_id: string
  status: string
  model_id?: string
  metrics?: Record<string, number>
  created_at?: string
}

async function fetchJson<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options?.headers },
  })
  if (!res.ok) throw new Error(`API error ${res.status}`)
  return res.json()
}

export default function AIModels() {
  const [tab, setTab] = useState<'models' | 'datasets' | 'jobs'>('models')
  const qc = useQueryClient()

  const { data: datasets = [] } = useQuery<Dataset[]>({
    queryKey: ['finetune', 'datasets'],
    queryFn: () => fetchJson('/datasets'),
  })

  const { data: settings } = useQuery<Record<string, unknown>>({
    queryKey: ['finetune', 'settings'],
    queryFn: () => fetchJson('/settings'),
  })

  const runMutation = useMutation({
    mutationFn: (datasetId: string) =>
      fetchJson<FineTuneJob>('/run', {
        method: 'POST',
        body: JSON.stringify({ dataset_id: datasetId, epochs: 3 }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['finetune'] }),
  })

  const tabs = [
    { id: 'models' as const, label: 'Model Registry' },
    { id: 'datasets' as const, label: 'Datasets' },
    { id: 'jobs' as const, label: 'Training Jobs' },
  ]

  return (
    <div className="min-h-full p-6 bg-zinc-950 text-zinc-100 pb-16">
      <div className="w-full max-w-[1400px] mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-zinc-800 rounded-md border border-zinc-700">
            <SparklesIcon className="w-8 h-8 text-zinc-400" />
          </div>
          <div>
            <h1 className="text-2xl font-display font-semibold text-zinc-100">AI Models</h1>
            <p className="text-zinc-500 text-sm mt-1">NeMo Customizer — fine-tuning, model registry, A/B testing</p>
          </div>
        </div>

        {/* Status strip */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800">
            <span className={CC_LABEL}>Client model</span>
            <span className={`text-xs font-mono ${settings?.client_model_enabled ? 'text-emerald-400' : 'text-zinc-500'}`}>
              {settings?.client_model_enabled ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-md bg-zinc-900 border border-zinc-800">
            <span className={CC_LABEL}>Datasets</span>
            <span className="text-xs font-mono text-zinc-300">{datasets.length}</span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-zinc-800">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2 text-sm font-sans transition-colors border-b-2 ${
                tab === t.id
                  ? 'border-zinc-400 text-zinc-100'
                  : 'border-transparent text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'models' && <ModelsTab />}
        {tab === 'datasets' && <DatasetsTab datasets={datasets} onTrain={(id) => runMutation.mutate(id)} training={runMutation.isPending} />}
        {tab === 'jobs' && <JobsTab />}
      </div>
    </div>
  )
}

function ModelsTab() {
  const { data, isLoading } = useQuery({
    queryKey: ['finetune', 'models'],
    queryFn: async () => {
      const res = await fetch('/api/v1/agents/fine-tuning/settings')
      if (!res.ok) return { models: [] }
      const settings = await res.json()
      return { models: settings.available_models ?? [] }
    },
  })

  if (isLoading) return <p className="text-zinc-500 text-sm">Loading models...</p>

  const models = (data?.models ?? []) as Array<{ model_id: string; dataset_id?: string; status?: string; created_at?: string; metrics?: Record<string, number> }>

  if (models.length === 0) {
    return (
      <div className={CC_CARD}>
        <div className="text-center py-8">
          <CpuChipIcon className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-500 text-sm">No models in registry.</p>
          <p className="text-zinc-600 text-xs mt-1">Upload a dataset and run fine-tuning to create your first model.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {models.map((m, i) => (
        <motion.div key={m.model_id || i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={CC_CARD}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CpuChipIcon className="w-5 h-5 text-zinc-500" />
              <div>
                <p className="text-zinc-100 text-sm font-medium">{m.model_id}</p>
                {m.dataset_id && <p className="text-zinc-500 text-xs">Dataset: {m.dataset_id}</p>}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2 py-1 rounded text-[10px] font-mono ${m.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-800 text-zinc-500'}`}>
                {m.status ?? 'available'}
              </span>
            </div>
          </div>
          {m.metrics && Object.keys(m.metrics).length > 0 && (
            <div className="flex gap-4 mt-3 text-[10px] font-mono text-zinc-500">
              {Object.entries(m.metrics).map(([k, v]) => (
                <span key={k}>{k}: {typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
              ))}
            </div>
          )}
        </motion.div>
      ))}
    </div>
  )
}

function DatasetsTab({
  datasets,
  onTrain,
  training,
}: {
  datasets: Dataset[]
  onTrain: (id: string) => void
  training: boolean
}) {
  const [showUpload, setShowUpload] = useState(false)
  const qc = useQueryClient()

  const uploadMutation = useMutation({
    mutationFn: async (formData: { name: string; records: string }) => {
      const res = await fetch(`${API}/datasets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          data: formData.records.split('\n').filter(Boolean).map((line) => {
            try { return JSON.parse(line) } catch { return { text: line } }
          }),
        }),
      })
      if (!res.ok) throw new Error('Upload failed')
      return res.json()
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['finetune', 'datasets'] })
      setShowUpload(false)
    },
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className={CC_LABEL}>{datasets.length} datasets</span>
        <button onClick={() => setShowUpload(true)} className={BTN}>+ Upload Dataset</button>
      </div>

      {showUpload && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={CC_CARD}>
          <h3 className="text-sm font-medium text-zinc-200 mb-3">Upload Training Dataset</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const form = e.target as HTMLFormElement
              uploadMutation.mutate({
                name: (form.querySelector('[name=name]') as HTMLInputElement).value,
                records: (form.querySelector('[name=records]') as HTMLTextAreaElement).value,
              })
            }}
            className="space-y-3"
          >
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Dataset name</label>
              <input name="name" required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm" placeholder="e.g. client-risk-assessments-2026" />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Records (JSONL — one JSON object per line)</label>
              <textarea name="records" rows={6} required className="w-full px-3 py-2 rounded-md bg-zinc-800 border border-zinc-600 text-zinc-100 text-sm font-mono" placeholder={'{"prompt": "Assess flood risk for...", "completion": "Based on CMIP6..."}\n{"prompt": "...", "completion": "..."}'} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={uploadMutation.isPending} className={BTN}>
                {uploadMutation.isPending ? 'Uploading...' : 'Upload'}
              </button>
              <button type="button" onClick={() => setShowUpload(false)} className="px-4 py-2 rounded-md border border-zinc-700 text-zinc-400 text-sm hover:bg-zinc-800">Cancel</button>
            </div>
          </form>
        </motion.div>
      )}

      {datasets.length === 0 ? (
        <div className={CC_CARD}>
          <p className="text-zinc-500 text-sm text-center py-4">No datasets. Upload one to get started.</p>
        </div>
      ) : (
        datasets.map((ds) => (
          <div key={ds.id} className={CC_CARD}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-zinc-100 text-sm font-medium">{ds.name}</p>
                <div className="flex gap-4 mt-1 text-[10px] font-mono text-zinc-500">
                  <span>{ds.records} records</span>
                  {ds.quality_score != null && <span>Quality: {(ds.quality_score * 100).toFixed(0)}%</span>}
                  <span>Created: {new Date(ds.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => onTrain(ds.id)}
                disabled={training}
                className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-zinc-800 border border-zinc-700 text-zinc-100 text-xs hover:bg-zinc-700"
              >
                <PlayIcon className="w-3.5 h-3.5" />
                Fine-tune
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function JobsTab() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ['finetune', 'settings'],
    queryFn: async () => {
      const res = await fetch(`${API}/settings`)
      if (!res.ok) return {}
      return res.json()
    },
  })

  if (isLoading) return <p className="text-zinc-500 text-sm">Loading...</p>

  const lastRun = settings?.last_run_id
  const modelPath = settings?.client_model_path

  return (
    <div className="space-y-4">
      <div className={CC_CARD}>
        <h3 className={CC_LABEL}>Fine-tuning Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-zinc-500 text-xs">Client Model</span>
            <p className="text-zinc-100 text-sm font-mono mt-1">{settings?.client_model_enabled ? 'Active' : 'Not active'}</p>
          </div>
          <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-zinc-500 text-xs">Last Run ID</span>
            <p className="text-zinc-100 text-sm font-mono mt-1 truncate">{lastRun ?? '—'}</p>
          </div>
          <div className="p-3 rounded-md bg-zinc-800 border border-zinc-700">
            <span className="text-zinc-500 text-xs">Model Path</span>
            <p className="text-zinc-100 text-sm font-mono mt-1 truncate">{modelPath ?? '—'}</p>
          </div>
        </div>
      </div>

      <div className={CC_CARD}>
        <p className="text-zinc-500 text-sm">Training job history will appear here after runs are executed from the Datasets tab.</p>
      </div>
    </div>
  )
}
