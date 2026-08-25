# Galley OS — Mission Timer

A "Multi-Dish Ignition Sequencer": a reverse-scheduling kitchen timer that
back-calculates each dish's start ("ignition") time from one shared serve
time, so every dish finishes together. Built for a design brief where a chef
has a fixed window to cook a multi-dish meal. Includes a JARVIS-style HUD
design system view and a **Galley AI** chat assistant for quick answers
mid-cook (text or voice input).

## How it's put together

```
public/          Static frontend — no build step
  index.html       Markup (timer view + design-system view)
  style.css        HUD design system styles
  app.js           Timer logic, dish tracks, Galley AI chat client

server/          Backend, shared by both hosting paths
  index.js          Express server: serves public/ + POST /api/chat
  lib/
    anthropicProxy.js  Calls the Anthropic API server-side (holds the key)
    rateLimiter.js      Best-effort per-IP rate limiting

api/
  chat.js          Vercel serverless function — thin wrapper around the
                    same server/lib/anthropicProxy.js used by Express
```

The frontend never talks to Anthropic directly. It calls same-origin
`POST /api/chat` with `{ message, context }`; the server holds
`ANTHROPIC_API_KEY` and does the real API call. This keeps the key off the
client and avoids the CORS failures you'd get calling `api.anthropic.com`
from a browser.

`server/lib/anthropicProxy.js` is the single source of truth for that
proxy logic — both the Express route and the Vercel function import it, so
behavior (validation, model, token limits, error handling) is identical
regardless of where you deploy.

## Running locally

```bash
npm install
cp .env.example .env
# edit .env and set ANTHROPIC_API_KEY=sk-ant-...
npm run dev
```

Open http://localhost:3000. Without an API key set, the timer/UI works
fully — only the Galley AI chat will return a 503 ("Server is not
configured with an ANTHROPIC_API_KEY").

## Deploying

### Vercel

```bash
npm install -g vercel   # if you don't have it
vercel
vercel env add ANTHROPIC_API_KEY production
vercel --prod
```

`vercel.json` points Vercel's static output at `public/`; anything in
`api/` is auto-detected as a serverless function. No build step is
required — the frontend is plain HTML/CSS/JS.

### Any other Node host (Render, Railway, Fly.io, a VPS, Docker)

```bash
npm install
ANTHROPIC_API_KEY=sk-ant-... npm start
```

`server/index.js` serves the static frontend *and* the `/api/chat` route
from a single Express process on `PORT` (default `3000`). Point your
platform's start command at `npm start`.

## Environment variables

| Variable            | Required | Default          | Notes                                      |
|----------------------|----------|------------------|---------------------------------------------|
| `ANTHROPIC_API_KEY`  | yes      | —                | Never expose this to the client.            |
| `ANTHROPIC_MODEL`    | no       | `claude-sonnet-5`| Any current Claude model ID.                |
| `PORT`               | no       | `3000`           | Only used by the standalone Express server. |

## Security notes

- The `/api/chat` endpoint is anonymous and same-origin only (no CORS
  headers are set, so only pages served from your own domain can call it).
- `server/lib/rateLimiter.js` applies a simple in-memory per-IP limit
  (12 requests/minute) to blunt casual abuse. It's **best-effort only** —
  on serverless platforms each warm instance has its own memory, so a
  client hitting multiple cold instances can exceed it. For real
  production traffic, swap it for a shared store (e.g. Upstash Redis) or
  put the endpoint behind your platform's edge rate limiting.
- Message length, context length, and `max_tokens` are all capped
  server-side to bound cost per request.

## Feature notes

- Dishes are seeded with a 30-minute, 3-dish default (chicken skewers,
  charred vegetables, seared catch) but are fully editable — add/remove
  dishes, adjust the total time frame, check off method steps manually.
- The design-system view (header link, top right) documents the color
  tokens, type system, HUD panel signature, and motion rules used
  throughout — toggled client-side, no page navigation.
- Voice input for Galley AI uses the browser's Web Speech API and only
  activates in browsers that support it (falls back to a text-only note
  otherwise).
