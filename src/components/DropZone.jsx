import { useRef, useState } from 'react'
import { UploadCloud, FileWarning, X } from 'lucide-react'
import { ACCEPTED } from '../lib/upload'

// AC-001..AC-004. Rejection reasons (pairing, unsupported type) come from ingestFiles.
// No batch cap (AC-002 retired v5.2): `count` is display-only.
export default function DropZone({ onFiles, rejected = [], count = 0 }) {
  const inputRef = useRef(null)
  const [dragging, setDragging] = useState(false)

  const pick = () => inputRef.current?.click()

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = e.dataTransfer?.files
    if (files?.length) onFiles(files)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      pick()
    }
  }

  const FORMATS = ['JPG', 'PNG', 'SVG', 'EPS/AI + JPG']

  return (
    <section className="grid gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={pick}
        onKeyDown={handleKey}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        className={`card dropzone flex min-h-[260px] cursor-pointer flex-col items-center justify-center gap-3 p-8 text-center transition-transform ${
          dragging ? '-translate-y-1' : ''
        }`}
        aria-label="Drop file di sini atau klik untuk memilih"
      >
        <span className="grid h-16 w-16 place-items-center rounded-full border-[3px] border-black bg-[var(--color-amber)]">
          <UploadCloud size={30} strokeWidth={2.5} aria-hidden="true" />
        </span>
        <p className="text-lg font-bold">Drop file di sini atau pilih dari komputer</p>
        <button
          type="button"
          className="btn btn-warn"
          onClick={(e) => {
            e.stopPropagation()
            pick()
          }}
        >
          <UploadCloud size={15} strokeWidth={2.5} aria-hidden="true" />
          Pilih file dari komputer
        </button>
        <div className="flex flex-wrap justify-center gap-1.5">
          {FORMATS.map((f) => (
            <span key={f} className="chip">
              {f}
            </span>
          ))}
        </div>
        <p className="max-w-xl text-sm font-medium">
          EPS/AI harus disertai <b>JPG dengan nama basis yang sama</b> (mis.{' '}
          <span className="mono">apel.eps</span> + <span className="mono">apel.jpg</span>).
          SVG, JPG, dan PNG berdiri sendiri. Jumlah berkas tidak dibatasi.
        </p>
        <p className="text-sm font-bold">
          Berkas dimuat: <span className="mono">{count}</span>
        </p>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept={ACCEPTED.join(',')}
          className="hidden"
          onChange={(e) => {
            if (e.target.files?.length) onFiles(e.target.files)
            e.target.value = ''
          }}
        />
      </div>

      {rejected.length > 0 && (
        <div className="card-sm p-3">
          <h3 className="flex items-center gap-2 text-sm">
            <FileWarning size={15} strokeWidth={2.5} aria-hidden="true" />
            File ditolak ({rejected.length})
          </h3>
          <ul className="mt-2 grid gap-1.5">
            {rejected.map((r, i) => (
              <li
                key={`${r.name}-${i}`}
                className="flex items-start gap-2 border-2 border-black bg-white p-1.5 text-sm"
              >
                <X size={13} className="mt-0.5 shrink-0 text-[#b3144e]" strokeWidth={2.5} aria-hidden="true" />
                <span>
                  <span className="mono break-all">{r.name}</span>
                </span>
                <span className="ml-auto whitespace-nowrap font-bold text-[#b3144e]">{r.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
