// OpenAI-compatible gateway client (9router default). Never logs the API key,
// endpoint, or model; error messages carry only status semantics.
export const TIMEOUT_MS = 60000;

class ProviderError extends Error {
  constructor(message, code) {
    super(message);
    this.code = code;
    this.name = 'ProviderError';
  }
}

// ag/gemini-3.8-flash (9router) wraps JSON in a markdown fence despite
// response_format json_object. Strip fences; bare JSON passes through.
export function unwrapJson(content) {
  if (typeof content !== 'string') return content;
  const trimmed = content.trim();
  const fenced = trimmed.match(/^```[a-zA-Z]*\s*\n([\s\S]*?)\n?```$/);
  if (fenced) return fenced[1].trim();
  return trimmed.replace(/```[a-zA-Z]*|```/g, '').trim();
}

function apiUrl(endpoint) {
  return `${String(endpoint).replace(/\/+$/, '')}/v1/chat/completions`;
}

function buildParts(textPrompt, imageB64) {
  const parts = [{ type: 'text', text: textPrompt }];
  if (imageB64) {
    parts.push({
      type: 'image_url',
      image_url: { url: imageB64.startsWith('data:') ? imageB64 : `data:image/jpeg;base64,${imageB64}` },
    });
  }
  return parts;
}

function mapStatus(status) {
  if (status === 401 || status === 403) return new ProviderError('Authentication failed', 'AUTH');
  if (status === 429) return new ProviderError('Rate limit exceeded', 'RATE');
  if (status >= 500) return new ProviderError('Server error', 'SERVER');
  return new ProviderError('Request failed', 'NETWORK');
}

// Returns the parsed JSON object from choices[0].message.content.
// Throws ProviderError with code in {AUTH, TIMEOUT, RATE, SERVER, BADJSON, NETWORK}.
export async function chatCompletion({ endpoint, model, apiKey, textPrompt, imageB64, signal }) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  if (signal) {
    if (signal.aborted) ctrl.abort();
    else signal.addEventListener('abort', () => ctrl.abort(), { once: true });
  }

  let res;
  try {
    res = await fetch(apiUrl(endpoint), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: buildParts(textPrompt, imageB64) }],
        response_format: { type: 'json_object' },
        stream: false, // 9router SSE-streams by default when omitted (BUG 6)
      }),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    throw ctrl.signal.aborted
      ? new ProviderError('Request timed out', 'TIMEOUT')
      : new ProviderError('Network error', 'NETWORK');
  }
  clearTimeout(timer);

  if (!res.ok) throw mapStatus(res.status);

  let body;
  try {
    body = await res.json();
  } catch {
    // ponytail: defense-in-depth for a stray SSE body (9router streams when
    // stream is omitted). res.json() already consumed the body, so the SSE
    // text arrives via a second read on the same response object.
    const text = typeof res.text === 'function' ? await res.text().catch(() => null) : null;
    const sse = text?.match(/^data: *(.+?)\s*$/gmu);
    const payloads = sse?.map((l) => l.replace(/^data: */u, '').trimEnd()).filter((l) => l && l !== '[DONE]');
    if (!payloads?.length) throw new ProviderError('Bad response body', 'BADJSON');
    try {
      body = JSON.parse(payloads[payloads.length - 1]);
    } catch {
      throw new ProviderError('Bad response body', 'BADJSON');
    }
  }
  const content = body?.choices?.[0]?.message?.content;
  if (content == null) throw new ProviderError('Empty response', 'BADJSON');
  if (typeof content === 'object') return content;
  try {
    return JSON.parse(unwrapJson(content));
  } catch {
    throw new ProviderError('Malformed JSON response', 'BADJSON');
  }
}

// Minimal text-only probe. Returns {ok, message} in Indonesian; no secrets in messages.
export async function testConnection(cfg) {
  try {
    await chatCompletion({
      endpoint: cfg.endpoint,
      model: cfg.model,
      apiKey: cfg.apiKey,
      textPrompt: 'Balas dengan JSON: {"ok": true}',
      imageB64: null,
    });
    return { ok: true, message: `Koneksi berhasil: ${cfg.model}` };
  } catch (err) {
    if (err.code === 'AUTH') return { ok: false, message: 'Autentikasi gagal: periksa kembali API key Anda di pengaturan.' };
    if (err.code === 'TIMEOUT') return { ok: false, message: 'Waktu habis (60s): server tidak merespons, periksa jaringan Anda.' };
    return { ok: false, message: 'Endpoint tidak terjangkau: periksa URL endpoint dan jaringan Anda.' };
  }
}
