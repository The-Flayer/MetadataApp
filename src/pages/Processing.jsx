import { ArrowRight } from 'lucide-react'
import SectionTitle from '../components/SectionTitle'
import SlotCards from '../components/SlotCards'
import QueueTable from '../components/QueueTable'
import ErrorLog from '../components/ErrorLog'
import StickyCta from '../components/StickyCta'

// Tab 2: queue page. Queue lives in App state, so leaving mid-run is safe.
export default function Processing({ assets, rejected, queueActive, onRetry, onNavigate }) {
  const total = assets.length
  const done = assets.filter((a) => a.status === 'done').length
  const failed = assets.filter((a) => a.status === 'failed').length
  const waiting = assets.filter((a) => a.status !== 'done' && a.status !== 'failed').length
  const withMeta = assets.filter((a) => a.meta).length
  const pct = total ? Math.round(((done + failed) / total) * 100) : 0

  return (
    <>
      <SectionTitle
        eyebrow="Langkah 2 dari 4"
        title="Sedang Menghasilkan Metadata"
        badge={<span className="badge badge-info">Batch aktif</span>}
      >
        {queueActive && (
          <span className="badge badge-warn" role="status">
            Sedang berjalan
          </span>
        )}
      </SectionTitle>

      <SlotCards
        total={total}
        done={done}
        failed={failed}
        waiting={waiting}
        pct={pct}
        queueActive={queueActive}
      />

      <SectionTitle eyebrow="Antrian" title="Daftar Antrean Batch Aktif" />

      <QueueTable assets={assets} queueActive={queueActive} onRetry={onRetry} />

      <ErrorLog rejected={rejected} assets={assets} />

      <StickyCta
        counter={total ? `${done} selesai · ${failed} gagal · ${waiting} menunggu` : 'Antrian kosong'}
      >
        <button
          className="btn btn-primary"
          onClick={() => onNavigate('review')}
          disabled={withMeta === 0}
        >
          Lanjut ke Tinjau &amp; Edit
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </StickyCta>
    </>
  )
}
