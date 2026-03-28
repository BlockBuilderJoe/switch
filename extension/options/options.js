// FuseBoard — Options Page Logic (full drill-down)

const board = document.getElementById('fuseboard');
const nav = document.getElementById('nav');
const titleEl = document.getElementById('title');
const statusDot = document.getElementById('status-dot');
const statusText = document.getElementById('status-text');

let selections = {};
let currentView = 'main';

function initSelections() {
  categories.forEach(cat => {
    if (!selections[cat.id]) {
      selections[cat.id] = { enabled: cat.defaultOn || false, sites: {}, features: {} };
    }
    // Always ensure all sites and features exist (handles new additions)
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
  if (!s || !s.enabled) return 'red';
  const cat = categories.find(c => c.id === catId);
  if (!cat.sites || cat.sites.length === 0) return 'green';
  const blocked = cat.sites.filter(site => s.sites[site.id]).length;
  if (blocked === 0) return 'red';
  if (blocked === cat.sites.length) return 'green';
  return 'amber';
}

function render() {
  if (currentView === 'main') renderMain();
  else if (currentView.includes('/')) renderFeatures(currentView);
  else renderSites(currentView);
}

function renderMain() {
  nav.innerHTML = '';
  titleEl.textContent = 'Your FuseBoard';
  board.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  categories.forEach(cat => {
    const isTripped = selections[cat.id]?.enabled || false;
    const wire = getWireColor(cat.id);
    const hasSites = (cat.sites || []).length > 0;
    const cell = createFuseCell(cat.name, isTripped, wire, hasSites ? (cat.sites.length + ' sites') : 'category', hasSites);

    cell.querySelector('.fuse-trk').addEventListener('click', (e) => {
      e.stopPropagation();
      const s = selections[cat.id];
      s.enabled = !s.enabled;
      (cat.sites || []).forEach(site => {
        s.sites[site.id] = s.enabled;
        (site.features || []).forEach(f => { s.features[f.id] = s.enabled; });
      });
      saveAndRender();
    });

    cell.addEventListener('click', (e) => {
      if (e.target.closest('.fuse-trk')) return;
      if (hasSites) { currentView = cat.id; render(); }
    });

    grid.appendChild(cell);
  });
  board.appendChild(grid);
  updateStatus();
}

function renderSites(catId) {
  const cat = categories.find(c => c.id === catId);
  if (!cat) { currentView = 'main'; render(); return; }

  nav.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'back-btn';
  back.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to FuseBoard';
  back.addEventListener('click', () => { currentView = 'main'; render(); });
  nav.appendChild(back);

  titleEl.textContent = cat.name;
  board.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  (cat.sites || []).forEach(site => {
    const isTripped = selections[cat.id].sites[site.id] || false;
    const hasFeatures = (site.features || []).length > 0;
    let wire = 'red';
    if (isTripped) {
      wire = 'green';
    } else if (hasFeatures) {
      const anyFeatOn = (site.features || []).some(f => selections[cat.id].features[f.id]);
      const allFeatOn = (site.features || []).every(f => selections[cat.id].features[f.id]);
      if (allFeatOn) wire = 'green';
      else if (anyFeatOn) wire = 'amber';
    }
    const showTripped = isTripped || wire !== 'red';
    const cell = createFuseCell(site.name, showTripped, wire, hasFeatures ? (site.features.length + ' features') : '', hasFeatures);

    cell.querySelector('.fuse-trk').addEventListener('click', (e) => {
      e.stopPropagation();
      selections[cat.id].sites[site.id] = !selections[cat.id].sites[site.id];
      const anySiteOn = Object.values(selections[cat.id].sites).some(v => v);
      selections[cat.id].enabled = anySiteOn;
      (site.features || []).forEach(f => {
        selections[cat.id].features[f.id] = selections[cat.id].sites[site.id];
      });
      saveAndRender();
    });

    cell.addEventListener('click', (e) => {
      if (e.target.closest('.fuse-trk')) return;
      if (hasFeatures) { currentView = cat.id + '/' + site.id; render(); }
    });

    grid.appendChild(cell);
  });
  board.appendChild(grid);
  updateStatus();
}

function renderFeatures(path) {
  const [catId, siteId] = path.split('/');
  const cat = categories.find(c => c.id === catId);
  const site = cat?.sites?.find(s => s.id === siteId);
  if (!cat || !site) { currentView = 'main'; render(); return; }

  nav.innerHTML = '';
  const back = document.createElement('button');
  back.className = 'back-btn';
  back.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg> Back to ${cat.name}`;
  back.addEventListener('click', () => { currentView = catId; render(); });
  nav.appendChild(back);

  titleEl.textContent = site.name + ' — Features';
  board.innerHTML = '';
  const grid = document.createElement('div');
  grid.className = 'fuse-grid';

  (site.features || []).forEach(feat => {
    const isTripped = selections[cat.id].features[feat.id] || false;
    const wire = isTripped ? 'green' : 'red';
    const cell = createFuseCell(feat.name, isTripped, wire, feat.type === 'allowlist' ? 'allow list' : feat.type, false);

    cell.addEventListener('click', () => {
      selections[cat.id].features[feat.id] = !selections[cat.id].features[feat.id];

      // Special handling for Subs Only Mode
      if (feat.type === 'allowlist') {
        chrome.storage.sync.set({ subsOnlyMode: selections[cat.id].features[feat.id] });
      }

      saveAndRender();
    });

    grid.appendChild(cell);
  });

  board.appendChild(grid);

  // If Subs Only Mode feature exists and is on, show the allowed channels editor
  const subsFeature = (site.features || []).find(f => f.type === 'allowlist');
  if (subsFeature && selections[cat.id].features[subsFeature.id]) {
    const editor = document.createElement('div');
    editor.style.cssText = 'margin-top:16px;padding:16px;background:var(--surface);border:1px solid var(--border);border-radius:12px;';

    chrome.storage.sync.get(['allowedChannels'], (data) => {
      const channels = data.allowedChannels || [];
      editor.innerHTML = `
        <div style="font-weight:700;font-size:.85rem;margin-bottom:10px;color:#e0e2e8">Allowed Channels</div>
        <div style="font-size:.75rem;color:#666;margin-bottom:12px">Only videos from these channels will be allowed. Add @handles or channel names.</div>
        <div style="display:flex;gap:8px;margin-bottom:4px">
          <input type="text" id="channel-input" placeholder="Search or type @ChannelName" style="flex:1;background:#07080a;border:1px solid #1e2028;border-radius:8px;padding:8px 12px;color:#e4e6ea;font-size:.82rem;outline:none">
          <button id="add-channel-btn" style="background:#22c55e;color:#000;border:none;border-radius:8px;padding:8px 16px;font-weight:700;font-size:.82rem;cursor:pointer">Add</button>
        </div>
        <div id="search-results" style="margin-bottom:10px"></div>
        <div id="channel-list" style="display:flex;flex-wrap:wrap;gap:6px">
          ${channels.map(c => `
            <span style="display:inline-flex;align-items:center;gap:6px;padding:4px 10px;background:#1e2028;border:1px solid #2a2e38;border-radius:100px;font-size:.78rem;font-family:monospace;color:#aab">
              ${c}
              <button data-ch="${c}" style="background:none;border:none;color:#555;cursor:pointer;font-size:1rem;line-height:1;padding:0">&times;</button>
            </span>
          `).join('')}
        </div>
      `;

      const input = editor.querySelector('#channel-input');
      const searchResults = editor.querySelector('#search-results');
      let searchTimeout;

      // Live search as user types
      input.addEventListener('input', () => {
        clearTimeout(searchTimeout);
        const q = input.value.trim();
        if (q.length < 2) { searchResults.innerHTML = ''; return; }

        searchTimeout = setTimeout(async () => {
          searchResults.innerHTML = '<div style="font-size:.7rem;color:#555;padding:4px 0">Searching...</div>';
          try {
            const resp = await fetch(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&sp=EgIQAg%3D%3D`);
            const html = await resp.text();

            // Extract channel info from YouTube's initial data
            const match = html.match(/var ytInitialData = ({.*?});<\/script>/s);
            if (!match) { searchResults.innerHTML = ''; return; }

            const data = JSON.parse(match[1]);
            const items = data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents || [];

            const channelResults = items
              .filter(i => i.channelRenderer)
              .slice(0, 5)
              .map(i => {
                const ch = i.channelRenderer;
                return {
                  name: ch.title?.simpleText || '',
                  handle: ch.channelId || '',
                  customUrl: ch.subscriberCountText?.simpleText || '',
                  thumb: ch.thumbnail?.thumbnails?.[0]?.url || '',
                };
              });

            if (channelResults.length === 0) {
              searchResults.innerHTML = '<div style="font-size:.7rem;color:#555;padding:4px 0">No channels found</div>';
              return;
            }

            searchResults.innerHTML = channelResults.map(ch => `
              <div class="search-ch" data-name="${ch.name}" style="display:flex;align-items:center;gap:8px;padding:6px 8px;border-radius:8px;cursor:pointer;transition:.15s;margin-bottom:2px">
                <img src="${ch.thumb}" style="width:28px;height:28px;border-radius:50%;background:#1e2028">
                <div style="flex:1;min-width:0">
                  <div style="font-size:.78rem;font-weight:600;color:#ccd;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${ch.name}</div>
                  <div style="font-size:.6rem;color:#555">${ch.customUrl}</div>
                </div>
                <div style="font-size:.65rem;color:#22c55e;font-weight:600;flex-shrink:0">+ Add</div>
              </div>
            `).join('');

            searchResults.querySelectorAll('.search-ch').forEach(el => {
              el.addEventListener('mouseenter', () => { el.style.background = '#12141a'; });
              el.addEventListener('mouseleave', () => { el.style.background = ''; });
              el.addEventListener('click', () => {
                const name = el.dataset.name;
                if (!channels.includes(name)) {
                  channels.push(name);
                  chrome.storage.sync.set({ allowedChannels: channels }, () => {
                    input.value = '';
                    searchResults.innerHTML = '';
                    render();
                  });
                }
              });
            });
          } catch (e) {
            searchResults.innerHTML = '<div style="font-size:.7rem;color:#555;padding:4px 0">Search failed — type the channel name and click Add</div>';
          }
        }, 400);
      });

      // Manual add button
      editor.querySelector('#add-channel-btn').addEventListener('click', () => {
        const val = input.value.trim();
        if (!val) return;
        channels.push(val);
        chrome.storage.sync.set({ allowedChannels: channels }, () => {
          input.value = '';
          searchResults.innerHTML = '';
          render();
        });
      });

      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') editor.querySelector('#add-channel-btn').click();
      });

      // Remove channel buttons
      editor.querySelectorAll('[data-ch]').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = channels.indexOf(btn.dataset.ch);
          if (idx > -1) channels.splice(idx, 1);
          chrome.storage.sync.set({ allowedChannels: channels }, () => render());
        });
      });
    });

    board.appendChild(editor);
  }

  updateStatus();
}

