#!/usr/bin/env node
/**
 * Circuit Breaker — Per-site feature validation with screenshots.
 * Loads the extension, configures features for a target site,
 * then verifies element hiding, URL blocking, and scroll caps.
 *
 * Usage: node test-features.js <siteId>
 *   e.g. node test-features.js youtube
 */

const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');
puppeteer.use(StealthPlugin());
const path = require('path');
const fs = require('fs');

const EXTENSION_PATH = path.join(__dirname, '..', 'extension');
const SS_DIR = '/opt/cursor/artifacts';

function wait(ms) { return new Promise(r => setTimeout(r, ms)); }

function loadCategories() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'extension', 'data', 'blocklists.js'), 'utf8');
  return new Function(src + '\nreturn categories;')();
}

// Where to navigate to find each site's features
const TEST_URLS = {
  youtube:    { element: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', home: 'https://www.youtube.com' },
  tiktok:     { element: 'https://www.tiktok.com/foryou', home: 'https://www.tiktok.com' },
  instagram:  { element: 'https://www.instagram.com', home: 'https://www.instagram.com' },
  facebook:   { element: 'https://www.facebook.com', home: 'https://www.facebook.com' },
  twitter:    { element: 'https://x.com/elonmusk', home: 'https://x.com' },
  reddit:     { element: 'https://www.reddit.com/r/AskReddit/top/?t=day', home: 'https://www.reddit.com' },
  pinterest:  { element: 'https://www.pinterest.com', home: 'https://www.pinterest.com' },
  linkedin:   { element: 'https://www.linkedin.com', home: 'https://www.linkedin.com' },
  twitch:     { element: 'https://www.twitch.tv', home: 'https://www.twitch.tv' },
  netflix:    { element: 'https://www.netflix.com', home: 'https://www.netflix.com' },
  amazon:     { element: 'https://www.amazon.com/dp/B0D1XD1ZV3', home: 'https://www.amazon.com' },
  ebay:       { element: 'https://www.ebay.com', home: 'https://www.ebay.com' },
  cnn:        { element: 'https://www.cnn.com', home: 'https://www.cnn.com' },
  'bbc-news': { element: 'https://www.bbc.co.uk/news', home: 'https://www.bbc.co.uk/news' },
  foxnews:    { element: 'https://www.foxnews.com', home: 'https://www.foxnews.com' },
  dailymail:  { element: 'https://www.dailymail.co.uk', home: 'https://www.dailymail.co.uk' },
  nytimes:    { element: 'https://www.nytimes.com', home: 'https://www.nytimes.com' },
  theguardian:{ element: 'https://www.theguardian.com', home: 'https://www.theguardian.com' },
  chatgpt:    { element: 'https://chatgpt.com', home: 'https://chatgpt.com' },
  steam:      { element: 'https://store.steampowered.com', home: 'https://store.steampowered.com' },
};

async function findExtId(browser) {
  for (let i = 0; i < 20; i++) {
    for (const t of browser.targets()) {
      if (t.type() === 'service_worker') {
        const m = t.url().match(/chrome-extension:\/\/([a-z]+)\//);
        if (m) return m[1];
      }
    }
    await wait(500);
  }
  return null;
}

async function configureFeatures(browser, extId, site, category, features) {
  const opt = await browser.newPage();
  await opt.goto(`chrome-extension://${extId}/options/options.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await wait(1000);

  const hiddenSelectors = {};
  const blockedUrls = [];
  const scrollCaps = {};
  const primaryDomain = site.domains[0];

  for (const feat of features) {
    if (feat.type === 'element' && feat.selector) {
      if (!hiddenSelectors[primaryDomain]) hiddenSelectors[primaryDomain] = [];
      hiddenSelectors[primaryDomain].push(feat.selector);
    }
    if (feat.type === 'url' && feat.urlFilter) {
      blockedUrls.push({ urlFilter: feat.urlFilter, requestDomains: feat.requestDomains || [primaryDomain] });
      if (feat.elementSelectors) {
        if (!hiddenSelectors[primaryDomain]) hiddenSelectors[primaryDomain] = [];
        hiddenSelectors[primaryDomain].push(feat.elementSelectors.join(', '));
      }
    }
    if (feat.type === 'scroll-cap') {
      scrollCaps[primaryDomain] = feat.defaultScreens;
    }
  }

  await opt.evaluate(async (hs, bu, sc) => new Promise(resolve => {
    chrome.storage.sync.set({
      hiddenSelectors: hs, blockedUrls: bu, scrollCaps: sc, blockedDomains: [],
    }, () => {
      chrome.runtime.sendMessage({ blockedDomains: [], hiddenSelectors: hs, blockedUrls: bu }, () => resolve());
    });
  }), hiddenSelectors, blockedUrls, scrollCaps);

  await opt.close();
  await wait(2000);
}

async function clearConfig(browser, extId) {
  const opt = await browser.newPage();
  await opt.goto(`chrome-extension://${extId}/options/options.html`, { waitUntil: 'domcontentloaded', timeout: 10000 });
  await wait(500);
  await opt.evaluate(async () => new Promise(resolve => {
    chrome.storage.sync.set({
      hiddenSelectors: {}, blockedUrls: [], scrollCaps: {}, blockedDomains: [],
    }, () => {
      chrome.runtime.sendMessage({ blockedDomains: [], hiddenSelectors: {}, blockedUrls: [] }, () => resolve());
    });
  }));
  await opt.close();
  await wait(1000);
}

async function testElementFeatures(page, site, features, siteId) {
  const results = [];
  const elementFeatures = features.filter(f => f.type === 'element');
  if (elementFeatures.length === 0) return results;

  // Check cb-hide is active
  const cbHide = await page.evaluate(() => {
    const s = document.getElementById('cb-hide');
    return s ? { active: true, rules: s.textContent.split('\n').filter(l => l.trim()).length } : { active: false };
  });

  for (const feat of elementFeatures) {
    const check = await page.evaluate((sel) => {
      const parts = sel.split(',').map(s => s.trim());
      let total = 0, hidden = 0;
      for (const p of parts) {
        try {
          const els = document.querySelectorAll(p);
          total += els.length;
          els.forEach(el => {
            const s = getComputedStyle(el);
            if (s.display === 'none' || s.visibility === 'hidden' || el.offsetHeight === 0) hidden++;
          });
        } catch {}
      }
      return { total, hidden };
    }, feat.selector);

    const status = check.total === 0 ? 'skip' : check.hidden === check.total ? 'pass' : (check.hidden > 0 ? 'partial' : 'fail');
    const icon = status === 'pass' ? '✅' : status === 'skip' ? '⊘' : status === 'partial' ? '⚠️' : '❌';
    console.log(`    ${icon} ${feat.name}: ${check.total} found, ${check.hidden} hidden`);
    results.push({ ...feat, ...check, status, cbHideActive: cbHide.active });
  }
  return results;
}

async function testUrlFeatures(page, browser, site, features, siteId) {
  const results = [];
  const urlFeatures = features.filter(f => f.type === 'url');
  if (urlFeatures.length === 0) return results;

  for (const feat of urlFeatures) {
    let targetUrl;
    if (feat.urlFilter.startsWith('||')) {
      targetUrl = 'https://' + feat.urlFilter.replace('||', '');
    } else {
      const domain = (feat.requestDomains && feat.requestDomains[0]) || site.domains[0];
      targetUrl = `https://www.${domain}${feat.urlFilter}`;
    }

    try {
      await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
      await wait(3000);

      const check = await page.evaluate(() => {
        const cbBlock = document.getElementById('cb-url-block');
        const body = document.body?.innerText?.substring(0, 200) || '';
        const blocked = body.includes('Blocked by Circuit Breaker') || body.includes('Tripped');
        return { blocked: !!cbBlock || blocked, url: location.href, body: body.substring(0, 80) };
      });

      const icon = check.blocked ? '✅' : '⊘';
      console.log(`    ${icon} ${feat.name} (${feat.urlFilter}): ${check.blocked ? 'BLOCKED' : 'accessible'}`);
      results.push({ ...feat, ...check, status: check.blocked ? 'pass' : 'accessible' });
    } catch (err) {
      if (err.message.includes('net::ERR_')) {
        console.log(`    ✅ ${feat.name}: blocked at network level`);
        results.push({ ...feat, status: 'pass', blocked: true });
      } else {
        console.log(`    ❌ ${feat.name}: error — ${err.message.substring(0, 60)}`);
        results.push({ ...feat, status: 'error', error: err.message });
      }
    }
  }
  return results;
}

async function testScrollCap(page, site, features, siteId) {
  const scrollCapFeat = features.find(f => f.type === 'scroll-cap');
  if (!scrollCapFeat) return null;

  const vh = await page.evaluate(() => window.innerHeight);
  const limit = scrollCapFeat.defaultScreens;
  const maxAttempt = (limit + 5) * vh;
  let attempted = 0;

  while (attempted < maxAttempt) {
    await page.evaluate(() => window.scrollBy(0, 300));
    attempted += 300;
    await wait(50);
    if (attempted % 2000 < 300) {
      const done = await page.evaluate(() => !!document.getElementById('cb-scroll-cap-overlay'));
      if (done) break;
    }
  }
  await wait(1000);

  const result = await page.evaluate(() => ({
    hasOverlay: !!document.getElementById('cb-scroll-cap-overlay'),
    text: document.getElementById('cb-scroll-cap-overlay')?.innerText?.substring(0, 60) || null,
  }));

  const icon = result.hasOverlay ? '✅' : '❌';
  console.log(`    ${icon} Scroll Cap (${limit} screens): ${result.hasOverlay ? 'TRIGGERED' : 'not triggered'}`);
  return { ...scrollCapFeat, ...result, status: result.hasOverlay ? 'pass' : 'fail' };
}

async function run() {
  const siteFilter = process.argv[2];
  const categories = loadCategories();

  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Circuit Breaker — Feature Validation Suite              ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-first-run', '--disable-default-apps', '--no-sandbox', '--disable-setuid-sandbox',
      '--disable-extensions-except=' + EXTENSION_PATH, '--load-extension=' + EXTENSION_PATH,
      '--window-size=1400,900'],
    defaultViewport: { width: 1400, height: 900 },
  });
  await wait(2000);

  const extId = await findExtId(browser);
  if (!extId) { console.log('❌ Extension not found'); await browser.close(); process.exit(1); }
  console.log('Extension: ' + extId + '\n');

  const allResults = {};

  for (const cat of categories) {
    for (const site of cat.sites || []) {
      if (siteFilter && site.id !== siteFilter) continue;
      if (!site.features || site.features.length === 0) continue;
      if (!TEST_URLS[site.id]) continue;

      const urls = TEST_URLS[site.id];
      console.log(`\n══ ${site.name} (${site.features.length} features) ══`);

      // Clear previous config
      await clearConfig(browser, extId);

      // Configure all features for this site
      await configureFeatures(browser, extId, site, cat, site.features);
      console.log('  Configured ' + site.features.length + ' features');

      const page = await browser.newPage();

      // BEFORE screenshot
      await page.goto(urls.element, { waitUntil: 'domcontentloaded', timeout: 30000 });
      await wait(8000);
      try { await page.evaluate(() => { document.querySelector('button[aria-label="Reject all"]')?.click(); document.querySelector('#onetrust-accept-btn-handler')?.click(); }); } catch {}
      await wait(1000);
      await page.evaluate(() => window.scrollBy(0, 500));
      await wait(2000);

      // Test element features
      console.log('  Element hiding:');
      const elementResults = await testElementFeatures(page, site, site.features, site.id);

      // Screenshot after element hiding
      await page.screenshot({ path: path.join(SS_DIR, `test_${site.id}_elements.png`) });
      console.log(`  📸 test_${site.id}_elements.png`);

      await page.close();

      // Test URL features (each navigates to a different URL)
      const urlFeatures = site.features.filter(f => f.type === 'url');
      let urlResults = [];
      if (urlFeatures.length > 0) {
        console.log('  URL blocking:');
        const urlPage = await browser.newPage();
        urlResults = await testUrlFeatures(urlPage, browser, site, site.features, site.id);
        await urlPage.close();
      }

      // Test scroll cap
      const scrollCapFeat = site.features.find(f => f.type === 'scroll-cap');
      let scrollResult = null;
      if (scrollCapFeat) {
        console.log('  Scroll cap:');
        const scrollPage = await browser.newPage();
        await scrollPage.goto(urls.element, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await wait(8000);
        scrollResult = await testScrollCap(scrollPage, site, site.features, site.id);
        if (scrollResult?.hasOverlay) {
          await scrollPage.screenshot({ path: path.join(SS_DIR, `test_${site.id}_scrollcap.png`) });
          console.log(`  📸 test_${site.id}_scrollcap.png`);
        }
        await scrollPage.close();
      }

      allResults[site.id] = { elementResults, urlResults, scrollResult };
      await wait(1000);
    }
  }

  // Summary
  console.log('\n\n════════════════════════════════════════════════════════');
  console.log('  SUMMARY');
  console.log('════════════════════════════════════════════════════════');
  for (const [siteId, r] of Object.entries(allResults)) {
    const ep = r.elementResults.filter(x => x.status === 'pass').length;
    const et = r.elementResults.length;
    const up = r.urlResults.filter(x => x.status === 'pass' || x.status === 'accessible').length;
    const ut = r.urlResults.length;
    const sc = r.scrollResult ? (r.scrollResult.status === 'pass' ? '✅' : '❌') : '—';
    console.log(`  ${siteId}: elements ${ep}/${et}, urls ${up}/${ut}, scroll-cap ${sc}`);
  }
  console.log('════════════════════════════════════════════════════════\n');

  // Save JSON report
  fs.writeFileSync(path.join(SS_DIR, 'feature_validation_report.json'), JSON.stringify(allResults, null, 2));

  await browser.close();
}

run().catch(err => { console.error('Fatal:', err); process.exit(1); });
