/**
 * CuRAG Card — GPU-accelerated document RAG status and document indexing.
 * Shows GET /api/v1/rag/status and allows POST /api/v1/rag/documents via modal.
 */
import { useState, useEffect } from 'react'
import { DocumentPlusIcon, CubeTransparentIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { getApiV1Base } from '../../config/env'

interface RagStatus {
  enable_curag: boolean
  available: boolean
  curag_index_path: string
}

export default function CuRAGCard() {
  const [status, setStatus] = useState<RagStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [modalOpen, setModalOpen] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [files, setFiles] = useState<FileList | null>(null)
  const [textsJson, setTextsJson] = useState('')
  const [result, setResult] = useState<{ indexed_count: number; skipped: number; errors: string[] } | null>(null)

  const base = getApiV1Base()

  useEffect(() => {
    let cancelled = false
    async function fetchStatus() {
      try {
        const res = await fetch(`${base}/rag/status`)
        if (res.ok && !cancelled) {
          const data = await res.json()
          setStatus(data)
        }
      } catch (_e) {
        if (!cancelled) setStatus(null)
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    fetchStatus()
    return () => { cancelled = true }
  }, [base])

  const handleUpload = async () => {
    if (!files?.length && !textsJson.trim()) return
    setUploading(true)
    setResult(null)
    try {
      const form = new FormData()
      if (files) {
        for (let i = 0; i < files.length; i++) form.append('files', files[i])
      }
      if (textsJson.trim()) form.append('texts_json', textsJson.trim())
      const res = await fetch(`${base}/rag/documents`, { method: 'POST', body: form })
      const data = await res.json().catch(() => ({}))
      if (res.ok) {
        setResult({ indexed_count: data.indexed_count ?? 0, skipped: data.skipped ?? 0, errors: data.errors ?? [] })
        setFiles(null)
        setTextsJson('')
        if (status) setStatus({ ...status, available: true })
      } else {
        setResult({ indexed_count: 0, skipped: 0, errors: [data.detail || res.statusText] })
      }
    } catch (e) {
      setResult({ indexed_count: 0, skipped: 0, errors: [String(e)] })
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return (
      <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <CubeTransparentIcon className="w-4 h-4 animate-pulse" />
          Loading RAG status…
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="rounded-md bg-zinc-900 border border-zinc-800 p-4">
        <div className="flex items-center justify-between gap-2 mb-2">
          <h3 className="text-sm font-display font-semibold text-zinc-300 flex items-center gap-2">
            <CubeTransparentIcon className="w-4 h-4 text-violet-400/80" />
            Document RAG (cuRAG)
          </h3>
          <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${status?.available ? 'bg-emerald-500/20 text-emerald-400' : status?.enable_curag ? 'bg-amber-500/20 text-amber-400' : 'bg-zinc-700 text-zinc-500'}`}>
            {status?.available ? 'Available' : status?.enable_curag ? 'Disabled (no nvidia-rag)' : 'Off'}
          </span>
        </div>
        <p className="text-[11px] text-zinc-500 mb-3">
          GPU-accelerated indexing for PDFs and text. Index path: {status?.curag_index_path || '—'}
        </p>
        {(!status?.enable_curag || !status?.available) && (
          <p className="text-[10px] text-zinc-500 mb-2">
            To enable: set ENABLE_CURAG=true in API .env and install nvidia-rag (pip install nvidia-rag).
          </p>
        )}
        <button
          type="button"
          onClick={() => setModalOpen(true)}
          disabled={!status?.enable_curag}
          className="inline-flex items-center gap-1.5 px-2 py-1.5 rounded text-xs font-medium bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <DocumentPlusIcon className="w-3.5 h-3.5" />
          Index documents
        </button>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => setModalOpen(false)}>
          <div className="rounded-lg bg-zinc-900 border border-zinc-700 shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-zinc-200">Index documents for cuRAG</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 rounded text-zinc-500 hover:text-zinc-300">
                <XMarkIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3 text-sm">
              <div>
                <label className="block text-zinc-500 text-xs mb-1">PDF or text files</label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.txt"
                  onChange={(e) => setFiles(e.target.files || null)}
                  className="w-full text-zinc-400 file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:bg-zinc-700 file:text-zinc-200 file:text-xs"
                />
              </div>
              <div>
                <label className="block text-zinc-500 text-xs mb-1">Or paste JSON array of strings (optional)</label>
                <textarea
                  value={textsJson}
                  onChange={(e) => setTextsJson(e.target.value)}
                  placeholder='["Snippet 1", "Snippet 2"]'
                  rows={2}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded text-zinc-200 placeholder:text-zinc-500 text-xs font-mono"
                />
              </div>
              {result && (
                <div className={`p-2 rounded text-xs ${result.errors.length ? 'bg-amber-500/10 text-amber-300' : 'bg-zinc-800 text-zinc-300'}`}>
                  Indexed: {result.indexed_count}, skipped: {result.skipped}
                  {result.errors.length > 0 && <div className="mt-1">Errors: {result.errors.join(', ')}</div>}
                </div>
              )}
            </div>
            <div className="flex gap-2 mt-4">
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading || (!files?.length && !textsJson.trim())}
                className="px-3 py-1.5 rounded bg-violet-600 text-white text-xs font-medium hover:bg-violet-500 disabled:opacity-50"
              >
                {uploading ? 'Uploading…' : 'Upload'}
              </button>
              <button type="button" onClick={() => setModalOpen(false)} className="px-3 py-1.5 rounded border border-zinc-600 text-zinc-400 text-xs">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
