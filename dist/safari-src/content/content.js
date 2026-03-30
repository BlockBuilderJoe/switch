// FuseBox — Content Script
// 1. Hides elements based on selectors
// 2. Watches for SPA URL changes and blocks matching paths

// Never run on FuseBox dashboard pages
const SAFE_HOSTS = ['fuseboard-sync.joe-780.workers.dev', 'switch-ahg.pages.dev'];
if (SAFE_HOSTS.includes(location.hostname)) {
  // Skip all blocking on dashboard
} else {

let hiddenSelectors = {};
let blockedUrlRules = [];
let allowedChannels = [];
let subsOnlyMode = false;
let lastUrl = location.href;

// Load config from storage
function loadConfig() {
  chrome.storage.sync.get(['hiddenSelectors', 'blockedUrls', 'allowedChannels', 'subsOnlyMode'], (data) => {
    hiddenSelectors = data.hiddenSelectors || {};
    blockedUrlRules = data.blockedUrls || [];
    allowedChannels = (data.allowedChannels || []).map(c => c.toLowerCase().trim());
    subsOnlyMode = data.subsOnlyMode || false;
    applyHiding();
    checkUrl();
    if (subsOnlyMode) checkChannel();
  });
}

// --- Element Hiding ---
function applyHiding() {
  const hostname = window.location.hostname.replace('www.', '');
  // Match exact domain OR subdomain (e.g. edition.cnn.com matches cnn.com key)
  const selectors = hiddenSelectors[hostname] ||
    Object.entries(hiddenSelectors).find(([k]) => hostname.endsWith('.' + k))?.[1];
  if (!selectors || selectors.length === 0) {
    const existing = document.getElementById('fuseboard-hide');
    if (existing) existing.remove();
    return;
  }

  let style = document.getElementById('fuseboard-hide');
  if (!style) {
    style = document.createElement('style');
    style.id = 'fuseboard-hide';
    (document.head || document.documentElement).appendChild(style);
  }

  const css = selectors.map(s => `${s} { display: none !important; }`).join('\n');
  style.textContent = css;
}

// --- SPA URL Blocking ---
let isRedirecting = false;

function checkUrl() {
  // Don't check on our own blocked page
  if (location.href.includes('blocked/blocked.html')) return;
  if (isRedirecting) return;

  const url = location.href;
  const pathname = location.pathname;
  const hostname = location.hostname.replace('www.', '');

  for (const rule of blockedUrlRules) {
    let urlFilter, domains;

    if (typeof rule === 'string') {
      urlFilter = rule;
      domains = null;
    } else {
      urlFilter = rule.urlFilter;
      domains = rule.requestDomains;
    }

    // Check domain match
    if (domains && !domains.some(d => hostname === d || hostname.endsWith('.' + d))) {
      continue;
    }

    // Check path match — only match against pathname, not full URL
    const filterClean = urlFilter.replace(/^\|\|[^/]*/, '');

    // If filter was domain-only (e.g. ||store.steampowered.com), domain match above is enough.
    // Otherwise check the path component matches.
    if (filterClean) {
      if (!pathname.includes(filterClean)) continue;
    } else if (!urlFilter.startsWith('||')) {
      // Plain string filter — match against pathname
      if (!pathname.includes(urlFilter)) continue;
    }
    // If we reach here: either domain-only || rule matched, or path matched

    isRedirecting = true;
    // Replace current history entry so back button doesn't loop
    window.stop();
    document.title = 'Blocked by FuseBox';
    document.body.innerHTML = `
      <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#07080a;color:#e4e6ea;font-family:system-ui,sans-serif;text-align:center">
        <div>
          <div style="font-size:2rem;margin-bottom:8px">Blocked by <span style="color:#22c55e">FuseBox</span></div>
          <div style="color:#666;margin-bottom:16px">This content has been switched off.</div>
          <a href="javascript:history.back()" style="color:#22c55e;text-decoration:none;padding:8px 20px;border:1px solid rgba(34,197,94,.3);border-radius:8px;font-size:.85rem">Go Back</a>
        </div>
      </div>
    `;
    setTimeout(() => { isRedirecting = false; }, 1000);
    return;
  }
}

// --- Subs Only Mode: check if current video is from an allowed channel ---
function checkChannel() {
  if (!subsOnlyMode) return;
  const hostname = location.hostname.replace('www.', '');
  if (hostname !== 'youtube.com') return;

  // Only check on video watch pages
  if (!location.pathname.startsWith('/watch')) return;
  if (isRedirecting) return;

  // Wait for the channel name to load (YouTube is dynamic)
  const tryCheck = (attempts) => {
    if (attempts <= 0) return;

    // Try multiple selectors for the channel name
    const channelEl =
      document.querySelector('#owner #channel-name a') ||
      document.querySelector('ytd-video-owner-renderer #channel-name a') ||
      document.querySelector('#upload-info #channel-name a') ||
      document.querySelector('.ytd-channel-name a');

    if (!channelEl) {
      setTimeout(() => tryCheck(attempts - 1), 500);
      return;
    }

    const channelName = channelEl.textContent.trim().toLowerCase();
    const channelHandle = (channelEl.href || '').split('/').pop()?.toLowerCase().replace('@', '') || '';

    const isAllowed = allowedChannels.some(allowed =>
      channelName.includes(allowed) ||
      channelHandle.includes(allowed) ||
      allowed.includes(channelName) ||
      allowed.replace('@', '') === channelHandle
    );

    if (!isAllowed) {
      isRedirecting = true;
      window.stop();
      document.title = 'Channel not in allow list — FuseBox';
      document.body.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:center;min-height:100vh;background:#07080a;color:#e4e6ea;font-family:system-ui,sans-serif;text-align:center">
          <div style="max-width:400px">
            <div style="font-size:1.5rem;font-weight:800;margin-bottom:8px">Subs Only Mode</div>
            <div style="color:#888;margin-bottom:8px"><strong style="color:#e4e6ea">${channelEl.textContent.trim()}</strong> is not in your allowed channels list.</div>
            <div style="color:#555;font-size:.8rem;margin-bottom:20px">Add this channel in FuseBox settings to allow it.</div>
            <div style="display:flex;gap:8px;justify-content:center">
              <a href="javascript:history.back()" style="color:#22c55e;text-decoration:none;padding:8px 20px;border:1px solid rgba(34,197,94,.3);border-radius:8px;font-size:.85rem">Go Back</a>
              <button id="fb-allow-channel" style="color:#fff;background:#22c55e;border:none;padding:8px 20px;border-radius:8px;font-size:.85rem;cursor:pointer;font-weight:600">Allow this channel</button>
            </div>
          </div>
        </div>
      `;
      // Quick-allow button
      document.getElementById('fb-allow-channel')?.addEventListener('click', () => {
        const handle = channelHandle || channelName;
        chrome.storage.sync.get(['allowedChannels'], (data) => {
          const channels = data.allowedChannels || [];
          channels.push(handle);
          chrome.storage.sync.set({ allowedChannels: channels }, () => {
            allowedChannels.push(handle.toLowerCase());
            isRedirecting = false;
            location.reload();
          });
        });
      });
      setTimeout(() => { isRedirecting = false; }, 1000);
    }
  };

  // Give YouTube time to render the channel name
  setTimeout(() => tryCheck(10), 1000);
}

// Watch for SPA navigation (URL changes without page reload)
function watchUrlChanges() {
  // Poll for URL changes (covers pushState, replaceState, popstate)
  setInterval(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      checkUrl();
      applyHiding();
      if (subsOnlyMode) checkChannel();
    }
  }, 500);

  // Also intercept pushState and replaceState
  const origPush = history.pushState;
  const origReplace = history.replaceState;

  history.pushState = function() {
    origPush.apply(this, arguments);
    setTimeout(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkUrl();
        applyHiding();
      }
    }, 0);
  };

  history.replaceState = function() {
    origReplace.apply(this, arguments);
    setTimeout(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        checkUrl();
        applyHiding();
      }
    }, 0);
  };

  window.addEventListener('popstate', () => {
    setTimeout(() => {
      lastUrl = location.href;
      checkUrl();
      applyHiding();
      if (subsOnlyMode) checkChannel();
    }, 0);
  });
}

// Watch for dynamic content (for element hiding)
const observer = new MutationObserver(() => {
  applyHiding();
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
} else {
  document.addEventListener('DOMContentLoaded', () => {
    if (document.body) {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
}

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync') {
    if (changes.hiddenSelectors) {
      hiddenSelectors = changes.hiddenSelectors.newValue || {};
      applyHiding();
    }
    if (changes.blockedUrls) {
      blockedUrlRules = changes.blockedUrls.newValue || [];
      checkUrl();
    }
    if (changes.allowedChannels) {
      allowedChannels = (changes.allowedChannels.newValue || []).map(c => c.toLowerCase().trim());
    }
    if (changes.subsOnlyMode) {
      subsOnlyMode = changes.subsOnlyMode.newValue || false;
      if (subsOnlyMode) checkChannel();
    }
  }
});

// Init
loadConfig();
watchUrlChanges();

} // end SAFE_HOSTS check
