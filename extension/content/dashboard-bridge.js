// FuseBox — Dashboard Bridge (content script)
// Injected on the FuseBox dashboard pages. Relays messages between
// the webpage (postMessage) and the extension background (runtime.sendMessage).
// This is the universal cross-browser approach (works on Chrome, Firefox, Safari, Edge).

const ALLOWED_ORIGINS = [
  'https://fuseboard-sync.joe-780.workers.dev',
  'https://switch-ahg.pages.dev',
  'http://localhost',
];

function isAllowedOrigin(origin) {
  return ALLOWED_ORIGINS.some(o => origin === o || origin.startsWith(o + ':'));
}

// Listen for messages from the webpage
window.addEventListener('message', (event) => {
  if (!isAllowedOrigin(event.origin)) return;
  if (!event.data?.type) return;

  if (event.data.type === 'FUSEBOX_PING') {
    const version = chrome.runtime?.getManifest?.()?.version || 'unknown';
    window.postMessage({ type: 'FUSEBOX_PONG', version }, '*');
    return;
  }

  if (event.data.type === 'FUSEBOX_UPDATE') {
    const msg = {
      type: 'updateRules',
      selections: event.data.selections,
      domains: event.data.domains || [],
      urls: event.data.urls || [],
      selectors: event.data.selectors || {},
    };

    // Write directly to storage (works even if service worker is asleep)
    const toStore = {
      blockedDomains: msg.domains,
      blockedUrls: msg.urls,
      hiddenSelectors: msg.selectors,
    };
    if (msg.selections) toStore.selections = msg.selections;
    if (event.data.allowedChannels !== undefined) toStore.allowedChannels = event.data.allowedChannels;
    if (event.data.subsOnlyMode !== undefined) toStore.subsOnlyMode = event.data.subsOnlyMode;
    chrome.storage.sync.set(toStore);

    // Also send to background for declarativeNetRequest rule updates
    chrome.runtime.sendMessage(msg, () => {
      if (chrome.runtime.lastError) {
        console.log('FuseBox bridge: background unavailable, storage updated directly');
      }
    });
    return;
  }
});

// Announce presence immediately so the page knows the extension is installed
window.postMessage({
  type: 'FUSEBOX_PONG',
  version: chrome.runtime?.getManifest?.()?.version || 'unknown',
}, '*');
