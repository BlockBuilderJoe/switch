// Circuit Breaker Sync Layer
// Runs in the background service worker. Syncs local settings to/from the server.

const SYNC_KEYS = ['selections', 'blockedDomains', 'blockedUrls', 'hiddenSelectors', 'followingOnly'];
const POLL_INTERVAL = 60000; // 60 seconds
const DEBOUNCE_DELAY = 2000; // 2 seconds

let syncEnabled = false;
let serverUrl = '';
let accessToken = '';
let refreshToken = '';
let deviceId = '';
let deviceRole = 'admin';
let localVersion = 0;
let debounceTimer = null;
let isPushing = false;
let pullCount = 0;

// --- Init ---

async function initSync() {
  const data = await chrome.storage.local.get(['sync_server', 'sync_access_token', 'sync_refresh_token', 'sync_device_id', 'sync_version', 'sync_device_role']);

  serverUrl = data.sync_server || '';
  accessToken = data.sync_access_token || '';
  refreshToken = data.sync_refresh_token || '';
  deviceId = data.sync_device_id || '';
  localVersion = data.sync_version || 0;
  deviceRole = data.sync_device_role || 'admin';

  syncEnabled = !!(serverUrl && accessToken);

  if (syncEnabled) {
    pull(); // Initial pull
    refreshDeviceRole(); // Fetch current role from server
    setInterval(pull, POLL_INTERVAL); // Poll
  }
}

// --- Pull (server → local) ---

async function pull() {
  if (!syncEnabled) return;

  try {
    const res = await apiFetch('GET', '/api/v1/sync');
    if (!res.ok) return;

    const data = await res.json();
    if (!data.settings || data.version <= localVersion) return;

    // Server has newer data — apply it
    const settings = data.settings;
    const toStore = {};
    SYNC_KEYS.forEach(key => {
      if (settings[key] !== undefined) toStore[key] = settings[key];
    });

    await chrome.storage.sync.set(toStore);
    localVersion = data.version;
    await chrome.storage.local.set({ sync_version: localVersion });

    console.log('Circuit Breaker Sync: pulled version', localVersion);

    // Refresh device role every 5th pull
    pullCount++;
    if (pullCount % 5 === 0) refreshDeviceRole();
  } catch (e) {
    console.log('Circuit Breaker Sync: pull failed', e.message);
  }
}

// --- Push (local → server) ---

function schedulePush() {
  if (!syncEnabled || isPushing || deviceRole === 'locked') return;
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(push, DEBOUNCE_DELAY);
}

async function push() {
  if (!syncEnabled || isPushing || deviceRole === 'locked') return;
  isPushing = true;

  try {
    const data = await chrome.storage.sync.get(SYNC_KEYS);
    const settings = {};
    SYNC_KEYS.forEach(key => {
      if (data[key] !== undefined) settings[key] = data[key];
    });

    const res = await apiFetch('PUT', '/api/v1/sync', {
      settings,
      device_id: deviceId,
    });

    if (res.ok) {
      const result = await res.json();
      localVersion = result.version;
      await chrome.storage.local.set({ sync_version: localVersion });
      console.log('Circuit Breaker Sync: pushed version', localVersion);
    }
  } catch (e) {
    console.log('Circuit Breaker Sync: push failed', e.message);
  }

  isPushing = false;
}

// --- Auth ---

async function signUp(server, email, password) {
  serverUrl = server.replace(/\/$/, '');
  const res = await fetch(`${serverUrl}/api/v1/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Sign up failed');
  }

  const data = await res.json();
  await saveAuth(data);
  await registerDevice();
  syncEnabled = true;
  await push(); // Upload existing local settings on signup
  pull();
  setInterval(pull, POLL_INTERVAL);
  return data;
}

async function signIn(server, email, password) {
  serverUrl = server.replace(/\/$/, '');
  const res = await fetch(`${serverUrl}/api/v1/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Sign in failed');
  }

  const data = await res.json();
  await saveAuth(data);
  await registerDevice();
  syncEnabled = true;
  pull();
  setInterval(pull, POLL_INTERVAL);
  return data;
}

async function deleteAccount() {
  await apiFetch('DELETE', '/api/v1/auth/account');
  await signOut();
}

async function signOut() {
  await chrome.storage.local.remove(['sync_server', 'sync_access_token', 'sync_refresh_token', 'sync_device_id', 'sync_version', 'sync_device_role']);
  syncEnabled = false;
  accessToken = '';
  refreshToken = '';
  deviceId = '';
  deviceRole = 'admin';
  localVersion = 0;
}

async function saveAuth(data) {
  accessToken = data.token;
  refreshToken = data.refresh_token;
  await chrome.storage.local.set({
    sync_server: serverUrl,
    sync_access_token: accessToken,
    sync_refresh_token: refreshToken,
  });
}

