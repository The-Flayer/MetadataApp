# PROGRESS.md — Stock Metadata Studio v5.0

Status: **implementation (M1+M2 complete, M3 audit in progress, BUG 6 fixed)**
Milestones: 1 ✅ → 2 ✅ → 3 🔄

## Changed paths (this session)

```
package.json, vite.config.js, index.html        scaffold + favicon (AC-021)
CONTRACT.md                                     shared lib/UI contract
src/config/provider.js                          localStorage config, validateConfig
src/data/categories.js                          21 Adobe category IDs
src/lib/upload.js                               intake + pairing rules (AC-001..004)
src/lib/preprocess.js                           canvas rasterize 1024px jpeg
src/lib/prompt.js                               niche prompt + parseMetadata (AC-009..012, 019)
src/lib/providerClient.js                       OpenAI-compatible client (AC-006, NFR-003)
src/lib/queue.js                                sequential queue + retry (AC-007, AC-008)
src/lib/validate.js                             deterministic badges (AC-014)
src/lib/slug.js                                 filename slugs (AC-013, AC-016)
src/lib/export.js                               JSZip + PapaParse (AC-017, AC-018, AC-020)
src/components/{SettingsPanel,DropZone,QueueBar,AssetCard,Badges,ExportBar}.jsx
src/App.jsx, src/index.css, src/main.jsx
tests/run.mjs                                   39 assert-based self-checks
```

## Checks / results

- `npm run test` → **39 passed, 0 failed**
- `npm run build` → succeeds (315 kB JS / 17 kB CSS gzipped)
- `npx serve dist` → AC-021 VERIFIED (static build mounts, no page errors)
- Browser e2e (Chrome + CDP): upload, pairing rejection, batch limit, sequential
  generate, retry, live slug, title>200 block, regenerate, ZIP/CSV export — all VERIFIED
- AC-006 VERIFIED against the owner's live local 9router (`http://localhost:20128`):
  wrong key → "Autentikasi gagal" + Edit pengaturan action in 3.0s (< 60s)

## 9router API shape — CONFIRMED (was PRD's only UNVERIFIED item)

9router is **self-hosted, open-source** (github.com/decolua/9router), NOT a hosted
SaaS. `https://9router.com` is only the marketing site — its `/v1/...` routes 404.
The owner's instance runs locally at `http://localhost:20128`.

- Endpoint: `POST {base}/v1/chat/completions` — OpenAI-compatible. **Confirmed.**
- Auth: `Authorization: Bearer <key>`. `/v1/models` accepts any bearer; chat
  completions reject invalid keys with `401 invalid_api_key`. **Confirmed.**
- Model IDs are **provider-prefixed slugs** (e.g. `ag/gemini-3.8-flash`), not
  short names. Vision-capable models present. **Confirmed.**
- CORS: `access-control-allow-origin: *` on the local instance. Browser calls work.
  (The marketing site has no CORS headers, but it is not the API host anyway.)

