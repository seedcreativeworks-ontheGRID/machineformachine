/**
 * Opt-in CORS for /api/chat. Disabled (same-origin only) by default — set
 * ALLOWED_ORIGINS (comma-separated) when the frontend is hosted somewhere
 * that can't run this backend itself, e.g. GitHub Pages. Only an origin in
 * that list gets Access-Control-Allow-Origin echoed back; everything else
 * gets no CORS headers at all, so the browser blocks the cross-origin read.
 */
function allowedOrigins() {
  return (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

export function resolveAllowedOrigin(requestOrigin) {
  if (!requestOrigin) return null;
  const allowed = allowedOrigins();
  return allowed.includes(requestOrigin) ? requestOrigin : null;
}

export function applyCorsHeaders(res, requestOrigin) {
  const origin = resolveAllowedOrigin(requestOrigin);
  if (!origin) return false;
  res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return true;
}
