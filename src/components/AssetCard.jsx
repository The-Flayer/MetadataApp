import { useState } from 'react'
import {
  RefreshCw,
  X,
  ChevronUp,
  ChevronDown,
  Plus,
  TriangleAlert,
  Image as ImageIcon,
} from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { deriveFilename } from '../lib/slug'
import { validateAsset, isExportable } from '../lib/validate'
import Badges from './Badges'

const KIND_TAB = {
  raster: 'bg-[var(--color-emerald)]',
  svg: 'bg-[var(--color-purple)]',
  'eps-pair': 'bg-[var(--color-pink)]',
}
const KIND_LABEL = { raster: 'Raster (JPG/PNG)', svg: 'SVG', 'eps-pair': 'EPS/AI + JPG' }

// AC-013..AC-016. Filename slug derives from title and live-updates on every keystroke.
export default function AssetCard({
  asset,
  busyAll,
  onTitleChange,
  onCategoryChange,
  onAddKeyword,
  onRemoveKeyword,
  onMoveKeyword,
  onRegenerate,
}) {
  const [draft, setDraft] = useState('')
  const meta = asset.meta
  const busy = asset.status === 'processing' || asset.status === 'queued'
  const editable = !!meta && !busy && !busyAll

  const fn = meta ? deriveFilename(asset) : null
  const exts = asset.files.map((f) => f.name.split('.').pop())

  const v = meta ? validateAsset(meta) : { badges: [] }
  const badges = [
    ...v.badges,
    ...(asset.warnings || []).map((w) => ({ level: 'warn', code: 'RASTER', message: w })),
  ]
  const exportable = !!(meta && isExportable(asset))
  const titleLen = meta?.title?.length ?? 0
  const overLimit = titleLen > 200
  const longTitle = titleLen > 70

  const addKeyword = () => {
    const kw = draft.trim()
    if (!kw || !editable) return
    onAddKeyword(asset.id, kw)
    setDraft('')
  }

  return (
    <article className="card overflow-hidden">
      <div className={`h-3 w-full border-b-[3px] border-black ${KIND_TAB[asset.kind]}`} role="presentation" />

      <div className="grid gap-3 p-3">
        <div className="flex items-center gap-2 text-xs font-bold">
          <span className="border-2 border-black bg-white px-1.5 py-0.5">
            {KIND_LABEL[asset.kind] || asset.kind}
          </span>
          {asset.status === 'done' && (
            <span className="border-2 border-black bg-[var(--color-emerald)] px-1.5 py-0.5">Selesai</span>
          )}
          {busy && (
            <span className="border-2 border-black bg-[var(--color-purple)] px-1.5 py-0.5 text-white">
              Sedang diproses
            </span>
          )}
          {asset.status === 'failed' && (
            <span className="border-2 border-black bg-[var(--color-pink)] px-1.5 py-0.5">Gagal</span>
          )}
        </div>

        {asset.previewUrl ? (
          <div className="rule -mx-3 border-x-0 border-b-0 bg-white">
            <img
              src={asset.previewUrl}
              alt={meta?.title || asset.files?.[0]?.name || 'pratinjau aset'}
              className="h-40 w-full object-contain"
              loading="lazy"
            />
          </div>
        ) : (
          <div className="rule -mx-3 flex h-40 items-center justify-center border-x-0 border-b-0 bg-white text-[#8a8a8a]">
            <ImageIcon size={28} strokeWidth={2} aria-hidden="true" />
          </div>
        )}

        {!meta ? (
          <p className="text-sm font-medium text-[#5c5c5c]">
            Tekan <b>Generate</b> di antrian untuk membuat metadata aset ini.
          </p>
        ) : (
          <>
            {/* Derived filename — live-updates on every title edit */}
            <div className="grid gap-1">
              <label className="text-xs font-bold" htmlFor={`fn-${asset.id}`}>
                Nama file hasil
              </label>
              <p id={`fn-${asset.id}`} className="mono break-all text-xs">
                {fn.name}.{exts[0]}
                {exts[1] && (
                  <>
                    {' '}+ {fn.name}.{exts[1]}
                  </>
                )}
              </p>
              {fn.conflict && (
                <p className="text-xs font-bold text-[#b3144e]">
                  Nama file bentrok dengan aset lain — edit judul supaya unik.
                </p>
              )}
            </div>

            {/* Title + live character count */}
            <div className="grid gap-1">
              <label className="flex items-center justify-between text-xs font-bold" htmlFor={`t-${asset.id}`}>
                Judul
                <span className={`mono ${overLimit ? 'text-[#b3144e]' : longTitle ? 'text-[#a86a00]' : ''}`}>
                  {titleLen} karakter
                </span>
              </label>
              <textarea
                id={`t-${asset.id}`}
                className="input min-h-[60px] resize-y text-sm"
                value={meta.title}
                onChange={(e) => onTitleChange(asset.id, e.target.value)}
                disabled={!editable}
                aria-describedby={`t-help-${asset.id}`}
              />
              <p id={`t-help-${asset.id}`} className="text-xs font-medium text-[#5c5c5c]">
                {overLimit
                  ? 'Melebihi 200 karakter (batas Adobe). Aset ini dikecualikan dari ekspor sampai diperbaiki.'
                  : longTitle
                    ? 'Judul panjang — disarankan di bawah 70 karakter.'
                    : 'Frasa natural ala judul stock, bukan tumpukan kata kunci.'}
              </p>
            </div>

            <Badges badges={badges} />

            {!exportable && (
              <p className="flex items-start gap-1.5 border-2 border-black bg-[var(--color-pink)] p-1.5 text-xs font-bold">
                <TriangleAlert size={13} className="mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                Aset ini dikecualikan dari ekspor karena ada badge error. Perbaiki lalu export lagi.
              </p>
            )}

            {/* Keywords: add / remove / reorder (no drag lib) */}
            <div className="grid gap-1">
              <label className="flex items-center justify-between text-xs font-bold" htmlFor={`k-${asset.id}`}>
                Kata kunci
                <span
                  className={`mono ${
                    meta.keywords.length < 15 || meta.keywords.length > 35 ? 'text-[#a86a00]' : ''
                  }`}
                >
                  {meta.keywords.length} kata kunci (target 15–35)
                </span>
              </label>
              <ul className="flex flex-wrap gap-1.5">
                {meta.keywords.map((kw, i) => (
                  <li key={`${kw}-${i}`} className="chip">
                    <span className="text-[#5c5c5c]">{i + 1}</span>
                    <span>{kw}</span>
                    <span className="flex items-center gap-0.5">
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onMoveKeyword(asset.id, i, -1)}
                        disabled={!editable || i === 0}
                        aria-label={`Naikkan kata kunci ${kw} ke posisi ${i}`}
                      >
                        <ChevronUp size={11} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onMoveKeyword(asset.id, i, 1)}
                        disabled={!editable || i === meta.keywords.length - 1}
                        aria-label={`Turunkan kata kunci ${kw} ke posisi ${i + 2}`}
                      >
                        <ChevronDown size={11} strokeWidth={3} />
                      </button>
                      <button
                        type="button"
                        className="btn-icon"
                        onClick={() => onRemoveKeyword(asset.id, i)}
                        disabled={!editable}
                        aria-label={`Hapus kata kunci ${kw}`}
                      >
                        <X size={11} strokeWidth={3} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-1.5">
                <input
                  id={`k-${asset.id}`}
                  className="input text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addKeyword()
                    }
                  }}
                  placeholder="Tambah kata kunci…"
                  disabled={!editable}
                />
                <button
                  type="button"
                  className="btn shrink-0"
                  onClick={addKeyword}
                  disabled={!editable || !draft.trim()}
                >
                  <Plus size={13} strokeWidth={3} aria-hidden="true" />
                  Tambah
                </button>
              </div>
            </div>

            {/* Category: 21 official Adobe Stock IDs */}
            <div className="grid gap-1">
              <label className="text-xs font-bold" htmlFor={`c-${asset.id}`}>
                Kategori
              </label>
              <select
                id={`c-${asset.id}`}
                className="input text-sm"
                value={meta.categoryId}
                onChange={(e) => onCategoryChange(asset.id, Number(e.target.value))}
                disabled={!editable}
              >
                {CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                className="btn btn-warn"
                onClick={() => onRegenerate(asset)}
                disabled={busy || busyAll}
              >
                <RefreshCw size={13} strokeWidth={2.5} aria-hidden="true" />
                Regenerate
              </button>
              {typeof meta.confidence === 'number' && (
                <span className="text-xs font-bold">
                  Konfidensi model: <span className="mono">{Math.round(meta.confidence * 100)}%</span>
                </span>
              )}
            </div>
          </>
        )}

        {/* Asset-level warnings (e.g. rasterization failure) — red strip under the keyword area */}
        {asset.warnings?.length > 0 && (
          <ul className="grid gap-1 border-l-4 border-[var(--color-pink)] bg-white px-2 py-1.5">
            {asset.warnings.map((w, i) => (
              <li
                key={i}
                className="flex items-start gap-1.5 text-xs font-bold text-[#b3144e]"
              >
                <TriangleAlert
                  size={12}
                  className="mt-0.5 shrink-0"
                  strokeWidth={2.5}
                  aria-hidden="true"
                />
                {w}
              </li>
            ))}
          </ul>
        )}
      </div>
    </article>
  )
}
