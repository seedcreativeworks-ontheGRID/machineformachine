const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 12;

const buckets = new Map();

/**
 * Best-effort in-memory sliding-window rate limiter keyed by client IP.
 *
 * NOTE: this only protects a single warm process/instance. On serverless
 * platforms (Vercel) each instance has its own memory, so a client that
 * hits multiple cold instances can exceed this limit. For real production
 * traffic, swap this for a shared store (e.g. Upstash Redis) — see README.
 */
export function checkRateLimit(key, maxRequests = MAX_REQUESTS_PER_WINDOW) {
  const now = Date.now();
  const timestamps = (buckets.get(key) || []).filter((ts) => now - ts < WINDOW_MS);

  if (timestamps.length >= maxRequests) {
    buckets.set(key, timestamps);
    return false;
  }

  timestamps.push(now);
  buckets.set(key, timestamps);
  return true;
}