async function registerDevice() {
  const ua = navigator.userAgent;
  const browser = ua.includes('Edg/') ? 'Edge' :
                  ua.includes('Firefox') ? 'Firefox' :
                  ua.includes('Chrome') ? 'Chrome' :
                  ua.includes('Safari') ? 'Safari' : 'Browser';
  const os = ua.includes('Macintosh') ? 'macOS' :
             ua.includes('Windows') ? 'Windows' :
             ua.includes('CrOS') ? 'ChromeOS' :
             ua.includes('Linux') ? 'Linux' :
             ua.includes('iPhone') ? 'iPhone' :
             ua.includes('iPad') ? 'iPad' :
             ua.includes('Android') ? 'Android' : 'Unknown';

  const res = await apiFetch('POST', '/api/v1/devices', {
    name: `${browser} on ${os}`,
    platform: browser.toLowerCase(),
    role: 'client',
  });

  if (res.ok) {
    const data = await res.json();
    deviceId = data.device_id;
    deviceRole = data.role || 'client';
    await chrome.storage.local.set({ sync_device_id: deviceId, sync_device_role: deviceRole });
  }
}

async function refreshDeviceRole() {
  if (!syncEnabled || !deviceId) return;
  try {
    const res = await apiFetch('GET', '/api/v1/devices');
    if (!res.ok) return;
    const data = await res.json();
    const thisDevice = data.devices.find(d => d.id === deviceId);
    if (thisDevice && thisDevice.role !== deviceRole) {
      deviceRole = thisDevice.role;
      await chrome.storage.local.set({ sync_device_role: deviceRole });
      console.log('Circuit Breaker Sync: role updated to', deviceRole);
    }
  } catch {}
}

