// lowercase, non-alnum -> '-', collapse repeats, trim '-', max 120
export function slugify(title) {
  return String(title ?? '')
    .toLowerCase()
    .replace(/[^\w]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120)
    .replace(/-+$/, '');
}

function extOf(fileName) {
  const base = String(fileName).replace(/\\/g, '/').split('/').pop();
  const i = base.lastIndexOf('.');
  return i <= 0 ? '' : base.slice(i + 1).toLowerCase();
}

// Per-file basename + extension for one asset.
// conflict is false here: a single asset cannot know about batch collisions;
// resolveFilenames owns uniqueness and flags them by diverging from slugify(title)
// (i.e. the returned basename carries a -2/-3 suffix).
export function deriveFilename(asset) {
  return {
    name: slugify(asset?.meta?.title) || 'untitled',
    ext: extOf(asset?.files?.[0]?.name ?? ''),
    conflict: false,
  };
}

// Basenames unique within the batch; EPS+JPG pairs share one basename (own extensions
// applied per file by the caller). Collisions get -2, -3, ...
// Returns Map<assetId, string> of basenames.
export function resolveFilenames(assets) {
  const map = new Map();
  const taken = new Set();
  for (const asset of assets || []) {
    const base = deriveFilename(asset).name;
    let name = base;
    let n = 2;
    while (taken.has(name)) name = `${base}-${n++}`;
    taken.add(name);
    map.set(asset.id, name);
  }
  return map;
}
