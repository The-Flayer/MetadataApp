const FILTERS = [
  { id: 'all', label: 'Semua' },
  { id: 'failed', label: 'Gagal' },
  { id: 'regen', label: 'Perlu regenerasi' },
  { id: 'nometa', label: 'Tanpa meta' },
]

// Controlled filter chips for the review toolbar. counts are optional.
export default function FilterChips({ value, onChange, counts = {} }) {
  return (
    <div className="flex flex-wrap gap-2">
      {FILTERS.map((f) => (
        <button
          key={f.id}
          type="button"
          className={`fchip ${value === f.id ? 'fchip-active' : ''}`}
          onClick={() => onChange(f.id)}
          aria-pressed={value === f.id}
        >
          {f.label}
          {counts[f.id] != null && (
            <>
              {' '}
              <span className="mono">({counts[f.id]})</span>
            </>
          )}
        </button>
      ))}
    </div>
  )
}
