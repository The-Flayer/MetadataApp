// Provider config persisted in browser localStorage only. Never server-side.
export const STORAGE_KEY = 'sms.provider';
export const DEFAULT_ENDPOINT = 'http://localhost:20128';
export const DEFAULT_MODEL = ''; // owner picks from 9router dashboard
export const TEST_STUB = false; // never a stub; test hits the real endpoint

function normalizeEndpoint(cfg) {
  // ponytail: CONTRACT keeps DEFAULT_ENDPOINT as 'https://9router.com/v1', but the
  // provider client appends '/v1/chat/completions', so the stored value must carry
  // no trailing slash and no '/v1'. Normalize here so the default stays usable.
  if (cfg && typeof cfg.endpoint === 'string') {
    cfg.endpoint = cfg.endpoint.trim().replace(/\/+$/, '').replace(/\/v1$/i, '');
  }
  return cfg;
}

export function loadConfig() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cfg = JSON.parse(raw);
    if (!cfg || typeof cfg !== 'object') return null;
    return normalizeEndpoint(cfg);
  } catch {
    return null;
  }
}

export function saveConfig(cfg) {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalizeEndpoint({ ...cfg })));
  } catch {
    // storage unavailable (private mode etc.) — config stays in memory only
  }
}

export function validateConfig(cfg) {
  const errors = [];
  if (!cfg || typeof cfg !== 'object') return { valid: false, errors: ['Konfigurasi tidak valid'] };
  normalizeEndpoint(cfg);

  const { endpoint, model, apiKey } = cfg;
  const isLoopback = /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])/i.test(endpoint || '')
  if (!endpoint) {
    errors.push('Endpoint harus diisi');
  } else if (!/^https?:\/\//i.test(endpoint)) {
    errors.push('Endpoint harus berupa URL http/https yang valid')
  } else if (!isLoopback && !/^https:\/\//i.test(endpoint)) {
    errors.push('Endpoint harus berupa URL https (kecuali localhost)');
  } else {
    try {
      new URL(endpoint); // throws on malformed
    } catch {
      errors.push('Endpoint harus berupa URL http/https yang valid');
    }
  }
  if (!model || !String(model).trim()) errors.push('Model harus diisi');
  if (!apiKey || !String(apiKey).trim()) errors.push('API key harus diisi');
  return { valid: errors.length === 0, errors, endpoint: cfg.endpoint, model: cfg.model, apiKey: cfg.apiKey };
}
