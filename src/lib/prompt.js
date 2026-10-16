import { CATEGORIES } from '../data/categories.js';
import { WEAK_WORDS, SINGULAR_PLURAL_MIN_LEN } from './validate.js';
import { unwrapJson } from './providerClient.js';

// Niche-aware prompt engine: Black-and-White Food Line Art (PRD §3 Feature 3).
// No secrets, filenames, or user data are embedded — the image is sent separately.
export function buildPrompt() {
  const cats = CATEGORIES.map((c) => `${c.id}. ${c.name}`).join('\n');
  return [
    'You write Adobe Stock metadata for a portfolio of BLACK-AND-WHITE FOOD LINE-ART vector illustrations: hand-drawn monochrome line art of food, ingredients, utensils, and dishes.',
    'Analyze the image and return metadata as JSON with EXACTLY these 5 keys: title, keywords, category_id, confidence, warnings. No other keys are allowed — never market_appeal, never social_caption.',
    '',
    'KEYWORDS (the most important part):',
    '- Return between 15 and 35 keywords. Accuracy beats count: never pad with filler, generic, or irrelevant terms.',
    '- Keywords are ORDERED by weight, and positions 1-10 carry the most weight on Adobe Stock.',
    '  * Put the SUBJECT terms first (what the food or item actually is, e.g. "olive oil", "ice cream", "avocado", "pasta").',
    '  * THEN the style/medium terms — still INSIDE the first 10 positions: "line art", "black and white", "vector illustration", "monochrome", "hand drawn".',
    '  * Style terms must NEVER appear only at position 11 or later.',
    '- Keep compound terms WHOLE as a single keyword: "line art" (not "line" + "art"), "olive oil", "ice cream", "black and white". Never split compounds into single words.',
    '- No duplicate keywords, and never both a singular and its plural (choose "banana" OR "bananas", not both).',
    '- COMPOUND DEDUP: never emit both a base term and its compound/plural variant ("cinnamon" + "cinnamon sticks", "skillet" + "cast iron skillet", "pie" + "meat pie" + "pot pie", "cabbage" + "pickled cabbage"). Keep the MORE SPECIFIC compound term, drop the bare one.',
    '- No near-synonym pairs for the same depicted object ("glass jar" + "mason jar", "cup" + "mug"). Pick the single most accurate term.',
    '- Every keyword must be a searchable noun or an established compound term a buyer would type ("bubble tea", "cast iron skillet"). No vague single words ("bitten", "tasty"), no fragments.',
    '- Never use these weak/banned words: ' + WEAK_WORDS.join(', ') + '.',
    '',
    'TITLE:',
    '- The title MUST start directly with the depicted subject (the food or item name).',
    '- FORBIDDEN openers: "Hand drawn ...", "Vector illustration of ...", "A black and white illustration of ...", "Black and white illustration of ...", or any sentence describing the medium instead of the subject.',
    '- BAD: "Hand drawn vector illustration of a bubble tea cup". GOOD: "Bubble Tea Cup with Tapioca Pearls".',
    '- Always use Title Case: capitalize every major word ("Fresh Apple Line Art", never "Fresh apple line art").',
    '- A natural, readable stock-title phrase describing the image. HARD MAXIMUM 70 characters.',
    '- No commas anywhere in the title (Adobe requires plain text) — join phrases with "and", "with" or "on" instead of a comma list.',
    '- Not a keyword dump: no comma-separated keyword lists, no hashtags, no keyword stuffing.',
    '',
    'CATEGORY:',
    '- category_id must be one of these 21 official Adobe Stock category IDs:',
    cats,
    '',
    'CONFIDENCE: a float from 0 to 1 expressing your confidence the metadata is accurate.',
    'WARNINGS: an array of strings noting any ambiguity (uncertain ingredient, unclear subject, low-confidence detail). Empty array if none.',
    '',
    'Reply with ONLY the JSON object — no commentary, no markdown fence. Title and keywords in English.',
  ].join('\n');
}

const RETIRED_KEYS = ['market_appeal', 'social_caption'];

function isSingularPluralPair(a, b) {
  if (a === b) return false;
  if (a.length < SINGULAR_PLURAL_MIN_LEN || b.length < SINGULAR_PLURAL_MIN_LEN) return false;
  return a === b + 's' || a === b + 'es' || b === a + 's' || b === a + 'es';
}

function dedupe(keywords) {
  const kept = [];
  for (const raw of keywords) {
    const k = String(raw).trim().toLowerCase();
    if (!k) continue;
    if (kept.some((prev) => prev === k || isSingularPluralPair(prev, k))) continue;
    kept.push(k);
  }
  return kept;
}

// Defensive normalizer: coerces keys, warns (never silently drops) on keyword-count
// drift, dedupes case-insensitively + singular/plural, strips weak words.
// Throws on retired fields (market_appeal / social_caption), missing title, empty
// keywords, or an invalid category_id.
export function parseMetadata(rawJson) {
  const raw = typeof rawJson === 'string' ? JSON.parse(unwrapJson(rawJson)) : rawJson;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Respons model bukan objek JSON');
  }
  for (const key of RETIRED_KEYS) {
    if (key in raw) throw new Error(`Respons mengandung field yang sudah dipensiunkan: ${key}`);
  }

  const title = String(raw.title ?? '').trim();
  if (!title) throw new Error('Title tidak boleh kosong');

  if (!Array.isArray(raw.keywords)) throw new Error('keywords harus berupa array');
  const keywords = raw.keywords.map((k) => String(k ?? '').trim()).filter(Boolean);
  if (!keywords.length) throw new Error('keywords tidak boleh kosong');

  const warnings = Array.isArray(raw.warnings)
    ? raw.warnings.map(String)
    : raw.warnings == null || raw.warnings === ''
      ? []
      : [String(raw.warnings)];

  const clean = dedupe(keywords).filter((k) => !WEAK_WORDS.some((w) => w.toLowerCase() === k));

  if (clean.length < 15) warnings.push(`Only ${clean.length} keywords - aim for 15-35 accurate ones`);
  else if (clean.length > 35) warnings.push(`${clean.length} keywords - aim for 15-35 accurate ones`);

  const categoryId = Number(raw.category_id ?? raw.categoryId);
  if (!Number.isInteger(categoryId) || !CATEGORIES.some((c) => c.id === categoryId)) {
    throw new Error('category_id tidak valid (harus salah satu dari 1-21)');
  }

  let confidence = Number(raw.confidence);
  if (!Number.isFinite(confidence)) confidence = 0;
  confidence = Math.min(1, Math.max(0, confidence));

  return { title, keywords: clean, categoryId, confidence, warnings };
}
