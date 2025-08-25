import React, { Component, ReactNode, useState, useCallback } from 'react'

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
  errorInfo: React.ErrorInfo | null
}

interface ComponentErrorBoundaryProps {
  children: ReactNode
  componentName?: string
  fallback?: ReactNode
}

export class ComponentErrorBoundary extends Component<ComponentErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ComponentErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null, errorInfo: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error, errorInfo: null }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({ errorInfo })
    console.error(`Error in ${this.props.componentName || 'Component'}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-4 border border-red-200 rounded-lg bg-red-50">
          <h3 className="text-red-800 font-semibold mb-2">
            {this.props.componentName ? `Error in ${this.props.componentName}` : 'Component Error'}
          </h3>
          <p className="text-red-700 text-sm mb-3">
            {this.state.error?.message || 'An unexpected error occurred'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
          >
            Retry
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

interface AsyncErrorState<T> {
  loading: boolean
  data: T | null
  error: Error | null
  hasError: boolean
}

interface UseAsyncErrorReturn<T> extends AsyncErrorState<T> {
  execute: (asyncFn: () => Promise<T>) => Promise<void>
  reset: () => void
}

export function useAsyncError<T = any>(): UseAsyncErrorReturn<T> {
  const [state, setState] = useState<AsyncErrorState<T>>({
    loading: false,
    data: null,
    error: null,
    hasError: false
  })

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null, hasError: false }))
    
    try {
      const result = await asyncFn()
      setState({
        loading: false,
        data: result,
        error: null,
        hasError: false
      })
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error))
      setState({
        loading: false,
        data: null,
        error: err,
        hasError: true
      })
    }
  }, [])

  const reset = useCallback(() => {
    setState({
      loading: false,
      data: null,
      error: null,
      hasError: false
    })
  }, [])

  return {
    ...state,
    execute,
    reset
  }
}
