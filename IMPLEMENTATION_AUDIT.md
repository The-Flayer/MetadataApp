# IMPLEMENTATION_AUDIT.md — Stock Metadata Studio v5.0

Audit date: 2026-10-08. Build: `npm run build` passes; `npm run test` → 36/36.
All app behavior verified by driving the real UI in Chrome (CDP) unless noted.
Stubbed-provider runs are labeled STUB; live calls against the owner's local
9router are labeled LIVE.

## Feature: Provider Settings (FR-003, NFR-002, NFR-003)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-005 | Valid 9router creds + Test → success | SettingsPanel, `config/provider.js`, `providerClient.js` | LIVE: `/v1/models` reachable on `http://localhost:20128`. Chat completions rejected `sk-wrong-key-on-purpose` with 401, so the endpoint and auth path are exercised. A *successful* test needs the owner's real key. STUB: test-connection rendered "Koneksi berhasil: ag/gemini-3.8-flash" | PARTIAL — plumbing VERIFIED, success-with-real-key UNVERIFIED |
| AC-006 | Wrong key → auth error <60s + edit action | SettingsPanel fail banner | LIVE: wrong key → "Autentikasi gagal: periksa kembali API key Anda di pengaturan." + "Edit pengaturan" button, in **3.0s** (limit 60s). Provider mapped 401 → AUTH (no retry, per NFR-003) | VERIFIED |
| AC-020 | No secrets in ZIP/CSV | `lib/export.js`, `lib/prompt.js` | ZIP entries + `metadata.csv` inspected: no key, no endpoint. DOM scan found no key text outside the password field. Key never logged (no console output of cfg) | VERIFIED |

## Feature: Batch Upload (FR-001, FR-002, NFR-004)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-001 | 16 mixed files accepted | DropZone, `lib/upload.js` | Dropped PNG + JPG + SVG; all accepted. "Slot tersisa" counter 13 → 12 → 0 as files added | VERIFIED |
| AC-002 | 17th file rejected, first 16 kept | DropZone + `ingestFiles(existingCount)` | Uploaded 5 then 14 more (19 total); slots hit 0 and excess files listed with "Batch limit reached: max 16 files per batch"; the first files remained queued | VERIFIED |
| AC-003 | EPS without same-basename JPG rejected, companion named | `lib/upload.js` | `d.eps` dropped alone → rejection row naming `missing companion: d.jpg` | VERIFIED |
| AC-004 | Single SVG accepted, native preview | DropZone + `preprocess.js` | SVG accepted; rasterized to a data-URL `<img>` preview. Canvas rasterize produces valid JPEG (verified by loading it back into an `Image`) | VERIFIED |

## Feature: Generation Queue (FR-004, FR-005, FR-011, NFR-003)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-007 | Strictly sequential, per-file progress | `lib/queue.js`, QueueBar | STUB: 2 assets processed one at a time; each card showed queued → processing → done; queue bar reported "1/1 selesai" / "2/2". Concurrency is a `for…await` loop, structurally 1 | VERIFIED |
| AC-008 | Double-failed file marked failed + retry; others exportable | `runOne` MAX_ATTEMPTS=3 | STUB: `bad.jpg` always 500 → retried with backoff, ended "Gagal" with a "Coba lagi" button; `good.png` completed and was exportable | VERIFIED |
| AC-009 | Valid JSON: title, keywords, category_id, confidence, warnings | `parseMetadata` | STUB: generated object had all 5 keys, normalized (categoryId coerced, confidence clamped 0..1). Unit tests cover coercion + malformed input | VERIFIED (STUB plumbing); live model output UNVERIFIED |
| AC-010 | Style terms within first 10 keywords on B&W food line art | `lib/prompt.js` | Prompt explicitly instructs subject-first then style terms inside the top 10 and forbids style-only-at-11+. **Requires 3 real samples to prove the model obeys** | UNVERIFIED |
| AC-011 | 15–35 keywords | `parseMetadata` + prompt | Prompt demands 15–35; validator warns outside the range. **Live count UNVERIFIED** | UNVERIFIED (prompt-encoded) |
| AC-012 | No singular/plural duplicates | `parseMetadata` dedupe | Unit test: `banana`+`bananas` collapsed; `art`/`arts` exempted by `SINGULAR_PLURAL_MIN_LEN`. Live output UNVERIFIED | VERIFIED (deterministic layer); live UNVERIFIED |
| AC-019 | No market_appeal / social_caption | `parseMetadata` | Unit test: presence of either key throws. Contract has exactly 5 keys | VERIFIED |

