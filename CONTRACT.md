# Stock Metadata Studio — Shared Contract

Single source of truth for data shapes and module signatures across all files.
Both builders MUST implement against this exactly. No invented exports.

## Providers (src/config/provider.js)

```js
export const STORAGE_KEY = 'sms.provider'
// { endpoint: string, model: string, apiKey: string }
export function loadConfig(): ProviderConfig | null
export function saveConfig(cfg: ProviderConfig): void
export const DEFAULT_ENDPOINT = 'http://localhost:20128'
export const DEFAULT_MODEL = '' // owner picks from 9router dashboard
export function validateConfig(cfg): { valid: boolean, errors: string[] }
export const TEST_STUB = false // never a stub; test hits the real endpoint
```

## Asset model (all of src/lib operates on this)

```js
// Asset
{
  id: string,              // stable unique id
  kind: 'raster' | 'svg' | 'eps-pair',
  files: [{ name: string, blob: File }],   // 1 for raster/svg, 2 for eps-pair ([eps, jpg])
  previewUrl: string,      // object URL or data URL for <img>
  rasterB64: string|null,  // base64 JPEG (data:image/jpeg;base64,…) max 1024px, q 0.85
  status: 'ready'|'queued'|'processing'|'done'|'failed',
  meta: { title, keywords:[], categoryId:int, confidence:float, warnings:[] } | null,
  warnings: string[]|null, // raster-blank warning etc.
  attemptCount: int,
  error: string|null,      // last failure reason shown to user
  fileType: string,        // display type token set at ingest: 'EPS'|'AI'|'SVG'|'JPG'|'PNG'
  sizeBytes: int,          // sum of file.blob.size (0 when unknown)
  sizeLabel: string,       // human size via formatBytes(): '500 B', '2 KB', '1.5 MB'
  dims: { w: int, h: int }|undefined, // natural px dims, set by rasterizeAsset when the image loads
  durationMs: int|undefined,           // wall-clock ms of the last chatCompletion+parse step; queue sets it on EVERY attempt (success or failure)
}
```

## src/lib/upload.js

```js
export const ACCEPTED = ['.jpg','.jpeg','.png','.svg','.eps','.ai']
// Returns { accepted: Asset[], rejected: [{name, reason}] }
// Pairing rule: .eps/.ai require a same-basename .jpg in the same drop batch.
// Bases are matched case-insensitively on the filename stem.
// No batch cap (AC-002 retired v5.2): every supported file is admitted.
// existingCount is accepted for backward compatibility and ignored.
export function ingestFiles(fileList, existingCount = 0): { accepted: Asset[], rejected: {name,reason}[] }
export function basenameOf(fileName): string
export function formatBytes(n): string  // sizeLabel: '<1024 B', '<1MB KB (rounded)', else 'x.y MB'
```

## src/lib/preprocess.js

```js
// rasterizeAsset(asset) -> Promise<void>; sets asset.rasterB64 + asset.warnings,
//   and asset.dims = {w,h} from the image's natural pixel dims (left unset if unavailable)
// raster (jpg/png): canvas downscale to max dim 1024, toDataURL jpeg 0.85
// svg: draw into <img> then canvas; if raster is blank -> warnings.push(...)
// eps-pair: rasterize the JPG companion only
export function rasterizeAsset(asset): Promise<void>
```

## src/lib/providerClient.js

```js
export const TIMEOUT_MS = 60000
// OpenAI-compatible: POST {endpoint}/v1/chat/completions  (endpoint has NO trailing slash guaranteed by provider.js validation)
// body: { model, messages:[{role:'user', content:[{type:'text',text},{type:'image_url',image_url:{url}}]}], response_format:{type:'json_object'} }
// Errors -> Error with err.code in {'AUTH','TIMEOUT','RATE','SERVER','BADJSON','NETWORK'}
export function chatCompletion({endpoint, model, apiKey, textPrompt, imageB64, signal}): Promise<any>  // parsed JSON object
export async function testConnection(cfg): Promise<{ok:boolean, message:string}>
```

Retry policy (NFR-003): max 2 retries with backoff on RATE/SERVER/TIMEOUT/BADJSON; AUTH never retried. `queue.js` owns attempt counting; `providerClient` owns per-request timeout.

## src/lib/prompt.js

