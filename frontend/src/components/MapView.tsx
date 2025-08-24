import React, { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Mapbox access token from environment
const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN;

interface PlaceResult {
  name: string;
  address: string;
  rating?: number;
  place_id: string;
  location?: {
    lat: number;
    lng: number;
  };
}

interface MapViewProps {
  results: PlaceResult[];
  className?: string;
}

export default function MapView({ results, className = '' }: MapViewProps) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markers = useRef<mapboxgl.Marker[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN) return;

    // Set Mapbox access token
    mapboxgl.accessToken = MAPBOX_TOKEN;

    // Initialize map
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [-118.2437, 34.0522], // Default to Los Angeles
      zoom: 10,
    });

    map.current.on('load', () => {
      setIsLoaded(true);
    });

    // Add navigation controls
    map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

    return () => {
      if (map.current) {
        map.current.remove();
      }
    };
  }, []);

  // Update markers when results change
  useEffect(() => {
    if (!map.current || !isLoaded) return;

    // Clear existing markers
    markers.current.forEach(marker => marker.remove());
    markers.current = [];

    // Add markers for results with location data
    const validResults = results.filter(result => result.location);
    
    if (validResults.length === 0) return;

    const bounds = new mapboxgl.LngLatBounds();

    validResults.forEach((result) => {
      if (!result.location) return;

      const { lat, lng } = result.location;

      // Create popup content
      const popupContent = `
        <div class="p-3 min-w-[200px]">
          <h3 class="font-semibold text-sm mb-1">${result.name}</h3>
          <p class="text-xs text-gray-600 mb-2">${result.address}</p>
          ${result.rating ? `
            <div class="flex items-center gap-1">
              <span class="text-yellow-500">★</span>
              <span class="text-xs">${result.rating}/5</span>
            </div>
          ` : ''}
        </div>
      `;

      // Create popup
      const popup = new mapboxgl.Popup({
        closeButton: true,
        closeOnClick: false,
        maxWidth: '300px'
      }).setHTML(popupContent);

      // Create marker
      const marker = new mapboxgl.Marker({
        color: '#3B82F6', // Blue color
        scale: 0.8
      })
        .setLngLat([lng, lat])
        .setPopup(popup)
        .addTo(map.current!);

      markers.current.push(marker);
      bounds.extend([lng, lat]);
    });

    // Fit map to show all markers
    if (validResults.length > 1) {
      map.current.fitBounds(bounds, {
        padding: 50,
        maxZoom: 15
      });
    } else if (validResults.length === 1) {
      // For single result, center on it
      const { lat, lng } = validResults[0].location!;
      map.current.setCenter([lng, lat]);
      map.current.setZoom(14);
    }
  }, [results, isLoaded]);

  // Show placeholder if no Mapbox token
  if (!MAPBOX_TOKEN) {
    return (
      <div className={`bg-gray-100 flex items-center justify-center ${className}`}>
        <div className="text-center p-8">
          <div className="text-gray-400 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-sm text-gray-500">Map requires Mapbox token</p>
          <p className="text-xs text-gray-400 mt-1">Set VITE_MAPBOX_TOKEN in .env</p>
        </div>
      </div>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <div ref={mapContainer} className="w-full h-full" />
      
      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-gray-100 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
            <p className="text-sm text-gray-500">Loading map...</p>
          </div>
        </div>
      )}

      {/* Results count badge */}
      {isLoaded && results.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-md px-3 py-2">
          <p className="text-sm font-medium">
            {results.filter(r => r.location).length} of {results.length} locations
          </p>
        </div>
      )}
    </div>
  );
}
