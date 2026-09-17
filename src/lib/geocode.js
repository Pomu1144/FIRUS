/**
 * Nominatim client with the manners the public endpoint expects:
 * one request per second, results cached, and in-flight requests deduped and
 * abortable so a fast typist cannot queue up a burst of lookups.
 */

const ENDPOINT = "https://nominatim.openstreetmap.org/search";
const MIN_REQUEST_INTERVAL_MS = 1100;
const CACHE_KEY = "firus:geocode-cache:v1";
const CACHE_LIMIT = 200;

const memoryCache = new Map();
let queueTail = Promise.resolve();
let lastRequestAt = 0;

function loadPersistedCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return;
    for (const [key, value] of Object.entries(JSON.parse(raw))) memoryCache.set(key, value);
  } catch {
    /* storage unavailable or corrupt - the in-memory cache still works */
  }
}

function persistCache() {
  try {
    const entries = [...memoryCache.entries()].slice(-CACHE_LIMIT);
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* non-fatal */
  }
}

loadPersistedCache();

const normalize = (query) => query.trim().toLowerCase().replace(/\s+/g, " ");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @returns {Promise<{ok: true, place: {lat:number, lon:number, label:string}}
 *   | {ok: false, reason: "empty"|"network"|"aborted"}>}
 */
export function geocode(query, { signal } = {}) {
  const key = normalize(query);
  if (!key) return Promise.resolve({ ok: false, reason: "empty" });

  if (memoryCache.has(key)) {
    const cached = memoryCache.get(key);
    return Promise.resolve(cached ? { ok: true, place: cached } : { ok: false, reason: "empty" });
  }

  // Serialise every lookup through one queue so we never exceed 1 req/sec.
  const run = queueTail.then(async () => {
    if (signal?.aborted) return { ok: false, reason: "aborted" };
    if (memoryCache.has(key)) {
      const cached = memoryCache.get(key);
      return cached ? { ok: true, place: cached } : { ok: false, reason: "empty" };
    }

    const sinceLast = Date.now() - lastRequestAt;
    if (sinceLast < MIN_REQUEST_INTERVAL_MS) await wait(MIN_REQUEST_INTERVAL_MS - sinceLast);
    if (signal?.aborted) return { ok: false, reason: "aborted" };

    lastRequestAt = Date.now();
    const url = `${ENDPOINT}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`;

    try {
      const response = await fetch(url, { signal, headers: { Accept: "application/json" } });
      if (!response.ok) return { ok: false, reason: "network" };
      const data = await response.json();
      if (!Array.isArray(data) || !data.length) {
        memoryCache.set(key, null);
        persistCache();
        return { ok: false, reason: "empty" };
      }
      const place = {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        label: data[0].display_name || query
      };
      memoryCache.set(key, place);
      persistCache();
      return { ok: true, place };
    } catch (error) {
      return { ok: false, reason: error?.name === "AbortError" ? "aborted" : "network" };
    }
  });

  // Keep the chain alive even if a lookup rejects unexpectedly.
  queueTail = run.then(
    () => undefined,
    () => undefined
  );
  return run;
}

/** Test seam: lets specs prime results without touching the network. */
export function primeGeocodeCache(query, place) {
  memoryCache.set(normalize(query), place);
}
