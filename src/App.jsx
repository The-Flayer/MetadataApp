import { useCallback, useState } from 'react'
import { AlertTriangle } from 'lucide-react'
import { loadConfig, saveConfig } from './config/provider'
import { ingestFiles } from './lib/upload'
import { rasterizeAsset } from './lib/preprocess'
import { testConnection } from './lib/providerClient'
import { runQueue, runOne } from './lib/queue'
import { isExportable } from './lib/validate'
import { buildZip, toCsv } from './lib/export'
import TopNav from './components/TopNav'
import Workspace from './pages/Workspace'
import Processing from './pages/Processing'
import Review from './pages/Review'
import SettingsExport from './pages/SettingsExport'

export default function App() {
  const [assets, setAssets] = useState([])
  const [rejected, setRejected] = useState([])
  const [cfg, setCfg] = useState(() => loadConfig())
  const [test, setTest] = useState({ state: 'idle', message: '' })
  const [queueActive, setQueueActive] = useState(false)
  const [exporting, setExporting] = useState(false)
  // No persisted provider config -> land on settings so the owner configures first.
  const [page, setPage] = useState(() => (loadConfig() ? 'workspace' : 'settings'))
  const [format, setFormat] = useState('zip')

  const onProgress = useCallback((a) => {
    setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...a } : x)))
  }, [])

  // ---- Provider config (AC-005 / AC-006) ----
  const handleSave = (next) => {
    saveConfig(next)
    setCfg(next)
    setTest({ state: 'idle', message: '' }) // invalidate stale test result
  }

  const handleTest = async (next) => {
    const c = next ?? cfg
    if (!c) return
    setTest({ state: 'testing', message: '' })
    try {
      const r = await testConnection(c)
      setTest({ state: r.ok ? 'ok' : 'fail', message: r.message })
    } catch (e) {
      setTest({ state: 'fail', message: e?.message || 'Koneksi gagal. Cek endpoint dan jaringan.' })
    }
  }

  // ---- Upload (AC-001..AC-004) ----
  const handleFiles = async (fileList) => {
    const { accepted, rejected: rej } = ingestFiles(fileList, assets.length)
    if (rej.length) setRejected((prev) => [...prev, ...rej])
    if (!accepted.length) return
    setAssets((prev) => [...prev, ...accepted])
    // Rasterize previews/AI inputs as they land (svg via canvas, eps-pair via its JPG).
    for (const a of accepted) {
      try {
        await rasterizeAsset(a)
      } catch {
        a.warnings = [...(a.warnings || []), 'Gagal merasterisasi pratinjau.']
      }
      setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...a } : x)))
    }
  }

  // ---- Queue (AC-007 / AC-008) ----
  const handleGenerate = async () => {
    if (queueActive || !assets.length) return
    setPage('processing') // jump to the queue view while it runs
    setQueueActive(true)
    try {
      await runQueue({ assets, cfg, onProgress })
    } finally {
      setQueueActive(false)
    }
  }

  const handleRunOne = async (asset) => {
    if (queueActive) return
    setQueueActive(true)
    try {
      await runOne({ asset, cfg, onProgress })
    } finally {
      setQueueActive(false)
    }
  }

  // ---- Edits (AC-013 / AC-014) ----
  const patchMeta = (id, patch) =>
    setAssets((prev) =>
      prev.map((a) => (a.id === id ? { ...a, meta: { ...a.meta, ...patch } } : a)),
    )

  const handleTitleChange = (id, title) => patchMeta(id, { title })
  const handleCategoryChange = (id, categoryId) => patchMeta(id, { categoryId })

  const handleAddKeyword = (id, kw) =>
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id ? { ...a, meta: { ...a.meta, keywords: [...a.meta.keywords, kw] } } : a,
      ),
    )
  const handleRemoveKeyword = (id, i) =>
    setAssets((prev) =>
      prev.map((a) =>
        a.id === id
          ? { ...a, meta: { ...a.meta, keywords: a.meta.keywords.filter((_, j) => j !== i) } }
          : a,
      ),
    )
  const handleMoveKeyword = (id, i, dir) =>
    setAssets((prev) =>
      prev.map((a) => {
        if (a.id !== id) return a
        const j = i + dir
        const kws = [...a.meta.keywords]
        if (j < 0 || j >= kws.length) return a
        ;[kws[i], kws[j]] = [kws[j], kws[i]]
        return { ...a, meta: { ...a.meta, keywords: kws } }
      }),
    )

  // ---- Workspace table cleanup ----
  const handleRemove = (id) => setAssets((prev) => prev.filter((a) => a.id !== id))
  const handleRemoveAll = () => {
    setAssets([])
    setRejected([])
  }

  // ---- Export (AC-017 / AC-018 / AC-020) ----
  const handleExport = async () => {
    const exportable = assets.filter((a) => a.meta && isExportable(a))
    if (!exportable.length) return
    setExporting(true)
    try {
      const blob =
        format === 'csv'
          ? new Blob([toCsv(exportable)], { type: 'text/csv;charset=utf-8' })
          : await buildZip(exportable)
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = format === 'csv' ? 'metadata.csv' : 'metadata.zip'
      document.body.appendChild(link)
      link.click()
      link.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const testOk = test?.state === 'ok'
  const canGenerate = testOk && assets.length > 0 && !queueActive
  const disabledReason = !testOk
    ? cfg
      ? 'Simpan dan tes koneksi provider dulu.'
      : 'Belum ada konfigurasi provider — isi pengaturan di atas dulu.'
    : assets.length === 0
      ? 'Tambahkan file ke antrian dulu.'
      : null

  const pill = testOk
    ? { cls: 'bg-[var(--color-emerald)]', text: 'Provider terhubung' }
    : test?.state === 'testing'
      ? { cls: 'bg-[var(--color-amber)]', text: 'Menguji koneksi…' }
      : test?.state === 'fail'
        ? { cls: 'bg-[var(--color-pink)]', text: 'Provider gagal terhubung' }
        : { cls: 'bg-white', text: 'Provider belum dikonfigurasi' }

  const failedCount = assets.filter((a) => a.status === 'failed').length
  const withMetaCount = assets.filter((a) => a.meta).length
  const exportableCount = assets.filter((a) => a.meta && isExportable(a)).length
  const tabBadges = {
    workspace: `${assets.length}`,
    processing: failedCount > 0 ? failedCount : null,
    review: withMetaCount > 0 ? withMetaCount : null,
    settings: exportableCount > 0 ? exportableCount : null,
  }

  return (
    <>
      <TopNav page={page} onPage={setPage} pill={pill} badges={tabBadges} />

      <div className="mx-auto grid max-w-5xl gap-5 px-4 py-6 md:py-8">
        {test?.state === 'fail' && (
          <div className="card-sm flex flex-wrap items-center gap-2 p-3">
            <AlertTriangle size={16} strokeWidth={2.5} className="shrink-0" aria-hidden="true" />
            <p className="text-sm font-bold">{test.message || 'Koneksi provider gagal.'}</p>
            <button
              className="btn btn-warn ml-auto"
              onClick={() => setPage('settings')}
            >
              Edit pengaturan
            </button>
          </div>
        )}

        {page === 'workspace' && (
          <Workspace
            assets={assets}
            rejected={rejected}
            onFiles={handleFiles}
            onRemove={handleRemove}
            onRemoveAll={handleRemoveAll}
            canGenerate={canGenerate}
            disabledReason={disabledReason}
            onGenerate={handleGenerate}
          />
        )}

        {page === 'processing' && (
          <Processing
            assets={assets}
            rejected={rejected}
            queueActive={queueActive}
            onRetry={handleRunOne}
            onNavigate={setPage}
          />
        )}

        {page === 'review' && (
          <Review
            assets={assets}
            busyAll={queueActive}
            onTitleChange={handleTitleChange}
            onCategoryChange={handleCategoryChange}
            onAddKeyword={handleAddKeyword}
            onRemoveKeyword={handleRemoveKeyword}
            onMoveKeyword={handleMoveKeyword}
            onRegenerate={handleRunOne}
            onNavigate={setPage}
          />
        )}

        {page === 'settings' && (
          <SettingsExport
            cfg={cfg}
            onSave={handleSave}
            onTest={handleTest}
            test={test}
            assets={assets}
            onExport={handleExport}
            exporting={exporting}
            format={format}
            onFormatChange={setFormat}
          />
        )}

        <footer className="text-xs font-medium text-[#5c5c5c]">
          Semua proses berjalan lokal di browser. API key hanya disimpan di browser ini dan tidak
          pernah masuk ke ekspor atau log.
        </footer>
      </div>
    </>
  )
}
