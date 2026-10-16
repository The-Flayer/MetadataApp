import { FileWarning } from 'lucide-react'

// Numbered error log: rejected uploads + failed assets, with reason text.
export default function ErrorLog({ rejected = [], assets = [] }) {
  const failed = assets.filter((a) => a.status === 'failed')
  const entries = [
    ...rejected.map((r) => ({ name: r.name, reason: r.reason })),
    ...failed.map((a) => ({
      name: a.files?.[0]?.name ?? a.id,
      reason: a.error || 'Gagal tanpa pesan.',
    })),
  ]

  if (!entries.length) return null

  return (
    <section className="card-sm p-4">
      <h3 className="flex items-center gap-2 text-base">
        <FileWarning size={16} strokeWidth={2.5} aria-hidden="true" />
        Error Log (<span className="mono">{entries.length}</span>)
      </h3>
      <ol className="mt-3 grid gap-1.5">
        {entries.map((e, i) => (
          <li
            key={`${e.name}-${i}`}
            className="flex flex-wrap items-start gap-2 border-2 border-black bg-white p-2 text-sm"
          >
            <span className="mono shrink-0 font-bold">{i + 1}.</span>
            <span className="mono break-all">{e.name}</span>
            <span className="ml-auto whitespace-pre-line text-right font-bold text-[#b3144e]">
              {e.reason}
            </span>
          </li>
        ))}
      </ol>
    </section>
  )
}
