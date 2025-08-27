// This script sets up background sync for trip data using the Background Sync API.

const SYNC_TAG = 'trip-data-sync';
const MAX_RETRIES = 3;

self.addEventListener('sync', (event) => {
  if (event.tag === SYNC_TAG) {
    event.waitUntil(syncTripData());
  }
});

async function syncTripData() {
  let retries = 0;
  while (retries < MAX_RETRIES) {
    try {
      const response = await fetch('/api/sync-trip-data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // Add any necessary data for syncing here
        }),
      });

      if (response.ok) {
        console.log('Trip data synced successfully.');
        return;
      } else {
        console.error('Failed to sync trip data:', response.statusText);
      }
    } catch (error) {
      console.error('Error during trip data sync:', error);
    }
    retries++;
    await new Promise((resolve) => setTimeout(resolve, 2000)); // Wait 2 seconds before retrying
  }
  console.error('Max retries reached. Sync failed.');
}

// Register the sync event when the user goes offline
self.addEventListener('fetch', (event) => {
  if (!navigator.onLine) {
    event.waitUntil(
      self.registration.sync.register(SYNC_TAG).then(() => {
        console.log('Background sync registered for trip data.');
      }).catch((error) => {
        console.error('Failed to register background sync:', error);
      })
    );
  }
});
