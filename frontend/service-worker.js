// This is the service worker file for enabling offline capabilities.

const CACHE_NAME = 'offline-cache-v1';
const OFFLINE_URLS = [
  '/',
  '/index.html',
  '/styles.css',
  '/script.js',
  '/offline.html',
];

// Install event: Cache offline resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(OFFLINE_URLS);
    })
  );
});

// Fetch event: Serve cached resources when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request).then((networkResponse) => {
        return caches.open(CACHE_NAME).then((cache) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      });
    }).catch(() => {
      return caches.match('/offline.html');
    })
  );
});

// Activate event: Clean up old caches
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!cacheWhitelist.includes(cacheName)) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Function to manage storage quota and cleanup
async function manageStorageQuota() {
  const cacheNames = await caches.keys();
  let totalSize = 0;

  for (const cacheName of cacheNames) {
    const cache = await caches.open(cacheName);
    const requests = await cache.keys();

    for (const request of requests) {
      const response = await cache.match(request);
      if (response) {
        const size = parseInt(response.headers.get('content-length') || '0', 10);
        totalSize += size;
      }
    }
  }

  const maxQuota = 50 * 1024 * 1024; // 50 MB
  if (totalSize > maxQuota) {
    console.warn('Storage quota exceeded. Cleaning up caches...');
    for (const cacheName of cacheNames) {
      await caches.delete(cacheName);
    }
  }
}

// Periodically check storage quota
self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'manage-storage-quota') {
    event.waitUntil(manageStorageQuota());
  }
});

// Function to download and cache offline map regions
async function cacheMapRegion(regionUrl) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(regionUrl);
    if (response.ok) {
      await cache.put(regionUrl, response);
      console.log(`Map region cached: ${regionUrl}`);
    } else {
      console.error(`Failed to fetch map region: ${regionUrl}`);
    }
  } catch (error) {
    console.error(`Error caching map region: ${regionUrl}`, error);
  }
}

// Example usage: Cache a specific map region
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'CACHE_MAP_REGION') {
    cacheMapRegion(event.data.regionUrl);
  }
});

importScripts('/background-sync.js');
