import { CATEGORIES } from '../data/categories.js';

export const WEAK_WORDS = [
  'unhealthy',
  'cheap',
  'generic',
  'generic background',
  'web element',
  'junk',
  'hobby',
  'amateur',
  'unprofessional',
  'bitten', // vague standalone keyword (observed in real export audit, v5.4)
];
export const SINGULAR_PLURAL_MIN_LEN = 4; // don't treat e.g. "art"/"arts" as a pair

// Adobe CSV spec: Title is 70 characters maximum and must be plain text with no
// commas. Over-length blocks export (error); a comma warns, since the CSV stays
// valid but Adobe's title field then reads worse.
// https://helpx.adobe.com/stock/contributor/manage-your-portfolio/csv-requirements-content.html
export const TITLE_MAX_LENGTH = 70;

// Title openers that bury the subject behind medium meta-description.
// Checked after stripping one leading article; 'Black and White Cookies' style
// subject-leading titles do NOT match any entry below.
export const FORBIDDEN_OPENERS = [
  'a black and white illustration of',
  'black and white illustration of',
  'a black and white drawing of',
  'black and white drawing of',
  'vector illustration of',
  'vector illustration',
  'an illustration of',
  'illustration of',
  'drawing of',
  'hand drawn',
  'hand-drawn',
  'image of',
  'picture of',
  'photo of',
];

const TITLE_MINOR_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'from', 'vs',
]);

function openerOf(title) {
  const t = String(title ?? '')
    .trim()
    .toLowerCase()
    .replace(/^(a|an|the)\s+/, '');
  const hits = FORBIDDEN_OPENERS.filter((op) => t === op || t.startsWith(op + ' ') || t.startsWith(op + ','));
  hits.sort((a, b) => b.length - a.length);
  return hits[0] || null;
}

// Title Case = every major word starts with a capital letter or digit.
// Single-word titles are exempt (capitalization is only meaningful across words).
function isTitleCase(title) {
  const words = String(title ?? '').trim().split(/\s+/).filter(Boolean);
  if (words.length < 2) return true;
  return words.every((w, i) => {
    const clean = w.replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
    if (!clean) return true;
    if (/^[A-Z0-9]/.test(clean)) return true;
    return i > 0 && TITLE_MINOR_WORDS.has(clean.toLowerCase());
  });
}

function wordsOf(k) {
  return String(k).trim().toLowerCase().split(/\s+/).filter(Boolean);
}

function wordsMatch(a, b) {
  return a === b || isSingularPluralPair(a, b);
}

// True when every word of `short` matches a distinct word of `long`
// (whole-word, singular/plural-aware — so 'tea' never matches 'steak').
function subsumes(longW, shortW) {
  if (shortW.length >= longW.length) return false;
  const pool = [...longW];
  return shortW.every((w) => {
    const i = pool.findIndex((x) => wordsMatch(x, w));
    if (i < 0) return false;
    pool.splice(i, 1);
    return true;
  });
}

function isSingularPluralPair(a, b) {
  if (a === b) return false;
  if (a.length < SINGULAR_PLURAL_MIN_LEN || b.length < SINGULAR_PLURAL_MIN_LEN) return false;
  return a === b + 's' || a === b + 'es' || b === a + 's' || b === a + 'es';
}

