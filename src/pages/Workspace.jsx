import { Wand2 } from 'lucide-react'
import { isExportable } from '../lib/validate'
import Hero from '../components/Hero'
import DropZone from '../components/DropZone'
import FileTable from '../components/FileTable'
import SectionTitle from '../components/SectionTitle'
import StickyCta from '../components/StickyCta'

// Tab 1: upload page. CTA runs onGenerate (App switches to Pemrosesan).
export default function Workspace({
  assets,
  rejected,
  onFiles,
  onRemove,
  onRemoveAll,
  canGenerate,
  disabledReason,
  onGenerate,
}) {
  const withMeta = assets.filter((a) => a.meta).length
  const exportable = assets.filter((a) => a.meta && isExportable(a)).length

  return (
    <>
      <Hero
        stats={[
          { label: 'Berkas dimuat', value: `${assets.length}` },
          { label: 'Dengan metadata', value: withMeta },
          { label: 'Siap ekspor', value: exportable },
        ]}
      />

      <DropZone onFiles={onFiles} rejected={rejected} count={assets.length} />

      <SectionTitle
        eyebrow="Langkah 1 dari 4"
        title="Daftar Berkas Terdeteksi"
        badge={
          <span className="badge badge-info">
            <span className="mono">{assets.length}</span> berkas
          </span>
        }
      />

      <FileTable assets={assets} onRemove={onRemove} onRemoveAll={onRemoveAll} />

      <StickyCta
        counter={
          disabledReason ||
          (assets.length ? `${assets.length} berkas siap digenerate` : 'Belum ada berkas')
        }
      >
        <button className="btn btn-ai" onClick={onGenerate} disabled={!canGenerate}>
          <Wand2 size={15} strokeWidth={2.5} aria-hidden="true" />
          Generate Metadata Sekarang ({assets.length} berkas)
        </button>
      </StickyCta>
    </>
  )
}
