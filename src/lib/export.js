import Papa from 'papaparse';
import JSZip from 'jszip';
import { CATEGORIES, categoryNumber } from '../data/categories.js';
import { isExportable } from './validate.js';
import { resolveFilenames } from './slug.js';

export const CSV_COLUMNS = ['Filename', 'Title', 'Keywords', 'Category']; // exact order, no other columns

function extOf(fileName) {
  const base = String(fileName).replace(/\\/g, '/').split('/').pop();
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

export function categoryLabel(id) {
  return CATEGORIES.find((c) => c.id === Number(id))?.name ?? '';
}

// Copy-ready per-asset text.
export function copyText(asset) {
  const m = asset?.meta;
  if (!m) return '';
  return [m.title, `Keywords: ${m.keywords.join(', ')}`, `Category: ${categoryLabel(m.categoryId)}`].join('\n');
}

// Files that leave the app. For an eps-pair only the vector file (.eps/.ai)
// is exported — the JPG companion exists solely for AI vision + preview
// (the browser cannot rasterize EPS) and never enters the ZIP or CSV.
export function exportFiles(asset) {
  const files = asset?.files || [];
  if (asset?.kind === 'eps-pair') {
    const vector = files.filter((f) => extOf(f.name) !== 'jpg' && extOf(f.name) !== 'jpeg');
    return vector.length ? vector : files;
  }
  return files;
}

// metadata.csv: keywords comma-separated, RFC4180 quoting (PapaParse).
// Category is the numeric Adobe category ID (7 = Food, 8 = Graphic Resources, ...),
// per Adobe's CSV spec; the human-readable name stays UI-only (categoryLabel/copyText).
export function toCsv(assets) {
  const names = resolveFilenames(assets);
  const rows = [];
  for (const asset of assets || []) {
    if (!isExportable(asset)) continue;
    const base = names.get(asset.id);
    for (const f of exportFiles(asset)) {
      rows.push({
        Filename: `${base}.${extOf(f.name)}`,
        Title: asset.meta.title,
        Keywords: asset.meta.keywords.join(', '),
        // Adobe expects the category NUMBER here, not the name. categoryNumber()
        // accepts either so a stray name in asset.meta still exports correctly.
        Category: categoryNumber(asset.meta.categoryId),
      });
    }
  }
  return Papa.unparse({ fields: CSV_COLUMNS, data: rows });
}

// Renamed files + metadata.csv. Filenames match the CSV exactly.
export async function buildZip(assets) {
  const names = resolveFilenames(assets);
  const zip = new JSZip();
  for (const asset of assets || []) {
    if (!isExportable(asset)) continue;
    const base = names.get(asset.id);
    for (const f of exportFiles(asset)) {
      zip.file(`${base}.${extOf(f.name)}`, await f.blob.arrayBuffer());
    }
  }
  zip.file('metadata.csv', toCsv(assets));
  return zip.generateAsync({ type: 'blob' });
}
