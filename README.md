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
  config.js        Runtime config: where the frontend calls for /api/chat
  app.js           Timer logic, dish tracks, Galley AI chat client
  audio/
    how-to-use-script.txt  Narration script — feed to a TTS tool
    how-to-use.mp3          Drop the generated narration here (not
                             included — see audio/README.md)

server/          Backend, shared by every hosting path
  index.js          Express server: serves public/ + POST /api/chat
  lib/
    anthropicProxy.js  Calls the Anthropic API server-side (holds the key)
    rateLimiter.js      Best-effort per-IP rate limiting
    cors.js             Opt-in cross-origin support (for GitHub Pages)

api/
  chat.js          Vercel serverless function — thin wrapper around the
                    same server/lib/anthropicProxy.js used by Express

.github/workflows/
  deploy-pages.yml   Publishes public/ to GitHub Pages on push to main
```

The frontend never talks to Anthropic directly. It calls `POST /api/chat`
with `{ message, context }`; the server holds `ANTHROPIC_API_KEY` and does
the real API call. This keeps the key off the client and avoids the CORS
failures you'd get calling `api.anthropic.com` from a browser.

`server/lib/anthropicProxy.js` is the single source of truth for that
proxy logic — both the Express route and the Vercel function import it, so
behavior (validation, model, token limits, error handling) is identical
regardless of where you deploy.

Where the frontend sends that request is controlled by `public/config.js`
(`window.GALLEY_CONFIG.apiBase`) — empty by default, meaning "same origin
as the page." That's correct for Vercel and the standalone Node server,
where one deployment serves both the static files and `/api/chat`. It's
**not** correct for GitHub Pages, which can only serve static files — see
below.

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

### GitHub Pages (frontend only — needs a backend deployed separately)

GitHub Pages only serves static files; it can't run `server/index.js` or
`api/chat.js`. So this path splits the app in two: **Pages hosts
`public/`**, and **the `/api/chat` backend still has to run somewhere
that executes Node** — Vercel is the easiest fit, since this repo already
ships `api/chat.js` for it and it's free for a project this size. Steps:

1. **Deploy the backend to Vercel first** (see above), and note its URL,
   e.g. `https://galley-os.vercel.app`. You don't need Vercel to serve the
   frontend for this path — only `api/chat.js` matters.

2. **Allow the Pages origin through CORS.** On the Vercel project, set the
   `ALLOWED_ORIGINS` environment variable to your Pages URL (comma-separate
   if you have more than one), e.g.:
   ```
   ALLOWED_ORIGINS=https://your-org.github.io
   ```
   Without this, the browser blocks the cross-origin request even though
   the API call itself would succeed — `server/lib/cors.js` only echoes
   back `Access-Control-Allow-Origin` for origins on this list, same-origin
   requests (Vercel serving both) don't need it at all.

3. **Point the Pages build at that backend.** In the GitHub repo, go to
   **Settings → Secrets and variables → Actions → Variables** and add:
   ```
   GALLEY_API_BASE_URL = https://galley-os.vercel.app
   ```
   `.github/workflows/deploy-pages.yml` writes this into `public/config.js`
   at deploy time, so the checked-in file never needs hand-editing.

4. **Push to `main`** (or run the workflow manually from the Actions tab).
   `.github/workflows/deploy-pages.yml` publishes `public/` to a `gh-pages`
   branch, creating it automatically on the first run.

5. **Point Pages at that branch, once, in the repo UI.** Settings → Pages
   → *Build and deployment* → **Source: Deploy from a branch** → **Branch:
   `gh-pages`, folder: `/ (root)`** → Save. (This step can't be done from a
   workflow file or from here — it's a repo setting, and `gh-pages` won't
   exist to pick from that dropdown until step 4 has run at least once.)

   The site then publishes to `https://<org-or-user>.github.io/<repo>/`.

Without step 2–3 configured, the timer itself still works fine on Pages —
only the Galley AI panel is affected, and it fails closed with "Signal's
down" rather than breaking the page (same behavior as running locally
with no `ANTHROPIC_API_KEY` set).

## Environment variables

| Variable            | Required | Default          | Notes                                      |
|----------------------|----------|------------------|---------------------------------------------|
| `ANTHROPIC_API_KEY`  | yes      | —                | Never expose this to the client.            |
| `ANTHROPIC_MODEL`    | no       | `claude-sonnet-5`| Any current Claude model ID.                |
| `PORT`               | no       | `3000`           | Only used by the standalone Express server. |
| `ALLOWED_ORIGINS`    | no       | *(unset = same-origin only)* | Comma-separated list of origins allowed to call `/api/chat` cross-origin. Set this to your GitHub Pages URL when splitting frontend/backend across hosts — see "GitHub Pages" above. |

`GALLEY_API_BASE_URL` is a separate thing: a **GitHub Actions repo
variable** (not a runtime env var — the workflow reads it at deploy time
to generate `public/config.js`), only relevant for the Pages path.

## Security notes

- The `/api/chat` endpoint is anonymous and same-origin only by default —
  no CORS headers are set unless `ALLOWED_ORIGINS` is configured, so only
  pages served from your own domain can call it out of the box. Only set
  `ALLOWED_ORIGINS` if you're deliberately splitting hosting (e.g. GitHub
  Pages + Vercel), and keep the list as narrow as possible — anything on
  it can spend your Anthropic usage.
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
- The "🔊 HOW TO USE THIS" button under the title plays a short narration
  (`public/audio/how-to-use.mp3`) walking through the timer, live tasks
  ticker, and Galley AI. That file isn't checked in — see
  `public/audio/README.md` for the script and expected path. Until it's
  added, the button shows "AUDIO NOT FOUND" and disables itself rather
  than erroring.