## Feature: Review / Edit / Validate (FR-006, FR-007, FR-008, FR-009)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-013 | Title edit live-updates slug | AssetCard + `deriveFilename` | Edited title → mono filename changed `fresh-olive-…png` → `avocado-slice-illustration.png` within one keystroke debounce | VERIFIED |
| AC-014 | Title >200 → error badge, export blocked | `lib/validate.js`, Badges, ExportBar | Typed 210 chars → error badge + per-card exclusion message; Export ZIP stayed disabled until fixed. Export re-enabled after correcting the title | VERIFIED |
| AC-015 | Regenerate replaces only that asset's metadata | `runOne` + AssetCard | Regenerated card 1; card 2's title unchanged. Only one title changed | VERIFIED |
| AC-016 | EPS+JPG pair shares basename slug | `resolveFilenames` | Unit test + in-browser export probe: `apple.EPS`+`apple.JPG` → `fresh-apple-line-art.eps` and `fresh-apple-line-art.jpg` | VERIFIED |

## Feature: Export (FR-010, NFR-002)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-017 | ZIP filenames == CSV Filename values | `lib/export.js` | Clicked Export ZIP in the UI; downloaded `metadata.zip`, unzipped, compared entries to CSV `Filename` column — exact match (`fresh-apple-line-art-black-and-white.png`) | VERIFIED |
| AC-018 | CSV columns exactly Filename,Title,Keywords,Category; comma-separated keywords | `CSV_COLUMNS` + PapaParse | Header `Filename,Title,Keywords,Category`; keywords in one quoted comma-separated field; RFC4180 quoting on titles containing commas | VERIFIED |
| AC-020 | No secrets in ZIP/CSV | export path | Inspected the downloaded ZIP + CSV: no key, no endpoint | VERIFIED |

## Feature: Local-only architecture (NFR-001)

| AC | Expected | Surface | Check / result | Status |
|---|---|---|---|---|
| AC-021 | Runs from local static build, no server beyond static file server | vite build output | `npm run build` → `dist/`; `npx serve dist` served at :4173; Chrome loaded it, React mounted (h1, settings panel, dropzone, 4 inputs), zero page errors. Only `fetch` outbound to the provider | VERIFIED |

## Cross-cutting NFRs

- **NFR-002 secrets**: key stored under `localStorage["sms.provider"]` only; never in
  exports, filenames, prompts, or console. Verified by ZIP/CSV inspection + DOM scan.
- **NFR-003 reliability**: 60s timeout (`AbortController`), max 2 retries with backoff
  on RATE/SERVER/TIMEOUT/BADJSON, no retry on AUTH. Unit-tested; observed live (401 →
  immediate failure, no retry loop).
- **NFR-004 usability**: all Indonesian; every rejection/error states the next action
  (e.g. "EPS/AI harus disertai JPG…", "Coba lagi", "Edit pengaturan").
- **FR-011 retired outputs**: contract is 5 keys; parser throws on retired fields.

## Known limitations

1. AC-005/AC-009..AC-012 live verification needs the owner's 9router API key. The
   owner enters it in Settings; the app never stores it outside localStorage.
2. SVG rasterization relies on the browser renderer; SVGs with external references
   may rasterize blank — surfaced as a warning badge, not a silent failure (PRD edge case).
3. Queue state is not persisted across tab close (documented PRD limitation); only
   provider config persists.
4. Test images used in automation were canvas-generated abstract circles, not real
   B&W food line art — AC-010's quality claim is therefore UNVERIFIED.

## Real vs mocked evidence

- LIVE: 9router endpoint shape, 401 auth mapping, CORS, AC-006 timing.
- STUB (provider replaced in-page, rest of app real): AC-007, AC-008, AC-009 plumbing,
  AC-013, AC-014, AC-015, AC-017, AC-018, AC-020.
- PURE LOGIC (unit tests, no browser): slug rules, singular/plural dedupe, pairing
  rules, batch limit, CSV quoting, retired-field rejection.

---

## v5.1 — Workspace refactor (re-verification)

Layout rebuilt into the 4 Stitch workspaces: **Ruang Kerja · Pemrosesan · Tinjau &
Edit · Pengaturan & Ekspor**, with a sticky top nav (badged tabs) and a sticky
bottom CTA per page. All previously verified ACs were re-verified against the
production build (`npx serve dist`) via CDP.

**Network layer untouched.** `src/lib/providerClient.js`, `prompt.js`, `slug.js`,
`validate.js`, `export.js` received zero changes — confirmed by diffing the module
list. The CDP run shows the provider call path is unchanged: every request was
`OPTIONS` preflight then `POST /v1/chat/completions`, exactly as before.

