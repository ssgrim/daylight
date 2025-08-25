// @ts-nocheck
// Lightweight adapters for external data sources (no new dependencies)
// Uses public APIs that don't require API keys by default.

import fs from "fs";
import path from "path";
// @ts-ignore
import LRU from "./lru.mjs";
// @ts-ignore
import { info, warn, error } from "./logger.mjs";
// @ts-ignore
import { getSeasonFor } from "./season.mjs";
// @ts-ignore
import { initDb, appendDb } from "./history.mjs";
// @ts-ignore
import { getSecretValue } from "./secrets.mjs";
// @ts-ignore
import { fetchLocalEvents } from "./events.mjs";
// @ts-ignore
import { fetchTraffic } from "./traffic.mjs";

const geocodeCache = LRU(500);
const HISTORY_FILE = path.resolve(
  process.cwd(),
  "backend",
  "external_history.log",
);
let dbPromise: any = null;
try {
  dbPromise = initDb();
} catch (e) {
  dbPromise = null;
}

/**
 * @param {string} url
 * @param {RequestInit} [opts]
 * @param {number} [ms]
 * @deprecated Use fetchWithCircuitBreaker instead
 */
function timeoutFetch(url: string, opts: RequestInit = {}, ms: number = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  // @ts-ignore fetch is available in Node 18+ in this dev environment
  return fetch(url, { ...opts, signal: controller.signal }).finally(() =>
    clearTimeout(id),
  );
}

/**
 * @param {() => Promise<any>} fn
 * @param {number} [attempts]
 * @param {number} [delayMs]
 * @deprecated Use fetchWithCircuitBreaker with retries instead
 */
async function retry(
  fn: () => Promise<any>,
  attempts: number = 2,
  delayMs: number = 300,
) {
  let lastErr = null;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn();
    } catch (e) {
      lastErr = e;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}

/** @param {any} entry */
function appendHistory(entry: any) {
  try {
    fs.appendFileSync(
      HISTORY_FILE,
      JSON.stringify({ ts: new Date().toISOString(), ...entry }) + "\n",
    );
  } catch (e) {
    /* ignore */
  }
}

/** @param {number} lat @param {number} lng */
export async function fetchWeather(lat: number, lng: number) {
  // provider switchable via env; default: open-meteo
  const provider = process.env.WEATHER_PROVIDER || "open-meteo";
  if (provider === "open-meteo") {
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lng)}&current_weather=true&timezone=UTC`;
    const raw = await retry(
      () => timeoutFetch(url, { method: "GET" }, 2500),
      2,
      300,
    );
    if (!raw.ok) throw new Error(`weather fetch failed: ${raw.status}`);
    const body = await raw.json();
    const cw = body.current_weather || {};
    const summary =
      cw.temperature != null
        ? `Temp ${cw.temperature}°C, wind ${cw.windspeed} km/h`
        : undefined;
    const season = getSeasonFor(lat, new Date());
    appendHistory({ type: "weather", provider, lat, lng, ok: true, season });
    return {
      temperatureC: cw.temperature,
      windSpeedKph: cw.windspeed,
      weatherCode: cw.weathercode,
      summary,
      season,
    };
  }
  // placeholder for other providers (openweathermap, etc.)
  throw new Error("unsupported weather provider");
}

export async function fetchEvents(lat: number, lng: number) {
  try {
    return await fetchLocalEvents(lat, lng);
  } catch (e) {
    return { provider: "error", events: [], error: String(e) };
  }
}

export async function fetchTrafficInfo(lat: number, lng: number) {
  try {
    return await fetchTraffic(lat, lng);
  } catch (e) {
    return { provider: "error", congestion: null, error: String(e) };
  }
}

/** @param {number} lat @param {number} lng */
export async function reverseGeocode(lat: number, lng: number) {
  const key = `${lat},${lng}`;
  const cached = geocodeCache.get(key);
  if (cached) return cached;
  const provider = process.env.GEOCODE_PROVIDER || "nominatim";
  if (provider === "nominatim") {
    const url = `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
    try {
      const raw = await retry(
        () =>
          timeoutFetch(
            url,
            {
              method: "GET",
              headers: { "User-Agent": "daylight/0.1 (+https://example.com)" },
            },
            2500,
          ),
        2,
        300,
      );
      if (!raw.ok) throw new Error(`geocode fetch failed: ${raw.status}`);
      const body = await raw.json();
      const result = { display_name: body.display_name };
      geocodeCache.set(key, result);
      const entry = { type: "geocode", provider, lat, lng, ok: true };
      if (dbPromise)
        (await dbPromise).then((db) =>
          appendDb(db, { ts: new Date().toISOString(), ...entry }),
        );
      else appendHistory(entry);
      return result;
    } catch (err) {
      const entry = {
        type: "geocode",
        provider,
        lat,
        lng,
        ok: false,
        error: String(err),
      };
      if (dbPromise)
        (await dbPromise).then((db) =>
          appendDb(db, { ts: new Date().toISOString(), ...entry }),
        );
      else appendHistory(entry);
      throw err;
    }
  }
  if (provider === "mapbox") {
    let token = process.env.MAPBOX_TOKEN;
    // if a secret ARN is provided, fetch it at runtime (dev + prod)
    const secretArn = process.env.MAPBOX_SECRET_ARN;
    if (secretArn) {
      try {
        const s = await getSecretValue(secretArn);
        if (s) token = s;
      } catch (e) {
        /* ignore */
      }
    }
    if (!token) throw new Error("MAPBOX_TOKEN not set");
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(lng)},${encodeURIComponent(lat)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    try {
      const raw = await retry(
        () => timeoutFetch(url, { method: "GET" }, 2500),
        2,
        300,
      );
      if (!raw.ok) throw new Error(`mapbox geocode failed: ${raw.status}`);
      const body = await raw.json();
      const place = body.features?.[0]?.place_name;
      const result = { display_name: place };
      geocodeCache.set(key, result);
      const entry = { type: "geocode", provider, lat, lng, ok: true };
      if (dbPromise)
        (await dbPromise).then((db) =>
          appendDb(db, { ts: new Date().toISOString(), ...entry }),
        );
      else appendHistory(entry);
      return result;
    } catch (err) {
      const entry = {
        type: "geocode",
        provider,
        lat,
        lng,
        ok: false,
        error: String(err),
      };
      if (dbPromise)
        (await dbPromise).then((db) =>
          appendDb(db, { ts: new Date().toISOString(), ...entry }),
        );
      else appendHistory(entry);
      throw err;
    }
  }
  throw new Error("unsupported geocode provider");
}
