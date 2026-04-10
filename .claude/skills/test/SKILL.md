---
name: test
description: |
  Circuit Breaker extension test runner and validation skill. Use this skill whenever testing, validating, or verifying any part of the Circuit Breaker extension — including after changing selectors, domain lists, urlFilter patterns, or before a release. Also trigger when the user says "test", "run tests", "check if it works", "validate", "verify selectors", or asks about test coverage. MANDATORY TRIGGERS: test, validate, verify, check selectors, run tests, test coverage, broken selector, does this work, before release.
---

# Circuit Breaker — Test Skill

This skill covers how to test every layer of the Circuit Breaker browser extension. The extension blocks content via three mechanisms, each with its own test approach:

1. **CSS element hiding** — content script injects `display: none` styles (tested via live selector validation)
2. **SPA URL blocking** — content script intercepts navigation to blocked paths (tested via Node.js unit tests)
3. **Domain-level blocking** — declarativeNetRequest redirects entire domains to blocked.html (tested via Puppeteer)

## Quick Reference — Which Test to Run

| What changed | Command | Needs browser? |
|---|---|---|
| CSS selectors in `blocklists.js` | Claude in Chrome live validation (Step 1 + Step 2) or `npm test` | Yes |
| `urlFilter` patterns in `blocklists.js` | `npm run test:url-blocking` | No |
| Domain lists in `blocklists.js` | `npm run test:restricted` | Yes (local Chrome) |
| Verify elements are actually hidden | Claude in Chrome element hiding test (Test 3 Step 2) | Yes |
| Before a release | All of the above | Mixed |

## Test 1: SPA URL Blocking (Node.js — no browser)

**When:** After changing any `urlFilter` pattern in `blocklists.js`.

**What it tests:** The content script's `checkUrl()` path-matching logic. It auto-reads every URL-type feature from `blocklists.js` and verifies root-page rules only block the homepage, path rules match correct paths, domain-only rules block all pages, and no rule leaks cross-site.

```bash
cd tests
npm run test:url-blocking              # 214 tests, fast
npm run test:url-blocking:verbose      # Show every case
node run-url-blocking.js --json        # JSON → results/url-blocking.json
```

This test exists because `urlFilter: '||tiktok.com/'` once stripped to just `'/'`, and `pathname.includes('/')` is always true — blocking the entire site instead of just the homepage. The test catches this class of bug automatically for all 41 URL-type features.

**If a test fails:** The issue is in `content.js`'s `checkUrl()` function. The path-matching logic at ~line 100 handles three cases:
- `filterClean === '/'` → must use exact match (`pathname === '/'`)
- `filterClean` is a path like `/shop` → uses `pathname.includes(filterClean)`
- `filterClean` is empty and `urlFilter` starts with `||` → domain-only match (any path)

## Test 2: Restricted Domain Blocking (Puppeteer — needs local Chrome)

**When:** After changing domain lists for adult, gambling, dating, or crypto categories.

**What it tests:** That `declarativeNetRequest` rules redirect restricted domains to `blocked.html`. Claude in Chrome cannot access these sites due to safety policy, so this test uses Puppeteer with the extension loaded.

```bash
cd tests
npm run test:restricted                     # All 28 sites
npm run test:restricted:gambling            # Just gambling (8 sites)
npm run test:restricted:adult               # Just adult (6 sites)
npm run test:restricted:dating              # Just dating (6 sites)
npm run test:restricted:crypto              # Just crypto (8 sites)
npm run test:restricted:headless            # All, headless mode
node run-restricted.js --category gambling --json  # JSON output
```

**Self-contained:** The test finds the extension's service worker, opens the options page, injects blocked domains into `chrome.storage.sync`, sends a message to trigger `applyRules()`, then checks each site. No manual dashboard setup needed.

**Cannot run in sandbox:** Puppeteer needs a local Chrome install. If running from a sandboxed environment (like Cowork), tell the user to run it locally.

**If adding a new restricted site:** Add it to the `RESTRICTED_SITES` object in `tests/run-restricted.js`, then run the test.

## Test 3: Live CSS Selector Validation (Claude in Chrome)

**When:** After changing element selectors in `blocklists.js`, or to verify a selector works on a real page.

**What it tests:** That CSS selectors actually match elements on the live site. Sites change their DOM frequently, so selectors can break.

### Step 1 — Verify selectors match elements

Navigate to the target site and run `document.querySelectorAll()` with the selector. Check that matches exist and are the right elements.

Example — validating The Guardian's cookie banner selector:
```javascript
// In Claude in Chrome javascript_tool on theguardian.com:
const sel = '[id^="sp_message_container"], .js-manage-consent, .cmp-container';
const matches = document.querySelectorAll(sel);
Array.from(matches).map(el => ({
  tag: el.tagName, id: el.id, visible: el.offsetHeight > 0
}));
```

### Step 2 — Verify CSS hiding actually works

