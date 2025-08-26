import React, { useEffect, useState, Suspense } from 'react'
import { Link } from 'react-router-dom'
import UserMenu from '../components/UserMenu'
import { apiService, type Trip, type CreateTripRequest } from '../services/apiService'
import { useAuthStore } from '../stores/authStore'
import type { Suggestion } from '../../../shared/src/types/daylight'
import { t, useLocale, type Locale } from '../i18n'

// Lazy load the Map component to reduce initial bundle size
const Map = React.lazy(() => import('../components/Map'))

// Map loading component
const MapLoader = () => (
  <div className="h-96 bg-gray-100 rounded-md flex items-center justify-center">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
      <p className="text-gray-600 text-sm">Loading map...</p>
    </div>
  </div>
)

export default function Plan() {
  const { user } = useAuthStore()
  const { locale, setLocale } = useLocale()
  
  // Existing state
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [latInput, setLatInput] = useState('47.6062')
  const [lngInput, setLngInput] = useState('-122.3321')
  const [showEvents, setShowEvents] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  const [selected, setSelected] = useState<Suggestion | null>(null)
  
  // New trip management state
  const [trips, setTrips] = useState<Trip[]>([])
  const [tripsLoading, setTripsLoading] = useState(false)
  const [showCreateTrip, setShowCreateTrip] = useState(false)
  const [newTripTitle, setNewTripTitle] = useState('')
  const [newTripDescription, setNewTripDescription] = useState('')

  // Map state
  const [mapCenter, setMapCenter] = useState<[number, number]>([Number(latInput), Number(lngInput)])
  const [mapZoom, setMapZoom] = useState(10)
  const [mapBounds, setMapBounds] = useState<[[number, number], [number, number]] | null>(null)
  const [regions, setRegions] = useState<Array<{ id: string; name: string; urls: string[]; createdAt: number }>>([])
  const [downloadingRegionId, setDownloadingRegionId] = useState<string | null>(null)

  // Update map center when lat/lng input changes
  useEffect(() => {
    setMapCenter([Number(latInput), Number(lngInput)])
  }, [latInput, lngInput])

  // Helper to compute slippy map tile x,y from lat/lng and zoom
  const lat2tile = (lat: number, zoom: number) => {
    const z = Math.pow(2, zoom)
    const xtile = Math.floor(((lngInput ? Number(lngInput) : 0) + 180) / 360 * z)
    const ytile = Math.floor((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * z)
    return { x: xtile, y: ytile }
  }

  const getTileUrlsForBounds = (bounds: [[number, number], [number, number]] | null, zoom: number) => {
    if (!bounds) return []
    const [sw, ne] = bounds
    const min = lat2tile(ne[0], Math.round(zoom))
    const max = lat2tile(sw[0], Math.round(zoom))
    const urls: string[] = []
    const z = Math.round(zoom)
    for (let x = Math.min(min.x, max.x); x <= Math.max(min.x, max.x); x++) {
      for (let y = Math.min(min.y, max.y); y <= Math.max(min.y, max.y); y++) {
        // Using OSM tile server for dev; respect tile usage in production
        urls.push(`https://tile.openstreetmap.org/${z}/${x}/${y}.png`)
      }
    }
    return urls
  }

    // Regions management helpers (using tilesDb)
    useEffect(() => {
      ;(async () => {
        try {
          const mod = await import('../lib/tilesDb')
          const rs = await mod.listRegions()
          setRegions(rs || [])
        } catch (e) {
          // ignore
        }
      })()
    }, [])

  // Markers for map
  const markers = suggestions.map((s) => ({
    id: s.id,
    lat: Number(latInput),
    lng: Number(lngInput),
    label: s.title
  }))

  // Load trips on component mount
  useEffect(() => {
    const loadTrips = async () => {
      setTripsLoading(true)
      try {
        const userTrips = await apiService.getTrips()
        setTrips(userTrips)
      } catch (error: any) {
        console.error('Failed to load trips:', error)
        // Don't set error for trips loading failure - the API might not be available yet
      } finally {
        setTripsLoading(false)
      }
    }

    if (user) {
      loadTrips()
    }
  }, [user])

  // Load suggestions (existing functionality) 
  useEffect(() => {
    fetchWithCoords(Number(latInput), Number(lngInput))
  }, [])

  const fetchWithCoords = async (lat: number, lng: number) => {
    setLoading(true)
    setError(null)
    const base = (import.meta as any).env?.VITE_API_BASE || ''
    const url = `${base}/plan?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}`
    try {
      const res = await fetch(url)
      if (!res.ok) throw new Error(`status ${res.status}`)
      const data = await res.json()
      if (Array.isArray(data)) setSuggestions(data)
      else setError('unexpected response shape')
    } catch (err: any) {
      // fallback demo so the page shows something without a backend running
      setSuggestions([
        {
          id: 'demo1',
          title: 'Pike Place Market',
          start: new Date().toISOString(),
          end: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
          score: 0.9,
          reason: 'Historic public market with fresh seafood and local crafts'
        },
        {
          id: 'demo2', 
          title: 'Space Needle',
          start: new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString(),
          end: new Date(Date.now() + 5 * 60 * 60 * 1000).toISOString(),
          score: 0.85,
          reason: 'Iconic observation tower with 360-degree city views'
        }
      ])
      setError(String(err.message ?? err))
    } finally {
      setLoading(false)
    }
  }

  const handleCreateTrip = async () => {
    if (!newTripTitle.trim()) return

    try {
      const tripData: CreateTripRequest = {
        title: newTripTitle,
        description: newTripDescription,
        startDate: new Date().toISOString(),
        endDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days from now
        locations: [`${latInput},${lngInput}`],
        isPublic: false
      }

      const newTrip = await apiService.createTrip(tripData)
      setTrips([...trips, newTrip])
      setNewTripTitle('')
      setNewTripDescription('')
      setShowCreateTrip(false)
    } catch (error: any) {
      console.error('Failed to create trip:', error)
      alert('Failed to create trip: ' + error.message)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link to="/" className="text-2xl font-bold text-gray-900">
                {t('title')}
              </Link>
              <span className="text-gray-500">•</span>
              <h1 className="text-xl font-medium text-gray-700">{t('planner')}</h1>
            </div>
            
            <div className="flex items-center space-x-4">
              {/* Language selector */}
              <div className="flex items-center">
                <label className="mr-2 text-sm text-gray-600">Lang:</label>
                <select 
                  value={locale} 
                  onChange={e => setLocale(e.target.value as Locale)} 
                  className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">EN</option>
                  <option value="es">ES</option>
                </select>
              </div>

              <UserMenu />
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto p-6">
        {/* Trip Management Section */}
        {user && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">My Trips</h2>
              <button
                onClick={() => setShowCreateTrip(!showCreateTrip)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Create Trip
              </button>
            </div>

            {showCreateTrip && (
              <div className="mb-4 p-4 bg-gray-50 rounded-md">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Trip Title
                    </label>
                    <input
                      type="text"
                      value={newTripTitle}
                      onChange={(e) => setNewTripTitle(e.target.value)}
                      placeholder="Enter trip title"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description (Optional)
                    </label>
                    <input
                      type="text"
                      value={newTripDescription}
                      onChange={(e) => setNewTripDescription(e.target.value)}
                      placeholder="Enter trip description"
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div className="mt-4 flex space-x-2">
                  <button
                    onClick={handleCreateTrip}
                    disabled={!newTripTitle.trim()}
                    className="bg-green-600 text-white px-4 py-2 rounded-md text-sm font-medium hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Create
                  </button>
                  <button
                    onClick={() => {
                      setShowCreateTrip(false)
                      setNewTripTitle('')
                      setNewTripDescription('')
                    }}
                    className="bg-gray-300 text-gray-700 px-4 py-2 rounded-md text-sm font-medium hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-500"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {tripsLoading ? (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
                <p className="text-gray-600 mt-2 text-sm">Loading trips...</p>
              </div>
            ) : trips.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {trips.map((trip) => (
                  <div key={trip.id} className="border border-gray-200 rounded-md p-4 hover:shadow-md transition-shadow">
                    <h3 className="font-medium text-gray-900 mb-1">{trip.title}</h3>
                    {trip.description && (
                      <p className="text-sm text-gray-600 mb-2">{trip.description}</p>
                    )}
                    <div className="text-xs text-gray-500">
                      <p>Created: {new Date(trip.createdAt).toLocaleDateString()}</p>
                      <p>Locations: {trip.locations.length}</p>
                      <p className="capitalize">Visibility: {trip.isPublic ? 'Public' : 'Private'}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                <p>No trips created yet. Create your first trip to get started!</p>
              </div>
            )}
          </div>
        )}

        {/* Map Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Explore Location</h2>
          <div className="mb-4">
            <Suspense fallback={<MapLoader />}>
              <Map
                center={mapCenter}
                zoom={mapZoom}
                markers={markers}
                onViewportChange={(center, zoom, bounds) => {
                  setMapCenter(center)
                  setMapZoom(zoom)
                  setMapBounds(bounds)
                }}
              />
            </Suspense>
            <div className="mt-2">
              <div className="flex items-center gap-2">
                <button
                  className="px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                  onClick={async () => {
                    const urls = getTileUrlsForBounds(mapBounds, mapZoom)
                    if (urls.length === 0) return alert('No tiles calculated for current viewport')
                    const id = `region-${Date.now()}`
                    setDownloadingRegionId(id)
                    // save region metadata first
                    try {
                      const mod = await import('../lib/tilesDb')
                      await mod.putRegion(id, { name: `Region ${new Date().toLocaleString()}`, urls, zoom: mapZoom, bounds: mapBounds })
                      setRegions((r) => [...r, { id, name: `Region ${new Date().toLocaleString()}`, urls, createdAt: Date.now() }])
                    } catch (e) {
                      // ignore
                    }
                    // trigger SW download
                    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                      navigator.serviceWorker.controller.postMessage({ type: 'DOWNLOAD_TILES', urls })
                    } else if ('serviceWorker' in navigator) {
                      navigator.serviceWorker.ready.then(reg => {
                        reg.active && reg.active.postMessage({ type: 'DOWNLOAD_TILES', urls })
                      })
                    } else {
                      alert('Service worker not available in this browser')
                    }
                    setDownloadingRegionId(null)
                  }}
                >
                  Download visible tiles for offline use
                </button>

                <div className="text-sm text-gray-500">{regions.length} offline region(s)</div>
              </div>
            </div>
            {mapBounds && (
              <div className="text-xs text-gray-500 mt-2">
                Viewport: [{mapBounds[0][0].toFixed(4)}, {mapBounds[0][1].toFixed(4)}] - [{mapBounds[1][0].toFixed(4)}, {mapBounds[1][1].toFixed(4)}]
              </div>
            )}
          </div>

            {/* Regions management */}
            <div className="mt-4 bg-gray-50 p-4 rounded">
              <h3 className="text-sm font-medium mb-2">Offline Regions</h3>
              {regions.length === 0 ? (
                <div className="text-sm text-gray-500">No regions downloaded yet.</div>
              ) : (
                <div className="space-y-2">
                  {regions.map(r => (
                    <div key={r.id} className="flex items-center justify-between border border-gray-200 rounded p-2">
                      <div>
                        <div className="font-medium text-sm">{r.name}</div>
                        <div className="text-xs text-gray-500">Tiles: {r.urls.length} • Downloaded: {new Date(r.createdAt).toLocaleString()}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          className="px-2 py-1 text-sm bg-red-600 text-white rounded"
                          onClick={async () => {
                            if (!confirm('Delete this region and its cached tiles?')) return
                            try {
                              if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                                navigator.serviceWorker.controller.postMessage({ type: 'DELETE_REGION', urls: r.urls })
                              } else if ('serviceWorker' in navigator) {
                                const reg = await navigator.serviceWorker.ready
                                reg.active && reg.active.postMessage({ type: 'DELETE_REGION', urls: r.urls })
                              }
                              const mod = await import('../lib/tilesDb')
                              await mod.deleteRegion(r.id)
                              setRegions(rs => rs.filter(x => x.id !== r.id))
                            } catch (e) {
                              // ignore
                            }
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          {/* Location controls */}
          <div className="flex flex-wrap gap-2 items-center mb-4">
            <label className="text-sm font-medium text-gray-700">{t('lat')}</label>
            <input 
              className="border border-gray-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={latInput} 
              onChange={(e) => setLatInput(e.target.value)} 
            />
            <label className="text-sm font-medium text-gray-700">{t('lng')}</label>
            <input 
              className="border border-gray-300 px-2 py-1 rounded focus:outline-none focus:ring-2 focus:ring-blue-500" 
              value={lngInput} 
              onChange={(e) => setLngInput(e.target.value)} 
            />
            <button 
              className="px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              onClick={() => fetchWithCoords(Number(latInput), Number(lngInput))}
            >
              {t('fetch')}
            </button>
            <button 
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              onClick={() => { setLatInput('47.6062'); setLngInput('-122.3321') }}
            >
              {t('seattle')}
            </button>
            <button 
              className="px-3 py-1 border border-gray-300 rounded hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500" 
              onClick={() => { setLatInput('37.7749'); setLngInput('-122.4194') }}
            >
              {t('sanfrancisco')}
            </button>
          </div>

          {/* Display options */}
          <div className="flex gap-4 mb-4">
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={showEvents} 
                onChange={(e) => setShowEvents(e.target.checked)} 
                className="rounded focus:ring-2 focus:ring-blue-500"
              /> 
              {t('showEvents')}
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input 
                type="checkbox" 
                checked={showTraffic} 
                onChange={(e) => setShowTraffic(e.target.checked)}
                className="rounded focus:ring-2 focus:ring-blue-500" 
              /> 
              {t('showTraffic')}
            </label>
          </div>
        </div>

        {/* Suggestions Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Suggestions</h2>
          
          {loading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">{t('loading')}</p>
            </div>
          ) : error ? (
            <div>
              <p className="text-yellow-600 mb-4">{t('unableToLoad')} ({error}) — showing demo results.</p>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="space-y-3">
                  {suggestions.map((s) => (
                    <div key={s.id} className="p-3 border border-gray-200 rounded-md">
                      <div className="font-medium">{s.title} <span className="text-sm text-gray-500">({s.score})</span></div>
                      <div className="text-sm text-gray-600">{s.start} → {s.end}</div>
                      {s.reason && <div className="text-sm text-gray-500 mt-1">{s.reason}</div>}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="space-y-3">
                {suggestions.map((s) => (
                  <div 
                    key={s.id} 
                    className={`p-3 border rounded-md cursor-pointer transition-colors ${
                      selected?.id === s.id ? 'bg-blue-50 border-blue-400' : 'border-gray-200 hover:bg-gray-50'
                    }`} 
                    onClick={() => setSelected(s)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-medium">{s.title} <span className="text-sm text-gray-500">({s.score})</span></div>
                      {s.season && (
                        <div className={`px-2 py-0.5 rounded text-xs ${
                          s.season.season === 'summer' 
                            ? 'bg-yellow-200 text-yellow-800' 
                            : s.season.season === 'winter' 
                            ? 'bg-blue-200 text-blue-800' 
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {s.season.season}
                        </div>
                      )}
                    </div>
                    <div className="text-sm text-gray-600">{s.start} → {s.end}</div>
                    {s.reason && <div className="text-sm text-gray-500 mt-1">{s.reason}</div>}
                    {s.season && (
                      <div className="text-xs text-gray-400 mt-1">Season: {s.season.season} ({s.season.hemisphere})</div>
                    )}
                  </div>
                ))}
              </div>

              {/* Details panel */}
              {selected && (
                <div className="border border-gray-200 rounded-md p-4">
                  <h3 className="font-semibold text-lg mb-2">{selected.title}</h3>
                  <div className="text-sm text-gray-600 mb-2">{selected.start} → {selected.end}</div>
                  {selected.reason && <p className="text-gray-700 mb-3">{selected.reason}</p>}
                  
                  {showEvents && selected.events?.events && (
                    <div className="mb-4">
                      <h4 className="font-medium mb-2">{t('nearbyEvents')}</h4>
                      <div className="space-y-2">
                        {selected.events.events.map((e: any, idx: number) => (
                          <div key={e.id || idx} className="flex gap-2 p-2 border border-gray-200 rounded">
                            {e.image ? (
                              <img src={e.image} alt={e.name} className="w-16 h-12 object-cover rounded" />
                            ) : (
                              <div className="w-16 h-12 bg-gray-100 rounded" />
                            )}
                            <div>
                              <div className="font-medium text-sm">{e.name}</div>
                              <div className="text-xs text-gray-500">
                                {e.venue} {e.date ? `• ${new Date(e.date).toLocaleString()}` : ''}
                              </div>
                              {e.url && (
                                <a 
                                  className="text-xs text-blue-600 hover:text-blue-800" 
                                  href={e.url} 
                                  target="_blank" 
                                  rel="noreferrer"
                                >
                                  {t('tickets')}
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {showTraffic && selected.traffic && selected.traffic.congestion !== null && selected.traffic.congestion !== undefined && (
                    <div>
                      <h4 className="font-medium mb-2">Traffic Information</h4>
                      <p className="text-sm text-gray-600">
                        Congestion level: {((selected.traffic.congestion ?? 0) * 100).toFixed(0)}%
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
