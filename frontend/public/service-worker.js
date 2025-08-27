// Simple Vite PWA service worker for offline support and caching
self.addEventListener('install', event => {
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  self.clients.claim()
})

self.addEventListener('fetch', event => {
  // Cache-first for navigation and static assets
  if (event.request.method === 'GET' && (event.request.mode === 'navigate' || event.request.destination === 'script' || event.request.destination === 'style' || event.request.destination === 'image')) {
    event.respondWith(
      caches.open('daylight-v1').then(async cache => {
        const resp = await cache.match(event.request)
        if (resp) return resp
        try {
          const response = await fetch(event.request)
          cache.put(event.request, response.clone())
          return response
        } catch (e) {
          // Offline shell fallback for navigation
          if (event.request.mode === 'navigate') {
            return cache.match('/index.html')
          }
          throw e
        }
      })
    )
  }
})

// Cache tile requests (tile servers typically serve images)
self.addEventListener('fetch', event => {
  try {
    const url = new URL(event.request.url)
    if (url.pathname.startsWith('/tiles/') || url.pathname.includes('/tile/') || url.hostname.endsWith('tile.openstreetmap.org')) {
      event.respondWith(
        caches.open('daylight-tiles-v1').then(async cache => {
          const cached = await cache.match(event.request)
          if (cached) return cached
          const resp = await fetch(event.request)
          cache.put(event.request, resp.clone())
          return resp
        })
      )
    }
  } catch (e) {
    // ignore
  }
})

// Listen for messages from the page to trigger background-like tile downloads
self.addEventListener('message', event => {
  if (!event.data) return
  if (event.data.type === 'DOWNLOAD_TILES' && Array.isArray(event.data.urls)) {
    const urls = event.data.urls
    event.waitUntil(
      caches.open('daylight-tiles-v1').then(async cache => {
        for (const u of urls) {
          try {
            const r = await fetch(u)
            await cache.put(u, r.clone())
          } catch (e) {
            // continue on errors
          }
        }
      })
    )
  }
  if (event.data.type === 'DELETE_REGION' && event.data.urls && Array.isArray(event.data.urls)) {
    const urls = event.data.urls
    event.waitUntil(
      caches.open('daylight-tiles-v1').then(async cache => {
        for (const u of urls) {
          try {
            await cache.delete(u)
          } catch (e) {
            // ignore individual errors
          }
        }
      })
    )
  }
})
