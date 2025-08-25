import { useEffect, useState } from 'react'
import Map from '../components/Map'
import Navigation from '../components/Navigation'
import type { Suggestion } from '../../../shared/src/types/daylight'
import { t, useLocale, type Locale } from '../i18n'

export default function Plan() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [latInput, setLatInput] = useState('47.6062')
  const [lngInput, setLngInput] = useState('-122.3321')
  const [showEvents, setShowEvents] = useState(true)
  const [showTraffic, setShowTraffic] = useState(true)
  // Details panel state
  const [selected, setSelected] = useState<Suggestion | null>(null)

  // Map state (must be after latInput/lngInput/suggestions)
  const [mapCenter, setMapCenter] = useState<[number, number]>([Number(latInput), Number(lngInput)])
  const [mapZoom, setMapZoom] = useState(10)
  const [mapBounds, setMapBounds] = useState<[[number, number], [number, number]] | null>(null)

  // Update map center when lat/lng input changes
  useEffect(() => {
    setMapCenter([Number(latInput), Number(lngInput)])
  }, [latInput, lngInput])

  // Markers for map (one per suggestion, using suggestion location if available)
  const markers = suggestions.map((s) => ({
    id: s.id,
    lat: Number(latInput),
    lng: Number(lngInput),
    label: s.title
  }))

  useEffect(() => {
  const base = (import.meta as any).env?.VITE_API_BASE || ''
    const url = `${base}/plan`
    let mounted = true
    fetch(url)
      .then(async (res) => {
        if (!res.ok) throw new Error(`status ${res.status}`)
        return res.json()
      })
      .then((data) => {
        if (!mounted) return
        if (Array.isArray(data)) setSuggestions(data)
        else setError('unexpected response shape')
      })
      .catch((err) => {
        // fallback demo so the page shows something without a backend running
        setError(String(err.message ?? err))
        setSuggestions([
          { id: 'demo-1', title: 'Demo Stop', start: new Date().toISOString(), end: new Date().toISOString(), score: 90, reason: `fallback: ${String(err.message ?? err)}` }
        ])
      })
      .finally(() => mounted && setLoading(false))

    return () => {
      mounted = false
    }
  }, [])

  async function fetchWithCoords(lat: number, lng: number) {
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
      setError(String(err.message ?? err))
    } finally {
      setLoading(false)
    }
  }


  const { locale, setLocale } = useLocale()
  return (
    <>
      <Navigation />
      <div className="p-6">
      <div className="my-6">
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
        {mapBounds && (
          <div className="text-xs text-slate-500 mt-1">Viewport: [{mapBounds[0][0].toFixed(4)}, {mapBounds[0][1].toFixed(4)}] - [{mapBounds[1][0].toFixed(4)}, {mapBounds[1][1].toFixed(4)}]</div>
        )}
      </div>
      <div className="flex justify-end mb-2">
        <label className="mr-2">Lang:</label>
        <select value={locale} onChange={e => setLocale(e.target.value as Locale)} className="border rounded px-2 py-1">
          <option value="en">EN</option>
          <option value="es">ES</option>
        </select>
      </div>
      <h2 className="text-xl font-semibold">{t('planner')}</h2>
      <div className="mt-3 flex gap-2 items-center">
        <label className="text-sm">{t('lat')}</label>
        <input className="border px-2 py-1 rounded" value={latInput} onChange={(e) => setLatInput(e.target.value)} />
        <label className="text-sm">{t('lng')}</label>
        <input className="border px-2 py-1 rounded" value={lngInput} onChange={(e) => setLngInput(e.target.value)} />
        <button className="px-3 py-1 bg-sky-600 text-white rounded" onClick={() => fetchWithCoords(Number(latInput), Number(lngInput))}>{t('fetch')}</button>
        <button className="ml-2 px-3 py-1 border rounded" onClick={() => { setLatInput('47.6062'); setLngInput('-122.3321') }}>{t('seattle')}</button>
        <button className="ml-2 px-3 py-1 border rounded" onClick={() => { setLatInput('37.7749'); setLngInput('-122.4194') }}>{t('sanfrancisco')}</button>
      </div>

      <div className="mt-3 flex gap-2">
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showEvents} onChange={(e) => setShowEvents(e.target.checked)} /> {t('showEvents')}</label>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={showTraffic} onChange={(e) => setShowTraffic(e.target.checked)} /> {t('showTraffic')}</label>
      </div>

      {loading ? (
        <p className="text-slate-600">{t('loading')}</p>
      ) : error ? (
        <div>
          <p className="text-yellow-600">{t('unableToLoad')} ({error}) — showing demo results.</p>
          <ul className="mt-4 space-y-3">
            {suggestions.map((s) => (
              <li key={s.id} className="p-3 border rounded">
                <div className="font-medium">{s.title} <span className="text-sm text-slate-500">({s.score})</span></div>
                <div className="text-sm text-slate-600">{s.start} → {s.end}</div>
                {s.reason && <div className="text-sm text-slate-500 mt-1">{s.reason}</div>}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex gap-6">
          <ul className="mt-4 space-y-3 flex-1">
            {suggestions.map((s) => (
              <li key={s.id} className={`p-3 border rounded cursor-pointer ${selected?.id === s.id ? 'bg-sky-50 border-sky-400' : ''}`} onClick={() => setSelected(s)}>
                <div className="flex items-center justify-between">
                  <div className="font-medium">{s.title} <span className="text-sm text-slate-500">({s.score})</span></div>
                  {s.season && (
                    <div className={`px-2 py-0.5 rounded text-xs ${s.season.season === 'summer' ? 'bg-yellow-200 text-yellow-800' : s.season.season === 'winter' ? 'bg-sky-200 text-sky-800' : 'bg-slate-100 text-slate-800'}`}>{s.season.season}</div>
                  )}
                </div>
                <div className="text-sm text-slate-600">{s.start} → {s.end}</div>
                {s.reason && <div className="text-sm text-slate-500 mt-1">{s.reason}</div>}
                {s.season && (
                  <div className="text-xs text-slate-400 mt-1">Season: {s.season.season} ({s.season.hemisphere})</div>
                )}
                {showEvents && s.events && s.events.events && (
                  <div className="mt-2 text-sm">
                    <div className="font-semibold">{t('nearbyEvents')}</div>
                    <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-2">
                      {s.events.events.map((e:any, idx:number) => (
                        <div key={e.id || idx} className="flex gap-2 p-2 border rounded">
                          {e.image ? <img src={e.image} alt={e.name} className="w-16 h-12 object-cover rounded" /> : <div className="w-16 h-12 bg-slate-100 rounded" />}
                          <div>
                            <div className="font-medium">{e.name}</div>
                            <div className="text-xs text-slate-500">{e.venue} {e.date ? `· ${new Date(e.date).toLocaleString()}` : ''}</div>
                            {e.url && <a className="text-xs text-sky-600" href={e.url} target="_blank" rel="noreferrer">{t('tickets')}</a>}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {showTraffic && s.traffic && s.traffic.congestion != null && (
                  <div className="mt-2 text-sm">{t('traffic')}: <span className="font-semibold">{s.traffic.congestion}%</span></div>
                )}
              </li>
            ))}
          </ul>
          {/* Details panel */}
          <div className="w-96 min-h-[200px] border rounded p-4 bg-white shadow-sm mt-4" style={{ display: selected ? 'block' : 'none' }}>
            {selected ? (
              <>
                <div className="font-bold text-lg mb-2">{selected.title}</div>
                {selected.photo && (
                  <img src={selected.photo} alt={selected.title} className="w-full h-40 object-cover rounded mb-2" />
                )}
                <div className="flex flex-wrap gap-2 mb-2 text-xs">
                  {selected.rank && <span className="bg-sky-100 text-sky-700 px-2 py-0.5 rounded">Rank #{selected.rank}</span>}
                  {selected.distanceKm != null && <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded">{selected.distanceKm.toFixed(1)} km</span>}
                  {selected.openNow != null && (
                    <span className={`px-2 py-0.5 rounded ${selected.openNow ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{selected.openNow ? 'Open now' : 'Closed'}</span>
                  )}
                </div>
                <div className="text-sm text-slate-600 mb-2">{selected.start} → {selected.end}</div>
                {selected.hours && <div className="text-sm text-slate-500 mb-1">Hours: {selected.hours}</div>}
                {selected.phone && <div className="text-sm text-slate-500 mb-1">Phone: <a href={`tel:${selected.phone}`} className="text-sky-700 underline">{selected.phone}</a></div>}
                {selected.website && <div className="text-sm text-slate-500 mb-1">Website: <a href={selected.website} className="text-sky-700 underline" target="_blank" rel="noreferrer">{selected.website}</a></div>}
                {selected.reason && <div className="text-sm text-slate-500 mb-2">{selected.reason}</div>}
              </>
            ) : null}
          </div>
        </div>
      )}
      </div>
    </>
  )
}
