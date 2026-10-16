const SLOTS = [
  { key: 'total', label: 'Total', cls: 'slot-total' },
  { key: 'done', label: 'Selesai', cls: 'slot-done' },
  { key: 'failed', label: 'Gagal', cls: 'slot-failed' },
  { key: 'waiting', label: 'Menunggu', cls: 'slot-waiting' },
]

// Pemrosesan: 4 stat slots + batch progress bar (hazard-striped while running).
export default function SlotCards({ total = 0, done = 0, failed = 0, waiting = 0, pct = 0, queueActive = false }) {
  const v = { total, done, failed, waiting }
  return (
    <section className="card grid gap-4 p-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {SLOTS.map((s) => (
          <div key={s.key} className={`slot ${s.cls}`}>
            <span className="mono block text-2xl font-bold leading-none">{v[s.key]}</span>
            <span className="text-xs font-bold uppercase tracking-wide">{s.label}</span>
          </div>
        ))}
      </div>
      <div>
        <div
          className="h-5 w-full border-2 border-black bg-white"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Progres batch"
        >
          <div
            className={`h-full transition-[width] duration-200 ${
              queueActive ? 'progress-hazard' : 'bg-[var(--color-emerald)]'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-1.5 text-sm font-bold">
          <span className="mono">{done + failed}</span>/<span className="mono">{total}</span> diproses
        </p>
      </div>
    </section>
  )
}
