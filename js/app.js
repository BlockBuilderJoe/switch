// Switch — Main application logic
import { categories, generatePolicies, generateCustomPolicy } from './blocklists.js';
import {
  getTokenCreateUrl, setToken, validateToken, restoreSession, getSelections,
  saveSelections, runFullSetup, loadExistingState, togglePolicy, clearSession
} from './cloudflare.js';
import { encryptToken, decryptToken, hasVault, clearVault } from './crypto.js';
import {
  detectPlatform, downloadMobileConfig, downloadWindowsScript,
  downloadLinuxScript, getWarpLinks, generateShareLink, shareLink, platforms
} from './device-profiles.js';

// --- State ---
const state = {
  selections: {},
  customDomains: [],
  dnsConfig: null,
};

// Initialize category defaults
categories.forEach(cat => {
  state.selections[cat.id] = {
    enabled: cat.defaultOn,
    sites: {},
  };
  cat.sites.forEach(site => {
    state.selections[cat.id].sites[site.id] = cat.defaultOn;
  });
});

// --- DOM Elements ---
const categoriesGrid = document.getElementById('categories-grid');
const selectionCounter = document.getElementById('selection-counter');
const setupBtn = document.getElementById('setup-btn');
const customDomainInput = document.getElementById('custom-domain-input');
const addDomainBtn = document.getElementById('add-domain-btn');
const customDomainsList = document.getElementById('custom-domains-list');

// --- Wire Color Logic ---
function getWireColor(categoryId) {
  const catState = state.selections[categoryId];
  if (!catState || !catState.enabled) return 'red'; // nothing blocked
  const category = categories.find(c => c.id === categoryId);
  if (category.sites.length === 0) return 'green'; // whole category blocked
  const blockedCount = category.sites.filter(s => catState.sites[s.id]).length;
  if (blockedCount === 0) return 'red';
  if (blockedCount === category.sites.length) return 'green';
  return 'amber';
}

// --- Render FuseBoard ---
state.currentView = 'main';

function renderCategories() {
  if (state.currentView === 'main') {
    renderMainFuseboard();
  } else {
    renderSubFuseboard(state.currentView);
  }
  updateCounter();
}

function renderMainFuseboard() {
  categoriesGrid.innerHTML = '';

  const panel = document.createElement('div');
  panel.className = 'fuse-panel';

  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  categories.forEach(cat => {
    const isTripped = state.selections[cat.id].enabled;
    const hasSites = cat.sites.length > 0;

    const wireColor = getWireColor(cat.id);

    const cell = document.createElement('div');
    cell.className = 'fuse-cell';
    cell.dataset.s = isTripped ? '1' : '0';
    cell.dataset.w = wireColor;
    cell.dataset.cat = cat.id;

    cell.innerHTML = `
      <div class="fuse-cd"></div>
      <div class="fuse-wire fuse-wi"></div>
      <div class="fuse-box">
        <div class="fuse-lb">${cat.name}</div>
        <div class="fuse-trk"><div class="fuse-lev"></div></div>
        <div class="fuse-inf">${cat.sites.length > 0 ? cat.sites.length + ' sites' : 'category'}</div>
        ${hasSites ? '<div class="fuse-cfg">configure</div>' : ''}
      </div>
      <div class="fuse-wire fuse-wo"></div>
      <div class="fuse-cd"></div>
    `;

    // Click the track/lever to toggle
    const trk = cell.querySelector('.fuse-trk');
    trk.addEventListener('click', (e) => {
      e.stopPropagation();
      const catState = state.selections[cat.id];
      catState.enabled = !catState.enabled;
      cat.sites.forEach(s => { catState.sites[s.id] = catState.enabled; });
      renderCategories();
    });

    // Click the cell (not the lever) to drill down
    cell.addEventListener('click', (e) => {
      if (e.target.closest('.fuse-trk')) return;
      if (hasSites) {
        state.currentView = cat.id;
        renderCategories();
      }
    });

    grid.appendChild(cell);
  });

  panel.appendChild(grid);
  categoriesGrid.appendChild(panel);
}

