#!/usr/bin/env node
// Circuit Breaker — Generate static declarativeNetRequest rule files
// Fetches Peter Lowe's ad server list + curated cookie consent domains
// Usage: node scripts/generate-rules.js [--check]

const fs = require('fs');
const path = require('path');
const https = require('https');

const RULES_DIR = path.join(__dirname, '..', 'extension', 'data', 'rules');

const SAFE_DOMAINS = [
  'fuseboard-sync.joe-780.workers.dev', 'switch-ahg.pages.dev', 'circuitbreaker.app', 'localhost',
  'cloudflare.com', 'cloudflare-dns.com', 'one.one.one.one',
  'chrome.google.com', 'chromewebstore.google.com',
];

const ALL_RESOURCE_TYPES = [
  'script', 'image', 'stylesheet', 'sub_frame', 'xmlhttprequest',
  'font', 'media', 'websocket', 'ping', 'other', 'main_frame'
];

// Cookie consent management platform domains
const COOKIE_CONSENT_DOMAINS = [
  'onetrust.com', 'cookielaw.org', 'optanon.blob.core.windows.net',
  'cookiebot.com', 'consentcdn.cookiebot.com',
  'quantcast.com', 'quantserve.com',
  'trustarc.com', 'truste.com', 'consent.trustarc.com',
  'didomi.io', 'sdk.privacy-center.org',
  'sourcepoint.com', 'sp-prod.net',
  'evidon.com', 'crownpeak.com',
  'usercentrics.eu', 'usercentrics.com',
  'iubenda.com',
  'osano.com',
  'cookieyes.com',
  'termly.io',
  'cookiefirst.com',
  'axeptio.eu',
  'consentmanager.net',
  'privacy-mgmt.com',
  'cookieinformation.com',
  'cookie-script.com',
  'secureprivacy.ai',
  'cookieconsent.com',
];

// Extra ad/tracker domains to merge (from blocklists.js)
const EXTRA_AD_DOMAINS = [
  'doubleclick.net', 'googlesyndication.com', 'googleadservices.com', 'googletagmanager.com',
  'facebook.net', 'fbsbx.com',
  'amazon-adsystem.com',
  'analytics.tiktok.com', 'ads.tiktok.com',
  'hotjar.com', 'mixpanel.com', 'segment.io', 'amplitude.com', 'fullstory.com',
  'google-analytics.com', 'analytics.google.com', 'clarity.ms',
];

function isSafe(domain) {
  return SAFE_DOMAINS.some(safe => domain === safe || domain.endsWith('.' + safe));
}

function domainToRule(domain, id) {
  return {
    id,
    priority: 1,
    action: { type: 'block' },
    condition: { requestDomains: [domain], resourceTypes: ALL_RESOURCE_TYPES }
  };
}

function fetch(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetch(res.headers.location).then(resolve, reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function generateAdRules() {
  console.log('Fetching Peter Lowe ad server list...');
  const raw = await fetch('https://pgl.yoyo.org/adservers/serverlist.php?hostformat=nohtml&showintro=0&mimetype=plaintext');

  const domains = raw.split('\n')
    .map(line => line.trim().toLowerCase())
    .filter(line => line && !line.startsWith('#'));

  // Merge extra domains
  const all = [...new Set([...domains, ...EXTRA_AD_DOMAINS])];

  // Filter safe domains
  const filtered = all.filter(d => !isSafe(d)).sort();

  console.log(`  ${domains.length} from Peter Lowe + ${EXTRA_AD_DOMAINS.length} extra = ${all.length} total, ${filtered.length} after safety filter`);

  const rules = filtered.map((domain, i) => domainToRule(domain, i + 1));

  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.writeFileSync(path.join(RULES_DIR, 'ads-trackers.json'), JSON.stringify(rules, null, 2));
  console.log(`  Written: extension/data/rules/ads-trackers.json (${rules.length} rules)`);
  return rules.length;
}

function generateCookieRules() {
  const filtered = COOKIE_CONSENT_DOMAINS.filter(d => !isSafe(d)).sort();
  const rules = filtered.map((domain, i) => domainToRule(domain, i + 1));

  fs.mkdirSync(RULES_DIR, { recursive: true });
  fs.writeFileSync(path.join(RULES_DIR, 'cookie-consent.json'), JSON.stringify(rules, null, 2));
  console.log(`  Written: extension/data/rules/cookie-consent.json (${rules.length} rules)`);
  return rules.length;
}

function validate() {
  console.log('\nValidating rule files...');
  let ok = true;

  for (const file of ['ads-trackers.json', 'cookie-consent.json']) {
    const filepath = path.join(RULES_DIR, file);
    if (!fs.existsSync(filepath)) { console.error(`  MISSING: ${file}`); ok = false; continue; }

    const rules = JSON.parse(fs.readFileSync(filepath, 'utf-8'));
    const ids = rules.map(r => r.id);
    const uniqueIds = new Set(ids);

    if (ids.length !== uniqueIds.size) { console.error(`  FAIL: ${file} has duplicate IDs`); ok = false; }

    const safeDomainHits = rules.filter(r => r.condition.requestDomains.some(isSafe));
    if (safeDomainHits.length) { console.error(`  FAIL: ${file} contains SAFE_DOMAINS`); ok = false; }

    if (!rules.every(r => r.action?.type === 'block')) { console.error(`  FAIL: ${file} has non-block actions`); ok = false; }

    console.log(`  OK: ${file} — ${rules.length} rules, IDs unique, no safe domains`);
  }

  return ok;
}

async function main() {
  const checkOnly = process.argv.includes('--check');

  if (checkOnly) {
    const ok = validate();
    process.exit(ok ? 0 : 1);
  }

  const adCount = await generateAdRules();
  const cookieCount = generateCookieRules();

  console.log(`\nTotal: ${adCount + cookieCount} blocking rules`);

  validate();
}

main().catch(e => { console.error(e); process.exit(1); });
