// Pure-node assert self-checks. Run with: npm run test
import assert from 'node:assert/strict';
import { basenameOf, ingestFiles, formatBytes } from '../src/lib/upload.js';
import { slugify, deriveFilename, resolveFilenames } from '../src/lib/slug.js';
import { validateAsset, isExportable, WEAK_WORDS, SINGULAR_PLURAL_MIN_LEN } from '../src/lib/validate.js';
import { buildPrompt, parseMetadata } from '../src/lib/prompt.js';
import { toCsv, buildZip, copyText, categoryLabel, CSV_COLUMNS, exportFiles } from '../src/lib/export.js';
import Papa from 'papaparse';
import JSZip from 'jszip';
import { CATEGORIES } from '../src/data/categories.js';
import { validateConfig, STORAGE_KEY, DEFAULT_ENDPOINT, TEST_STUB } from '../src/config/provider.js';
import { chatCompletion, testConnection, TIMEOUT_MS, unwrapJson } from '../src/lib/providerClient.js';
import { runOne } from '../src/lib/queue.js';

let pass = 0;
const fail = [];
function check(name, fn) {
  try {
    fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail.push({ name, err });
    console.log(`  FAIL ${name}\n         ${err.message}`);
  }
}
async function checkAsync(name, fn) {
  try {
    await fn();
    pass++;
    console.log(`  ok   ${name}`);
  } catch (err) {
    fail.push({ name, err });
    console.log(`  FAIL ${name}\n         ${err.message}`);
  }
}
const file = (name) => ({ name });

console.log('\n== slug ==');
check('slugify basic', () => {
  assert.equal(slugify('Black & White Olive Oil Line Art!'), 'black-white-olive-oil-line-art');
  assert.equal(slugify('  ---Hello,,,  World---  '), 'hello-world');
  assert.equal(slugify('Café au Lait'), 'caf-au-lait');
});
check('slugify collapse + max 120', () => {
  assert.equal(slugify('a'.repeat(150)).length, 120);
  assert.equal(slugify('!!!???...'), '');
});
check('deriveFilename empty title -> untitled', () => {
  const a = { meta: { title: '' }, files: [{ name: 'photo.JPG' }] };
  assert.deepEqual(deriveFilename(a), { name: 'untitled', ext: 'jpg', conflict: false });
});
check('resolveFilenames: pair shares basename, collisions suffixed', () => {
  const pair = { id: 'p1', kind: 'eps-pair', meta: { title: 'Apple Line Art' }, files: [{ name: 'a.EPS' }, { name: 'a.jpg' }] };
  const other = { id: 'o1', kind: 'raster', meta: { title: 'apple line art' }, files: [{ name: 'b.png' }] };
  const third = { id: 't1', kind: 'raster', meta: { title: 'apple line art' }, files: [{ name: 'c.png' }] };
  const map = resolveFilenames([pair, other, third]);
  assert.equal(map.get('p1'), 'apple-line-art');
  assert.equal(map.get('o1'), 'apple-line-art-2');
  assert.equal(map.get('t1'), 'apple-line-art-3');
});