function renderSubFuseboard(categoryId) {
  const cat = categories.find(c => c.id === categoryId);
  if (!cat) { state.currentView = 'main'; renderMainFuseboard(); return; }

  categoriesGrid.innerHTML = '';

  // Back button
  const backBtn = document.createElement('button');
  backBtn.className = 'fuse-back-btn';
  backBtn.innerHTML = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
    Back to FuseBoard
  `;
  backBtn.addEventListener('click', () => {
    state.currentView = 'main';
    renderCategories();
  });
  categoriesGrid.appendChild(backBtn);

  const panel = document.createElement('div');
  panel.className = 'fuse-panel';
  panel.innerHTML = `<div class="fuse-panel-title">${cat.name}</div>`;

  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  cat.sites.forEach(site => {
    const isTripped = state.selections[cat.id].sites[site.id];

    const cell = document.createElement('div');
    cell.className = 'fuse-cell';
    cell.dataset.s = isTripped ? '1' : '0';
    cell.dataset.w = isTripped ? 'green' : 'red';

    cell.innerHTML = `
      <div class="fuse-cd"></div>
      <div class="fuse-wire fuse-wi"></div>
      <div class="fuse-box">
        <div class="fuse-lb">${site.name}</div>
        <div class="fuse-trk"><div class="fuse-lev"></div></div>
      </div>
      <div class="fuse-wire fuse-wo"></div>
      <div class="fuse-cd"></div>
    `;

    cell.addEventListener('click', () => {
      state.selections[cat.id].sites[site.id] = !state.selections[cat.id].sites[site.id];
      // Update parent enabled state
      const anySiteOn = Object.values(state.selections[cat.id].sites).some(v => v);
      state.selections[cat.id].enabled = anySiteOn;
      renderCategories();
    });

    grid.appendChild(cell);
  });

  // If no sites, show a message
  if (cat.sites.length === 0) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:20px;color:var(--text-tertiary);font-size:0.85rem;">This category blocks all matching sites at the DNS level. No individual configuration needed.</div>`;
  }

  panel.appendChild(grid);
  categoriesGrid.appendChild(panel);
}

function updateCounter() {
  const trippedCats = categories.filter(c => state.selections[c.id].enabled).length;
  const hasSelection = trippedCats > 0 || state.customDomains.length > 0;

  if (state.currentView !== 'main') {
    const cat = categories.find(c => c.id === state.currentView);
    if (cat) {
      const blocked = cat.sites.filter(s => state.selections[cat.id].sites[s.id]).length;
      selectionCounter.innerHTML = `<strong>${blocked}</strong> of ${cat.sites.length} sites blocked`;
    }
  } else if (hasSelection) {
    selectionCounter.innerHTML = `<strong>${trippedCats}</strong> ${trippedCats === 1 ? 'fuse' : 'fuses'} tripped${state.customDomains.length ? ` + <strong>${state.customDomains.length}</strong> custom` : ''}`;
  } else {
    selectionCounter.textContent = 'Trip a fuse to block a category';
  }

  setupBtn.disabled = !hasSelection;
}

// --- Custom Domains ---
function addCustomDomain() {
  const val = customDomainInput.value.trim().toLowerCase()
    .replace(/^https?:\/\//, '')
    .replace(/\/.*$/, '')
    .replace(/^www\./, '');

  if (!val || state.customDomains.includes(val)) {
    customDomainInput.value = '';
    return;
  }

  // Basic domain validation
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/.test(val)) {
    customDomainInput.value = '';
    return;
  }

  state.customDomains.push(val);
  customDomainInput.value = '';
  renderCustomDomains();
  updateCounter();
}

function renderCustomDomains() {
  customDomainsList.innerHTML = state.customDomains.map(domain => `
    <span class="domain-tag">
      ${domain}
      <button type="button" aria-label="Remove ${domain}" data-domain="${domain}">&times;</button>
    </span>
  `).join('');

  customDomainsList.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      state.customDomains = state.customDomains.filter(d => d !== btn.dataset.domain);
      renderCustomDomains();
      updateCounter();
    });
  });
}

addDomainBtn.addEventListener('click', addCustomDomain);
customDomainInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    addCustomDomain();
  }
});

// --- Setup Flow (Token Modal) ---

const modal = document.getElementById('token-modal');
const tokenStep1 = document.getElementById('token-step-1');
const tokenStep2 = document.getElementById('token-step-2');
const tokenInput = document.getElementById('token-input');
const tokenSubmitBtn = document.getElementById('token-submit-btn');
const tokenError = document.getElementById('token-error');

// Open modal when setup button clicked
setupBtn.addEventListener('click', () => {
  modal.classList.remove('hidden');
  document.getElementById('create-token-link').href = getTokenCreateUrl();
});

// Close modal
document.getElementById('modal-close-btn').addEventListener('click', () => {
  modal.classList.add('hidden');
});
modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.add('hidden');
});

