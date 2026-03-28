// Switch — Cloudflare API Token integration
// All API calls run client-side. No backend needed.

const CF_API = 'https://api.cloudflare.com/client/v4';

// Pre-filled token creation URL — opens Cloudflare dashboard with correct permissions
const TOKEN_CREATE_URL = 'https://dash.cloudflare.com/profile/api-tokens?permissionGroupKeys=%5B%7B%22key%22%3A%22zero_trust%22%2C%22type%22%3A%22edit%22%7D%5D&name=Switch';

let accessToken = null;
let accountId = null;

// --- Token Management ---

export function getTokenCreateUrl() {
  return TOKEN_CREATE_URL;
}

export function setToken(token) {
  accessToken = token;
  sessionStorage.setItem('switch_token', token);
}

export function restoreSession() {
  accessToken = sessionStorage.getItem('switch_token');
  return !!accessToken;
}

export function clearSession() {
  accessToken = null;
  accountId = null;
  sessionStorage.removeItem('switch_token');
  sessionStorage.removeItem('switch_selections');
}

export function saveSelections(selections) {
  sessionStorage.setItem('switch_selections', JSON.stringify(selections));
}

export function getSelections() {
  const saved = sessionStorage.getItem('switch_selections');
  return saved ? JSON.parse(saved) : null;
}

// --- API Helpers ---

async function cfApi(path, options = {}) {
  const res = await fetch(`${CF_API}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  const data = await res.json();
  if (!data.success) {
    const msg = data.errors?.[0]?.message || 'Cloudflare API error';
    throw new Error(msg);
  }
  return data.result;
}

// --- Validate Token ---

export async function validateToken() {
  const result = await cfApi('/user/tokens/verify');
  return result?.status === 'active';
}

// --- Account Setup ---

export async function getAccount() {
  const accounts = await cfApi('/accounts?per_page=5');
  if (!accounts || accounts.length === 0) {
    throw new Error('No Cloudflare account found.');
  }
  accountId = accounts[0].id;
  return accountId;
}

export async function getExistingPolicies() {
  const rules = await cfApi(`/accounts/${accountId}/gateway/rules`);
  return rules || [];
}

// --- Create Policies ---

export async function createPolicies(policies, onProgress) {
  const existing = await getExistingPolicies();
  const existingNames = new Set(existing.map(r => r.name));
  let created = 0;

  for (const policy of policies) {
    if (existingNames.has(policy.name)) {
      created++;
      onProgress?.(`Skipping "${policy.name}" (already exists)`, created, policies.length);
      continue;
    }

    await cfApi(`/accounts/${accountId}/gateway/rules`, {
      method: 'POST',
      body: JSON.stringify(policy),
    });

    created++;
    onProgress?.(`Created "${policy.name}"`, created, policies.length);
  }

  return created;
}

// --- DNS Location ---

export async function getOrCreateDnsLocation() {
  const locations = await cfApi(`/accounts/${accountId}/gateway/locations`);

  if (locations && locations.length > 0) {
    return locations[0];
  }

  const location = await cfApi(`/accounts/${accountId}/gateway/locations`, {
    method: 'POST',
    body: JSON.stringify({
      name: 'FuseBoard DNS',
      client_default: true,
    }),
  });

  return location;
}

export async function getDnsConfig() {
  const location = await getOrCreateDnsLocation();
  return {
    dohEndpoint: location.doh_subdomain
      ? `https://${location.doh_subdomain}.cloudflare-gateway.com/dns-query`
      : null,
    dotHostname: location.doh_subdomain
      ? `${location.doh_subdomain}.cloudflare-gateway.com`
      : null,
    ipv4: location.ip || location.endpoints?.ipv4?.ip,
    ipv6: location.endpoints?.ipv6?.ip,
    teamName: location.doh_subdomain,
  };
}

// --- Toggle / Update Policy ---

export async function togglePolicy(ruleId, enabled) {
  await cfApi(`/accounts/${accountId}/gateway/rules/${ruleId}`, {
    method: 'PATCH',
    body: JSON.stringify({ enabled }),
  });
}

export async function deletePolicy(ruleId) {
  await cfApi(`/accounts/${accountId}/gateway/rules/${ruleId}`, {
    method: 'DELETE',
  });
}

// --- Load Existing State (for returning users) ---

export async function loadExistingState() {
  await getAccount();
  const policies = await getExistingPolicies();
  const dnsConfig = await getDnsConfig();

  const switchPolicies = policies.filter(p => p.name.startsWith('Switch - '));

  return { policies: switchPolicies, allPolicies: policies, dnsConfig };
}

// --- Full Setup Flow ---

export async function runFullSetup(policies, onProgress) {
  onProgress?.('Connecting to your account...', 0, 4);

  await getAccount();
  onProgress?.('Connected!', 1, 4);

  onProgress?.('Setting up your Switch rules...', 1, 4);
  await createPolicies(policies, (msg, current, total) => {
    onProgress?.(`Configuring... (${current}/${total})`, 1 + (current / total), 4);
  });
  onProgress?.('Switch rules active!', 3, 4);

  onProgress?.('Almost there...', 3, 4);
  const dnsConfig = await getDnsConfig();
  onProgress?.('All done!', 4, 4);

  return dnsConfig;
}
