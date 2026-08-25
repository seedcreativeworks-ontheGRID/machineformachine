import { getGalleyAiReply, ChatProxyError } from '../server/lib/anthropicProxy.js';
import { checkRateLimit } from '../server/lib/rateLimiter.js';
import { applyCorsHeaders } from '../server/lib/cors.js';

/**
 * Vercel serverless function: POST /api/chat
 * Mirrors the Express route in server/index.js — same shared proxy logic,
 * so behavior is identical whether this project is deployed on Vercel or
 * run as a standalone Node server.
 */
export default async function handler(req, res) {
  applyCorsHeaders(res, req.headers.origin);

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const forwardedFor = req.headers['x-forwarded-for'];
  const key = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';

  if (!checkRateLimit(key)) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }

  try {
    const reply = await getGalleyAiReply(req.body || {});
    res.status(200).json({ reply });
  } catch (err) {
    const status = err instanceof ChatProxyError ? err.status : 500;
    res.status(status).json({ error: err.message || 'Unexpected error' });
  }
}
