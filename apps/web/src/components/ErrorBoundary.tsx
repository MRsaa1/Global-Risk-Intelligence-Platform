import { Component, ErrorInfo, ReactNode } from 'react'
import { ExclamationTriangleIcon } from '@heroicons/react/24/outline'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    }
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
    this.setState({
      error,
      errorInfo,
    })
    
    // Log to error tracking service (e.g., Sentry)
    // logErrorToService(error, errorInfo)
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-8">
          <div className="max-w-2xl w-full glass rounded-md p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="p-3 bg-red-500/20 rounded-md">
                <ExclamationTriangleIcon className="w-8 h-8 text-red-400" />
              </div>
              <div>
                <h1 className="text-2xl font-display font-bold">Something went wrong</h1>
                <p className="text-zinc-500 mt-1">
                  An unexpected error occurred. Please try again.
                </p>
              </div>
            </div>

            {this.state.error && (
              <div className="mb-6 p-4 bg-zinc-950 rounded-md">
                <p className="text-sm font-mono text-red-400 mb-2">
                  {this.state.error.name}: {this.state.error.message}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-4">
                    <summary className="text-sm text-zinc-500 cursor-pointer">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-zinc-500 overflow-auto max-h-64">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            {this.state.error?.message?.includes('Failed to fetch dynamically imported module') && (
              <p className="mb-4 text-sm text-zinc-400">
                Часто из‑за 504 (Outdated Optimize Dep), сброса кэша после перезапуска dev-сервера или ERR_NETWORK_CHANGED (сеть/VPN).
                <br />
                <strong>Что сделать:</strong> закройте все вкладки с приложением и откройте заново <a href="http://127.0.0.1:5180" className="text-emerald-400 hover:underline">http://127.0.0.1:5180</a>. Убедитесь, что запущены и Vite (<code className="bg-zinc-800 px-1 rounded">npm run dev</code> в <code className="bg-zinc-800 px-1 rounded">apps/web</code>), и API на порту 9002 (<code className="bg-zinc-800 px-1 rounded">cd apps/api && source .venv/bin/activate && uvicorn src.main:app --port 9002</code>).
              </p>
            )}
            <div className="flex flex-wrap gap-4">
              {this.state.error?.message?.includes('Failed to fetch dynamically imported module') && (
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-emerald-600 text-white rounded-md font-medium hover:bg-emerald-500 transition-colors"
                >
                  Reload page
                </button>
              )}
              <button
                onClick={this.handleReset}
                className="px-4 py-2 bg-zinc-600 text-zinc-100 rounded-md font-medium hover:bg-zinc-500 transition-colors"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.href = '/'}
                className="px-4 py-2 bg-zinc-900 border border-zinc-800 text-zinc-100 rounded-md font-medium hover:bg-zinc-950 transition-colors"
              >
                Go Home
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
