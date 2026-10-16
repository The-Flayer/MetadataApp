import { useState } from 'react'
import { Trash2, CheckCircle2, XCircle, Clock, Loader2, FileStack, Image as ImageIcon } from 'lucide-react'

const STATUS = {
  ready: { cls: 'bg-white', label: 'Siap', Icon: FileStack },
  queued: { cls: 'bg-[var(--color-amber)]', label: 'Antri', Icon: Clock },
  processing: { cls: 'bg-[var(--color-purple)] text-white', label: 'Memproses…', Icon: Loader2 },
  done: { cls: 'bg-[var(--color-emerald)]', label: 'Selesai', Icon: CheckCircle2 },
  failed: { cls: 'bg-[var(--color-pink)]', label: 'Gagal', Icon: XCircle },
}

// Data model additions (fileType/sizeLabel/dims) may be absent — render "—".
function fileTypeOf(asset) {
  if (asset.fileType) return asset.fileType
  const name = asset.files?.[0]?.name ?? ''
  const i = name.lastIndexOf('.')
  return i > 0 ? name.slice(i + 1).toUpperCase() : null
}

function Pill({ status }) {
  const s = STATUS[status] || STATUS.ready
  const { Icon, label, cls } = s
  return (
    <span
      className={`inline-flex items-center gap-1 border-2 border-black px-1.5 py-0.5 text-xs font-bold ${cls}`}
    >
      <Icon
        size={12}
        strokeWidth={2.5}
        className={status === 'processing' ? 'animate-spin' : ''}
        aria-hidden="true"
      />
      {label}
    </span>
  )
}

// Ruang Kerja: 5-column detected-file table + bulk delete bar.
export default function FileTable({ assets, onRemove, onRemoveAll }) {
  const [armed, setArmed] = useState(false)

  if (!assets.length) {
    return (
      <div className="card-sm p-6 text-center">
        <p className="text-sm font-medium text-[#5c5c5c]">
          Belum ada berkas terdeteksi. Unggah file di dropzone di atas untuk memulai.
        </p>
      </div>
    )
  }

  return (
    <div className="card-sm overflow-hidden p-0">
      <div className="flex flex-wrap items-center gap-3 border-b-[3px] border-black bg-white p-2">
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={armed}
            onChange={(e) => setArmed(e.target.checked)}
          />
          Pilih semua (<span className="mono">{assets.length}</span>)
        </label>
        <button
          className="btn btn-danger ml-auto"
          onClick={() => {
            onRemoveAll()
            setArmed(false)
          }}
          disabled={!armed}
        >
          <Trash2 size={13} strokeWidth={2.5} aria-hidden="true" />
          Hapus Semua
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="tbl">
          <colgroup>
            <col style={{ width: '13%' }} />
            <col style={{ width: '41%' }} />
            <col style={{ width: '13%' }} />
            <col style={{ width: '16%' }} />
            <col style={{ width: '17%' }} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Type</th>
              <th scope="col">Nama &amp; informasi</th>
              <th scope="col">Ukuran</th>
              <th scope="col">Status</th>
              <th scope="col">Tindakan</th>
            </tr>
          </thead>
          <tbody>
            {assets.map((a) => {
              const name = a.files?.[0]?.name ?? a.id
              const dims = a.dims ? `${a.dims.w}\u00d7${a.dims.h} px` : '\u2014'
              return (
                <tr key={a.id}>
                  <td>
                    <span className="badge badge-info">{fileTypeOf(a) || '\u2014'}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      {a.previewUrl ? (
                        <img
                          src={a.previewUrl}
                          alt=""
                          className="h-10 w-10 shrink-0 border-2 border-black bg-white object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <span className="grid h-10 w-10 shrink-0 place-items-center border-2 border-black bg-white text-[#8a8a8a]">
                          <ImageIcon size={15} strokeWidth={2} aria-hidden="true" />
                        </span>
                      )}
                      <span className="grid min-w-0">
                        <span className="mono break-all text-xs">{name}</span>
                        <span className="text-xs text-[#5c5c5c]">{dims}</span>
                      </span>
                    </div>
                  </td>
                  <td className="mono text-xs">{a.sizeLabel || '\u2014'}</td>
                  <td>
                    <Pill status={a.status} />
                  </td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => onRemove(a.id)}
                      aria-label={`Hapus ${name}`}
                    >
                      <Trash2 size={13} strokeWidth={2.5} aria-hidden="true" />
                      Hapus
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
