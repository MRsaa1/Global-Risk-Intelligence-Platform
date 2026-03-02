/**
 * xeokit-bim-viewer integration (XKT models).
 * Same visual as https://xeokit.github.io/xeokit-bim-viewer/
 * Requires XKT data in public/xeokit-data/projects (see docs/XEOKIT_INTEGRATION.md).
 */
import { useEffect, useRef, useState } from 'react'

const XEOKIT_DATA_BASE = '/xeokit-data'

export interface XeokitBIMViewerProps {
  /** Project ID from xeokit data (e.g. "Duplex", "OTCConferenceCenter"). */
  projectId: string
  /** Base URL for projects index and project JSON/XKT (default: /xeokit-data). */
  dataDir?: string
  /** Called when project loaded. */
  onLoad?: () => void
  /** Called on load error. */
  onError?: (message: string) => void
}

/**
 * Pre-validate that the project index JSON exists and is parseable
 * before handing off to xeokit (whose internal XHR callbacks throw
 * uncatchable errors when the response is not valid JSON).
 */
async function validateProjectData(
  dataDir: string,
  projectId: string,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const url = `${dataDir}/projects/${projectId}/index.json`
    const res = await fetch(url, { signal })
    if (!res.ok) {
      return { ok: false, reason: `Project data not found (HTTP ${res.status})` }
    }
    const ct = res.headers.get('content-type') ?? ''
    if (!ct.includes('json')) {
      return { ok: false, reason: 'Project index is not JSON (SPA fallback?)' }
    }
    const json = await res.json()
    if (!json || typeof json !== 'object') {
      return { ok: false, reason: 'Project index is not a valid object' }
    }
    return { ok: true }
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      return { ok: false, reason: 'Cancelled' }
    }
    return { ok: false, reason: err?.message ?? String(err) }
  }
}

