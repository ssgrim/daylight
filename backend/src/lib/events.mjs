import { getSecretValue } from "./secrets.mjs";
import { timeoutFetch, retry } from "./external-helpers.mjs";
import { createCache } from "./cache.mjs";

const cache = createCache(30_000);

// Lightweight local events adapter
// Providers supported: 'ticketmaster' (via API key), otherwise 'mock'

export async function fetchLocalEvents(lat, lng) {
  const provider = process.env.EVENTS_PROVIDER || "mock";
  if (provider === "ticketmaster") {
    const cacheKey = `events:${lat},${lng}:tm`;
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
    // prefer SSM parameter name if present
    let key = process.env.EVENTS_API_KEY;
    const ssmParam = process.env.EVENTS_SSM_PARAMETER;
    if (ssmParam)
      key = (await getSecretValue(ssmParam, { fromSSM: true })) || key;
    const secretArn = process.env.EVENTS_SECRET_ARN;
    if (!key && secretArn) key = (await getSecretValue(secretArn)) || key;
    if (!key) throw new Error("EVENTS_API_KEY not set");
    const url = `https://app.ticketmaster.com/discovery/v2/events.json?latlong=${encodeURIComponent(lat)},${encodeURIComponent(lng)}&radius=10&apikey=${encodeURIComponent(key)}`;
    const res = await retry(
      () => timeoutFetch(url, { method: "GET" }, 3000),
      2,
      200,
    );
    if (!res.ok) throw new Error(`events fetch failed: ${res.status}`);
    const body = await res.json();
    const events = (body._embedded?.events || []).slice(0, 3).map((e) => ({
      id: e.id,
      name: e.name,
      venue: e._embedded?.venues?.[0]?.name,
      date: e.dates?.start?.dateTime,
      image: (e.images || [])[0]?.url || null,
      url: e.url || null,
      genre: e.classifications?.[0]?.genre?.name || null,
    }));
    const out = { provider, events };
    await cache.set(cacheKey, out);
    return out;
  }
  // mock fallback
  return {
    provider: "mock",
    events: [
      { name: "Farmers Market", venue: "Main St Park", date: null },
      { name: "Open-Air Concert", venue: "River Stage", date: null },
    ],
  };
}

export async function fetchEvents(lat, lng) {
  return await fetchLocalEvents(lat, lng);
}

export default { fetchLocalEvents, fetchEvents };
