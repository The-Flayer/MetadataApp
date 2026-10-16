import { Package, FileSpreadsheet, Check } from 'lucide-react'

const OPTIONS = [
  { id: 'zip', label: '.ZIP', desc: 'Aset + metadata.csv', Icon: Package },
  { id: 'csv', label: '.CSV', desc: 'Metadata saja', Icon: FileSpreadsheet },
]

// Pilih Format Ekspor: two option cards.
export default function FormatPicker({ value, onChange }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {OPTIONS.map((o) => {
        const sel = value === o.id
        const { Icon } = o
        return (
          <button
            key={o.id}
            type="button"
            className={`fcard ${sel ? 'fcard-selected' : ''}`}
            onClick={() => onChange(o.id)}
            aria-pressed={sel}
          >
            <span className="flex items-center gap-2 font-bold">
              <Icon size={18} strokeWidth={2.5} aria-hidden="true" />
              <span className="mono text-base">{o.label}</span>
              {sel && (
                <Check size={15} strokeWidth={3} className="ml-auto" aria-hidden="true" />
              )}
            </span>
            <span className="text-xs font-medium text-[#3c3c3c]">{o.desc}</span>
          </button>
        )
      })}
    </div>
  )
}
