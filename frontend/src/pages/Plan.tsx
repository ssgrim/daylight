import { useEffect, useState } from 'react'
import { 
  ComponentErrorBoundary, 
  useAsyncError, 
  useNetworkError,
  LoadingError,
  InlineError
} from '../components/error'

type Suggestion = {
  id: string
  title: string
  start: string
  end: string
  score: number
  reason?: string
  season?: { season: string; hemisphere: string }
  events?: { provider: string; events: Array<{ name: string; venue?: string; date?: string }> }
  traffic?: { provider: string; congestion?: number }
}

export default function Plan() {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [latInput, setLatInput] = useState('47.6062')
  const [lngInput, setLngInput] = useState('-122.3321')
  const [showEvents, setShowEvents] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)

  const { isOnline, networkError } = useNetworkError()
  const asyncError = useAsyncError<Suggestion[]>()

  const fetchPlanData = async (lat?: number, lng?: number) => {
    const base = (import.meta as any).env?.VITE_API_BASE || ''
    const query = lat !== undefined && lng !== undefined 
      ? `?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
      : ''
    const url = `${base}/plan${query}`

    try {
      const result = await asyncError.execute(async () => {
        const response = await fetch(url)
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }
        const data = await response.json()
        
        if (Array.isArray(data)) {
          return data
        } else {
          throw new Error('Unexpected response format')
        }
      })

      setSuggestions(result)
    } catch (error) {
      // Fallback to demo data for better UX
      console.warn('Plan fetch failed, showing demo data:', error)
      setSuggestions([
        { 
          id: 'demo-1', 
          title: 'Demo Stop', 
          start: new Date().toISOString(), 
          end: new Date().toISOString(), 
          score: 90, 
          reason: `Fallback demo data (API unavailable)` 
        }
      ])
    }
  }

  useEffect(() => {
    fetchPlanData()
  }, [])

  const handleFetchWithCoords = () => {
    const lat = Number(latInput)
    const lng = Number(lngInput)
    
    if (isNaN(lat) || isNaN(lng)) {
      asyncError.clearError()
      // You could use a form error hook here instead
      alert('Please enter valid latitude and longitude values')
      return
    }
    
    fetchPlanData(lat, lng)
  }

  const handleRetry = () => {
    fetchPlanData(Number(latInput), Number(lngInput))
  }

  return (
    <ComponentErrorBoundary componentName="Plan">
      <div className="p-6">
        <h2 className="text-xl font-semibold">Planner</h2>
        
        {/* Network Status */}
        {!isOnline && (
          <InlineError 
            message="You're currently offline. Some features may not work properly."
            onDismiss={() => {}} 
          />
        )}

        {/* Controls */}
        <div className="mt-3 flex gap-2 items-center">
          <label className="text-sm">Lat</label>
          <input 
            className="border px-2 py-1 rounded" 
            value={latInput} 
            onChange={(e) => setLatInput(e.target.value)} 
          />
          <label className="text-sm">Lng</label>
          <input 
            className="border px-2 py-1 rounded" 
            value={lngInput} 
            onChange={(e) => setLngInput(e.target.value)} 
          />
          <button 
            className="px-3 py-1 bg-sky-600 text-white rounded disabled:opacity-50" 
            onClick={handleFetchWithCoords}
            disabled={asyncError.loading || !isOnline}
          >
            {asyncError.loading ? 'Loading...' : 'Fetch'}
          </button>
          <button 
            className="ml-2 px-3 py-1 border rounded" 
            onClick={() => { setLatInput('47.6062'); setLngInput('-122.3321') }}
          >
            Seattle
          </button>
          <button 
            className="ml-2 px-3 py-1 border rounded" 
            onClick={() => { setLatInput('37.7749'); setLngInput('-122.4194') }}
          >
            San Francisco
          </button>
        </div>

        {/* Display Options */}
        <div className="mt-3 flex gap-2">
          <label className="flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              checked={showEvents} 
              onChange={(e) => setShowEvents(e.target.checked)} 
            /> 
            Show events
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input 
              type="checkbox" 
              checked={showTraffic} 
              onChange={(e) => setShowTraffic(e.target.checked)} 
            /> 
            Show traffic
          </label>
        </div>

        {/* Error State */}
        {asyncError.hasError && !asyncError.loading && (
          <div className="mt-4">
            <InlineError
              message={asyncError.error?.message || 'Failed to load plan data'}
              errorId={asyncError.errorId || undefined}
              onRetry={handleRetry}
              onDismiss={asyncError.clearError}
            />
          </div>
        )}

        {/* Loading State */}
        {asyncError.loading && (
          <div className="mt-4 flex items-center justify-center p-8">
            <div className="text-center">
              <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-slate-600">Loading suggestions…</p>
            </div>
          </div>
        )}

        {/* Suggestions */}
        {!asyncError.loading && suggestions.length > 0 && (
          <div className="mt-4">
            {asyncError.hasError && (
              <p className="text-yellow-600 mb-4">
                Showing cached or demo results due to loading error.
              </p>
            )}
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <ComponentErrorBoundary key={s.id} componentName="SuggestionItem" minimal>
                  <li className="p-3 border rounded">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">
                        {s.title} <span className="text-sm text-slate-500">({s.score})</span>
                      </div>
                      {s.season && (
                        <div className={`px-2 py-0.5 rounded text-xs ${
                          s.season.season === 'summer' 
                            ? 'bg-yellow-200 text-yellow-800' 
                            : s.season.season === 'winter' 
                            ? 'bg-sky-200 text-sky-800' 
                            : 'bg-slate-100 text-slate-800'
                        }`}>
                          {s.season.season}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-slate-600">{s.start} → {s.end}</div>
                    {s.reason && <div className="text-sm text-slate-500 mt-1">{s.reason}</div>}
                    {s.season && (
                      <div className="text-xs text-slate-400 mt-1">
                        Season: {s.season.season} ({s.season.hemisphere})
                      </div>
                    )}
                    {showEvents && s.events && s.events.events && (
                      <div className="mt-2 text-sm">
                        <div className="font-semibold">Nearby events</div>
                        <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                          {s.events.events.map((e: any, idx: number) => (
                            <ComponentErrorBoundary key={e.id || idx} componentName="EventItem" minimal>
                              <div className="flex gap-2 p-2 border rounded">
                                {e.image ? (
                                  <img 
                                    src={e.image} 
                                    alt={e.name} 
                                    className="w-16 h-12 object-cover rounded"
                                    onError={(event) => {
                                      // Handle image load errors gracefully
                                      const target = event.target as HTMLImageElement
                                      target.style.display = 'none'
                                      target.nextElementSibling?.classList.remove('hidden')
                                    }}
                                  />
                                ) : null}
                                <div className={`w-16 h-12 bg-slate-100 rounded ${e.image ? 'hidden' : ''}`} />
                                <div>
                                  <div className="font-medium">{e.name}</div>
                                  <div className="text-xs text-slate-500">
                                    {e.venue} {e.date ? `· ${new Date(e.date).toLocaleString()}` : ''}
                                  </div>
                                  {e.url && (
                                    <a 
                                      className="text-xs text-sky-600 hover:underline" 
                                      href={e.url} 
                                      target="_blank" 
                                      rel="noreferrer"
                                    >
                                      Tickets
                                    </a>
                                  )}
                                </div>
                              </div>
                            </ComponentErrorBoundary>
                          ))}
                        </div>
                      </div>
                    )}
                    {showTraffic && s.traffic && s.traffic.congestion != null && (
                      <div className="mt-2 text-sm">
                        Traffic congestion: <span className="font-semibold">{s.traffic.congestion}%</span>
                      </div>
                    )}
                  </li>
                </ComponentErrorBoundary>
              ))}
            </ul>
          </div>
        )}

        {/* Empty State */}
        {!asyncError.loading && !asyncError.hasError && suggestions.length === 0 && (
          <LoadingError
            message="No suggestions available"
            onRetry={() => fetchPlanData()}
          />
        )}
      </div>
    </ComponentErrorBoundary>
  )
}