Adaptations made:
1. `DEFAULT_ENDPOINT` corrected to `http://localhost:20128` (was `https://9router.com`,
   which would have 404'd on first use).
2. `validateConfig` now permits `http` for loopback hosts only; `https` still
   required for anything else (self-hosted router is plain http on localhost).

## Unresolved IDs

- **AC-005, AC-009, AC-010, AC-011, AC-012** — require a generation call with a
  valid 9router API key. Only the owner has one. Evidence exists that the plumbing
  works end-to-end (stubbed generation produced valid metadata, badges, slugs,
  export), but live model output is UNVERIFIED until the owner enters their key
  and runs one batch. AC-010 specifically needs 3 real B&W food line-art samples.

## Next action

Owner: enter your 9router API key in Settings (endpoint `http://localhost:20128`,
model e.g. `ag/gemini-3.8-flash`), press Tes koneksi, then Generate on a batch of
3 real B&W food line-art files. That closes AC-005, AC-009..AC-012.

## BUG 6 — false "Endpoint tidak terjangkau" (fixed)

**Root cause:** `chatCompletion` never sent `stream` in the request body. 9router
defaults to SSE streaming when it is omitted, so the 200 OK response body was
`data: {...}` chunks instead of one JSON document. `res.json()` threw
`SyntaxError`, which the client mapped to `NETWORK`, and `testConnection` showed
the misleading "Endpoint tidak terjangkau" even though the endpoint, auth, and
model were all fine.

**Fix** (`src/lib/providerClient.js`):

1. Request body now sends `stream: false` — the primary fix; endpoint, auth,
   array content, and `response_format` were all verified correct (200 OK +
   valid content once `stream:false` is present).
2. Defense-in-depth: when the body parse fails, the client looks for
   SSE-shaped text (`data: {...}` lines), parses the last non-`[DONE]` payload,
   and uses it — so a stray streaming response degrades to a warning rather
   than crashing generation.

**Verification:** `npm run test` → **39 passed, 0 failed**, including three new
checks: request body contains `stream:false` (stubbed global fetch), stray SSE
body parses from the last `data:` line, and `[DONE]`-only body still maps to
`BADJSON`.

---

## v5.1 — Workspace refactor (UX overhaul)

Single-page layout rebuilt as the 4 Stitch workspaces: **Ruang Kerja** (upload +
FileTable), **Pemrosesan** (SlotCards + QueueTable + ErrorLog), **Tinjau & Edit**
(FilterChips + asset grid), **Pengaturan & Ekspor** (settings + RulesPanel +
FormatPicker + ExportBar). Sticky tab nav with count badges; sticky bottom CTA
per page.

- `npm run test` → 41 sync + 13 async checks, **0 failures**
- `npm run build` clean (1615 modules)
- Full e2e re-run against the production build (`npx serve dist`): every previously
  verified AC re-confirmed, zero page errors
- **`src/lib/providerClient.js` untouched** — the network layer received zero
  changes; the refactor is pure UI plus 3 additive data fields

Decisions applied (owner-approved): 4 tabs, tab-state navigation (no router
dependency), `.ZIP` + `.CSV` export cards only (no `.JSON`), and **no TOKEN
column** in QueueTable — so the network layer stays untouched. If real `usage`
turns out to be present in 9router responses, adding the column later is 3 lines.

**Next action (unchanged):** owner enters their 9router API key in Pengaturan,
runs one batch of 3 real B&W food line-art files → closes AC-009..AC-012.

---

## v5.2 — Batch limit removed (owner decision, opsi B)

`MAX_BATCH = 16` dihapus total (bukan dinaikkan). Alasan: owner ingin jumlah
berkas tidak dibatasi.

- `src/lib/upload.js`: konstanta `MAX_BATCH` dihapus; `ingestFiles` menerima
  semua file yang didukung. `existingCount` tetap ada di signature (diabaikan)
  agar pemanggil lama tidak pecah. Aturan pairing EPS/AI + JPG dan penolakan
  tipe tak didukung tidak berubah.
- `DropZone.jsx`: teks "Maksimal 16 file" → "Jumlah berkas tidak dibatasi";
  counter "Slot tersisa: X/16" → "Berkas dimuat: N".
- `App.jsx` (badge tab) dan `Workspace.jsx` (stat hero): `n/16` → `n`.
- `tests/run.mjs`: 2 test AC-002 diganti — 20 file sekaligus semuanya diterima;
  `existingCount` diabaikan. Hasil: **41 passed, 0 failed**.
- `CONTRACT.md`: seksi `upload.js` diperbarui, `MAX_BATCH` dihapus.
- **AC-002 dinyatakan RETIRED** — tidak ada lagi penolakan file ke-17.
  Verifikasi browser: drop 20 file → 20 baris di FileTable, badge "Ruang Kerja20",
  tidak ada teks limit, tidak ada baris "File ditolak", zero page errors.

Risiko yang sudah dijelaskan ke owner dan diterima: batch sangat besar membebani
memori tab (blob + raster + ZIP in-memory), antrean sequential makin lama, dan
queue tidak persist kalau tab ditutup. Tidak ada guard yang menggantikan limit.

---

## v5.3 — JPG pendamping tidak ikut ekspor (owner decision)

Aturan upload tidak berubah (EPS/AI tanpa JPG senama tetap ditolak — JPG
dibutuhkan AI vision + preview), tapi saat ekspor pair hanya mengeluarkan file
vektornya (`.eps`/`.ai`).

- `src/lib/export.js`: helper baru `exportFiles(asset)` dipakai bersama oleh
  `toCsv` dan `buildZip`, jadi invarian AC-017 (nama file ZIP == kolom Filename
  CSV) otomatis terjaga. `slug.js` tidak perlu diubah (basename per aset).
- `tests/run.mjs`: test AC-017 diperbarui + 1 test baru — pair EPS+JPG dan AI+JPG
  menghasilkan ZIP berisi `.eps`/`.ai` + `metadata.csv` saja; CSV 1 baris per
  pair bernama vektor. Hasil: **42 passed, 0 failed**.
- `CONTRACT.md`: `exportFiles` didokumentasikan + aturan ekspor pair.
- Verifikasi browser (production build): pair `apple.eps`+`apple.jpg` diterima
  sebagai 1 aset, generate sukses, `metadata.zip` terunduh berisi
  `fresh-apple-line-art-black-and-white.eps` + `metadata.csv` saja, kolom
  Filename CSV sama persis, tidak ada JPG di mana pun, zero page errors.
- Workflow owner: JPG untuk generate di aplikasi, EPS + CSV untuk submit ke Adobe.

---

## v5.4 — Metadata quality hardening (real 16-asset export audit)

Audit `metadata.csv` menemukan: 2 judul berawalan "Hand drawn vector illustration
of a...", 2 judul sentence-case, duplikat substring/near-synonym dalam satu aset
(cinnamon/cinnamon sticks, skillet/cast iron skillet, glass jar/mason jar,
pickled cabbage/cabbage, meat pie/pie/pot pie), keyword vague ("bitten",
"pita chip"), 1 judul 84 karakter.

- `src/lib/prompt.js` (`buildPrompt`): aturan TITLE subject-first + daftar
  FORBIDDEN openers + contoh BAD/GOOD, Title Case wajib, COMPOUND DEDUP
  (pertahankan compound yang lebih spesifik), larangan pasangan near-synonym,
  syarat "searchable noun or established compound term". FR-005 dan semua aturan
  niche lama tidak berubah.
- `src/lib/validate.js`: badge baru `TITLE_OPENER` (warn), `TITLE_CASE` (warn,
  judul multi-kata saja), `KW_SUBSUMED` (warn + saran hapus yang lemah,
  pencocokan whole-word agar 'tea' tidak match 'steak'), `KW_NEAR_DUP` (warn
  untuk head-noun sama, mis. glass jar/mason jar); `WEAK_WORDS` += 'bitten'
  (otomatis masuk banned-list prompt). Pasangan exact-dupe dan singular/plural
  tetap milik `KW_DUP`/`KW_SINGULAR_PLURAL` (tidak double-flag).
- Temuan >70-char: **bukan bug** — `TITLE_LONG` menyala dengan benar pada judul
  84-char, tapi levelnya `warn` sehingga aset tetap exportable by design.
  Severity tidak diubah (mengubahnya = menyentuh perilaku export-blocking/AC).
- `tests/run.mjs`: 6 test baru (opener ±, case ±, subsumed ± termasuk guard
  tea/steak, near-dup, bitten) + 1 test teks aturan prompt. Hasil:
  **48 passed, 0 failed** (tidak ada test lama yang diubah).
- Verifikasi tanpa rebuild (node langsung, 19/19 pass): 10 penanda teks aturan
  ada di prompt; ke-6 kasus bad menyalakan badge yang tepat; judul/keyword gaya
  "regenerasi" yang benar tetap bersih dari badge.
- `CONTRACT.md`: badge + `FORBIDDEN_OPENERS` didokumentasikan.
