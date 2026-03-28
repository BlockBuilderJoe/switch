# FuseBox — Project Notes

## Versioning
- Current version: **1.4.1**
- Version is shown in the popup and options page header
- Use semantic versioning: MAJOR.MINOR.PATCH
  - PATCH (1.4.1 → 1.4.2): bug fixes, selector updates, small tweaks
  - MINOR (1.4.x → 1.5.0): new features, new sites, new categories
  - MAJOR (1.x → 2.0): breaking changes, major redesign
- Update in ALL of these places each time:
  1. `extension/manifest.json` → `"version"` field (3-part: "1.4.1")
  2. `extension/popup/popup.html` → `.version` span text (3-part: "v1.4.1")
  3. `extension/options/options.html` → `.version` span text (3-part: "v1.4.1")
  4. `CHANGELOG.md` → add new entry at the top
  5. `extension/options/options.js` → add entry to the inline changelog HTML

## Changelog
- Always add a new entry to the top of `CHANGELOG.md` for every version bump
- Format: `## v1.X.0 — Short Title` followed by bullet points
- Be specific about what changed

## Architecture
- Browser extension (Chrome Manifest V3)
- Extension files in `/extension/`
- Blocking: `declarativeNetRequest` for domains, content script for URL paths + element hiding
- Settings: `chrome.storage.sync`
- No backend, no accounts, fully local

## Key Files
- `extension/data/blocklists.js` — all categories, sites, features, selectors
- `extension/content/content.js` — element hiding + SPA URL blocking
- `extension/background/background.js` — declarativeNetRequest rule management
- `extension/popup/popup.js` — popup UI
- `extension/options/options.js` — full config with 3-level drill-down

## Branding
- Name: FuseBox
- Tagline: Your digital fusebox
- Visual: 10J lever-in-card fuse style with animated wire pulses
- Wire colors: Red = unprotected, Amber = partial, Green = fully blocked