console.log('\n== upload ==');
check('basenameOf', () => {
  assert.equal(basenameOf('apple.eps'), 'apple');
  assert.equal(basenameOf('C:\\art\\Apple.JPG'), 'Apple');
});
check('AC-003 eps without jpg rejected, names companion', () => {
  const { accepted, rejected } = ingestFiles([file('apple.eps')]);
  assert.equal(accepted.length, 0);
  assert.equal(rejected[0].reason, 'missing companion: apple.jpg');
});
check('eps+jpg pair accepted as eps-pair [eps, jpg]', () => {
  const { accepted, rejected } = ingestFiles([file('apple.EPS'), file('APPLE.jpg')]);
  assert.equal(rejected.length, 0);
  assert.equal(accepted.length, 1);
  assert.equal(accepted[0].kind, 'eps-pair');
  assert.deepEqual(accepted[0].files.map((f) => f.name), ['apple.EPS', 'APPLE.jpg']);
});
check('ai pairs too; svg standalone; unsupported rejected', () => {
  const { accepted, rejected } = ingestFiles([file('x.ai'), file('x.jpg'), file('y.svg'), file('z.txt')]);
  assert.equal(accepted.length, 2);
  assert.equal(accepted[0].kind, 'eps-pair');
  assert.equal(accepted[1].kind, 'svg');
  assert.equal(rejected.length, 1);
  assert.ok(rejected[0].reason.startsWith('Unsupported file type'));
});
check('AC-002 retired v5.2: no batch cap, 20 files all accepted', () => {
  const files = [];
  for (let i = 0; i < 20; i++) files.push(file(`f${i}.jpg`));
  const { accepted, rejected } = ingestFiles(files);
  assert.equal(accepted.length, 20);
  assert.equal(rejected.length, 0);
});
check('AC-002 retired v5.2: existingCount ignored, all admitted', () => {
  const { accepted, rejected } = ingestFiles([file('a.jpg'), file('b.jpg'), file('c.jpg')], 15);
  assert.equal(accepted.length, 3);
  assert.equal(rejected.length, 0);
});
check('two eps one jpg: second eps rejected', () => {
  const { accepted, rejected } = ingestFiles([file('a.eps'), file('a.eps'), file('a.jpg')]);
  assert.equal(accepted.length, 1);
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].reason, 'missing companion: a.jpg');
});
check('formatBytes: B / KB / MB', () => {
  assert.equal(formatBytes(500), '500 B');
  assert.equal(formatBytes(1024), '1 KB');
  assert.equal(formatBytes(1536), '2 KB');
  assert.equal(formatBytes(1572864), '1.5 MB');
});
check('fileType per kind: EPS / AI / SVG / JPG / PNG', () => {
  assert.equal(ingestFiles([file('apple.EPS'), file('apple.jpg')]).accepted[0].fileType, 'EPS');
  assert.equal(ingestFiles([file('x.ai'), file('x.jpg')]).accepted[0].fileType, 'AI');
  assert.equal(ingestFiles([file('y.svg')]).accepted[0].fileType, 'SVG');
  assert.equal(ingestFiles([file('z.jpg')]).accepted[0].fileType, 'JPG');
  assert.equal(ingestFiles([file('z.jpeg')]).accepted[0].fileType, 'JPG');
  assert.equal(ingestFiles([file('z.png')]).accepted[0].fileType, 'PNG');
});
check('sizeBytes sums blob sizes; sizeLabel non-empty', () => {
  const named = ingestFiles([{ name: 'a.eps', size: 1000 }, { name: 'a.jpg', size: 24 }]);
  assert.equal(named.accepted[0].sizeBytes, 1024);
  assert.equal(named.accepted[0].sizeLabel, '1 KB');
  // blobs with a .size property stand in for File in node
  const noSize = ingestFiles([file('a.eps'), file('a.jpg')]);
  assert.equal(noSize.accepted[0].sizeBytes, 0); // missing blob -> 0
  assert.ok(noSize.accepted[0].sizeLabel.length > 0);
});
check('raster asset has no dims until rasterize runs', () => {
  const a = ingestFiles([file('z.jpg')]).accepted[0];
  assert.equal('dims' in a, false);
  assert.equal(a.dims, undefined);
});

