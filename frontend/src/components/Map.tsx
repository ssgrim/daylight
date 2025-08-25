import React, { useRef, useEffect } from 'react'

export interface MapProps {
  center: [number, number]
  zoom: number
  markers: Array<{ id: string, lat: number, lng: number, label?: string }>
  onViewportChange?: (center: [number, number], zoom: number, bounds: [[number, number], [number, number]]) => void
}

// Simple Mapbox GL JS wrapper (requires mapbox-gl to be installed)
export default function Map({ center, zoom, markers, onViewportChange }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<any>(null)

  useEffect(() => {
    let mapboxgl: any
    let map: any
    let markerObjs: any[] = []
    let clusterLayer: any
    let supercluster: any
    let loaded = false
    let bounds: [[number, number], [number, number]] = [[0,0],[0,0]]

    (async () => {
      mapboxgl = (await import('mapbox-gl')).default
      supercluster = (await import('supercluster')).default
      mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN
      map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/streets-v11',
        center,
        zoom
      })
      map.on('moveend', () => {
        const c = map.getCenter()
        const z = map.getZoom()
        const b = map.getBounds()
        bounds = [[b.getSouthWest().lat, b.getSouthWest().lng], [b.getNorthEast().lat, b.getNorthEast().lng]]
        onViewportChange && onViewportChange([c.lat, c.lng], z, bounds)
      })
      loaded = true
      // Add markers and clustering
      if (markers.length > 0) {
        const points = markers.map(m => ({ type: 'Feature', geometry: { type: 'Point', coordinates: [m.lng, m.lat] }, properties: { id: m.id, label: m.label } }))
        const cluster = new supercluster({ radius: 40, maxZoom: 16 })
        cluster.load(points)
        const clusters = cluster.getClusters([bounds[0][1], bounds[0][0], bounds[1][1], bounds[1][0]], Math.round(map.getZoom()))
        clusters.forEach((c: any) => {
          if (c.properties.cluster) {
            // Cluster marker
            new mapboxgl.Marker({ color: '#0ea5e9' })
              .setLngLat(c.geometry.coordinates)
              .addTo(map)
          } else {
            // Single marker
            new mapboxgl.Marker()
              .setLngLat(c.geometry.coordinates)
              .setPopup(new mapboxgl.Popup().setText(c.properties.label || c.properties.id))
              .addTo(map)
          }
        })
      }
      mapInstance.current = map
    })()
    return () => {
      if (mapInstance.current) mapInstance.current.remove()
    }
  }, [center[0], center[1], zoom, markers])

  return <div ref={mapRef} style={{ width: '100%', height: 400 }} />
}
