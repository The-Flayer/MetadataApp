// Workspace hero: headline, subtitle, 3 stat chips (values passed by the page).
export default function Hero({ stats = [] }) {
  return (
    <section className="grid gap-4">
      <div className="grid gap-2">
        <h1 className="text-3xl md:text-4xl">Buat Metadata Otomatis</h1>
        <p className="max-w-2xl text-sm font-medium md:text-base">
          Unggah karya <b>black-and-white food line art</b> Anda — AI membuat judul, kata kunci, dan
          kategori yang sesuai untuk Adobe Stock. Semua proses berjalan lokal di browser; API key
          tidak pernah masuk ke ekspor atau log.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        {stats.map((s) => (
          <span key={s.label} className="stat-chip">
            <span className="mono text-lg font-bold leading-none">{s.value}</span>
            <span className="text-xs font-bold uppercase tracking-wide text-[#5c5c5c]">{s.label}</span>
          </span>
        ))}
      </div>
    </section>
  )
}
