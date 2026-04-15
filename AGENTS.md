# AGENTS.md

## Cursor Cloud specific instructions

### Project overview
Circuit Breaker is a browser extension (Chrome/Firefox/Safari) that selectively blocks distracting web features. It has three components: the extension (`extension/`), a sync server (`worker/`), and a static dashboard (`index.html` + `js/` + `css/`).

### Running services

**Sync server (worker):** Start with `cd worker && JWT_SECRET=$(openssl rand -hex 32) node node-entry.js`. Serves the dashboard + sync API on port 8787. Requires `/data` directory for SQLite (run `sudo mkdir -p /data && sudo chown $(whoami) /data` if it doesn't exist). The `better-sqlite3` native module may need rebuilding after `npm install` — run `cd worker && npm rebuild better-sqlite3` if you see "invalid ELF header" errors.

**Extension dev reload server (optional):** `cd extension && python3 -m http.server 8111`

### Building
`./build.sh all` builds Chrome, Firefox, Safari, and dashboard targets to `dist/`. The dashboard is also copied to `worker/public/` for serving.

### Testing
All test commands run from `tests/` directory. See `tests/package.json` for the full list:
- `npm run test:url-blocking` — 214 unit tests for URL blocking logic (no browser needed, fast)
- `npm run test:restricted:headless` — 28 restricted domain tests via Puppeteer (needs Chrome)
- `npm test` — full Puppeteer test suite (element + URL + allowlist, needs Chrome)
- `npm run test:quick` — quick Playwright smoke test

### Gotchas
- The worker's `DB_PATH` defaults to `/data/circuitbreaker.db`. In the cloud VM, `/data` must be created manually with write permissions.
- API routes are versioned under `/api/v1/` (e.g., `/api/v1/auth/signup`, `/api/v1/sync`). Trailing slashes on routes may 404 due to Hono routing.
- No top-level `package.json` — dependency install must be done separately in `tests/` and `worker/`.
- The extension has no build step for development; load `extension/` directly as an unpacked extension in Chrome.
