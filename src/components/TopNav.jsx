const TABS = [
  { id: 'workspace', label: 'Ruang Kerja' },
  { id: 'processing', label: 'Pemrosesan' },
  { id: 'review', label: 'Tinjau & Edit' },
  { id: 'settings', label: 'Pengaturan & Ekspor' },
]

// Sticky workspace shell. Tab badges are computed in App; falsy = no badge.
export default function TopNav({ page, onPage, pill, badges = {} }) {
  return (
    <div className="tabbar">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
        <span className="flex items-center gap-2">
          <span
            className="inline-block h-5 w-5 border-[3px] border-black bg-[var(--color-pink)]"
            aria-hidden="true"
          />
          <span className="font-display text-lg font-bold leading-none">Stock Metadata Studio</span>
        </span>
        <nav className="flex flex-1 flex-wrap items-center gap-2" aria-label="Tab ruang kerja">
          {TABS.map((t) => {
            const active = page === t.id
            const badge = badges[t.id]
            return (
              <button
                key={t.id}
                type="button"
                className={`tab ${active ? 'tab-active' : ''}`}
                onClick={() => onPage(t.id)}
                aria-current={active ? 'page' : undefined}
              >
                {t.label}
                {badge != null && (
                  <span className={`tab-count ${t.id === 'processing' ? 'tab-count-danger' : ''}`}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </nav>
        <span className={`badge ${pill.cls}`} role="status">
          {pill.text}
        </span>
      </div>
    </div>
  )
}