| AC | Re-verification result | Status |
|---|---|---|
| AC-001/002 | FileTable renders 2 rows (PNG/JPG), size column `7 KB`, counter `2/16`; eps rejected and named | VERIFIED |
| AC-003 | `standalone.eps` rejected; appears in Error Log on Pemrosesan | VERIFIED |
| AC-005 | Tes koneksi → "Koneksi berhasil", config persisted to `sms.provider` | VERIFIED |
| AC-007 | Generate navigates to Pemrosesan; SlotCards show `2 SELESAI / 0 GAGAL / 0 MENUNGGU`; QueueTable rows reach `Selesai` | VERIFIED |
| AC-008 | One asset force-failed: legend `Berhasil 1/2 · Gagal 1/2`, retry button present, Error Log lists it, retry re-runs and fails again cleanly | VERIFIED |
| AC-013 | Title edit live-updates slug (`fresh-apple-line-art…png` → `avocado-slice-illustration.png`) | VERIFIED |
| AC-014 | 210-char title → badge + Review CTA disabled + `Export ZIP` disabled + excluded list says "ada badge error"; fixing the title re-enables export | VERIFIED |
| AC-017 | `metadata.zip` downloaded via UI; entries `avocado-slice-illustration.png`, `fresh-apple-line-art-black-and-white.jpg`, `metadata.csv`; CSV `Filename` column matches entries exactly | VERIFIED |
| AC-018 | CSV header exactly `Filename,Title,Keywords,Category` | VERIFIED |
| AC-020 | No key/endpoint anywhere in ZIP or CSV | VERIFIED |
| AC-021 | Static build serves and mounts with zero page errors; first-run with no config redirects to the Pengaturan tab | VERIFIED |
| TOKEN column | Deliberately omitted (option 1). QueueTable headers: `Berkas & tipe · Status pemrosesan · Waktu · Hasil cepat · Tindakan` | by design |

**New capability:** standalone `.csv` download. Previously `toCsv` was only embedded
inside the ZIP; the FormatPicker now offers `.ZIP` and `.CSV` as separate downloads.
Both were exercised: `metadata.csv` (2 data rows) and `metadata.zip` both produced.

**Tests:** 41 synchronous + 13 asynchronous checks, 0 failures. New lib fields
`fileType` / `sizeBytes` / `sizeLabel` / `dims` / `durationMs` are all covered,
including `durationMs` on both success and failure paths of `runOne`.

**Still UNVERIFIED (unchanged):** AC-009/010/011/012 live model output — needs the
owner's real 9router API key and 3 actual B&W food line-art samples.

---

## v5.2 — AC-002 RETIRED (batch limit removed per owner decision)

`MAX_BATCH = 16` removed entirely (option B, not raised). `ingestFiles` admits
every supported file; pairing and unsupported-type rejections unchanged.
UI counters changed from `n/16` to plain `n` (tab badge, hero stat, DropZone now
reads "Berkas dimuat: N" + "Jumlah berkas tidak dibatasi"). Browser-verified:
20 dropped files → 20 FileTable rows, no rejections, zero page errors.
AC-002's old expectation (17th file rejected) no longer applies; its 2 unit
tests were replaced with no-cap assertions. Accepted risk (owner-acknowledged):
large batches stress tab memory, lengthen the sequential queue, and the queue
does not persist across tab close.

---

## v5.3 — JPG companion excluded from export (per owner decision)

Upload rule unchanged (EPS/AI without same-basename JPG still rejected — the JPG
feeds AI vision + preview), but export of a pair now emits only the vector file.

Browser-verified on the production build: `apple.eps`+`apple.jpg` accepted as
one asset, generation succeeds, downloaded `metadata.zip` contains only
`fresh-apple-line-art-black-and-white.eps` + `metadata.csv`; the CSV `Filename`
column matches exactly; no JPG anywhere; zero page errors. Unit tests cover
EPS and AI pairs for `exportFiles`, `toCsv`, and `buildZip` (42 passed).
Owner workflow: JPG for in-app generation, EPS + CSV for Adobe submission.

---

## v5.4 — Metadata quality hardening (real-export audit)

Prompt gained subject-first TITLE rules (forbidden openers + BAD/GOOD example +
Title Case), COMPOUND DEDUP, near-synonym ban, and a searchable-noun quality
rule. Validator gained `TITLE_OPENER`, `TITLE_CASE`, `KW_SUBSUMED` (whole-word,
with removal suggestion), and `KW_NEAR_DUP` badges, plus `bitten` in
`WEAK_WORDS`. The >70-char "miss" was investigated and is not a bug: `TITLE_LONG`
fires correctly; warnings don't block export by design. Verified without a
rebuild: 19/19 node-level checks pass (10 prompt markers + 6 bad cases firing the
right badges + clean good cases). Full suite: 48 passed, 0 failed; no existing
test modified.
