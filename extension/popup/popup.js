// FuseBox Extension — Popup Logic

const board = document.getElementById('fuseboard');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let selections = {};

function initSelections() {
  categories.forEach(cat => {
    if (!selections[cat.id]) {
      selections[cat.id] = { enabled: cat.defaultOn || false, sites: {}, features: {} };
    }
    (cat.sites || []).forEach(site => {
      if (selections[cat.id].sites[site.id] === undefined) {
        selections[cat.id].sites[site.id] = cat.defaultOn || false;
      }
      (site.features || []).forEach(f => {
        if (selections[cat.id].features[f.id] === undefined) {
          selections[cat.id].features[f.id] = cat.defaultOn || false;
        }
      });
    });
  });
}

function getWireColor(catId) {
  const s = selections[catId];
  if (!s) return 'red';
  const cat = categories.find(c => c.id === catId);
  if (!cat.sites || cat.sites.length === 0) return s.enabled ? 'green' : 'red';
  const blocked = cat.sites.filter(site => s.sites[site.id]).length;
  const anyFeature = cat.sites.some(site => (site.features || []).some(f => s.features[f.id]));
  if (blocked === 0 && !anyFeature) return 'red';
  if (blocked === cat.sites.length) return 'green';
  return 'amber';
}

function render() {
  board.innerHTML = '';

  // Onboarding hint
  const anyActive = categories.some(c => selections[c.id]?.enabled);
  if (!anyActive && !document.body.classList.contains('client-locked')) {
    const hint = document.createElement('div');
    hint.className = 'onboarding-hint';
    hint.textContent = 'Flip a switch to start blocking distractions';
    board.appendChild(hint);
  }

  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  categories.forEach(cat => {
    const isTripped = selections[cat.id]?.enabled || false;
    const wireColor = getWireColor(cat.id);
    const siteCount = (cat.sites || []).length;
    const hasSites = siteCount > 0;

    const cell = document.createElement('div');
    cell.className = 'fuse-cell';
    cell.dataset.s = isTripped ? '1' : '0';
    cell.dataset.w = wireColor;

    cell.innerHTML = `
      <div class="fuse-wire"></div>
      <div class="fuse-box">
        ${cat.icon ? '<div class="fuse-icon">' + cat.icon + '</div>' : ''}
        <div class="fuse-lb">${cat.name}</div>
        <div class="fuse-trk" role="switch" aria-checked="${isTripped}" aria-label="Block ${cat.name}" tabindex="0"><div class="fuse-lev"></div></div>
        <div class="fuse-inf">${hasSites ? siteCount + ' sites' : ''}</div>
        ${hasSites ? '<div class="fuse-cfg">details ›</div>' : ''}
      </div>
      <div class="fuse-wire"></div>
    `;

    const trk = cell.querySelector('.fuse-trk');

    function toggleFuse() {
      if (document.body.classList.contains('client-locked')) return;
      const s = selections[cat.id];
      s.enabled = !s.enabled;
      (cat.sites || []).forEach(site => {
        s.sites[site.id] = s.enabled;
        (site.features || []).forEach(f => {
          s.features[f.id] = s.enabled;
        });
      });
      cell.classList.add('just-toggled');
      setTimeout(() => cell.classList.remove('just-toggled'), 200);
      saveAndRender();
    }

    trk.addEventListener('click', (e) => { e.stopPropagation(); toggleFuse(); });
    trk.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); toggleFuse(); }
    });

    cell.addEventListener('click', (e) => {
      if (e.target.closest('.fuse-trk')) return;
      if (hasSites) {
        chrome.storage.sync.set({ openView: cat.id }, () => {
          chrome.runtime.openOptionsPage();
        });
      }
    });

    grid.appendChild(cell);
  });

  board.appendChild(grid);

  if (document.body.classList.contains('client-locked')) {
    const lockBar = document.createElement('div');
    lockBar.className = 'lock-bar';
    lockBar.textContent = 'Locked — change settings from your admin device';
    board.appendChild(lockBar);
  }

  updateStatus();
}

function updateStatus() {
  const tripped = categories.filter(c => selections[c.id]?.enabled).length;
  if (tripped === 0) {
    statusDot.className = 'status-dot';
    statusText.textContent = 'Nothing blocked yet';
  } else if (tripped === categories.length) {
    statusDot.className = 'status-dot active';
    statusText.textContent = `All ${tripped} categories blocked`;
  } else {
    statusDot.className = 'status-dot partial';
    statusText.textContent = `${tripped} of ${categories.length} blocked`;
  }
}

function saveAndRender() {
  chrome.storage.sync.set({ selections }, () => {
    sendRulesToBackground();
    render();
  });
}

function sendRulesToBackground() {
  const domains = [];
  const urls = [];
  const selectors = {};

  categories.forEach(cat => {
    const s = selections[cat.id];
    if (!s) return;

    (cat.sites || []).forEach(site => {
      const siteOn = s.sites[site.id];
      const siteFeatures = site.features || [];
      const anyFeatureOn = siteFeatures.some(f => s.features[f.id]);
      const allFeaturesOn = siteFeatures.length > 0 && siteFeatures.every(f => s.features[f.id]);

      if (siteOn && (siteFeatures.length === 0 || allFeaturesOn)) {
        (site.domains || []).forEach(d => {
          if (d && !domains.includes(d)) domains.push(d);
        });
        return;
      }

      siteFeatures.forEach(feat => {
        if (!s.features[feat.id]) return;
        if (feat.type === 'url' && feat.urlFilter) {
          if (feat.requestDomains) {
            urls.push({ urlFilter: feat.urlFilter, requestDomains: feat.requestDomains });
          } else {
            urls.push(feat.urlFilter);
          }
        }
        if (feat.type === 'element' && feat.selector) {
          const hostname = (site.domains[0] || '').replace('www.', '');
          if (!selectors[hostname]) selectors[hostname] = [];
          selectors[hostname].push(feat.selector);
        }
        if (feat.elementSelectors) {
          const hostname = (site.domains[0] || '').replace('www.', '');
          if (!selectors[hostname]) selectors[hostname] = [];
          selectors[hostname].push(...feat.elementSelectors);
        }
      });
    });
  });

  console.log('FuseBox sending rules:', { domains: domains.length, urls, selectors });
  chrome.runtime.sendMessage({ type: 'updateRules', domains, urls, selectors });
}

document.getElementById('options-btn').addEventListener('click', () => {
  chrome.runtime.openOptionsPage();
});

chrome.storage.sync.get(['selections'], (data) => {
  if (data.selections) selections = data.selections;
  initSelections();

  chrome.runtime.sendMessage({ type: 'sync_device_role' }, (res) => {
    if (res?.role === 'client') {
      document.body.classList.add('client-locked');
    }
    render();
  });
});