// After user clicks "Open Cloudflare", show paste step
document.getElementById('create-token-link').addEventListener('click', () => {
  setTimeout(() => {
    tokenStep1.classList.add('hidden');
    tokenStep2.classList.remove('hidden');
    tokenInput.focus();
  }, 500);
});

// Skip to paste
document.getElementById('skip-to-paste').addEventListener('click', () => {
  tokenStep1.classList.add('hidden');
  tokenStep2.classList.remove('hidden');
  tokenInput.focus();
});

// Toggle token visibility
document.getElementById('token-toggle').addEventListener('click', () => {
  const isPassword = tokenInput.type === 'password';
  tokenInput.type = isPassword ? 'text' : 'password';
});

// Enable submit when token pasted
tokenInput.addEventListener('input', () => {
  const val = tokenInput.value.trim();
  tokenSubmitBtn.disabled = val.length < 20;
  tokenError.classList.add('hidden');
});

// Submit token → validate → show PIN creation
tokenSubmitBtn.addEventListener('click', async () => {
  const token = tokenInput.value.trim();
  if (!token) return;

  tokenSubmitBtn.disabled = true;
  tokenSubmitBtn.textContent = 'Validating...';
  tokenError.classList.add('hidden');

  try {
    setToken(token);
    await validateToken();

    // Token valid — show PIN creation step
    state.pendingToken = token;
    tokenStep2.classList.add('hidden');
    document.getElementById('token-step-3').classList.remove('hidden');
    document.getElementById('pin-create-input').focus();
  } catch (err) {
    tokenError.textContent = 'Invalid token. Make sure you copied the full token from Cloudflare.';
    tokenError.classList.remove('hidden');
    tokenSubmitBtn.disabled = false;
    tokenSubmitBtn.textContent = 'Next';
  }
});

// --- PIN Creation (in modal) ---
const pinCreateInput = document.getElementById('pin-create-input');
const pinConfirmInput = document.getElementById('pin-confirm-input');
const pinCreateBtn = document.getElementById('pin-create-btn');
const pinCreateError = document.getElementById('pin-create-error');

function checkPinMatch() {
  const pin = pinCreateInput.value;
  const confirm = pinConfirmInput.value;
  pinCreateBtn.disabled = pin.length < 4 || pin !== confirm;
  pinCreateError.classList.add('hidden');
}

pinCreateInput.addEventListener('input', checkPinMatch);
pinConfirmInput.addEventListener('input', checkPinMatch);
pinConfirmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !pinCreateBtn.disabled) pinCreateBtn.click();
});

pinCreateBtn.addEventListener('click', async () => {
  const pin = pinCreateInput.value;
  const confirm = pinConfirmInput.value;

  if (pin.length < 4) {
    pinCreateError.textContent = 'PIN must be at least 4 digits.';
    pinCreateError.classList.remove('hidden');
    return;
  }
  if (pin !== confirm) {
    pinCreateError.textContent = 'PINs do not match.';
    pinCreateError.classList.remove('hidden');
    return;
  }
  if (!/^\d+$/.test(pin)) {
    pinCreateError.textContent = 'PIN must be numbers only.';
    pinCreateError.classList.remove('hidden');
    return;
  }

  pinCreateBtn.disabled = true;
  pinCreateBtn.textContent = 'Encrypting...';

  try {
    // Encrypt and store the token
    await encryptToken(state.pendingToken, pin);
    setToken(state.pendingToken);
    delete state.pendingToken;

    // Close modal and run setup
    modal.classList.add('hidden');
    runActualSetup();
  } catch (err) {
    pinCreateError.textContent = 'Failed to encrypt token. Please try again.';
    pinCreateError.classList.remove('hidden');
    pinCreateBtn.disabled = false;
    pinCreateBtn.textContent = 'Connect & Set Up My FuseBoard';
  }
});

// Allow Enter key in token input
tokenInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !tokenSubmitBtn.disabled) {
    tokenSubmitBtn.click();
  }
});

async function runActualSetup() {
  document.getElementById('blocker').classList.add('hidden');
  const setupSection = document.getElementById('setup');
  setupSection.classList.remove('hidden');

  const progressFill = document.getElementById('progress-fill');
  const progressText = document.getElementById('progress-text');

  try {
    const policies = generatePolicies(state.selections);
    const customPolicy = generateCustomPolicy(state.customDomains);
    if (customPolicy) policies.push(customPolicy);

    state.dnsConfig = await runFullSetup(policies, (msg, current, total) => {
      progressText.textContent = msg;
      progressFill.style.width = `${(current / total) * 100}%`;
    });

    document.getElementById('setup-progress').classList.add('hidden');
    document.getElementById('setup-complete').classList.remove('hidden');

    // After a moment, transition to the dashboard view
    setTimeout(() => {
      document.getElementById('setup').classList.add('hidden');
      showDashboard();
    }, 3000);

    renderDevices();
  } catch (err) {
    progressText.innerHTML = `<span style="color: var(--red);">Error: ${err.message}</span>`;
    progressFill.style.background = 'var(--red)';
  }
}