function createFuseCell(label, isTripped, wireColor, info, canDrill) {
  const cell = document.createElement('div');
  cell.className = 'fuse-cell';
  cell.dataset.s = isTripped ? '1' : '0';
  cell.dataset.w = wireColor;
  cell.innerHTML = `
    <div class="fuse-cd"></div>
    <div class="fuse-wire fuse-wi"></div>
    <div class="fuse-box">
      <div class="fuse-lb">${label}</div>
      <div class="fuse-trk"><div class="fuse-lev"></div></div>
      ${info ? '<div class="fuse-inf">' + info + '</div>' : ''}
      ${canDrill ? '<div class="fuse-cfg">configure</div>' : ''}
    </div>
    <div class="fuse-wire fuse-wo"></div>
    <div class="fuse-cd"></div>
  `;
  return cell;
}

function updateStatus() {
  const tripped = categories.filter(c => selections[c.id]?.enabled).length;
  if (tripped === 0) { statusDot.className = 'status-dot'; statusText.textContent = 'All fuses open'; }
  else if (tripped === categories.length) { statusDot.className = 'status-dot active'; statusText.textContent = `All ${tripped} fuses tripped`; }
  else { statusDot.className = 'status-dot partial'; statusText.textContent = `${tripped} of ${categories.length} fuses tripped`; }
}