console.log('\n== validate ==');
const mk = (title, kws, cat = 7) => ({ title, keywords: kws, categoryId: cat, confidence: 0.9, warnings: [] });
const kw = (n) => Array.from({ length: n }, (_, i) => `k${i}`);
check('AC-014 title >70 is an error and blocks export (Adobe limit)', () => {
  const r = validateAsset(mk('x'.repeat(71), kw(20)));
  assert.equal(r.ok, false);
  assert.ok(r.badges.some((b) => b.level === 'error' && b.code === 'TITLE_LENGTH'));
  assert.equal(isExportable({ meta: mk('x'.repeat(71), kw(20)) }), false);
});
check('title of exactly 70 chars exports clean', () => {
  const r = validateAsset(mk('x'.repeat(70), kw(20)));
  assert.equal(r.ok, true);
  assert.ok(!r.badges.some((b) => b.code === 'TITLE_LENGTH'));
});
check('comma in title warns but still exports (Adobe: plain text, no commas)', () => {
  const r = validateAsset(mk('Ramen Bowl, Chashu Pork and Egg', kw(20)));
  assert.equal(r.ok, true);
  assert.ok(r.badges.some((b) => b.code === 'TITLE_COMMA'));
});
check('keyword count warns outside 15-35', () => {
  assert.ok(validateAsset(mk('t', kw(10))).badges.some((b) => b.code === 'KW_COUNT'));
  assert.ok(validateAsset(mk('t', kw(36))).badges.some((b) => b.code === 'KW_COUNT'));
  assert.equal(validateAsset(mk('t', kw(20))).badges.length, 0);
});
check('duplicate detection (ci)', () => {
  const r = validateAsset(mk('t', [...kw(14), 'banana', 'Banana']));
  assert.ok(r.badges.some((b) => b.code === 'KW_DUP'));
});
check('AC-012 singular/plural pair flagged, art/arts not', () => {
  const r = validateAsset(mk('t', [...kw(13), 'banana', 'bananas']));
  assert.ok(r.badges.some((b) => b.code === 'KW_SINGULAR_PLURAL'));
  const r2 = validateAsset(mk('t', [...kw(13), 'art', 'arts']));
  assert.ok(!r2.badges.some((b) => b.code === 'KW_SINGULAR_PLURAL'), 'art/arts below min len');
});
check('weak words flagged', () => {
  const r = validateAsset(mk('t', [...kw(14), 'unhealthy']));
  assert.ok(r.badges.some((b) => b.code === 'KW_WEAK'));
});
check('TITLE_OPENER fires on medium-first titles, not on subject-first', () => {
  const bad = validateAsset(mk('Hand drawn vector illustration of a bubble tea cup', kw(15)));
  assert.ok(bad.badges.some((b) => b.code === 'TITLE_OPENER'), 'opener missed');
  const bad2 = validateAsset(mk('A black and white illustration of ramen', kw(15)));
  assert.ok(bad2.badges.some((b) => b.code === 'TITLE_OPENER'), 'illustration opener missed');
  const good = validateAsset(mk('Bubble Tea Cup with Tapioca Pearls', kw(15)));
  assert.ok(!good.badges.some((b) => b.code === 'TITLE_OPENER'), 'subject-first false positive');
  const cookies = validateAsset(mk('Black and White Cookies', kw(15)));
  assert.ok(!cookies.badges.some((b) => b.code === 'TITLE_OPENER'), 'Black and White Cookies false positive');
});
check('TITLE_CASE fires on sentence case only', () => {
  const bad = validateAsset(mk('Fresh apple line art black and white', kw(15)));
  assert.ok(bad.badges.some((b) => b.code === 'TITLE_CASE'), 'sentence case missed');
  const good = validateAsset(mk('Fresh Apple Line Art Black and White', kw(15)));
  assert.ok(!good.badges.some((b) => b.code === 'TITLE_CASE'), 'Title Case false positive');
});
check('KW_SUBSUMED flags base term, keeps compound; whole-word only', () => {
  const r = validateAsset(mk('Fresh Apple Line Art', [...kw(11), 'cinnamon', 'cinnamon sticks', 'skillet', 'cast iron skillet']));
  const sub = r.badges.filter((b) => b.code === 'KW_SUBSUMED');
  assert.ok(sub.some((b) => /'cinnamon' is covered by 'cinnamon sticks'/.test(b.message)), JSON.stringify(sub));
  assert.ok(sub.some((b) => /'skillet' is covered by 'cast iron skillet'/.test(b.message)), JSON.stringify(sub));
  const r2 = validateAsset(mk('Fresh Apple Line Art', [...kw(12), 'meat pie', 'pie', 'pot pie']));
  assert.ok(r2.badges.filter((b) => b.code === 'KW_SUBSUMED').length >= 1, 'bare pie missed');
  const r3 = validateAsset(mk('Fresh Apple Line Art', [...kw(13), 'tea', 'steak']));
  assert.ok(!r3.badges.some((b) => b.code === 'KW_SUBSUMED' || b.code === 'KW_NEAR_DUP'), 'tea/steak false positive');
});
check('KW_NEAR_DUP flags shared-head synonyms', () => {
  const r = validateAsset(mk('Fresh Apple Line Art', [...kw(13), 'glass jar', 'mason jar']));
  assert.ok(r.badges.some((b) => b.code === 'KW_NEAR_DUP'), 'glass jar/mason jar missed');
});
check('bitten is a weak word', () => {
  const r = validateAsset(mk('Fresh Apple Line Art', [...kw(14), 'bitten']));
  assert.ok(r.badges.some((b) => b.code === 'KW_WEAK' && /bitten/.test(b.message)));
});
check('invalid category warns; missing meta errors', () => {
  assert.ok(validateAsset(mk('t', kw(20), 99)).badges.some((b) => b.code === 'CATEGORY'));
  assert.equal(validateAsset(null).ok, false);
  assert.equal(isExportable({ meta: null }), false);
});
check('WEAK_WORDS / SINGULAR_PLURAL_MIN_LEN constants', () => {
  assert.ok(WEAK_WORDS.includes('unhealthy'));
  assert.equal(SINGULAR_PLURAL_MIN_LEN, 4);
});

