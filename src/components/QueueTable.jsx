import { RotateCcw, CheckCircle2, XCircle, Clock, Loader2, FileStack } from 'lucide-react'
import { categoryLabel } from '../lib/export'

const STATUS = {
  ready: { cls: 'bg-white', label: 'Siap', Icon: FileStack },
  queued: { cls: 'bg-[var(--color-amber)]', label: 'Antri', Icon: Clock },
  processing: { cls: 'bg-[var(--color-purple)] text-white', label: 'Memproses…', Icon: Loader2 },
  done: { cls: 'bg-[var(--color-emerald)]', label: 'Selesai', Icon: CheckCircle2 },
  failed: { cls: 'bg-[var(--color-pink)]', label: 'Gagal', Icon: XCircle },
}

function fileTypeOf(asset) {
  if (asset.fileType) return asset.fileType
  const name = asset.files?.[0]?.name ?? ''
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase() : null
}

// Pemrosesan: 5-column batch-queue table with legend footer.
export default function QueueTable({ assets, queueActive, onRetry }) {
  if (!assets.length) {
    return (
      <div className="card-sm p-6 text-center">
        <p className="text-sm font-medium text-[#5c5c5c]">
          Antrian kosong. Generate metadata dari tab Ruang Kerja untuk mengisi batch.
        </p>
      </div>
    )
  }

  const total = assets.length
  const done = assets.filter((a) => a.status === 'done').length
  const failed = assets.filter((a) => a.status === 'failed').length

  return (
    <div className="card-sm overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="tbl">
          <colgroup>
            <col style={{ width: '30%' }} />
            <col style={{ width: '17%' }} />
            <col style={{ width: '10%' }} />
            <col style={{ width: '30%' }} />
            <col style={{ width: '13%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Berkas &amp; tipe</th>
              <th scope="col">Status pemrosesan</th>
              <th scope="col">Waktu</th>
              <th scope="col">Hasil cepat</th>
              <th scope="col">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const s = STATUS[a.status] || STATUS.ready
              const { Icon, label, cls } = s
              const name = a.files?.[0]?.name ?? a.id
              const time = a.durationMs ? `${(a.durationMs / 1000).toFixed(1)}s` : '\u2014'
              return (
                <tr key={a.id}>
                  <td>
                    <span className="grid min-w-0 gap-1">
                      <span className="mono break-all text-xs">{name}</span>
                      <span>
                        <span className="badge badge-info">{fileTypeOf(a) || '\u2014'}</span>
                      </span>
                    </span>
                  </td>
                  <td>
                    <span
                      className={`inline-flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-xs font-bold ${cls}`}
                    >
                      <Icon
                        size={12}
                        strokeWidth={2.5}
                        className={a.status === 'processing' ? 'animate-spin' : ''}
                        aria-hidden="true"
                      />
                      {label}
                    </span>
                    {a.attemptCount > 0 && a.status !== 'done' && (
                      <span className="mt-1 block mono text-[10px] text-[#5c5c5c]">
                        percobaan {a.attemptCount}
                      </span>
                    )}
                  </td>
                  <td className="mono text-xs">{time}</td>
                  <td>
                    {a.meta ? (
                      <span className="flex flex-wrap items-center gap-1">
                        {a.meta.keywords.slice(0, 6).map((kw, i) => (
                          <span key={`${kw}-${i}`} className="chip">
                            {kw}
                          </span>
                        ))}
                        {a.meta.keywords.length > 6 && (
                          <span className="text-xs text-[#5c5c5c]">
                            +{a.meta.keywords.length - 6}
                          </span>
                        )}
                        <span className="badge badge-ok">{categoryLabel(a.meta.categoryId)}</span>
                      </span>
                    ) : (
                      <span className="text-xs text-[#8a8a8a]">{'\u2014'}</span>
                    )}
                  </td>
                  <td>
                    {a.status === 'failed' ? (
                      <button
                        className="btn btn-danger"
                        onClick={() => onRetry(a)}
                        disabled={queueActive}
                      >
                        <RotateCcw size={13} strokeWidth={2.5} aria-hidden="true" />
                        Coba lagi
                      </button>
                    ) : (
                      <span className="text-xs text-[#8a8a8a]">{'\u2014'}</span>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="border-t-[3px] border-black bg-white p-2 text-xs font-bold">
        Berhasil <span className="mono">{done}</span>/<span className="mono">{total}</span> &middot;
        Gagal <span className="mono">{failed}</span>/<span className="mono">{total}</span>
      </div>
    </div>
  )
}