// Badge = { level: 'error'|'warn'|'info', code: string, message: string }
export function validateAsset(meta) {
  if (!meta) {
    return { ok: false, badges: [{ level: 'error', code: 'NO_META', message: 'Metadata belum dibuat' }] };
  }

  const badges = [];
  const title = String(meta.title ?? '');
  if (!title) {
    badges.push({ level: 'error', code: 'TITLE_EMPTY', message: 'Title masih kosong' });
  } else if (title.length > TITLE_MAX_LENGTH) {
    badges.push({
      level: 'error',
      code: 'TITLE_LENGTH',
      message: `Title exceeds ${TITLE_MAX_LENGTH} characters (Adobe limit) — now ${title.length}`,
    });
  }
  if (title.includes(',')) {
    badges.push({
      level: 'warn',
      code: 'TITLE_COMMA',
      message: "Title contains a comma — Adobe's spec wants plain text, without commas",
    });
  }
  const opener = openerOf(title);
  if (opener) {
    badges.push({
      level: 'warn',
      code: 'TITLE_OPENER',
      message: `Title buries the subject ('${opener} ...') — lead with the food/item name instead`,
    });
  }
  if (title && !isTitleCase(title)) {
    badges.push({
      level: 'warn',
      code: 'TITLE_CASE',
      message: 'Title is not Title Case — capitalize every major word',
    });
  }

  const kws = Array.isArray(meta.keywords) ? meta.keywords : [];
  const n = kws.length;
  if (n < 15) {
    badges.push({ level: 'warn', code: 'KW_COUNT', message: `Only ${n} keywords - aim for 15-35 accurate ones` });
  } else if (n > 35) {
    badges.push({ level: 'warn', code: 'KW_COUNT', message: `${n} keywords - aim for 15-35 accurate ones` });
  }

  const lower = kws.map((k) => String(k).trim().toLowerCase()).filter(Boolean);
  const seen = new Set();
  for (const k of lower) {
    if (seen.has(k)) badges.push({ level: 'warn', code: 'KW_DUP', message: `Duplicate: '${k}' appears twice` });
    seen.add(k);
  }

  for (let i = 0; i < lower.length; i++) {
    for (let j = i + 1; j < lower.length; j++) {
      if (isSingularPluralPair(lower[i], lower[j])) {
        badges.push({
          level: 'warn',
          code: 'KW_SINGULAR_PLURAL',
          message: `Singular/plural duplicate: '${kws[i]}' and '${kws[j]}'`,
        });
      }
    }
  }

  // Compound/substring + near-synonym detection (v5.4 audit findings).
  // Exact dupes and singular/plural pairs are owned by KW_DUP / KW_SINGULAR_PLURAL
  // above and skipped here to avoid double-flagging. Whole-word matching only,
  // so 'tea' never matches 'steak' and 'pie' never matches 'piece'.
  const wordLists = lower.map(wordsOf);
  for (let i = 0; i < lower.length; i++) {
    for (let j = i + 1; j < lower.length; j++) {
      if (lower[i] === lower[j] || isSingularPluralPair(lower[i], lower[j])) continue;
      const wi = wordLists[i];
      const wj = wordLists[j];
      if (subsumes(wi, wj)) {
        badges.push({
          level: 'warn',
          code: 'KW_SUBSUMED',
          message: `'${kws[j]}' is covered by '${kws[i]}' — keep the more specific term`,
        });
      } else if (subsumes(wj, wi)) {
        badges.push({
          level: 'warn',
          code: 'KW_SUBSUMED',
          message: `'${kws[i]}' is covered by '${kws[j]}' — keep the more specific term`,
        });
      } else if (
        wi.length > 1 &&
        wj.length > 1 &&
        wordsMatch(wi[wi.length - 1], wj[wj.length - 1])
      ) {
        badges.push({
          level: 'warn',
          code: 'KW_NEAR_DUP',
          message: `'${kws[i]}' and '${kws[j]}' share a head noun — keep the single most accurate term`,
        });
      }
    }
  }

  for (const k of kws) {
    if (WEAK_WORDS.some((w) => w.toLowerCase() === String(k).trim().toLowerCase())) {
      badges.push({ level: 'warn', code: 'KW_WEAK', message: `Weak word: '${k}' - remove it` });
    }
  }

  const categoryId = Number(meta.categoryId);
  if (!Number.isInteger(categoryId) || !CATEGORIES.some((c) => c.id === categoryId)) {
    badges.push({ level: 'warn', code: 'CATEGORY', message: 'Select a valid category' });
  }

  return { ok: !badges.some((b) => b.level === 'error'), badges };
}

export function isExportable(asset) {
  return !!asset?.meta && validateAsset(asset.meta).ok;
}