console.log('\n== prompt + parseMetadata ==');
check('buildPrompt encodes niche rules', () => {
  const p = buildPrompt();
  for (const term of ['line art', 'black and white', 'vector illustration', '15 and 35', 'first 10', 'olive oil', 'ice cream', 'category_id', 'confidence', 'warnings', 'market_appeal']) {
    assert.ok(p.includes(term), `prompt missing: ${term}`);
  }
  assert.ok(p.includes(String(WEAK_WORDS[0])));
  assert.ok(p.split('\n').filter(Boolean).length > 15);
});
check('buildPrompt encodes v5.4 audit rules', () => {
  const p = buildPrompt();
  for (const term of ['FORBIDDEN openers', 'Title Case', 'COMPOUND DEDUP', 'near-synonym', 'searchable noun', 'bitten']) {
    assert.ok(p.includes(term), `prompt missing v5.4 rule: ${term}`);
  }
});
check('parseMetadata normalizes keys', () => {
  const m = parseMetadata({ title: ' Fresh Olive Oil Line Art ', keywords: [...kw(20)], category_id: '7', confidence: 1.5, warnings: 'hi' });
  assert.equal(m.title, 'Fresh Olive Oil Line Art');
  assert.equal(m.categoryId, 7);
  assert.equal(m.confidence, 1);
  assert.deepEqual(m.warnings, ['hi']);
});
check('AC-019 throws on market_appeal / social_caption', () => {
  assert.throws(() => parseMetadata({ title: 't', keywords: kw(20), category_id: 7, market_appeal: 'x' }), /market_appeal/);
  assert.throws(() => parseMetadata({ title: 't', keywords: kw(20), category_id: 7, social_caption: 'x' }), /social_caption/);
});
check('AC-012 parseMetadata dedupes singular/plural ci', () => {
  const m = parseMetadata({ title: 't', keywords: [...kw(13), 'Banana', 'bananas'], category_id: 7 });
  assert.ok(!m.keywords.includes('bananas'));
  assert.ok(m.keywords.includes('banana'));
});
check('parseMetadata drops weak words', () => {
  const m = parseMetadata({ title: 't', keywords: [...kw(14), 'cheap'], category_id: 7 });
  assert.ok(!m.keywords.includes('cheap'));
});
check('parseMetadata warns (not drops) on keyword count', () => {
  assert.ok(parseMetadata({ title: 't', keywords: kw(5), category_id: 7 }).warnings.some((w) => /keywords/.test(w)));
});
check('parseMetadata throws on missing title / empty keywords / bad category', () => {
  assert.throws(() => parseMetadata({ keywords: kw(20), category_id: 7 }), /Title/);
  assert.throws(() => parseMetadata({ title: 't', keywords: [], category_id: 7 }), /keywords/);
  assert.throws(() => parseMetadata({ title: 't', keywords: kw(20), category_id: 99 }), /category_id/);
});
check('parseMetadata accepts a JSON string', () => {
  const m = parseMetadata(JSON.stringify({ title: 't', keywords: kw(20), category_id: 7, confidence: 0.5, warnings: [] }));
  assert.equal(m.categoryId, 7);
});

