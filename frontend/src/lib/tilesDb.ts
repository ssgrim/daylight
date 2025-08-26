// Minimal IndexedDB helper for storing tiles and region metadata
import { openDB } from 'idb'

const DB_NAME = 'daylight-tiles'
const DB_VERSION = 1

export async function getDb() {
  return openDB(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('tiles')) {
        const s = db.createObjectStore('tiles', { keyPath: 'url' })
        s.createIndex('by-url', 'url')
      }
      if (!db.objectStoreNames.contains('regions')) {
        db.createObjectStore('regions', { keyPath: 'id' })
      }
    }
  })
}

export async function putTile(url: string, blob: Blob) {
  const db = await getDb()
  await db.put('tiles', { url, blob, createdAt: Date.now() })
}

export async function getTile(url: string) {
  const db = await getDb()
  return db.get('tiles', url)
}

export async function putRegion(id: string, meta: any) {
  const db = await getDb()
  await db.put('regions', { id, meta, createdAt: Date.now() })
}

export async function getRegion(id: string) {
  const db = await getDb()
  return db.get('regions', id)
}

export async function listTiles() {
  const db = await getDb()
  return db.getAll('tiles')
}

export async function clearOldTiles(olderThanMs: number) {
  const db = await getDb()
  const tx = db.transaction('tiles', 'readwrite')
  const store = tx.objectStore('tiles')
  const all = await store.getAll()
  for (const item of all) {
    if (Date.now() - item.createdAt > olderThanMs) {
      await store.delete(item.url)
    }
  }
  await tx.done
}
