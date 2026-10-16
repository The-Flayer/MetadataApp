// No batch cap: every supported file is admitted (owner decision v5.2,
// AC-002 retired). Pairing and type rules below still apply.
export const ACCEPTED = ['.jpg', '.jpeg', '.png', '.svg', '.eps', '.ai'];

const PAIR_EXTS = ['eps', 'ai'];
const RASTER_EXTS = ['jpg', 'jpeg', 'png'];

function extOf(fileName) {
  const base = String(fileName).replace(/\\/g, '/').split('/').pop();
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

export function basenameOf(fileName) {
  const base = String(fileName).replace(/\\/g, '/').split('/').pop();
  const i = base.lastIndexOf('.');
  return i <= 0 ? base : base.slice(0, i);
}

function newId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  return 'a' + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

const RASTER_TYPES = { jpg: 'JPG', jpeg: 'JPG', png: 'PNG' };

export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function fileTypeOf(kind, files) {
  const ext = extOf(files[0]?.name);
  if (kind === 'eps-pair') return ext === 'ai' ? 'AI' : 'EPS';
  if (kind === 'svg') return 'SVG';
  return RASTER_TYPES[ext] || ext.toUpperCase();
}

function makeAsset(kind, files) {
  const blobs = files.map((f) => ({ name: f.name, blob: f }));
  const sizeBytes = blobs.reduce((sum, f) => sum + (f.blob?.size ?? 0), 0);
  return {
    id: newId(),
    kind,
    files: blobs,
    fileType: fileTypeOf(kind, blobs),
    sizeBytes,
    sizeLabel: formatBytes(sizeBytes),
    previewUrl: null,
    rasterB64: null,
    status: 'ready',
    meta: null,
    warnings: [],
    attemptCount: 0,
    error: null,
  };
}

// Returns { accepted: Asset[], rejected: [{name, reason}] }
// Pairing rule: .eps/.ai require a same-basename .jpg in the same drop batch
// (matched case-insensitively on the filename stem).
// existingCount is accepted for backward compatibility and ignored.
export function ingestFiles(fileList, existingCount = 0) {
  const rejected = [];
  const accepted = [];

  const usable = [];
  for (const f of Array.from(fileList || [])) {
    const ext = extOf(f.name);
    if (!ACCEPTED.includes('.' + ext)) {
      rejected.push({ name: f.name, reason: `Unsupported file type: .${ext || '?'}` });
      continue;
    }
    usable.push(f);
  }

  const admitted = usable;

  const jpgStems = new Set();
  for (const f of admitted) if (extOf(f.name) === 'jpg') jpgStems.add(basenameOf(f.name).toLowerCase());

  const usedJpg = new Set();
  for (const f of admitted) {
    const ext = extOf(f.name);
    if (PAIR_EXTS.includes(ext)) {
      const stem = basenameOf(f.name).toLowerCase();
      const companion = `${basenameOf(f.name)}.jpg`;
      if (!jpgStems.has(stem) || usedJpg.has(stem)) {
        rejected.push({ name: f.name, reason: `missing companion: ${companion.toLowerCase()}` });
        continue;
      }
      usedJpg.add(stem);
      const jpg = admitted.find((g) => extOf(g.name) === 'jpg' && basenameOf(g.name).toLowerCase() === stem);
      accepted.push(makeAsset('eps-pair', [f, jpg]));
    } else if (ext === 'jpg' || ext === 'jpeg' || ext === 'png') {
      const stem = basenameOf(f.name).toLowerCase();
      if (usedJpg.has(stem)) continue; // consumed as an eps/ai companion
      accepted.push(makeAsset('raster', [f]));
    } else {
      accepted.push(makeAsset('svg', [f]));
    }
  }

  return { accepted, rejected };
}
