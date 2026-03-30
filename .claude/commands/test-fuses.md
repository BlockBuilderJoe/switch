# /test-fuses — FuseBox End-to-End Feature Test

Test that each fuse correctly blocks sites and hides elements using Claude for Chrome on the live browser.

## Arguments
- No args: test all sites that have features
- `$ARGUMENTS` can be: `--site youtube`, `--site twitter`, `--category social-media`, etc.

## Instructions

You are testing the FuseBox browser extension by toggling fuses on the dashboard website and verifying blocking works in real Chrome tabs.

### Setup

1. Read `extension/data/blocklists.js` to get the full category/site/feature map
2. Use `mcp__claude-in-chrome__tabs_context_mcp` to get browser state
3. Create 2 tabs in the MCP group:
   - **Dashboard tab**: navigate to `https://fuseboard-sync.joe-780.workers.dev/`
   - **Test tab**: used for navigating to target sites
4. Wait for dashboard to load, then register the test helpers (see below)

### Test URL Map

Some features need specific pages. Use **two URLs per site** where applicable:

```
youtube (video):  https://www.youtube.com/watch?v=dQw4w9WgXcQ
youtube (home):   https://www.youtube.com/
tiktok:           https://www.tiktok.com/foryou
twitter:          https://x.com/home
reddit:           https://www.reddit.com/r/AskReddit/top/?t=day
twitch:           https://www.twitch.tv/xqc
amazon:           https://www.amazon.co.uk/s?k=headphones
cnn:              https://www.cnn.com
bbc-news:         https://www.bbc.co.uk/news
chatgpt:          https://chatgpt.com
instagram:        https://www.instagram.com
pinterest:        https://www.pinterest.com
linkedin:         https://www.linkedin.com/feed/
steam:            https://store.steampowered.com
roblox:           https://www.roblox.com
```

For YouTube specifically:
- Test `yt-home`, `yt-notifications`, `yt-playlist-mix` on the **home page** (`youtube.com/`)
- Test all other element features on a **video page** (`youtube.com/watch?v=dQw4w9WgXcQ`)

### Register test helpers on dashboard tab FIRST

Run this JavaScript on the **dashboard tab** at the start and re-run if it gets lost. These helpers persist on `window`:

```js
// Toggle a single feature ON and send to extension
window._test = function(catId, siteId, featureId, selectorOrUrl, isUrl) {
  const sel = JSON.parse(localStorage.getItem('fb_selections') || '{}');
  if (!sel[catId]) sel[catId] = {enabled: true, sites: {}, features: {}};
  // Reset all features for this site prefix
  const prefix = featureId.split('-')[0] + '-';
  Object.keys(sel[catId].features || {}).forEach(k => {
    if (k.startsWith(prefix)) sel[catId].features[k] = false;
  });
  sel[catId].enabled = true;
  sel[catId].sites[siteId] = true;
  sel[catId].features[featureId] = true;
  localStorage.setItem('fb_selections', JSON.stringify(sel));

  if (isUrl) {
    // URL features — send as blockedUrls with requestDomains format
    const url = typeof selectorOrUrl === 'object' ? selectorOrUrl : selectorOrUrl;
    window.postMessage({type: 'FUSEBOX_UPDATE', selections: sel, domains: [], urls: [url], selectors: {}}, '*');
  } else {
    // Element features — send as hiddenSelectors keyed by domain
    const domain = siteId.replace('www.', '');
    // Get the actual domain from blocklists
    const cat = categories.find(c => c.id === catId);
    const site = cat?.sites?.find(s => s.id === siteId);
    const d = (site?.domains?.[0] || siteId + '.com').replace('www.', '');
    window.postMessage({type: 'FUSEBOX_UPDATE', selections: sel, domains: [], urls: [], selectors: {[d]: [selectorOrUrl]}}, '*');
  }
  return featureId + ' ON';
};

// Full reset — clear everything
window._reset = function() {
  localStorage.setItem('fb_selections', '{}');
  window.postMessage({type: 'FUSEBOX_UPDATE', selections: {}, domains: [], urls: [], selectors: {}, allowedChannels: [], subsOnlyMode: false}, '*');
  return 'reset';
};
```