```js
export function buildPrompt(): string   // niche-aware, B&W food line art rules per PRD §3 Feature 3
export function parseMetadata(rawJson): { title, keywords, categoryId, confidence, warnings } | never
```

Output JSON contract — exactly these 5 keys, no market_appeal, no social_caption:
`{ "title": string<=200, "keywords": [15-35 ordered], "category_id": int(1..21), "confidence": float, "warnings": [string] }`

## src/lib/queue.js

```js
// Sequential (concurrency 1). onProgress(asset) called on every status change.
// runOne sets asset.durationMs (ms of the chatCompletion + parse step) on every attempt, success or failure.
export function runQueue({ assets, cfg, onProgress, signal }): Promise<void>
export async function runOne({ asset, cfg, onProgress, signal }): Promise<void>  // used by regenerate
```

## src/lib/validate.js

```js
export function validateAsset(meta): { ok: boolean, badges: Badge[] }
// Badge = { level: 'error'|'warn'|'info', code: string, message: string }
// rules: titleLen (>70 error — Adobe's Title limit, blocks export), TITLE_COMMA (comma in title, warn),
//   TITLE_OPENER (medium-first title, warn),
//   TITLE_CASE (not Title Case, warn, multi-word titles only),
//   kwCount (<15 or >35 warn), dup (ci), singular/plural dup,
//   KW_SUBSUMED (base term covered by compound, warn, whole-word only),
//   KW_NEAR_DUP (shared head noun, warn), weakWord (banned list), category valid
export function isExportable(asset): boolean   // no error badge
export const WEAK_WORDS = ['unhealthy','cheap','generic','generic background','web element','junk','hobby','amateur','unprofessional','bitten']
export const SINGULAR_PLURAL_MIN_LEN = 4  // don't treat e.g. "art"/"arts" below this
export const FORBIDDEN_OPENERS = [...]  // title openers that bury the subject; TITLE_OPENER checked after stripping one leading article
```

## src/lib/slug.js

```js
export function slugify(title): string  // lowercase, non-alnum->'-', collapse repeats, trim '-', max 120
export function deriveFilename(asset): { name: string, ext: string, conflict: boolean }   // per file
export function resolveFilenames(assets): Map<assetId, string>  // unique within batch; pairs share basename
```

EPS-pair: both files get the same basename, own extensions (`x.eps`, `x.jpg`).
Collision: append `-2`, `-3`. `resolveFilenames` flags conflicts so UI can warn.

## src/lib/export.js

```js
export const CSV_COLUMNS = ['Filename','Title','Keywords','Category']  // exact order, no other columns
// Category holds the NUMERIC Adobe category id (7 = Food), never the name — Adobe
// ignores a name and falls back to Sensei auto-categorization.
export function toCsv(assets): string        // keywords joined ", "; quotes escaped per RFC4180 (PapaParse)
export function buildZip(assets): Promise<Blob>   // renamed files + metadata.csv
export function copyText(asset): string      // copy-ready per-asset text
export function categoryLabel(id): string
export function exportFiles(asset): File[]  // v5.3: eps-pair -> vector file only (.eps/.ai); JPG companion never exported
```

Zip entries: `<slug>.<ext>` for each exported file of each exportable asset, plus `metadata.csv`.
For `eps-pair` assets only the vector file is exported — the JPG companion is
upload-time only (AI vision + preview) and never enters the ZIP or CSV.
`Filename` values MUST equal zip entry names exactly.

## src/data/categories.js

```js
export const CATEGORIES = [{id:1,name:'Animals'}, ..., {id:21,name:'Travel'}]  // 21 entries, v4.0 order
export const CATEGORY_BY_NAME = { 'animals': 1, ..., 'travel': 21 }  // lowercase name -> id
export function categoryNumber(category): number|''  // name (ci) or id -> id; '' when unknown
// Numeric ids cross-checked against Adobe's community answer (Community Expert,
// "Correct answer") for "What are the Category Numbers for CSV"; Adobe's CSV
// requirements page states Category must be the category NUMBER.
```

## UI → lib integration points

- App holds `assets` state; never mutates lib-owned promises.
- No API key, endpoint, or model string may appear in any export, filename, title, prompt, or console log.

## References

- PRD.md §5 Architecture, §6 Data Models, §8 API Spec, §9 File Map
- Stitch design system: `design-reference/*.html` + DESIGN.md in Stitch project
