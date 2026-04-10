# Circuit Breaker

## Git
- Always commit and push WITHOUT the `Co-Authored-By: Claude` trailer — no Claude attribution in commit messages.

## Versioning
- Current version: **2.0.1**
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
`fuseboard-sync.joe-780.workers.dev`, `switch-ahg.pages.dev`, `localhost`,
`circuitbreaker.app`,
`cloudflare.com`, `cloudflare-dns.com`, `one.one.one.one`,
`chrome.google.com`, `chromewebstore.google.com`

**Domain blocking uses `requestDomains`** (not `urlFilter`) in declarativeNetRequest rules.
This ensures exact domain matching with automatic subdomain support.
Never use `urlFilter: ||domain` for domain blocking — it can false-positive on substring
matches (e.g. `||ea.com` pattern-matching inside `cloudflare.com`).

## Testing — Automated Test Suite (`tests/`)

### Test runners
| Script | What it does |
|---|---|
| `npm test` | Puppeteer + Stealth: element/URL/allowlist features on live sites (Chrome only) |
| `npm run test:restricted` | **Puppeteer: domain-block verification for restricted sites** (gambling, adult, dating, crypto) |
| `npm run test:url-blocking` | **Node.js: SPA URL blocking logic tests** (no browser needed, tests all 41 URL-type features) |
| `npm run test:quick` | Playwright headless quick smoke test |

### Restricted sites test (`tests/run-restricted.js`)
Claude in Chrome **cannot** access gambling, adult, dating, or crypto sites due to safety policy.
These sites only use domain-level blocking (declarativeNetRequest redirect to `blocked.html`).
Use the Puppeteer-based restricted sites test instead:

```bash
cd tests
npm run test:restricted                     # All restricted categories
npm run test:restricted:gambling            # Just gambling
npm run test:restricted:adult               # Just adult
npm run test:restricted:dating              # Just dating
npm run test:restricted:crypto              # Just crypto
npm run test:restricted:headless            # All, headless mode
node run-restricted.js --category gambling --json  # JSON output
```

**Self-contained:** The test automatically injects all blocked domains into the extension's
`chrome.storage.sync` and triggers `applyRules()` — no manual dashboard setup needed.
Results are saved to `tests/results/restricted-sites.json`.

### URL blocking test (`tests/run-url-blocking.js`)
Tests the content script's `checkUrl()` SPA navigation blocking logic in pure Node.js (no browser).
Automatically reads all URL-type features from `blocklists.js` and verifies:
- Root-page rules (`||domain/`) only block the homepage, not every page
- Path-based rules (`/shop`, `/live`) block correct paths only
- Domain-only rules (`||subdomain`) block all pages on that subdomain
- No rule leaks to unrelated domains

```bash
cd tests
npm run test:url-blocking              # Run all (214 tests)
npm run test:url-blocking:verbose      # Show every test case
node run-url-blocking.js --json        # JSON output → results/url-blocking.json
```

**Why this exists:** `urlFilter: '||tiktok.com/'` previously stripped to just `'/'`, and
`pathname.includes('/')` is always true — blocking the entire site instead of just the homepage.

### Test coverage by method
- **Claude in Chrome** (live CSS selector validation): Social media, news, shopping, gaming, AI, video streaming — tests element selectors via `document.querySelectorAll()` on real pages
- **Puppeteer restricted test**: Adult, gambling, dating, crypto — tests domain-level blocks by checking for redirect to `blocked.html`
- **URL blocking test**: All 41 URL-type features — tests SPA path matching logic (root-page, path, domain-only, cross-site scoping)
- **Puppeteer main test** (`run.js`): Full element/URL/allowlist feature testing with stealth plugin

### Test coverage summary (2 April 2026, v2.0.0)
- **Puppeteer full suite** (`npm test`): 77 pass, 11 intermittent/content-dependent, 39 skipped (login failures: Facebook, Twitter/X, Instagram challenge; allowlist features)
- **Restricted domain tests**: 28/28 pass (adult 6/6, gambling 8/8, dating 6/6, crypto 8/8)
- **URL blocking tests**: 214/214 pass (root-page 10, path-based 140, domain-only 8, cross-site 41, regression 15)
- **CSS element hiding**: Verified via Claude in Chrome on 9 sites — all matched elements hide with `display: none !important`, zero specificity conflicts
- **Collateral damage**: 15/16 safe (1 expected: YouTube blocked when Video Streaming category enabled)
- **Combined**: 319/330 passing across all suites
- **Intermittent failures** (not broken selectors): YouTube notifications/mixes, Twitch pre-roll ads, Reddit NSFW, Guardian donation banner, NY Times paywall/comments, Amazon buy-again/subscribe-save, ChatGPT web browse, Prime Video store/buy
- **Not covered by automation**: Firefox/Safari (extension not installed), dashboard UI toggle interactions

### Dashboard
Test results dashboard at `tests/results/dashboard.html` — dark theme, filterable, shows pass/fail/skip per feature with selector details and issue tracking.

### When to run which test
- **After changing selectors** in `blocklists.js` → Claude in Chrome live validation or `npm test`
- **After changing domain lists** → `npm run test:restricted`
- **After changing urlFilter patterns** in `blocklists.js` → `npm run test:url-blocking`
- **Before a release** → all three: `npm test`, `npm run test:restricted`, `npm run test:url-blocking`, then review `dashboard.html`
- **Never send domain-level blocks during manual `/test-fuses` tests** — only use `urls` and `selectors`

### Adding new sites — test checklist
When adding a new site or category to `blocklists.js`:
1. **Add the site** to `blocklists.js` with domains, features, and selectors
2. **If it's a restricted category** (adult, gambling, dating, crypto): also add it to `tests/run-restricted.js` in the `RESTRICTED_SITES` object, then run `npm run test:restricted` to verify the domain block works
3. **If it has URL-type features**: run `npm run test:url-blocking` to verify path matching (auto-reads from blocklists.js). Root-page rules (`||domain/`) must only match `/`, never all pages.
4. **If it has element/URL features**: validate selectors on the live site using Claude in Chrome (`document.querySelectorAll()` on real pages), or add the site to `tests/run.js` `TEST_URLS` and run `npm test`
4. **Update `tests/results/dashboard.html`** with the new test results
5. **Bump the version** per versioning rules above
