import SectionTitle from '../components/SectionTitle'
import SettingsPanel from '../components/SettingsPanel'
import RulesPanel from '../components/RulesPanel'
import FormatPicker from '../components/FormatPicker'
import ExportBar from '../components/ExportBar'
import StickyCta from '../components/StickyCta'

// Tab 4: provider settings (always visible) + rules + format picker + export.
// ExportBar is the sticky bottom CTA on this page.
export default function SettingsExport({ cfg, onSave, onTest, test, assets, onExport, exporting, format, onFormatChange }) {
  return (
    <>
      <SectionTitle
        eyebrow="Langkah 4 dari 4"
        title="Pengaturan & Ekspor"
        badge={<span className="badge badge-info">Provider</span>}
      />

      <SettingsPanel cfg={cfg} onSave={onSave} onTest={onTest} test={test} />

      <RulesPanel />

      <SectionTitle eyebrow="Ekspor" title="Pilih Format Ekspor" />

      <FormatPicker value={format} onChange={onFormatChange} />

      {/* Extra clearance: ExportBar carries the pre-export summary lists. */}
      <div className="h-40" aria-hidden="true" />

      <StickyCta>
        <ExportBar
          assets={assets}
          onExport={onExport}
          exporting={exporting}
          format={format}
        />
      </StickyCta>
    </>
  )
}