// --- Device Setup ---
function renderDevices() {
  const deviceSection = document.getElementById('devices');
  deviceSection.classList.remove('hidden');

  const platform = detectPlatform();
  const dnsConfig = state.dnsConfig;
  if (!dnsConfig) return;

  // Primary device (detected)
  const primaryEl = document.getElementById('device-primary');
  const platformInfo = platforms.find(p => p.id === platform);

  if (platformInfo && platform !== 'unknown') {
    primaryEl.classList.remove('hidden');
    document.getElementById('detected-platform-name').textContent = platformInfo.name;
    document.getElementById('device-primary-title').textContent = platformInfo.action;
    document.getElementById('device-primary-desc').textContent = platformInfo.description;

    const primaryBtn = document.getElementById('device-primary-btn');
    primaryBtn.textContent = platformInfo.action;
    primaryBtn.onclick = () => handleDeviceSetup(platform, dnsConfig);
  }

  // DNS Info
  const dnsInfo = document.getElementById('dns-info');
  dnsInfo.classList.remove('hidden');
  const dnsRows = document.getElementById('dns-rows');
  dnsRows.innerHTML = [
    { label: 'DoH Endpoint', value: dnsConfig.dohEndpoint },
    { label: 'DNS Hostname', value: dnsConfig.dotHostname },
    { label: 'IPv4', value: dnsConfig.ipv4 },
    { label: 'IPv6', value: dnsConfig.ipv6 },
  ].filter(r => r.value).map(row => `
    <div class="dns-row">
      <span class="dns-label">${row.label}</span>
      <span class="dns-value">
        <code>${row.value}</code>
        <button class="copy-btn" data-copy="${row.value}" aria-label="Copy ${row.label}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </span>
    </div>
  `).join('');

  // Copy buttons
  dnsRows.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  });

  // Other device cards
  const deviceGrid = document.getElementById('device-grid');
  deviceGrid.innerHTML = platforms
    .filter(p => p.id !== platform && p.id !== 'router')
    .map(p => `
      <div class="device-card" data-platform="${p.id}">
        ${p.icon}
        <h4>${p.name}</h4>
        <p>${p.description}</p>
      </div>
    `).join('');

  // Add router card
  deviceGrid.innerHTML += `
    <div class="device-card" data-platform="router">
      ${platforms.find(p => p.id === 'router').icon}
      <h4>Router</h4>
      <p>Protect your whole home network</p>
    </div>
  `;

  // WARP card
  deviceGrid.innerHTML += `
    <div class="device-card" data-platform="warp">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" width="28" height="28"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
      <h4>WARP App</h4>
      <p>Works on any device, any network</p>
    </div>
  `;

  deviceGrid.querySelectorAll('.device-card').forEach(card => {
    card.addEventListener('click', () => {
      handleDeviceSetup(card.dataset.platform, dnsConfig);
    });
  });

  // Manual guides accordion
  renderGuides(dnsConfig);

  // Share buttons
  document.getElementById('share-link-btn').addEventListener('click', async () => {
    const result = await shareLink(dnsConfig);
    if (result === 'copied') {
      document.getElementById('share-link-btn').textContent = 'Link copied!';
      setTimeout(() => {
        document.getElementById('share-link-btn').innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
          Share Setup Link
        `;
      }, 2000);
    }
  });

  document.getElementById('copy-link-btn').addEventListener('click', async () => {
    const url = generateShareLink(dnsConfig);
    await navigator.clipboard.writeText(url);
    const btn = document.getElementById('copy-link-btn');
    btn.textContent = 'Copied!';
    setTimeout(() => {
      btn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copy Link
      `;
    }, 2000);
  });
}

