import { chatCompletion } from './providerClient.js';
import { buildPrompt, parseMetadata } from './prompt.js';
import { rasterizeAsset } from './preprocess.js';

const MAX_ATTEMPTS = 3; // 1 initial + 2 retries (NFR-003)
const RETRYABLE = new Set(['RATE', 'SERVER', 'TIMEOUT', 'BADJSON']);

function backoff(attempt) {
  return new Promise((resolve) => setTimeout(resolve, 800 * attempt));
}

function friendlyError(err) {
  switch (err?.code) {
    case 'TIMEOUT':
      return 'Waktu habis (60s): tidak ada respons dari model.';
    case 'RATE':
      return 'Rate limit: terlalu banyak permintaan, coba lagi nanti.';
    case 'SERVER':
      return 'Server provider bermasalah, coba lagi.';
    case 'BADJSON':
      return 'Respons model tidak valid (bukan JSON).';
    case 'AUTH':
      return 'Autentikasi gagal: periksa API key di pengaturan provider.';
    case 'NETWORK':
      return 'Jaringan tidak tersedia atau endpoint tidak terjangkau.';
    default:
      return err?.message || 'Gagal menghasilkan metadata.';
  }
}

// One asset: preprocess (if needed) -> up to 3 attempts, AUTH/abort not retried.
export async function runOne({ asset, cfg, onProgress, signal }) {
  const notify = () => onProgress?.(asset);
  asset.status = 'queued';
  asset.error = null;
  notify();

  if (!asset.rasterB64) {
    try {
      await rasterizeAsset(asset);
    } catch (err) {
      asset.status = 'failed';
      asset.error = friendlyError(err);
      notify();
      return;
    }
  }

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    asset.attemptCount = attempt;
    asset.status = 'processing';
    notify();

    const t0 = Date.now();
    try {
      const raw = await chatCompletion({
        endpoint: cfg.endpoint,
        model: cfg.model,
        apiKey: cfg.apiKey,
        textPrompt: buildPrompt(),
        imageB64: asset.rasterB64,
        signal,
      });
      asset.meta = parseMetadata(raw);
      asset.durationMs = Date.now() - t0;
      asset.status = 'done';
      asset.error = null;
      notify();
      return;
    } catch (err) {
      asset.durationMs = Date.now() - t0;
      if (signal?.aborted) {
        asset.status = 'failed';
        asset.error = 'Dibatalkan oleh pengguna.';
        notify();
        return;
      }
      if (err.code === 'AUTH' || !RETRYABLE.has(err.code)) {
        asset.status = 'failed';
        asset.error = friendlyError(err);
        notify();
        return;
      }
      if (attempt < MAX_ATTEMPTS) {
        asset.status = 'queued';
        asset.error = `Gagal, mengulang (${attempt}/2)...`;
        notify();
        await backoff(attempt);
      } else {
        asset.status = 'failed';
        asset.error = friendlyError(err);
        notify();
        return;
      }
    }
  }
}

// Sequential queue (concurrency 1). Batch continues when one asset fails.
export async function runQueue({ assets, cfg, onProgress, signal }) {
  for (const asset of assets || []) {
    if (signal?.aborted) return;
    await runOne({ asset, cfg, onProgress, signal });
  }
}
