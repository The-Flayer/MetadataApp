import { useState } from 'react'
import { Search } from 'lucide-react'
import { isExportable } from '../lib/validate'
import AssetCard from './AssetCard'
import FilterChips from './FilterChips'

// Review grid wrapper: owns search + filter state, renders the AssetCard grid.
export default function AssetList({
  assets,
  busyAll,
  onTitleChange,
  onCategoryChange,
  onAddKeyword,
  onRemoveKeyword,
  onMoveKeyword,
  onRegenerate,
}) {
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const query = q.trim().toLowerCase()

  if (!assets.length) {
    return (
      <div className="card-sm p-6 text-center">
        <p className="text-sm font-medium text-[#5c5c5c]">
          Belum ada aset. Generate metadata di tab Pemrosesan untuk mulai meninjau.
        </p>
      </div>
    )
  }

  const counts = {
    all: assets.length,
    failed: assets.filter((a) => a.status === 'failed').length,
    regen: assets.filter((a) => a.meta && !isExportable(a)).length,
    nometa: assets.filter((a) => !a.meta).length,
  }

  const filtered = assets.filter((a) => {
    if (query) {
      const hay = [a.files?.[0]?.name, a.meta?.title, ...(a.meta?.keywords || [])]
        .join(' ')
        .toLowerCase()
      if (!hay.includes(query)) return false
    }
    if (filter === 'failed') return a.status === 'failed'
    if (filter === 'regen') return !!a.meta && !isExportable(a)
    if (filter === 'nometa') return !a.meta
    return true
  })

  return (
    <section className="grid gap-3">
      <div className="card-sm flex flex-wrap items-center gap-3 p-3">
        <div className="relative min-w-[200px] flex-1">
          <Search
            size={15}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#5c5c5c]"
            aria-hidden="true"
          />
          <input
            type="search"
            className="input pl-8 text-sm"
            placeholder="Cari judul, kata kunci, atau nama file…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-label="Cari aset"
          />
        </div>
        <FilterChips value={filter} onChange={setFilter} counts={counts} />
      </div>

      {filtered.length ? (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((a) => (
            <AssetCard
              key={a.id}
              asset={a}
              busyAll={busyAll}
              onTitleChange={onTitleChange}
              onCategoryChange={onCategoryChange}
              onAddKeyword={onAddKeyword}
              onRemoveKeyword={onRemoveKeyword}
              onMoveKeyword={onMoveKeyword}
              onRegenerate={onRegenerate}
            />
          ))}
        </div>
      ) : (
        <div className="card-sm p-6 text-center">
          <p className="text-sm font-medium text-[#5c5c5c]">
            Tidak ada aset yang cocok dengan pencarian atau filter ini.
          </p>
        </div>
      )}
    </section>
  )
}