export default function XeokitBIMViewer({
  projectId,
  dataDir = XEOKIT_DATA_BASE,
  onLoad,
  onError,
}: XeokitBIMViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const webglHandlersRef = useRef<{ lost: (e: Event) => void; restored: () => void } | null>(null)
  const viewerRef = useRef<any>(null)
  const serverRef = useRef<any>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [contextLost, setContextLost] = useState(false)

  useEffect(() => {
    if (!projectId || !containerRef.current) return

    setContextLost(false)
    let mounted = true
    const abortCtrl = new AbortController()
    const container = containerRef.current

    // DOM structure required by xeokit BIMViewer
    const backdrop = document.createElement('div')
    backdrop.className = 'xeokit-busy-modal-backdrop'
    backdrop.style.cssText = 'position:relative;width:100%;height:100%;display:flex;flex-direction:column;background:#09090b;'
    const explorer = document.createElement('div')
    explorer.className = 'xeokit-explorer'
    explorer.style.cssText = 'min-width:200px;max-width:280px;border-right:1px solid rgba(255,255,255,0.1);'
    const content = document.createElement('div')
    content.style.cssText = 'flex:1;display:flex;flex-direction:column;min-height:0;'
    const toolbar = document.createElement('div')
    toolbar.className = 'xeokit-toolbar'
    const canvas = document.createElement('canvas')
    canvasRef.current = canvas
    canvas.style.cssText = 'flex:1;width:100%;min-height:200px;display:block;'
    const navCube = document.createElement('canvas')
    navCube.style.cssText = 'position:absolute;bottom:16px;right:16px;width:120px;height:120px;'

    content.appendChild(toolbar)
    content.appendChild(canvas)
    content.appendChild(navCube) // NavCube is child of content
    backdrop.appendChild(explorer)
    backdrop.appendChild(content)
    container.appendChild(backdrop)

    // Suppress uncaught xeokit errors that escape from internal XHR callbacks
    // after the component unmounts and DOM elements are removed.
    const suppressXeokitError = (event: ErrorEvent) => {
      if (
        !mounted &&
        event.filename &&
        event.filename.includes('xeokit-bim-viewer')
      ) {
        event.preventDefault()
      }
    }
    window.addEventListener('error', suppressXeokitError)

    async function init() {
      try {
        // Pre-check: verify project data is available before engaging xeokit
        const check = await validateProjectData(dataDir, projectId, abortCtrl.signal)
        if (!mounted) return
        if (!check.ok) {
          setStatus('error')
          setErrorMessage(check.reason)
          onError?.(check.reason)
          return
        }

        await import('@xeokit/xeokit-bim-viewer/dist/xeokit-bim-viewer.css').catch(() => {})

        // Package ships only dist/ (no src/); named exports from dist build
        const mod = await import('@xeokit/xeokit-bim-viewer/dist/xeokit-bim-viewer.es.js')
        const Server = mod.Server
        const BIMViewer = mod.BIMViewer
        if (!Server || !BIMViewer) {
          throw new Error('xeokit-bim-viewer: Server or BIMViewer not found')
        }

        if (!mounted) return

        const server = new Server({ dataDir })
        serverRef.current = server

        const viewer = new BIMViewer(server, {
          canvasElement: canvas,
          explorerElement: explorer,
          toolbarElement: toolbar,
          navCubeCanvasElement: navCube,
          busyModelBackdropElement: backdrop,
          // Scope all internal querySelector calls to our own DOM tree,
          // preventing ID clashes across multiple viewer instances.
          containerElement: backdrop,
        })
        viewerRef.current = viewer

        const loadProject = () => {
          if (!mounted || !viewerRef.current) return
          const v = viewerRef.current
          v.loadProject(
            projectId,
            () => {
              if (!mounted || viewerRef.current !== v) return
              setStatus('ready')
              setErrorMessage(null)
              setContextLost(false)
              onLoad?.()
            },
            (errMsg: string) => {
              if (!mounted || viewerRef.current !== v) return
              setStatus('error')
              setErrorMessage(errMsg || 'Failed to load project')
              onError?.(errMsg || 'Failed to load project')
            }
          )
        }

        const onContextLost = (e: Event) => {
          e.preventDefault()
          if (mounted) setContextLost(true)
        }

        const onContextRestored = () => {
          if (!mounted || !viewerRef.current || !serverRef.current) return
          const prevViewer = viewerRef.current
          try {
            if (typeof prevViewer.unloadProject === 'function') prevViewer.unloadProject()
            if (typeof prevViewer.destroy === 'function') prevViewer.destroy()
          } catch { /* ignore */ }
          viewerRef.current = null
          const newViewer = new BIMViewer(serverRef.current, {
            canvasElement: canvas,
            explorerElement: explorer,
            toolbarElement: toolbar,
            navCubeCanvasElement: navCube,
            busyModelBackdropElement: backdrop,
            containerElement: backdrop,
          })
          viewerRef.current = newViewer
          loadProject()
        }

        webglHandlersRef.current = { lost: onContextLost, restored: onContextRestored }
        canvas.addEventListener('webglcontextlost', onContextLost, false)
        canvas.addEventListener('webglcontextrestored', onContextRestored, false)

        if (!mounted) return

        loadProject()
      } catch (err: any) {
        if (mounted) {
          setStatus('error')
          const msg = err?.message || String(err)
          setErrorMessage(msg)
          onError?.(msg)
        }
      }
    }

    init()

    return () => {
      mounted = false
      abortCtrl.abort()
      // Destroy viewer before removing DOM so pending XHR callbacks
      // still find elements (reduces null-pointer race window).
      const v = viewerRef.current
      viewerRef.current = null
      serverRef.current = null
      try {
        if (v?.unloadProject) v.unloadProject()
        if (typeof v?.destroy === 'function') v.destroy()
      } catch (_) { /* ignore */ }
      const c = canvasRef.current
      const h = webglHandlersRef.current
      if (c && h) {
        try {
          c.removeEventListener('webglcontextlost', h.lost, false)
          c.removeEventListener('webglcontextrestored', h.restored, false)
        } catch (_) { /* ignore */ }
        webglHandlersRef.current = null
        canvasRef.current = null
      }
      // Remove DOM after a short delay so any in-flight XHR callbacks
      // can still resolve without null-pointer crashes.
      setTimeout(() => {
        try {
          while (container.firstChild) container.removeChild(container.firstChild)
        } catch (_) { /* ignore */ }
        window.removeEventListener('error', suppressXeokitError)
      }, 500)
    }
  }, [projectId, dataDir, onLoad, onError])

  if (status === 'error' && errorMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] bg-zinc-950 rounded-md p-6 text-center">
        <p className="text-red-400/80 font-medium mb-2">BIM (XKT) load failed</p>
        <p className="text-sm text-zinc-400 mb-4">{errorMessage}</p>
        <p className="text-xs text-zinc-500">
          Add XKT data under <code className="text-cyan-400/80">public/xeokit-data/projects</code> and set <code className="text-cyan-400/80">projectId</code>. See docs/XEOKIT_INTEGRATION.md.
        </p>
      </div>
    )
  }

  return (
    <div className="relative w-full h-full min-h-[320px] rounded-md overflow-hidden">
      <div ref={containerRef} className="w-full h-full min-h-[320px]" />
      {contextLost && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-zinc-950/90 rounded-md"
          aria-live="polite"
        >
          <p className="text-amber-400/80 font-medium">WebGL context lost. Restoring...</p>
        </div>
      )}
    </div>
  )
}
