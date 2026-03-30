# FuseBox

## Versioning
- Current version: **1.5.1**
- Update ALL of these: `extension/manifest.json`, `extension/popup/popup.html`, `extension/options/options.html`, `index.html`, `CHANGELOG.md`, `extension/options/options.js` (inline changelog)
- PATCH: selector fixes. MINOR: new features/sites. MAJOR: breaking changes.

## Architecture
- **Dashboard** (`index.html`, `js/`, `css/`): primary UI, static SPA, no sign-up needed
- **Extension** (`extension/`): thin client, applies blocking rules from dashboard via `postMessage`
- **Bridge** (`extension/content/dashboard-bridge.js`): relays `postMessage` → `background.js` (cross-browser)
- **Backend** (`worker/`): optional sync server (Cloudflare Worker + D1, or Docker + SQLite)
- Source of truth for blocklists: `extension/data/blocklists.js`

## Build & Deploy
- `./build.sh all` — Chrome + Firefox + Safari + dashboard (copies to `worker/public/`)
- `cd worker && npx wrangler deploy` — deploy worker + dashboard
- `npx wrangler pages deploy . --project-name switch` — deploy to Cloudflare Pages
- Dev auto-reload: `cd extension && python3 -m http.server 8111`

## Dashboard Safeguards
Never block these domains — they're filtered in `background.js` and skipped in `content.js`:
`fuseboard-sync.joe-780.workers.dev`, `switch-ahg.pages.dev`, `localhost`

## Testing — `/test-fuses`
- Tests every feature by toggling fuses on the dashboard and checking blocking in Chrome
- Fix failures → `./build.sh all` → re-test → bump version + changelog if changes made
- **Never send domain-level blocks during tests** — only use `urls` and `selectors`