Selector matching alone doesn't prove elements will be hidden. The content script creates a `<style id="cb-hide">` element with `display: none !important` rules. We need to verify:
- The selectors don't have specificity conflicts that prevent hiding
- Elements aren't in shadow DOM or otherwise immune to CSS hiding
- The `!important` flag actually overrides the site's styles

**IMPORTANT:** `chrome.storage.sync` is NOT accessible from the page context (Claude in Chrome's `javascript_tool` runs in page context, not the extension context). Do NOT attempt to call `chrome.storage` — it will throw `TypeError: Cannot read properties of undefined`. Instead, use these approaches that work from page context:

**A) Check what the extension is already hiding (verify active rules):**
```javascript
// Check if the extension's content script is active and hiding elements
const style = document.getElementById('cb-hide');
if (!style) {
  'Extension content script has NOT injected any hiding rules on this page';
} else {
  const rules = style.textContent.split('\n').filter(l => l.trim());
  const selectors = rules.map(r => r.replace(/ \{ display: none !important; \}/, ''));
  const results = selectors.map(sel => {
    try {
      const els = document.querySelectorAll(sel);
      const visibleCount = Array.from(els).filter(el => getComputedStyle(el).display !== 'none').length;
      return { selector: sel.slice(0, 80), matched: els.length, stillVisible: visibleCount };
    } catch(e) { return { selector: sel.slice(0, 80), error: e.message }; }
  });
  JSON.stringify({ totalRules: rules.length, results }, null, 2);
}
```

**B) Simulate hiding to test new/changed selectors:**

Inject a test `<style>` element that mimics exactly what the content script does (`display: none !important`), then check whether elements are actually hidden. This catches specificity conflicts and other CSS issues without needing extension storage access.
```javascript
// Simulate element hiding — test whether selectors would work if the extension applied them
const testSelectors = {
  // Paste the selectors from blocklists.js for this site:
  'gu-comments': '#comments, .discussion__comments, [data-component="discussion"], gu-island[name*="Discussion"]',
  'gu-related': 'gu-island[name="OnwardsUpper"], gu-island[name="MostViewedFooterData"], gu-island[name="MostViewedRightWithAd"]',
};

// Record pre-hide visibility
const preCheck = {};
for (const [name, sel] of Object.entries(testSelectors)) {
  const els = document.querySelectorAll(sel);
  preCheck[name] = { matched: els.length, visibleBefore: Array.from(els).filter(el => el.offsetHeight > 0).length };
}

// Inject test style (same mechanism as content script)
let testStyle = document.getElementById('cb-test-hide');
if (!testStyle) {
  testStyle = document.createElement('style');
  testStyle.id = 'cb-test-hide';
  document.head.appendChild(testStyle);
}
testStyle.textContent = Object.values(testSelectors).map(s => s + ' { display: none !important; }').join('\n');

// Check post-hide state
const results = {};
for (const [name, sel] of Object.entries(testSelectors)) {
  const els = document.querySelectorAll(sel);
  const hiddenCount = Array.from(els).filter(el => getComputedStyle(el).display === 'none').length;
  const stillVisible = Array.from(els).filter(el => getComputedStyle(el).display !== 'none').length;
  results[name] = {
    matched: els.length,
    visibleBefore: preCheck[name].visibleBefore,
    hiddenAfter: hiddenCount,
    stillVisible,
    status: els.length === 0 ? 'NO MATCH'
      : stillVisible === 0 ? 'ALL HIDDEN'
      : hiddenCount > 0 ? 'PARTIAL — some elements resist hiding'
      : 'FAILED — display:none had no effect'
  };
}
JSON.stringify(results, null, 2);
```

**After testing with approach B, always clean up the test style:**
```javascript
const testStyle = document.getElementById('cb-test-hide');
if (testStyle) testStyle.remove();
'Test style removed';
```

**C) Full end-to-end verification (requires user to enable features first):**

If the user has enabled features via the dashboard or options page, the extension will have written selectors to `chrome.storage.sync` and the content script applies them automatically. Use approach A to verify the `#cb-hide` style is present and elements are hidden. This is the most reliable test because it exercises the full pipeline: dashboard → storage → content script → CSS injection.

### What to check for failures

- **`cb-hide` style missing**: Content script didn't run — check if the site is in `SAFE_HOSTS`, or if `hiddenSelectors` storage is empty for this domain
- **Style exists but selector not in it**: The feature isn't enabled in storage, or the domain key doesn't match (e.g. `edition.cnn.com` vs `cnn.com` — the content script handles subdomains via `.endsWith()`)
- **Selector in style but elements still visible**: Another CSS rule overrides with higher specificity, or elements are re-injected after the style is applied (common with lazy-loaded content)
- **Elements matched but not hidden**: The `!important` flag should override most styles. If not working, the element may use inline styles or shadow DOM
- **Page can't scroll after hiding consent popups**: Consent managers (Sourcepoint, Fundingchoices, Didomi) add classes like `sp-message-open` to `<html>` or `<body>` that set `overflow: hidden` and constrain height to the viewport. The content script includes CSS overrides for known scroll-lock classes, but if a new one appears, check `document.documentElement.className` and `getComputedStyle(document.body).overflow` to identify the lock, then add an override rule to the `globalSelectors` block in `content.js`'s `applyHiding()` function

