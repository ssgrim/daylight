import sqlite3 from 'sqlite3'
import { open } from 'sqlite'
import path from 'path'
import fs from 'fs'

const DB_PATH = path.resolve(process.cwd(), 'backend', 'external_history.sqlite')

export async function initDb() {
  try {
    // ensure parent directory exists (fixes SQLITE_CANTOPEN when running from different cwd)
    const dir = path.dirname(DB_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    // ensure file exists (sqlite will create it, but ensure permissions)
    try { fs.openSync(DB_PATH, 'a').close() } catch (e) { /* ignore */ }
    const db = await open({ filename: DB_PATH, driver: sqlite3.Database })
    await db.exec(`CREATE TABLE IF NOT EXISTS history (id INTEGER PRIMARY KEY, ts TEXT, type TEXT, provider TEXT, lat REAL, lng REAL, ok INTEGER, error TEXT)`)
    return db
  } catch (err) {
    console.warn('initDb failed', String(err))
    throw err
  }
}

export async function appendDb(db, entry) {
  await db.run('INSERT INTO history (ts,type,provider,lat,lng,ok,error) VALUES (?,?,?,?,?,?,?)', entry.ts, entry.type, entry.provider, entry.lat, entry.lng, entry.ok ? 1 : 0, entry.error || null)
}

export async function queryHistory(db, limit = 100) {
  return db.all('SELECT * FROM history ORDER BY id DESC LIMIT ?', limit)
}
