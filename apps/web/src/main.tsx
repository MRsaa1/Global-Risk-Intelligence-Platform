import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { analytics } from './lib/analytics'
import './index.css'

// Initialize analytics
analytics.init()

/**
 * React Query Client Configuration
 * 
 * Optimized for real-time risk platform:
 * - Aggressive stale times for slowly-changing data
 * - Smart retry logic with exponential backoff
 * - Window focus refetch disabled for stability
 * - Global error handling
 */
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache times
      staleTime: 30_000,         // 30 seconds - data considered fresh
      gcTime: 5 * 60_000,        // 5 minutes - garbage collection time (formerly cacheTime)
      
      // Retry configuration
      retry: (failureCount, error) => {
        // Don't retry on 4xx errors (client errors)
        if (error && typeof error === 'object' && 'status' in error) {
          const status = (error as { status: number }).status
          if (status >= 400 && status < 500) return false
        }
        // Retry up to 2 times for other errors
        return failureCount < 2
      },
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
      
      // Refetch behavior
      refetchOnWindowFocus: false,   // Disable automatic refetch on window focus
      refetchOnReconnect: true,      // Refetch when network reconnects
      refetchOnMount: true,          // Refetch when component mounts
      
      // Network mode
      networkMode: 'online',
    },
    mutations: {
      // Mutation retry configuration
      retry: 1,
      retryDelay: 1000,
      
      // Show error to user
      onError: (error) => {
        console.error('Mutation error:', error)
      },
    },
  },
})

// Optional: Log cache operations in development
if (import.meta.env.DEV) {
  queryClient.getQueryCache().subscribe((event) => {
    if (event.type === 'updated' && event.action.type === 'error') {
      console.warn('[QueryCache] Query error:', event.query.queryKey, event.action.error)
    }
  })
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>,
)