### Checking element visibility

On the **test tab**, use this function to check if elements are hidden:

```js
function c(sel) {
  const els = document.querySelectorAll(sel);
  const visible = Array.from(els).filter(el => {
    const s = getComputedStyle(el);
    return s.display !== 'none' && s.visibility !== 'hidden' && el.offsetHeight > 0;
  });
  return [els.length, visible.length];
}
```

Result `[total, visible]`:
- `[N, 0]` where N > 0 → **PASS** (elements found and all hidden)
- `[N, M]` where M > 0 → **FAIL** (M elements still visible)
- `[0, 0]` → **SKIP** (selector not found on this page)

### Test flow for each feature

#### Element features (`type: 'element'`)

1. On dashboard tab: `window._test('CATEGORY_ID', 'SITE_ID', 'FEATURE_ID', 'SELECTOR', false)`
2. On test tab: Navigate to target URL, wait 4 seconds
3. On test tab: Run `c('SELECTOR')` to check `[total, visible]`
4. Record result
5. On dashboard tab: `window._reset()`

#### URL features (`type: 'url'`)

1. On dashboard tab: Send with the URL rule object (include `requestDomains` if present in blocklists):
   ```js
   window._test('CATEGORY_ID', 'SITE_ID', 'FEATURE_ID', {urlFilter: '/shorts', requestDomains: ['youtube.com']}, true)
   ```
2. On test tab: Navigate to the blocked URL path
3. Wait 3 seconds, check `document.title` — if it contains "Blocked by FuseBox", **PASS**
4. On dashboard tab: `window._reset()`

**CRITICAL: Never send `domains: ['youtube.com']` or any domain-level block. This creates declarativeNetRequest rules that block the ENTIRE domain including the dashboard if the domain matches. Only use `urls` (URL path filters) and `selectors` (element hiding).**

#### Allowlist features (`type: 'allowlist'`)

For YouTube Subs Only Mode:
1. On dashboard tab: Enable the feature AND send `allowedChannels` + `subsOnlyMode`:
   ```js
   window.postMessage({
     type: 'FUSEBOX_UPDATE',
     selections: sel,
     domains: [], urls: [], selectors: {},
     allowedChannels: ['Rick Astley'],
     subsOnlyMode: true,
   }, '*');
   ```
2. Test an ALLOWED channel video → should load normally (title shows video name)
3. Test a DIFFERENT channel video → title should contain "Channel not in allow list"
4. Reset with: `window._reset()`

### Baseline check

Before testing a site's features, first navigate to the test URL WITHOUT any fuses toggled and run a baseline check of ALL element selectors for that site. This tells you which selectors actually exist on the page. Record 0-count selectors as **SKIP**.

### Output

After testing, output a markdown table:

```
| Site | Feature | Type | Status | Details |
|------|---------|------|--------|---------|
| YouTube | Comments | element | PASS | 2 elements found, all hidden |
| YouTube | Shorts | url | PASS | Blocked by FuseBox |
| YouTube | Subs Only | allowlist | PASS | Allowed channel plays, others blocked |
```

And a summary: `X passed, Y failed, Z skipped out of N features`

### Important notes

- Wait 4 seconds after navigation for dynamic content to load
- Re-register `window._test` and `window._reset` on the dashboard tab if they get lost (page reload clears them)
- Some sites need login (Instagram, Facebook, LinkedIn) — if login wall detected, skip with reason "login required"
- **Always call `window._reset()` after each test** to prevent bleed between tests
- The dashboard at `fuseboard-sync.joe-780.workers.dev` is protected and can never be blocked by the extension
- If `$ARGUMENTS` contains `--site SITEID`, only test that specific site
- If `$ARGUMENTS` contains `--category CATID`, only test sites in that category