console.log('\n== categories ==');
check('21 categories, ids 1..21, v4.0 order', () => {
  assert.equal(CATEGORIES.length, 21);
  assert.deepEqual(CATEGORIES.map((c) => c.id), Array.from({ length: 21 }, (_, i) => i + 1));
  assert.equal(CATEGORIES[0].name, 'Animals');
  assert.equal(CATEGORIES[6].name, 'Food');
  assert.equal(CATEGORIES[19].name, 'Transport');
  assert.equal(CATEGORIES[20].name, 'Travel');
});

console.log('\n== provider config ==');
check('contract constants', () => {
  assert.equal(STORAGE_KEY, 'sms.provider');
  assert.equal(DEFAULT_ENDPOINT, 'http://localhost:20128');
  assert.equal(TEST_STUB, false);
});
check('validateConfig: https required, model+key required, /v1 normalized away', () => {
  assert.equal(validateConfig({ endpoint: 'https://9router.com/v1', model: 'm', apiKey: 'k' }).valid, true);
  assert.equal(validateConfig({ endpoint: 'https://9router.com/v1', model: 'm', apiKey: 'k' }).endpoint, 'https://9router.com');
  assert.equal(validateConfig({ endpoint: 'http://x.com', model: 'm', apiKey: 'k' }).valid, false);
  assert.equal(validateConfig({ endpoint: 'http://localhost:20128', model: 'm', apiKey: 'k' }).valid, true);
  assert.equal(validateConfig({ endpoint: 'https://x.com/', model: '', apiKey: 'k' }).valid, false);
  assert.equal(validateConfig({ endpoint: 'https://x.com', model: 'm', apiKey: '' }).valid, false);
});