function saveAndRender() {
  chrome.storage.sync.set({ selections }, () => {
    const domains = [], urls = [], selectors = {};
    categories.forEach(cat => {
      const s = selections[cat.id];
      if (!s) return;
      (cat.sites || []).forEach(site => {
        const siteOn = s.sites[site.id];
        const siteFeatures = site.features || [];
        const allFeaturesOn = siteFeatures.length > 0 && siteFeatures.every(f => s.features[f.id]);

        // Whole site blocked
        if (siteOn && (siteFeatures.length === 0 || allFeaturesOn)) {
          (site.domains || []).forEach(d => { if (d && !domains.includes(d)) domains.push(d); });
          return;
        }

        // Individual features (regardless of site toggle)
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
            const h = (site.domains[0] || '').replace('www.', '');
            if (!selectors[h]) selectors[h] = [];
            selectors[h].push(feat.selector);
          }
          if (feat.elementSelectors) {
            const h = (site.domains[0] || '').replace('www.', '');
            if (!selectors[h]) selectors[h] = [];
            selectors[h].push(...feat.elementSelectors);
          }
        });
      });
    });
    chrome.runtime.sendMessage({ type: 'updateRules', domains, urls, selectors });
    render();
  });
}

// Changelog toggle
document.getElementById('changelog-toggle').addEventListener('click', () => {
  const el = document.getElementById('changelog');
  if (el.style.display === 'none') {
    el.style.display = 'block';
    document.getElementById('changelog-toggle').style.color = '#888';
  } else {
    el.style.display = 'none';
    document.getElementById('changelog-toggle').style.color = '#3a3e48';
  }
});

