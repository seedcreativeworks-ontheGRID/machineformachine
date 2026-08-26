import 'dotenv/config';
import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getGalleyAiReply, ChatProxyError } from './lib/anthropicProxy.js';
import { synthesizeSpeech, SpeechProxyError } from './lib/elevenLabsProxy.js';
import { checkRateLimit } from './lib/rateLimiter.js';
import { applyCorsHeaders } from './lib/cors.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, '..', 'public');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '20kb' }));
app.use(express.static(publicDir));

app.options('/api/chat', (req, res) => {
  applyCorsHeaders(res, req.headers.origin);
  res.status(204).end();
});

app.post('/api/chat', async (req, res) => {
  applyCorsHeaders(res, req.headers.origin);

  const key = req.ip || 'unknown';
  if (!checkRateLimit(key)) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }

  try {
    const reply = await getGalleyAiReply(req.body || {});
    res.json({ reply });
  } catch (err) {
    const status = err instanceof ChatProxyError ? err.status : 500;
    res.status(status).json({ error: err.message || 'Unexpected error' });
  }
});

app.options('/api/speak', (req, res) => {
  applyCorsHeaders(res, req.headers.origin);
  res.status(204).end();
});

app.post('/api/speak', async (req, res) => {
  applyCorsHeaders(res, req.headers.origin);

  // A dedicated (higher, namespaced) bucket — the 5-second voice-cue loop
  // alone can hit ~12 requests/minute, which would exhaust the shared
  // chat-endpoint limit and starve Galley AI on the same IP.
  const key = 'speak:' + (req.ip || 'unknown');
  if (!checkRateLimit(key, 20)) {
    return res.status(429).json({ error: 'Too many requests — slow down.' });
  }

  try {
    const audio = await synthesizeSpeech(req.body || {});
    res.set('Content-Type', 'audio/mpeg');
    res.send(audio);
  } catch (err) {
    const status = err instanceof SpeechProxyError ? err.status : 500;
    res.status(status).json({ error: err.message || 'Unexpected error' });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Galley OS server listening on http://localhost:${port}`);
});
