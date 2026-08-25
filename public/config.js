// Runtime config for the frontend. Loaded before app.js.
//
// apiBase: base URL the Galley AI chat panel calls for POST /api/chat.
//   - "" (default): same-origin — correct when this frontend is served by
//     server/index.js or deployed to Vercel alongside api/chat.js.
//   - "https://your-backend.vercel.app": cross-origin — required when the
//     frontend is hosted somewhere that can't run the backend itself, e.g.
//     GitHub Pages. The backend must set ALLOWED_ORIGINS to include this
//     page's origin so its CORS check accepts the request. See README.md.
//
// The GitHub Pages workflow (.github/workflows/deploy-pages.yml) rewrites
// this file at deploy time from the GALLEY_API_BASE_URL repo variable, so
// you don't need to hand-edit it for that path — just set the variable.
window.GALLEY_CONFIG = {
  apiBase: ""
};
