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
      caches.open('daylight-v1').then(cache =>
        cache.match(event.request).then(resp =>
          resp || fetch(event.request).then(response => {
            cache.put(event.request, response.clone())
            return response
          })
        )
      )
    )
  }
})