async function refreshAccessToken() {
  if (!refreshToken) return false;

  try {
    const res = await fetch(`${serverUrl}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!res.ok) return false;

    const data = await res.json();
    accessToken = data.token;
    await chrome.storage.local.set({ sync_access_token: accessToken });
    return true;
  } catch {
    return false;
  }
}

// --- API Helper ---

async function apiFetch(method, path, body) {
  let res = await fetch(`${serverUrl}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${accessToken}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  // Token expired? Try refresh
  if (res.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      res = await fetch(`${serverUrl}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    }
  }

  return res;
}

// --- Listen for local changes → trigger push ---

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'sync') return;
  const relevantChange = SYNC_KEYS.some(key => key in changes);
  if (relevantChange) schedulePush();
});

// --- Message handler for popup/options ---

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'sync_signup') {
    signUp(msg.server, msg.email, msg.password)
      .then(data => sendResponse({ ok: true, ...data }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'sync_signin') {
    signIn(msg.server, msg.email, msg.password)
      .then(data => sendResponse({ ok: true, ...data }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'sync_signout') {
    signOut().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'sync_delete_account') {
    deleteAccount()
      .then(() => sendResponse({ ok: true }))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'sync_status') {
    sendResponse({
      enabled: syncEnabled,
      server: serverUrl,
      version: localVersion,
    });
    return true;
  }

  if (msg.type === 'sync_devices') {
    if (!syncEnabled) { sendResponse({ devices: [] }); return true; }
    apiFetch('GET', '/api/v1/devices')
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(() => sendResponse({ devices: [] }));
    return true;
  }

  if (msg.type === 'sync_remove_device') {
    apiFetch('DELETE', `/api/v1/devices/${msg.device_id}`)
      .then(() => sendResponse({ ok: true }))
      .catch(() => sendResponse({ error: 'Failed' }));
    return true;
  }

  if (msg.type === 'sync_subscription') {
    if (!syncEnabled) { sendResponse({ plan: 'free' }); return true; }
    apiFetch('GET', '/api/v1/subscription')
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(() => sendResponse({ plan: 'free' }));
    return true;
  }

  if (msg.type === 'sync_checkout') {
    apiFetch('POST', '/api/v1/subscription/checkout', { plan: msg.plan })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'sync_device_role') {
    sendResponse({ role: deviceRole, device_id: deviceId });
    return true;
  }

  if (msg.type === 'sync_change_device_role') {
    apiFetch('PATCH', `/api/v1/devices/${msg.target_device_id}/role`, {
      role: msg.role,
      requester_device_id: deviceId,
    })
      .then(r => r.json())
      .then(data => sendResponse(data))
      .catch(e => sendResponse({ error: e.message }));
    return true;
  }

  if (msg.type === 'sync_force_push') {
    push().then(() => sendResponse({ ok: true }));
    return true;
  }

  if (msg.type === 'sync_force_pull') {
    pull().then(() => sendResponse({ ok: true }));
    return true;
  }
});

// Start
initSync();

// Circuit Breaker — Background Service Worker v2.0.1

// --- Dev auto-reload: polls a local dev server for build changes ---
// Run `python3 -m http.server 8111` in the extension/ dir to enable
(function devReload() {
  const DEV_URL = 'http://localhost:8111/.build-stamp';
  const POLL_MS = 2000;
  let lastStamp = null;

  async function check() {
    try {
      const res = await fetch(DEV_URL, { cache: 'no-store' });
      if (!res.ok) { setTimeout(check, POLL_MS); return; }
      const stamp = (await res.text()).trim();
      if (lastStamp && stamp !== lastStamp) {
        console.log('Circuit Breaker: build changed, reloading...');
        chrome.runtime.reload();
        return;
      }
      lastStamp = stamp;
    } catch {} // dev server not running — ignore
    setTimeout(check, POLL_MS);
  }
  check();
})();

chrome.runtime.onInstalled.addListener(async () => {
  // Nuke all rules on install/update
  const all = await chrome.declarativeNetRequest.getDynamicRules();
  if (all.length) {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: all.map(r => r.id) });
  }
  applyRules();
  updateStaticRulesets();
});

chrome.runtime.onStartup.addListener(() => { applyRules(); updateStaticRulesets(); });

chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && (changes.blockedDomains || changes.blockedUrls)) {
    applyRules();
  }
  if (area === 'sync' && changes.selections) {
    updateStaticRulesets();
  }
});

// Toggle static rulesets (ad/tracker + cookie consent) based on ads-trackers category
async function updateStaticRulesets() {
  try {
    const data = await chrome.storage.sync.get(['selections']);
    const adsEnabled = data.selections?.['ads-trackers']?.enabled || false;

    await chrome.declarativeNetRequest.updateEnabledRulesets({
      enableRulesetIds: adsEnabled ? ['ads_trackers_network', 'cookie_consent'] : [],
      disableRulesetIds: adsEnabled ? [] : ['ads_trackers_network', 'cookie_consent'],
    });

    console.log('Circuit Breaker: ad/cookie rulesets', adsEnabled ? 'enabled' : 'disabled');
  } catch (e) {
    console.error('Circuit Breaker: static ruleset error:', e.message);
  }
}

let applying = false;

async function applyRules() {
  if (applying) return;
  applying = true;

  try {
    // 1. Remove every existing rule
    const existing = await chrome.declarativeNetRequest.getDynamicRules();
    if (existing.length) {
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: existing.map(r => r.id),
      });
    }

    // 2. Verify they're gone
    const check = await chrome.declarativeNetRequest.getDynamicRules();
    if (check.length) {
      console.warn('Circuit Breaker: stale rules remain, forcing clear');
      await chrome.declarativeNetRequest.updateDynamicRules({
        removeRuleIds: check.map(r => r.id),
      });
    }

    // 3. Build new rules from storage
    const data = await chrome.storage.sync.get(['blockedDomains']);
    const domains = [...new Set((data.blockedDomains || []).filter(Boolean))];

    if (domains.length === 0) {
      chrome.action.setBadgeText({ text: '' });
      applying = false;
      return;
    }

    // Never block the Circuit Breaker dashboard, extension pages, or core infrastructure
    const SAFE_DOMAINS = [
      'fuseboard-sync.joe-780.workers.dev', 'switch-ahg.pages.dev', 'circuitbreaker.app', 'localhost',
      'cloudflare.com', 'cloudflare-dns.com', 'one.one.one.one',
      'chrome.google.com', 'chromewebstore.google.com',
    ];
    const safeDomains = domains.filter(d => !SAFE_DOMAINS.some(safe => d === safe || d.endsWith('.' + safe)));

    const addRules = [];

    // Use requestDomains for exact domain matching (includes subdomains automatically).
    // This is safer than urlFilter: ||domain which can false-positive on substring matches
    // (e.g. ||ea.com could match via urlFilter pattern bugs, but requestDomains won't).
    safeDomains.forEach((domain, i) => {
      addRules.push({
        id: i + 1,
        priority: 1,
        action: { type: 'redirect', redirect: { extensionPath: '/blocked/blocked.html' } },
        condition: { requestDomains: [domain], resourceTypes: ['main_frame'] }
      });
    });

    // 4. Add new rules
    await chrome.declarativeNetRequest.updateDynamicRules({ addRules });

    chrome.action.setBadgeText({ text: String(addRules.length) });
    chrome.action.setBadgeBackgroundColor({ color: '#22c55e' });
    console.log('Circuit Breaker:', addRules.length, 'rules applied');
  } catch (e) {
    console.error('Circuit Breaker:', e.message);
  }

  applying = false;
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'updateRules') {
    // Save selections if provided (from dashboard bridge)
    const toStore = {
      blockedDomains: msg.domains || [],
      blockedUrls: msg.urls || [],
      hiddenSelectors: msg.selectors || {},
    };
    if (msg.selections) toStore.selections = msg.selections;

    chrome.storage.sync.set(toStore, () => {
      applyRules().then(() => {
        updateStaticRulesets();
        sendResponse({ ok: true });
      });
    });
    return true;
  }
  if (msg.action === 'openDashboard') {
    chrome.tabs.create({ url: 'https://circuitbreaker.app/#dashboard' });
  }
});
