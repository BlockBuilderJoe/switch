// Switch — Token encryption with PIN using Web Crypto API
// Uses PBKDF2 key derivation + AES-GCM encryption

const STORAGE_KEY = 'switch_vault';
const SALT_KEY = 'switch_salt';

// Derive an AES-GCM key from a PIN using PBKDF2
async function deriveKey(pin, salt) {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(pin),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt,
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

// Encrypt the API token with a PIN
export async function encryptToken(token, pin) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(pin, salt);

  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoder.encode(token)
  );

  // Store salt, iv, and encrypted data
  const vault = {
    salt: arrayToBase64(salt),
    iv: arrayToBase64(iv),
    data: arrayToBase64(new Uint8Array(encrypted)),
  };

  localStorage.setItem(STORAGE_KEY, JSON.stringify(vault));
  localStorage.setItem(SALT_KEY, vault.salt);
}

// Decrypt the API token with a PIN
export async function decryptToken(pin) {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return null;

  const vault = JSON.parse(stored);
  const salt = base64ToArray(vault.salt);
  const iv = base64ToArray(vault.iv);
  const data = base64ToArray(vault.data);

  const key = await deriveKey(pin, salt);

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    // Wrong PIN — decryption fails
    return null;
  }
}

// Check if a vault exists (returning user)
export function hasVault() {
  return localStorage.getItem(STORAGE_KEY) !== null;
}

// Clear the vault (reset / sign out)
export function clearVault() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(SALT_KEY);
}

// --- Base64 helpers ---
function arrayToBase64(arr) {
  return btoa(String.fromCharCode(...arr));
}

function base64ToArray(b64) {
  const binary = atob(b64);
  const arr = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    arr[i] = binary.charCodeAt(i);
  }
  return arr;
}