console.log('\n== provider client ==');
check('unwrapJson strips markdown fences (AC: gemini fence tolerance)', () => {
  assert.deepEqual(JSON.parse(unwrapJson('```json\n{"ok": true}\n```')), { ok: true });
  assert.deepEqual(JSON.parse(unwrapJson('```\n{"b":2}\n```')), { b: 2 });
  assert.deepEqual(JSON.parse(unwrapJson('  ```javascript\n{"c":3}\n```  ')), { c: 3 });
  assert.deepEqual(JSON.parse(unwrapJson('{"a":1}')), { a: 1 }); // bare JSON unchanged
  assert.deepEqual(JSON.parse(unwrapJson('  {"d":4}\n')), { d: 4 }); // whitespace only
  assert.deepEqual(JSON.parse(unwrapJson('```json\n{"e":5}```')), { e: 5 }); // no trailing newline
  assert.deepEqual(JSON.parse(unwrapJson('```{"f":6}```')), { f: 6 }); // adjacent fences, no lang tag
  assert.equal(unwrapJson(null), null); // non-string passthrough
});
const okBody = (obj) => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: JSON.stringify(obj) } }] }),
});
const captured = () => {
  const calls = [];
  const fetch = async (url, opts) => {
    calls.push({ url, opts });
    return fetch.responder(url, opts);
  };
  fetch.calls = calls;
  fetch.responder = async () => okBody({ ok: true });
  return fetch;
};
checkAsync('TIMEOUT_MS is 60s', async () => {
  assert.equal(TIMEOUT_MS, 60000);
});
checkAsync('BUG 6: request body sends stream:false', async () => {
  const f = captured();
  globalThis.fetch = f;
  try {
    await chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p' });
    assert.equal(JSON.parse(f.calls[0].opts.body).stream, false, 'body must contain stream:false');
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('BUG 6: stray SSE body parsed from last data: line', async () => {
  const finalMsg = { title: 't', keywords: ['a'], category_id: 7, confidence: 1, warnings: [] };
  const sse = [
    `data: ${JSON.stringify({ choices: [{ delta: { content: '{' } }] })}`,
    '',
    `data: ${JSON.stringify({ choices: [{ message: { content: JSON.stringify(finalMsg) } }] })}`,
    '',
    'data: [DONE]',
    '',
  ].join('\n');
  let textCalled = false;
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token data'); },
    text: async () => { textCalled = true; return sse; },
  });
  try {
    const out = await chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p' });
    assert.equal(textCalled, true, 'SSE fallback must read body text');
    assert.equal(out.category_id, 7);
    assert.equal(out.title, 't');
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('BUG 6: SSE fallback ignores [DONE]-only body -> BADJSON', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => { throw new SyntaxError('Unexpected token data'); },
    text: async () => 'data: [DONE]\n\n',
  });
  try {
    await assert.rejects(
      () => chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p' }),
      (err) => err.code === 'BADJSON',
    );
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('200 -> parsed object, bearer key sent', async () => {
  const f = captured();
  f.responder = async () => okBody({ title: 't', keywords: ['a'], category_id: 7, confidence: 1, warnings: [] });
  globalThis.fetch = f;
  try {
    const out = await chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p', imageB64: null });
    assert.equal(out.category_id, 7);
    assert.equal(f.calls[0].url, 'https://nine.test/v1/chat/completions');
    assert.equal(f.calls[0].opts.headers.Authorization, 'Bearer sk-secret');
    const body = JSON.parse(f.calls[0].opts.body);
    assert.equal(body.response_format.type, 'json_object');
    assert.equal(body.messages[0].content[0].type, 'text');
    assert.equal(body.messages[0].content.length, 1); // no image part when imageB64 null
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('fenced JSON response parses (AC: gemini fence tolerance, end-to-end)', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: '```json\n{"title":"t","keywords":["a"],"category_id":7,"confidence":0.9,"warnings":[]}\n```' } }] }),
  });
  try {
    const out = await chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p' });
    assert.equal(out.category_id, 7);
    assert.equal(parseMetadata(out).categoryId, 7); // parseMetadata tolerates fences too
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('image part included when imageB64 set', async () => {
  const f = captured();
  globalThis.fetch = f;
  try {
    await chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'k', textPrompt: 'p', imageB64: 'data:image/jpeg;base64,AAA' });
    const body = JSON.parse(f.calls[0].opts.body);
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/jpeg;base64,AAA');
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('status code mapping', async () => {
  const cases = [
    [401, 'AUTH'], [403, 'AUTH'], [429, 'RATE'], [500, 'SERVER'], [503, 'SERVER'], [400, 'NETWORK'],
  ];
  globalThis.fetch = async () => ({ ok: false, status: 0 });
  globalThis.fetch = async () => ({ ok: false, status: 0 });
  try {
    for (const [status, code] of cases) {
      globalThis.fetch = async () => ({ ok: false, status });
      await assert.rejects(
        () => chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-x', textPrompt: 'p' }),
        (err) => err.code === code,
        `${status} should map to ${code}`,
      );
    }
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('bad JSON -> BADJSON, no secret in message', async () => {
  globalThis.fetch = async () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: 'not json{' } }] }) });
  try {
    await assert.rejects(
      () => chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'sk-secret', textPrompt: 'p' }),
      (err) => err.code === 'BADJSON' && !err.message.includes('sk-secret'),
    );
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('aborted external signal -> TIMEOUT', async () => {
  globalThis.fetch = async () => { throw new Error('net'); };
  try {
    const ac = new AbortController();
    ac.abort();
    await assert.rejects(
      () => chatCompletion({ endpoint: 'https://nine.test', model: 'm', apiKey: 'k', textPrompt: 'p', signal: ac.signal }),
      (err) => err.code === 'TIMEOUT',
    );
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('testConnection messages (Indonesian, no secrets)', async () => {
  globalThis.fetch = async () => okBody({ ok: true });
  try {
    let r = await testConnection({ endpoint: 'https://nine.test', model: 'vision-1', apiKey: 'sk-secret' });
    assert.equal(r.ok, true);
    assert.equal(r.message, 'Koneksi berhasil: vision-1');
    assert.ok(!r.message.includes('sk-secret'));

    globalThis.fetch = async () => ({ ok: false, status: 401 });
    r = await testConnection({ endpoint: 'https://nine.test', model: 'vision-1', apiKey: 'sk-secret' });
    assert.equal(r.ok, false);
    assert.ok(r.message.startsWith('Autentikasi gagal'), r.message);
    assert.ok(!r.message.includes('nine.test'));

    globalThis.fetch = async () => ({ ok: false, status: 500 });
    r = await testConnection({ endpoint: 'https://nine.test', model: 'vision-1', apiKey: 'sk-secret' });
    assert.ok(r.message.startsWith('Endpoint tidak terjangkau'), r.message);

    globalThis.fetch = async () => { throw new Error('net'); };
    r = await testConnection({ endpoint: 'https://nine.test', model: 'vision-1', apiKey: 'sk-secret' });
    assert.ok(r.message.startsWith('Endpoint tidak terjangkau'), r.message);
  } finally {
    delete globalThis.fetch;
  }
});

console.log('\n== queue ==');
const runOneAsset = () => ({
  id: 'q1',
  kind: 'raster',
  files: [{ name: 'a.jpg', blob: { size: 10 } }],
  previewUrl: null,
  rasterB64: 'data:image/jpeg;base64,AAAA', // set: skips browser-only rasterize
  status: 'ready',
  meta: null,
  warnings: [],
  attemptCount: 0,
  error: null,
});
const goodMeta = { title: 'Olive Line Art', keywords: Array.from({ length: 20 }, (_, i) => `k${i}`), category_id: 7, confidence: 0.9, warnings: [] };
checkAsync('runOne sets durationMs on success', async () => {
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ choices: [{ message: { content: JSON.stringify(goodMeta) } }] }),
  });
  try {
    const a = runOneAsset();
    await runOne({ asset: a, cfg: { endpoint: 'https://nine.test', model: 'm', apiKey: 'k' } });
    assert.equal(a.status, 'done');
    assert.equal(typeof a.durationMs, 'number');
    assert.ok(a.durationMs >= 0);
  } finally {
    delete globalThis.fetch;
  }
});
checkAsync('runOne sets durationMs on failure', async () => {
  globalThis.fetch = async () => { throw new Error('boom'); }; // no code -> non-retryable, no backoff
  try {
    const a = runOneAsset();
    await runOne({ asset: a, cfg: { endpoint: 'https://nine.test', model: 'm', apiKey: 'k' } });
    assert.equal(a.status, 'failed');
    assert.equal(typeof a.durationMs, 'number');
    assert.ok(a.durationMs >= 0);
  } finally {
    delete globalThis.fetch;
  }
});