// Populate changelog
document.getElementById('changelog').innerHTML = `
  <div style="font-weight:700;font-size:.9rem;color:#e0e2e8;margin-bottom:12px">Changelog</div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#22c55e;margin-bottom:4px">v1.4.2 — Rule Engine Fix</div>
    <ul style="padding-left:16px;color:#777">
      <li>Fixed duplicate rule ID errors on extension reload</li>
      <li>Rules now use timestamp-based IDs to guarantee uniqueness</li>
      <li>Separate clear-then-add flow prevents race conditions</li>
    </ul>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#ccd;margin-bottom:4px">v1.4.1 — Changelog & Amber Fix</div>
    <ul style="padding-left:16px;color:#777">
      <li>Added in-app changelog</li>
      <li>Version number in popup and options header</li>
      <li>Fixed amber wire color on sub-fuseboard</li>
    </ul>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#22c55e;margin-bottom:4px">v1.4.0 — Feature Explosion</div>
    <ul style="padding-left:16px;color:#777">
      <li>Added 41 new blockable features across 13 sites</li>
      <li>YouTube: Autoplay, Live Chat, Premium Upsell, View Counts, Subscribe Button, Mixes</li>
      <li>TikTok: Like Counts, Share Button</li>
      <li>Twitter/X: Premium Upsell, Promoted Posts, Spaces, View Counts</li>
      <li>Reddit: Promoted Posts, Vote Counts, Suggested Subs</li>
      <li>Twitch: Pre-roll Ads, Bits, Subscribe Button, Prime Upsell</li>
      <li>Amazon: Sponsored Products, Prime Upsell, Reviews</li>
      <li>News sites: Cookie banners, autoplay video, comments, paywalls</li>
      <li>Fixed 13 broken selectors across 6 sites</li>
    </ul>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#ccd;margin-bottom:4px">v1.3 — SPA Navigation Fix</div>
    <ul style="padding-left:16px;color:#777">
      <li>Fixed YouTube Shorts blocking on SPA navigation</li>
      <li>Content script intercepts history.pushState</li>
      <li>Inline blocked message instead of redirect</li>
      <li>YouTube channel search for Subs Only Mode</li>
      <li>Quick-allow button on blocked page</li>
    </ul>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#ccd;margin-bottom:4px">v1.2 — Feature-Level Blocking</div>
    <ul style="padding-left:16px;color:#777">
      <li>3-level drill-down: Category &rarr; Site &rarr; Feature</li>
      <li>80+ blockable features across all major sites</li>
      <li>URL blocking + element hiding + SPA interception</li>
      <li>Subs Only Mode for YouTube and Twitch</li>
    </ul>
  </div>

  <div style="margin-bottom:14px">
    <div style="font-weight:700;color:#ccd;margin-bottom:4px">v1.1 — Browser Extension</div>
    <ul style="padding-left:16px;color:#777">
      <li>Pivoted from Cloudflare DNS to Chrome extension</li>
      <li>FuseBoard UI in extension popup</li>
      <li>12 categories, domain blocking, element hiding</li>
      <li>Branded blocked page</li>
    </ul>
  </div>

  <div>
    <div style="font-weight:700;color:#ccd;margin-bottom:4px">v1.0 — Initial Release</div>
    <ul style="padding-left:16px;color:#777">
      <li>FuseBoard web app with fuseboard visual metaphor</li>
      <li>Cloudflare Zero Trust Gateway DNS integration</li>
      <li>PIN-encrypted token storage</li>
      <li>Device setup guides for all platforms</li>
    </ul>
  </div>
`;

// Load state
chrome.storage.sync.get(['selections', 'openView'], (data) => {
  if (data.selections) selections = data.selections;
  initSelections();
  if (data.openView) {
    currentView = data.openView;
    chrome.storage.sync.remove('openView');
  }
  render();
});
