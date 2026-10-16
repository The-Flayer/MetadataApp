import { Check } from 'lucide-react'

// The niche rules the generator enforces (mirrors lib/prompt.js + lib/validate.js).
const RULES = [
  '15–35 kata kunci per aset — akurasi di atas jumlah',
  'Kata kunci subjek di posisi pertama (bobot tertinggi Adobe Stock)',
  'Tidak ada duplikat, termasuk pasangan tunggal/jamak ("banana" atau "bananas", bukan keduanya)',
  'Tidak ada kata lemah/banned (unhealthy, cheap, generic, junk, …)',
  'Kategori harus salah satu dari 21 ID resmi Adobe Stock',
  'Tidak ada field market_appeal atau social_caption',
]

export default function RulesPanel() {
  return (
    <section className="card-sm p-4">
      <h2 className="text-lg">Aturan Sistem Metadata</h2>
      <ul className="mt-3 grid gap-2">
        {RULES.map((r, i) => (
          <li key={i} className="flex items-start gap-2 text-sm font-medium">
            <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center border-2 border-black bg-[var(--color-emerald)]">
              <Check size={12} strokeWidth={3.5} aria-hidden="true" />
            </span>
            {r}
          </li>
        ))}
      </ul>
    </section>
  )
}
