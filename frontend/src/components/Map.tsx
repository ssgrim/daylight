import React, { useRef, useEffect } from 'react'
import type { Map as MaplibreMap } from 'maplibre-gl'

export interface MapProps {
  center: [number, number]
  zoom: number
  markers: Array<{ id: string, lat: number, lng: number, label?: string }>
  onViewportChange?: (center: [number, number], zoom: number, bounds: [[number, number], [number, number]]) => void
}

// MapLibre GL JS wrapper
export default function Map({ center, zoom, markers, onViewportChange }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<MaplibreMap | null>(null)

  useEffect(() => {
    let map: MaplibreMap | null = null
    let supercluster: any

    (async () => {
      const maplibregl = (await import('maplibre-gl')) as any
      supercluster = (await import('supercluster')).default

      map = new maplibregl.Map({
        container: mapRef.current!,
        style: 'https://demotiles.maplibre.org/style.json',
        center: [center[1], center[0]], // [lng, lat]
        zoom
      })

      map.on('moveend', () => {
        if (!map) return
        const c = map.getCenter()
        const z = map.getZoom()
        const b = map.getBounds()
        const bounds: [[number, number], [number, number]] = [[b.getSouthWest().lat, b.getSouthWest().lng], [b.getNorthEast().lat, b.getNorthEast().lng]]
        onViewportChange && onViewportChange([c.lat, c.lng], z, bounds)
      })

      // markers + simple clustering
      if (markers.length > 0) {
        const points = markers.map(m => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [m.lng, m.lat] }, properties: { id: m.id, label: m.label } }))
        const cluster = new supercluster({ radius: 40, maxZoom: 16 })
        cluster.load(points)
        const mapBounds = map.getBounds()
        const bbox: [number, number, number, number] = [
          mapBounds.getSouthWest().lng,
          mapBounds.getSouthWest().lat,
          mapBounds.getNorthEast().lng,
          mapBounds.getNorthEast().lat
        ]
        const clusters = cluster.getClusters(bbox, Math.round(map.getZoom()))
        clusters.forEach((c: any) => {
          const el = document.createElement('div')
          el.className = 'marker'
          el.style.background = '#0ea5e9'
          el.style.width = '18px'
          el.style.height = '18px'
          el.style.borderRadius = '50%'
          new maplibregl.Marker({ element: el })
            .setLngLat(c.geometry.coordinates)
            .setPopup(new maplibregl.Popup().setText(c.properties.label || c.properties.id))
            .addTo(map)
        })
      }

      mapInstance.current = map
    })()

    return () => {
      if (mapInstance.current) mapInstance.current.remove()
    }
  }, [center[0], center[1], zoom, markers, onViewportChange])

  return <div ref={mapRef} style={{ width: '100%', height: 400 }} />
}