function handleDeviceSetup(platform, dnsConfig) {
  switch (platform) {
    case 'ios':
    case 'macos':
      downloadMobileConfig(dnsConfig, platform);
      break;
    case 'android':
      navigator.clipboard.writeText(dnsConfig.dotHostname);
      alert(`DNS hostname copied to clipboard!\n\nGo to:\nSettings > Network & Internet > Private DNS\n\nPaste: ${dnsConfig.dotHostname}`);
      break;
    case 'windows':
      downloadWindowsScript(dnsConfig);
      break;
    case 'linux':
      downloadLinuxScript(dnsConfig);
      break;
    case 'warp': {
      const links = getWarpLinks(dnsConfig.teamName);
      const detectedPlatform = detectPlatform();
      const storeLink = links[detectedPlatform] || links.windows;
      window.open(storeLink, '_blank');
      break;
    }
    case 'router':
      // Scroll to DNS info
      document.getElementById('dns-info').scrollIntoView({ behavior: 'smooth' });
      break;
  }
}

// --- Manual Guides ---
function renderGuides(dnsConfig) {
  const accordion = document.getElementById('guides-accordion');
  const chevronSvg = '<svg class="chevron" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>';

  const guides = [
    {
      name: 'iPhone / iPad',
      icon: platforms.find(p => p.id === 'ios').icon,
      steps: [
        `Tap the <strong>"Install Profile"</strong> button above, or download the .mobileconfig file`,
        `Your iPhone will show <strong>"Profile Downloaded"</strong> — tap it, or go to <strong>Settings</strong>`,
        `Tap <strong>"Profile Downloaded"</strong> at the top of Settings`,
        `Tap <strong>"Install"</strong>, enter your passcode, then tap <strong>"Install"</strong> again`,
        `Done! DNS protection is now active on this device`,
      ]
    },
    {
      name: 'Mac',
      icon: platforms.find(p => p.id === 'macos').icon,
      steps: [
        `Download the <strong>.mobileconfig</strong> file from the button above`,
        `Open the downloaded file — it will appear in <strong>System Settings > Privacy & Security > Profiles</strong>`,
        `Click <strong>"Install"</strong> and enter your password`,
        `Done! DNS protection is now active`,
      ]
    },
    {
      name: 'Android',
      icon: platforms.find(p => p.id === 'android').icon,
      steps: [
        `Open <strong>Settings</strong> on your phone`,
        `Go to <strong>Network & Internet</strong> (or <strong>Connections</strong> on Samsung)`,
        `Tap <strong>Private DNS</strong>`,
        `Select <strong>"Private DNS provider hostname"</strong>`,
        `Enter: <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">${dnsConfig.dotHostname}</code>`,
        `Tap <strong>Save</strong>. Done!`,
      ]
    },
    {
      name: 'Windows',
      icon: platforms.find(p => p.id === 'windows').icon,
      steps: [
        `Download the setup script from the button above`,
        `Right-click the downloaded file and select <strong>"Run with PowerShell"</strong>`,
        `If prompted, click <strong>"Yes"</strong> to allow admin access`,
        `The script will configure DNS on all your network connections`,
        `Done! Close the window when finished`,
      ]
    },
    {
      name: 'Linux',
      icon: platforms.find(p => p.id === 'linux').icon,
      steps: [
        `Download the setup script from the button above`,
        `Open Terminal and navigate to the download folder`,
        `Run: <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">chmod +x switch-setup.sh && sudo ./switch-setup.sh</code>`,
        `The script will detect your DNS system and configure it automatically`,
        `Done! A backup of your previous config is saved`,
      ]
    },
    {
      name: 'Router (whole network)',
      icon: platforms.find(p => p.id === 'router').icon,
      steps: [
        `Open your router admin page (usually <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">192.168.1.1</code> or <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">192.168.0.1</code>)`,
        `Find the <strong>DNS settings</strong> (often under WAN, Internet, or DHCP settings)`,
        `Set Primary DNS to: <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">${dnsConfig.ipv4}</code>`,
        `Set Secondary DNS to: <code style="background:var(--surface-active);padding:2px 8px;border-radius:4px;font-family:var(--font-mono)">${dnsConfig.ipv6 || '1.0.0.1'}</code>`,
        `Save and reboot your router. All devices on your home network are now protected!`,
      ]
    },
  ];

  accordion.innerHTML = guides.map(guide => `
    <div class="guide-item">
      <button class="guide-header" type="button" aria-expanded="false">
        ${guide.icon}
        ${guide.name}
        ${chevronSvg}
      </button>
      <div class="guide-body">
        <div class="guide-content">
          <ol class="guide-steps">
            ${guide.steps.map(step => `<li>${step}</li>`).join('')}
          </ol>
        </div>
      </div>
    </div>
  `).join('');

  accordion.querySelectorAll('.guide-header').forEach(header => {
    header.addEventListener('click', () => {
      const item = header.closest('.guide-item');
      const isOpen = item.classList.contains('open');

      // Close all
      accordion.querySelectorAll('.guide-item').forEach(i => i.classList.remove('open'));

      // Toggle clicked
      if (!isOpen) item.classList.add('open');
      header.setAttribute('aria-expanded', !isOpen);
    });
  });
}

