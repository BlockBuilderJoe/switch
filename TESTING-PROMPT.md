# FuseBoard Extension — Testing Prompt for Claude Cowork

## Context
FuseBoard is a Chrome browser extension (Manifest V3) that blocks distracting websites and specific features within websites. It lives in `/Users/joe/Documents/GitHub/switch/extension/`.

The extension has 3 levels of blocking:
1. **Category level** — trip a fuse to block an entire category (e.g. all Social Media)
2. **Site level** — drill into a category and block individual sites (e.g. just YouTube)
3. **Feature level** — drill into a site and block specific features (e.g. YouTube Shorts, Comments, Recommendations)

Blocking works via:
- `chrome.declarativeNetRequest` — blocks entire domains (redirects to blocked page)
- Content script URL monitoring — blocks specific URL paths on SPAs (e.g. `/shorts` on YouTube)
- Content script CSS injection — hides page elements (e.g. comments section, shop buttons)

## Your Task
Systematically test every site and feature in the extension's blocklist, fix any issues you find, and verify the fixes work. Go through each site one by one.

## Files You'll Be Working With
- `/Users/joe/Documents/GitHub/switch/extension/data/blocklists.js` — all categories, sites, features, selectors
- `/Users/joe/Documents/GitHub/switch/extension/content/content.js` — content script that hides elements and blocks SPA navigation
- `/Users/joe/Documents/GitHub/switch/extension/background/background.js` — service worker that manages declarativeNetRequest rules
- `/Users/joe/Documents/GitHub/switch/extension/popup/popup.js` — popup UI logic
- `/Users/joe/Documents/GitHub/switch/extension/options/options.js` — options page with drill-down

## Testing Process

For each site that has features, do the following:

### 1. Visit the site and inspect the current DOM
Use Puppeteer to navigate to the site. Take a screenshot. Then check if the CSS selectors in `blocklists.js` actually match elements on the page:

```javascript
// Example: check if YouTube Shorts selectors exist
document.querySelectorAll('ytd-reel-shelf-renderer').length
document.querySelectorAll('[title="Shorts"]').length
```

### 2. Verify each feature's selectors
For each feature in the site's `features` array:
- If `type: 'element'` — check that the `selector` matches real elements on the page
- If `type: 'url'` — check that the `urlFilter` would match the actual URL patterns used by the site
- If selectors are outdated or wrong, inspect the page to find the correct selectors

### 3. Fix any broken selectors
Sites change their DOM frequently. If a selector doesn't match:
- Use the browser devtools / Puppeteer to find the correct selector
- Update `blocklists.js` with the working selector
- Test that the element is actually hidden when the CSS is applied

### 4. Test URL-based blocking
For features that use `urlFilter`:
- Navigate to the URL that should be blocked
- Verify the content script catches it (both on direct navigation and SPA navigation)
- Check that the `requestDomains` field is correct if present

## Sites to Test (in order)

### Social Media
1. **YouTube** (youtube.com) — Test: Shorts, Trending, Comments, Up Next, Home Feed, Notifications, Shop, End Cards
2. **TikTok** (tiktok.com) — Test: For You, Live, Comments, Shop
3. **Instagram** (instagram.com) — Test: Reels, Explore, Stories, Shop, Suggested Posts, Comments
4. **Facebook** (facebook.com) — Test: Reels, Marketplace, News Feed, Watch, Gaming, Groups, Notifications, Stories, Comments
5. **Twitter/X** (x.com) — Test: Trending, Explore, Notifications, Who to Follow, Replies, Like Counts, Retweet Counts, Grok AI
6. **Snapchat** (snapchat.com) — Test: Discover, Spotlight
7. **Reddit** (reddit.com) — Test: Popular, r/all, Home Feed, Comments, Awards, Sidebar/Trending, Chat, NSFW
8. **Pinterest** (pinterest.com) — Test: Home Feed, Shop, Notifications
9. **LinkedIn** (linkedin.com) — Test: Feed, Notifications, Messaging, Promoted Posts, Games

### Video Streaming
10. **Netflix** (netflix.com) — Test: Browse/Home, Autoplay Previews
11. **Twitch** (twitch.tv) — Test: Browse, Clips, Chat, Recommendations

### Gaming
12. **Steam** (store.steampowered.com) — Test: Store, Community, Market
13. **Epic Games** (epicgames.com) — Test: Store, Fortnite
14. **Roblox** (roblox.com) — Test: Avatar Shop, Discover

### Shopping
15. **Amazon** (amazon.com) — Test: Deals, Recommendations, Buy Again
16. **eBay** (ebay.com) — Test: Daily Deals

### AI
17. **ChatGPT** (chatgpt.com) — Test: Image Gen, Web Browse
18. **Midjourney** (midjourney.com) — Test: Explore

## What to Fix
For each broken selector or feature:
1. Navigate to the site with Puppeteer
2. Screenshot the page
3. Inspect the DOM to find the correct element/selector
4. Update `blocklists.js` with the fix
5. Verify the fix by injecting the CSS and taking another screenshot

## Common Issues to Watch For
- **SPA navigation** — YouTube, Twitter, Instagram, Facebook are all SPAs. URL blocking must work on internal navigation, not just page loads
- **Dynamic content** — Many elements load lazily. The content script uses MutationObserver but selectors need to match the final rendered DOM
- **Selector specificity** — Some selectors may match too many elements (e.g. hiding all `[role="feed"]` might break the page). Be precise.
- **Shadow DOM** — Some sites use Shadow DOM which CSS selectors can't penetrate. Note these as limitations.
- **Login walls** — Some sites require login to see certain features. Note which ones can't be tested without auth.

## Output
After testing, provide:
1. A summary of which features work and which are broken
2. All fixes applied to `blocklists.js`
3. Any content script changes needed
4. A list of features that can't work due to technical limitations (Shadow DOM, login required, etc.)
