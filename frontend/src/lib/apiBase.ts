// Loads API base URL from /env.json at runtime, with fallback to VITE_API_BASE
export async function getApiBase(): Promise<string> {
  // Try to fetch /env.json with no-cache
  try {
    const resp = await fetch('/env.json', { cache: 'no-store' });
    if (resp.ok) {
      const env = await resp.json();
      if (env.API_BASE) return env.API_BASE;
      if (env.API_BASE_URL) return env.API_BASE_URL; // legacy key
    }
  } catch (e) {
    // ignore
  }
  // Fallback to Vite env
  return import.meta.env.VITE_API_BASE;
}