// --- Navigation ---
document.querySelectorAll('a[href^="#"]').forEach(link => {
  link.addEventListener('click', (e) => {
    const target = document.querySelector(link.getAttribute('href'));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: 'smooth' });
    }
  });
});

// --- OAuth Callback Handler ---
if (window.location.search.includes('code=')) {
  handleOAuthCallback()
    .then(() => {
      const selections = getSelections();
      if (selections) {
        Object.assign(state.selections, selections);
      }
      runActualSetup();
    })
    .catch(err => {
      console.error('OAuth error:', err);
      alert('Failed to connect to Cloudflare. Please try again.');
    });
}

// --- Dashboard (returning users) ---

function showDashboard() {
  // Hide onboarding screens
  document.getElementById('home').classList.add('hidden');
  document.getElementById('blocker').classList.add('hidden');
  document.getElementById('setup').classList.add('hidden');

  // Show dashboard
  const dashboard = document.getElementById('dashboard');
  dashboard.classList.remove('hidden');

  // Update nav
  const navLinks = document.querySelector('.nav-links');
  navLinks.innerHTML = `
    <a href="#dashboard" data-nav="dashboard" class="active">My FuseBoard</a>
    <a href="#devices" data-nav="devices">Devices</a>
  `;
  navLinks.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: 'smooth' }); }
    });
  });

  // Show loading
  const grid = document.getElementById('dashboard-grid');
  grid.innerHTML = `
    <div class="dashboard-loading" style="grid-column: 1 / -1;">
      <div class="spinner"></div>
      <p>Loading your FuseBoard...</p>
    </div>
  `;

  loadExistingState()
    .then(({ policies, dnsConfig }) => {
      state.dnsConfig = dnsConfig;
      state.dashboardPolicies = policies;
      renderDashboardGrid(policies);
      renderDashboardDns(dnsConfig);
      renderDevices();

      // Status
      const activeCount = policies.filter(p => p.enabled).length;
      const statusText = document.getElementById('dashboard-status-text');
      const statusDot = document.querySelector('.dashboard-status .status-dot');
      if (activeCount === 0) {
        statusText.textContent = 'All switches are off';
        statusDot.className = 'status-dot';
      } else if (activeCount < policies.length) {
        statusText.textContent = `${activeCount} of ${policies.length} switches active`;
        statusDot.className = 'status-dot partial';
      } else {
        statusText.textContent = `All ${activeCount} switches active`;
        statusDot.className = 'status-dot active';
      }
    })
    .catch(err => {
      console.error('Dashboard load error:', err);
      grid.innerHTML = `
        <div class="banner banner-error" style="grid-column: 1 / -1;">
          <span>Could not load your FuseBoard. Your session may have expired.</span>
        </div>
      `;
      // Fall back to onboarding
      setTimeout(() => {
        clearSession();
        window.location.reload();
      }, 3000);
    });
}