console.log('\n== export ==');
const asset = (title, names, id) => ({
  id: id ?? title,
  kind: names.length === 2 ? 'eps-pair' : 'raster',
  files: names.map((n) => ({ name: n, blob: new Blob(['pixel-data']) })),
  meta: { title, keywords: ['line art', 'black and white', ...kw(13)], categoryId: 7, confidence: 0.9, warnings: [] },
});
check('AC-018 CSV columns exact + order', () => {
  const csv = toCsv([asset('Apple Line Art', ['a.eps', 'a.jpg'])]);
  const header = csv.split('\n')[0];
  assert.equal(header.trim(), CSV_COLUMNS.join(','));
});
check('AC-017 CSV filenames == zip entry names; eps pair exports vector only', async () => {
  const a = asset('Apple Line Art', ['apple.EPS', 'apple.JPG']);
  const blob = await buildZip([a]);
  const zip = await JSZip.loadAsync(blob);
  const entries = Object.keys(zip.files).filter((n) => n !== 'metadata.csv').sort();
  assert.deepEqual(entries, ['apple-line-art.eps']);
  const csv = await zip.file('metadata.csv').async('string');
  const csvNames = Papa7parse(csv).map((r) => r.Filename).sort();
  assert.deepEqual(csvNames, entries);
});
check('JPG companion never exported (v5.3): csv + zip + exportFiles', async () => {
  const pair = asset('Apple Line Art', ['apple.EPS', 'apple.JPG']);
  const ai = asset('Banana Icon', ['b.AI', 'b.JPG']);
  assert.deepEqual(exportFiles(pair).map((f) => f.name), ['apple.EPS']);
  assert.deepEqual(exportFiles(ai).map((f) => f.name), ['b.AI']);
  const csv = toCsv([pair, ai]);
  const names = Papa7parse(csv).map((r) => r.Filename).sort();
  assert.deepEqual(names, ['apple-line-art.eps', 'banana-icon.ai']);
  const blob = await buildZip([pair, ai]);
  const zip = await JSZip.loadAsync(blob);
  const entries = Object.keys(zip.files).sort();
  assert.deepEqual(entries, ['apple-line-art.eps', 'banana-icon.ai', 'metadata.csv']);
});
check('keywords comma-separated, RFC4180 quoting', () => {
  const csv = toCsv([asset('Apple, Olive & Oil Line Art', ['a.jpg'])]);
  const row = csv.split('\n')[1];
  assert.ok(row.startsWith('apple-olive-oil-line-art.jpg,"Apple, Olive & Oil Line Art",'), row);
});
check('non-exportable asset excluded from CSV', () => {
  const bad = asset('x'.repeat(250), ['b.jpg']);
  const csv = toCsv([bad]);
  assert.equal(csv.trim(), CSV_COLUMNS.join(','));
});
check('copyText', () => {
  const t = copyText(asset('Apple Line Art', ['a.jpg']));
  assert.ok(t.includes('Apple Line Art'));
  assert.ok(t.includes('Keywords: line art, black and white'));
  assert.ok(t.endsWith('Category: Food'));
});
check('categoryLabel', () => {
  assert.equal(categoryLabel(7), 'Food');
  assert.equal(categoryLabel(99), '');
});
check('CSV Category column holds the NUMBER, not the name', () => {
  const row = Papa7parse(toCsv([asset('Apple Line Art', ['a.jpg'])]))[0];
  assert.equal(row.Category, '7');
  assert.notEqual(row.Category, 'Food');
});
check('every one of the 21 categories exports its official number', () => {
  for (const c of CATEGORIES) {
    const a = asset('Apple Line Art', ['a.jpg']);
    a.meta.categoryId = c.id;
    assert.equal(Papa7parse(toCsv([a]))[0].Category, String(c.id), `category ${c.id} ${c.name}`);
  }
});
check('category given as a name still exports the number', () => {
  const a = asset('Apple Line Art', ['a.jpg']);
  a.meta.categoryId = 'Food';
  assert.equal(Papa7parse(toCsv([a]))[0].Category, '7');
});
check('unknown category exports empty, never a bogus number', () => {
  const a = asset('Apple Line Art', ['a.jpg']);
  a.meta.categoryId = 99;
  assert.equal(Papa7parse(toCsv([a]))[0].Category, '');
});
check('UI copy text keeps the human-readable category name', () => {
  assert.ok(copyText(asset('Apple Line Art', ['a.jpg'])).endsWith('Category: Food'));
});

// papaparse in node, used by the CSV assertions above
function Papa7parse(text) {
  return Papa.parse(text, { header: true, skipEmptyLines: true }).data;
}

console.log(`\n================\nRESULT: ${pass} passed, ${fail.length} failed`);
if (fail.length) {
  for (const f of fail) console.log(`  FAILED: ${f.name}\n    ${f.err.stack?.split('\n').slice(0, 3).join('\n    ')}`);
  process.exitCode = 1;
}