### Sites that Claude in Chrome CANNOT access

Use Puppeteer restricted test instead — these sites only use domain-level blocking:
- Adult: pornhub.com, xvideos.com, onlyfans.com, xhamster.com, redtube.com, chaturbate.com
- Gambling: bet365.com, draftkings.com, fanduel.com, betfair.com, williamhill.com, paddypower.com, pokerstars.com, ladbrokes.com
- Dating: tinder.com, bumble.com, match.com, hinge.co, grindr.com, okcupid.com
- Crypto: binance.com, coinbase.com, kraken.com, crypto.com, kucoin.com, bybit.com, okx.com, gate.io

**For these restricted sites, never attempt to navigate there with Claude in Chrome.** They only use domain-level blocking anyway, so the Puppeteer test covers them.

### Sites that may be domain-blocked by user config

Some sites (TikTok, Instagram, Facebook, X/Twitter, Snapchat, Pinterest, etc.) may be domain-blocked by the user's extension settings. If you navigate and get redirected to `blocked.html`, the domain block is working. To test CSS element hiding on these sites, the user must first disable the domain block in their settings, or you should use `npm test` (Puppeteer with stealth) instead.

## Test 4: Full Puppeteer Test (needs local Chrome + stealth plugin)

**When:** For comprehensive element/URL/allowlist testing with the real extension loaded.

```bash
cd tests
npm test                    # Full run
npm run test:site           # Single site mode
```

Uses puppeteer-extra with stealth plugin to avoid bot detection. Tests element selectors, URL blocking, and allowlist features on live sites.

## Adding a New Site — Test Checklist

When adding a new site or category to `blocklists.js`:

1. Add the site to `blocklists.js` with domains, features, and selectors
2. **If restricted category** (adult, gambling, dating, crypto): add to `RESTRICTED_SITES` in `tests/run-restricted.js`, run `npm run test:restricted`
3. **If it has URL-type features**: run `npm run test:url-blocking` (auto-reads from blocklists.js). Root-page rules (`||domain/`) must only match `/`, never all pages
4. **If it has element selectors**: validate on the live site with Claude in Chrome:
   - **Step 1**: Verify selectors match elements (`document.querySelectorAll()`)
   - **Step 2**: Verify elements are actually hidden (inject selectors into storage, reload, check `getComputedStyle(el).display === 'none'` and `#cb-hide` style element)
5. Update `tests/results/dashboard.html` with new results
6. Bump the version per versioning rules in CLAUDE.md

## Common Pitfalls

**Root-page urlFilter patterns:** `||domain/` strips to just `/`. The content script must check `pathname === '/'`, not `pathname.includes('/')` (which is always true). The URL blocking test catches this automatically.

**Self-hosted consent scripts:** Sites like The Guardian (`sourcepoint.theguardian.com`) and The Argus (`a02342.theargus.co.uk`) host consent scripts on their own subdomains. Network-level blocking of `sourcepoint.com` won't catch them — CSS element hiding is the fallback. The content script has built-in `COOKIE_CONSENT_CSS` selectors that activate when the cookie-popups feature is enabled.

**Feature toggle cascading:** When toggling individual features, the state must cascade back up: `sites[siteId]` should reflect whether any features are on, and `category.enabled` should reflect whether any sites are on. Without this, toggling features off doesn't properly clear domain-level blocks.

**`requestDomains` vs `urlFilter` for domain blocking:** Always use `requestDomains: [domain]` in declarativeNetRequest rules, never `urlFilter: ||domain`. The urlFilter approach can false-positive on substring matches (e.g. `||ea.com` matching inside `cloudflare.com`).

## Test Results Dashboard

Visual dashboard at `tests/results/dashboard.html` — dark theme, filterable, shows pass/fail/skip per feature with selector details and issue tracking.

## Current Coverage (v2.0.0)

- **Puppeteer full suite** (`npm test`): 77 pass, 11 intermittent/content-dependent, 39 skipped (login failures + allowlist features)
- **Restricted domain tests**: 28/28 pass (adult 6/6, gambling 8/8, dating 6/6, crypto 8/8)
- **URL blocking tests**: 214/214 pass
- **CSS element hiding** (Claude in Chrome): Verified on 9 sites — zero specificity conflicts
- **Collateral damage**: 15/16 safe (1 expected: YouTube blocked under Video Streaming category)
- **Combined**: 319/330 passing across all suites
- **Intermittent** (not broken selectors): YouTube notifications/mixes, Twitch pre-roll ads, Reddit NSFW, Guardian donation, NY Times paywall/comments, Amazon buy-again/S&S, ChatGPT web browse, Prime Video store/buy
- **Not automated**: Firefox/Safari, dashboard UI toggle interactions