function renderDashboardGrid(policies) {
  const grid = document.getElementById('dashboard-grid');
  grid.innerHTML = '';

  // Map policies back to categories
  categories.forEach(cat => {
    const matchingPolicy = policies.find(p =>
      p.name.includes(cat.name) || p.name.includes(cat.name.split(' ')[0])
    );

    const isActive = matchingPolicy?.enabled ?? false;
    const card = document.createElement('div');
    card.className = `category-card${isActive ? ' active' : ''}`;
    card.dataset.id = cat.id;

    card.innerHTML = `
      <div class="category-header">
        <div class="category-icon">${cat.icon}</div>
        <div class="category-info">
          <div class="category-name">${cat.name}</div>
          <div class="category-desc">${cat.description}</div>
          <span class="policy-status ${isActive ? 'on' : 'off'}">${isActive ? 'Switched off' : 'Allowed'}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${isActive ? 'checked' : ''}
            data-rule-id="${matchingPolicy?.id || ''}"
            data-cat="${cat.id}"
            aria-label="Toggle ${cat.name}">
          <span class="toggle-track"></span>
        </label>
      </div>
    `;

    grid.appendChild(card);
  });

  // Also show any custom/unrecognized Switch policies
  const knownNames = categories.map(c => c.name);
  const customPolicies = policies.filter(p =>
    !knownNames.some(name => p.name.includes(name) || p.name.includes(name.split(' ')[0]))
  );

  customPolicies.forEach(policy => {
    const card = document.createElement('div');
    card.className = `category-card${policy.enabled ? ' active' : ''}`;

    card.innerHTML = `
      <div class="category-header">
        <div class="category-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>
        </div>
        <div class="category-info">
          <div class="category-name">${policy.name.replace('Switch - ', '').replace('Off ', '')}</div>
          <div class="category-desc">Custom rule</div>
          <span class="policy-status ${policy.enabled ? 'on' : 'off'}">${policy.enabled ? 'Switched off' : 'Allowed'}</span>
        </div>
        <label class="toggle">
          <input type="checkbox" ${policy.enabled ? 'checked' : ''}
            data-rule-id="${policy.id}"
            aria-label="Toggle ${policy.name}">
          <span class="toggle-track"></span>
        </label>
      </div>
    `;

    grid.appendChild(card);
  });

  // Bind toggle events — these sync to Cloudflare
  grid.querySelectorAll('.toggle input').forEach(input => {
    input.addEventListener('change', async (e) => {
      e.stopPropagation();
      const ruleId = e.target.dataset.ruleId;
      const enabled = e.target.checked;
      const card = e.target.closest('.category-card');
      const statusEl = card.querySelector('.policy-status');

      card.classList.toggle('active', enabled);
      statusEl.className = `policy-status ${enabled ? 'on' : 'off'}`;
      statusEl.textContent = enabled ? 'Switched off' : 'Allowed';

      if (ruleId) {
        try {
          await togglePolicy(ruleId, enabled);
        } catch (err) {
          // Revert on error
          e.target.checked = !enabled;
          card.classList.toggle('active', !enabled);
          statusEl.className = `policy-status ${!enabled ? 'on' : 'off'}`;
          statusEl.textContent = !enabled ? 'Switched off' : 'Allowed';
          console.error('Failed to toggle policy:', err);
        }
      }

      // Update status bar
      const allToggles = grid.querySelectorAll('.toggle input');
      const activeCount = [...allToggles].filter(t => t.checked).length;
      const statusText = document.getElementById('dashboard-status-text');
      const statusDot = document.querySelector('.dashboard-status .status-dot');
      if (activeCount === 0) {
        statusText.textContent = 'All switches are off';
        statusDot.className = 'status-dot';
      } else if (activeCount < allToggles.length) {
        statusText.textContent = `${activeCount} of ${allToggles.length} switches active`;
        statusDot.className = 'status-dot partial';
      } else {
        statusText.textContent = `All ${activeCount} switches active`;
        statusDot.className = 'status-dot active';
      }
    });
  });
}

function renderDashboardDns(dnsConfig) {
  if (!dnsConfig) return;
  const rows = document.getElementById('dashboard-dns-rows');
  rows.innerHTML = [
    { label: 'DoH Endpoint', value: dnsConfig.dohEndpoint },
    { label: 'DNS Hostname', value: dnsConfig.dotHostname },
    { label: 'IPv4', value: dnsConfig.ipv4 },
    { label: 'IPv6', value: dnsConfig.ipv6 },
  ].filter(r => r.value).map(row => `
    <div class="dns-row">
      <span class="dns-label">${row.label}</span>
      <span class="dns-value">
        <code>${row.value}</code>
        <button class="copy-btn" data-copy="${row.value}" aria-label="Copy ${row.label}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        </button>
      </span>
    </div>
  `).join('');

  rows.querySelectorAll('.copy-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      await navigator.clipboard.writeText(btn.dataset.copy);
      btn.classList.add('copied');
      btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
      setTimeout(() => {
        btn.classList.remove('copied');
        btn.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>';
      }, 2000);
    });
  });
}

