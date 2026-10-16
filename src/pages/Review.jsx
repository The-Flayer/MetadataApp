import { ArrowRight } from 'lucide-react'
import { isExportable } from '../lib/validate'
import SectionTitle from '../components/SectionTitle'
import AssetList from '../components/AssetList'
import StickyCta from '../components/StickyCta'

// Tab 3: per-asset review + edit.
export default function Review({
  assets,
  busyAll,
  onTitleChange,
  onCategoryChange,
  onAddKeyword,
  onRemoveKeyword,
  onMoveKeyword,
  onRegenerate,
  onNavigate,
}) {
  const exportable = assets.filter((a) => a.meta && isExportable(a)).length

  return (
    <>
      <SectionTitle
        eyebrow="Langkah 3 dari 4"
        title="Tinjau & Edit Metadata"
        badge={
          <span className="badge badge-info">
            <span className="mono">{assets.length}</span> aset
          </span>
        }
      />

      <AssetList
        assets={assets}
        busyAll={busyAll}
        onTitleChange={onTitleChange}
        onCategoryChange={onCategoryChange}
        onAddKeyword={onAddKeyword}
        onRemoveKeyword={onRemoveKeyword}
        onMoveKeyword={onMoveKeyword}
        onRegenerate={onRegenerate}
      />

      <StickyCta
        counter={exportable ? `${exportable} aset siap diekspor` : 'Belum ada aset yang siap'}
      >
        <button
          className="btn btn-primary"
          onClick={() => onNavigate('settings')}
          disabled={exportable === 0}
        >
          Lanjut ke Ekspor
          <ArrowRight size={14} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </StickyCta>
    </>
  )
}
