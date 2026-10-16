import { useState } from 'react'
import { Download, Copy, Check, PackageX, PackageCheck } from 'lucide-react'
import { isExportable } from '../lib/validate'
import { copyText } from '../lib/export'

// AC-017 / AC-018 / AC-020. Pre-export summary names every asset — nothing is silently dropped.
export default function ExportBar({ assets, onExport, exporting, format = 'zip' }) {
  const [copied, setCopied] = useState(null)

  const withMeta = assets.filter((a) => a.meta)
  const exportable = withMeta.filter((a) => isExportable(a))
  const excluded = withMeta.filter((a) => !isExportable(a))
  const ready = exportable.length > 0

  const nameOf = (a) => a.meta.title?.trim() || a.files?.[0]?.name || a.id

  const handleCopy = async (a) => {
    try {
      await navigator.clipboard.writeText(copyText(a))
      setCopied(a.id)
      setTimeout(() => setCopied((c) => (c === a.id ? null : c)), 1500)
    } catch {
      setCopied(null)
    }
  }

  return (
    <section className="card p-4">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-lg">Ekspor</h2>
        <button className="btn btn-primary" onClick={onExport} disabled={!ready || exporting}>
          <Download size={15} strokeWidth={2.5} aria-hidden="true" />
          {exporting
            ? format === 'csv'
              ? 'Menyusun CSV…'
              : 'Menyusun ZIP…'
            : format === 'csv'
              ? 'Export CSV'
              : 'Export ZIP'}
        </button>
        {!ready && (
          <p className="text-sm font-medium text-[#5c5c5c]">
            Butuh minimal 1 aset yang bisa diekspor (tanpa badge error).
          </p>
        )}
      </div>

      {withMeta.length > 0 && (
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <div className="border-2 border-black bg-white p-2">
            <h3 className="flex items-center gap-1.5 text-sm">
              <PackageCheck size={14} strokeWidth={2.5} aria-hidden="true" />
              Siap diekspor (<span className="mono">{exportable.length}</span>)
            </h3>
            <ul className="mt-1.5 grid gap-1">
              {exportable.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="truncate">{nameOf(a)}</span>
                  <button
                    className="btn-icon ml-auto shrink-0"
                    onClick={() => handleCopy(a)}
                    aria-label={`Salin teks metadata untuk ${nameOf(a)}`}
                    title="Salin teks"
                  >
                    {copied === a.id ? (
                      <Check size={12} strokeWidth={3} aria-hidden="true" />
                    ) : (
                      <Copy size={12} strokeWidth={2.5} aria-hidden="true" />
                    )}
                  </button>
                </li>
              ))}
              {exportable.length === 0 && <li className="text-xs text-[#8a8a8a]">Belum ada.</li>}
            </ul>
          </div>

          <div className="border-2 border-black bg-white p-2">
            <h3 className="flex items-center gap-1.5 text-sm">
              <PackageX size={14} strokeWidth={2.5} aria-hidden="true" />
              Dikecualikan (<span className="mono">{excluded.length}</span>)
            </h3>
            <ul className="mt-1.5 grid gap-1">
              {excluded.map((a) => (
                <li key={a.id} className="flex items-center gap-2 text-xs">
                  <span className="truncate">{nameOf(a)}</span>
                  <span className="ml-auto shrink-0 font-bold text-[#b3144e]">ada badge error</span>
                </li>
              ))}
              {excluded.length === 0 && <li className="text-xs text-[#8a8a8a]">Tidak ada.</li>}
            </ul>
          </div>
        </div>
      )}

      {withMeta.length === 0 && (
        <p className="mt-3 text-sm font-medium text-[#5c5c5c]">
          Hasilkan metadata dulu — file yang belum diproses tidak masuk ekspor.
        </p>
      )}
    </section>
  )
}
