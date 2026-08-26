import { synthesizeSpeech, SpeechProxyError } from '../server/lib/elevenLabsProxy.js';
import { checkRateLimit } from '../server/lib/rateLimiter.js';
import { applyCorsHeaders } from '../server/lib/cors.js';

/**
 * Vercel serverless function: POST /api/speak
 * Mirrors the Express route in server/index.js — same shared proxy logic,
 * so behavior is identical whether this project is deployed on Vercel or
 * run as a standalone Node server. Returns raw audio/mpeg bytes.
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
  const ip = (Array.isArray(forwardedFor) ? forwardedFor[0] : forwardedFor)?.split(',')[0].trim()
    || req.socket?.remoteAddress
    || 'unknown';
  const key = 'speak:' + ip;

  if (!checkRateLimit(key, 20)) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }

  try {
    const audio = await synthesizeSpeech(req.body || {});
    res.setHeader('Content-Type', 'audio/mpeg');
    res.status(200).send(audio);
  } catch (err) {
    const status = err instanceof SpeechProxyError ? err.status : 500;
    res.status(status).json({ error: err.message || 'Unexpected error' });
  }
}
