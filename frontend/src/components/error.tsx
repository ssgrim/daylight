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
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    }
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    this.setState({
      error,
      errorInfo
    })
    console.error(`Error in ${this.props.componentName || 'component'}:`, error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="error-boundary p-4 border border-red-300 bg-red-50 rounded-lg">
          <h3 className="text-red-800 font-semibold mb-2">
            Something went wrong in {this.props.componentName || 'this component'}
          </h3>
          <details className="text-sm text-red-700">
            <summary className="cursor-pointer mb-2">Error details</summary>
            <pre className="whitespace-pre-wrap text-xs bg-red-100 p-2 rounded">
              {this.state.error && this.state.error.toString()}
              {this.state.errorInfo && this.state.errorInfo.componentStack}
            </pre>
          </details>
          <button 
            onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
            className="mt-2 px-3 py-1 bg-red-600 text-white text-sm rounded hover:bg-red-700"
          >
            Try again
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

interface AsyncErrorState<T> {
  loading: boolean
  error: Error | null
  data: T | null
}

interface UseAsyncErrorReturn<T> extends AsyncErrorState<T> {
  setError: (error: Error | null) => void
  setLoading: (loading: boolean) => void
  setData: (data: T | null) => void
  clearError: () => void
  execute: (asyncFn: () => Promise<T>) => Promise<void>
  hasError: boolean
}

export function useAsyncError<T = any>(): UseAsyncErrorReturn<T> {
  const [state, setState] = useState<AsyncErrorState<T>>({
    loading: false,
    error: null,
    data: null
  })

  const setError = useCallback((error: Error | null) => {
    setState(prev => ({ ...prev, error, loading: false }))
  }, [])

  const setLoading = useCallback((loading: boolean) => {
    setState(prev => ({ ...prev, loading }))
  }, [])

  const setData = useCallback((data: T | null) => {
    setState(prev => ({ ...prev, data, loading: false, error: null }))
  }, [])

  const clearError = useCallback(() => {
    setState(prev => ({ ...prev, error: null }))
  }, [])

  const execute = useCallback(async (asyncFn: () => Promise<T>) => {
    setState(prev => ({ ...prev, loading: true, error: null }))
    try {
      const result = await asyncFn()
      setState(prev => ({ ...prev, data: result, loading: false, error: null }))
    } catch (error) {
      setState(prev => ({ ...prev, error: error as Error, loading: false }))
    }
  }, [])

  return {
    ...state,
    setError,
    setLoading,
    setData,
    clearError,
    execute,
    hasError: state.error !== null
  }
}

export default ComponentErrorBoundary
