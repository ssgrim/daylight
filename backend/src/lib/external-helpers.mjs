export function timeoutFetch(url, opts = {}, ms = 3000) {
  const controller = new AbortController()
  const id = setTimeout(() => controller.abort(), ms)
  // @ts-ignore
  return fetch(url, { ...opts, signal: controller.signal }).finally(() => clearTimeout(id))
}

export async function retry(fn, attempts = 2, delayMs = 300) {
  let lastErr = null
  for (let i = 0; i < attempts; i++) {
    try { return await fn() } catch (e) { lastErr = e; await new Promise(r => setTimeout(r, delayMs)) }
  }
  throw lastErr
}

export default { timeoutFetch, retry }
