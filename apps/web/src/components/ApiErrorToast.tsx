/**
 * Global API error toast — shows the last query/mutation error so users see
 * "API temporarily unavailable" or similar without reloading.
 */
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

function getErrorMessage(error: unknown): string {
  if (error == null) return 'Something went wrong'
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) return String((error as { message: unknown }).message)
  if (error && typeof error === 'object' && 'status' in error) {
    const status = (error as { status: number }).status
    if (status >= 500) return 'Server error. Try again later.'
    if (status === 404) return 'Not found.'
    if (status >= 400) return 'Request failed.'
  }
  return 'Something went wrong'
}

export default function ApiErrorToast() {
  const queryClient = useQueryClient()
  const [lastError, setLastError] = useState<string | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const queryCache = queryClient.getQueryCache()
    const mutationCache = queryClient.getMutationCache()

    const onError = (error: unknown) => {
      const msg = getErrorMessage(error)
      setLastError(msg)
      setVisible(true)
    }

    const unsubQuery = queryCache.subscribe((event: { type?: string; action?: { type?: string; error?: unknown }; query?: { state?: { error?: unknown } } }) => {
      if (event?.type !== 'updated') return
      const err = event.action?.type === 'error' ? event.action.error : event.query?.state?.error
      if (err != null) onError(err)
    })

    const unsubMutation = mutationCache.subscribe((event: { type?: string; action?: { type?: string; error?: unknown } }) => {
      if (event?.type === 'updated' && event.action?.type === 'error' && event.action?.error != null) {
        onError(event.action.error)
      }
    })

    return () => {
      unsubQuery()
      unsubMutation()
    }
  }, [queryClient])

  if (!visible || !lastError) return null

  return (
    <div
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-md bg-zinc-800 border border-red-500/50 text-zinc-100 shadow-xl max-w-md"
      role="alert"
    >
      <span className="text-sm flex-1">{lastError}</span>
      <button
        type="button"
        onClick={() => { setVisible(false); setLastError(null) }}
        className="text-zinc-400 hover:text-white text-sm font-medium px-2 py-0.5 rounded"
      >
        Dismiss
      </button>
    </div>
  )
}