// --- Demo Dashboard (for testing) ---
function showDemoDashboard() {
  // Hide onboarding
  document.getElementById('home').classList.add('hidden');
  document.getElementById('blocker').classList.add('hidden');
  document.getElementById('setup').classList.add('hidden');

  const dashboard = document.getElementById('dashboard');
  dashboard.classList.remove('hidden');

  // Update nav
  const navLinks = document.querySelector('.nav-links');
  navLinks.innerHTML = `
    <a href="#dashboard" data-nav="dashboard" class="active">My FuseBoard</a>
    <a href="#devices" data-nav="devices">Devices</a>
  `;

  // Mock policies
  const mockPolicies = [
    { id: 'mock-1', name: 'FuseBoard - Off Social Media', enabled: true, traffic: 'any(dns.content_category[*] in {149})' },
    { id: 'mock-2', name: 'FuseBoard - Off Video Streaming', enabled: false, traffic: 'any(dns.content_category[*] in {164})' },
    { id: 'mock-3', name: 'FuseBoard - Off Ads & Trackers', enabled: true, traffic: 'any(dns.content_category[*] in {66})' },
    { id: 'mock-4', name: 'FuseBoard - Off Adult Content', enabled: true, traffic: 'any(dns.content_category[*] in {67 125 133})' },
    { id: 'mock-5', name: 'FuseBoard - Off Gambling', enabled: true, traffic: 'any(dns.content_category[*] in {99})' },
    { id: 'mock-6', name: 'FuseBoard - Off Gaming', enabled: false, traffic: 'any(dns.domains[*] in {"store.steampowered.com"})' },
    { id: 'mock-7', name: 'FuseBoard - Off News & Doomscrolling', enabled: false, traffic: 'any(dns.content_category[*] in {122})' },
    { id: 'mock-8', name: 'FuseBoard - Off Security Threats', enabled: true, traffic: 'any(dns.security_category[*] in {68 178})' },
  ];

  state.dnsConfig = {
    dohEndpoint: 'https://abc123team.cloudflare-gateway.com/dns-query',
    dotHostname: 'abc123team.cloudflare-gateway.com',
    ipv4: '172.64.36.1',
    ipv6: '2606:4700:4700::1111',
    teamName: 'abc123team',
  };

  state.dashboardPolicies = mockPolicies;
  renderDashboardGrid(mockPolicies);
  renderDashboardDns(state.dnsConfig);
  renderDevices();

  const activeCount = mockPolicies.filter(p => p.enabled).length;
  document.getElementById('dashboard-status-text').textContent = `${activeCount} of ${mockPolicies.length} switches active`;
  document.querySelector('.dashboard-status .status-dot').className = 'status-dot partial';
}

// --- PIN Unlock Screen (returning users) ---
function showPinScreen() {
  // Hide everything else
  document.getElementById('home').classList.add('hidden');
  document.getElementById('blocker').classList.add('hidden');
  document.getElementById('setup').classList.add('hidden');
  document.getElementById('dashboard').classList.add('hidden');

  const pinScreen = document.getElementById('pin-screen');
  pinScreen.classList.remove('hidden');

  const pinInput = document.getElementById('pin-unlock-input');
  const pinError = document.getElementById('pin-unlock-error');
  const pinBtn = document.getElementById('pin-unlock-btn');

  pinInput.focus();

  pinBtn.onclick = async () => {
    const pin = pinInput.value;
    if (pin.length < 4) return;

    pinBtn.disabled = true;
    pinBtn.textContent = 'Unlocking...';
    pinError.classList.add('hidden');

    const token = await decryptToken(pin);
    if (!token) {
      pinError.textContent = 'Wrong PIN. Please try again.';
      pinError.classList.remove('hidden');
      pinBtn.disabled = false;
      pinBtn.textContent = 'Unlock';
      pinInput.value = '';
      pinInput.focus();
      return;
    }

    // Token decrypted — set it and load dashboard
    setToken(token);
    pinScreen.classList.add('hidden');
    showDashboard();
  };

  pinInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') pinBtn.click();
  });

  // Reset button
  document.getElementById('pin-reset-btn').onclick = () => {
    if (confirm('This will remove your saved token. You will need to paste it again.')) {
      clearVault();
      clearSession();
      window.location.reload();
    }
  };
}

// --- Sign Out ---
document.getElementById('sign-out-btn')?.addEventListener('click', () => {
  clearVault();
  clearSession();
  window.location.reload();
});

// --- Dashboard Devices Button ---
document.getElementById('dashboard-devices-btn')?.addEventListener('click', () => {
  const devicesSection = document.getElementById('devices');
  devicesSection.classList.remove('hidden');
  devicesSection.scrollIntoView({ behavior: 'smooth' });
});

// --- Init ---

// Demo mode: ?demo=dashboard shows the returning user dashboard with mock data
if (window.location.search.includes('demo=dashboard')) {
  showDemoDashboard();
}
// Returning user with encrypted vault — show PIN screen
else if (hasVault()) {
  showPinScreen();
}
// Active session token (e.g. just set up) — show dashboard
else if (restoreSession()) {
  showDashboard();
}
// New user — show onboarding
else {
  renderCategories();
}

// Scroll-triggered animations
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('fade-in');
      observer.unobserve(entry.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.category-card, .device-card, .guide-item').forEach(el => {
  observer.observe(el);
});
