import { useState } from 'react'
import { Settings, KeyRound, Server, Cpu, Save, Plug, Loader2, Check, AlertTriangle, Eye, EyeOff } from 'lucide-react'
import { validateConfig, DEFAULT_ENDPOINT, DEFAULT_MODEL } from '../config/provider'

// AC-005 / AC-006. First-run prompt is driven by App (lands on the settings tab when no cfg).
// apiKey lives in local form state -> cfg -> localStorage only. Never logged, never rendered outside this panel.
// Always visible on the Pengaturan & Ekspor tab (no collapse).
export default function SettingsPanel({ cfg, onSave, onTest, test }) {
  const [form, setForm] = useState({
    endpoint: cfg?.endpoint ?? DEFAULT_ENDPOINT,
    model: cfg?.model ?? DEFAULT_MODEL,
    apiKey: cfg?.apiKey ?? '',
  })
  const [errors, setErrors] = useState([])
  const [showKey, setShowKey] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  const handleSave = () => {
    const v = validateConfig(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    setErrors([])
    onSave(form)
  }

  const handleTest = () => {
    const v = validateConfig(form)
    if (!v.valid) {
      setErrors(v.errors)
      return
    }
    setErrors([])
    onSave(form)
    onTest(form)
  }

  const testing = test?.state === 'testing'
  const failed = test?.state === 'fail'

  return (
    <section className="card-sm p-4">
      <h2 className="flex items-center gap-2 text-lg">
        <Settings size={18} strokeWidth={2.5} aria-hidden="true" />
        Pengaturan provider
      </h2>

      {!cfg && (
        <p className="mt-3 rounded bg-white/70 p-2 text-sm">
          Belum ada konfigurasi provider. Isi <b>endpoint</b>, <b>model</b>, dan <b>API key</b>,
          lalu simpan dan tes koneksi untuk mulai generate metadata.
        </p>
      )}

      <div className="mt-4 grid gap-3">
          <label className="grid gap-1 text-sm font-bold">
            <span className="flex items-center gap-1.5">
              <Server size={13} strokeWidth={2.5} aria-hidden="true" /> Endpoint
            </span>
            <input
              className="input"
              value={form.endpoint}
              onChange={set('endpoint')}
              placeholder="https://contoh.com"
              autoComplete="off"
              spellCheck={false}
              disabled={testing}
            />
            <span className="font-medium text-[#5c5c5c]">
              URL http/https, tanpa garis miring di akhir, tanpa /v1 — klien menambahkan /v1 sendiri. http hanya untuk localhost.
            </span>
          </label>

          <label className="grid gap-1 text-sm font-bold">
            <span className="flex items-center gap-1.5">
              <Cpu size={13} strokeWidth={2.5} aria-hidden="true" /> Model
            </span>
            <input
              className="input"
              value={form.model}
              onChange={set('model')}
              placeholder="nama model vision (mis. gpt-4o)"
              autoComplete="off"
              spellCheck={false}
              disabled={testing}
            />
          </label>

          <label className="grid gap-1 text-sm font-bold">
            <span className="flex items-center gap-1.5">
              <KeyRound size={13} strokeWidth={2.5} aria-hidden="true" /> API key
            </span>
            <input
              className="input mono"
              type={showKey ? 'text' : 'password'}
              value={form.apiKey}
              onChange={set('apiKey')}
              placeholder="••••••••••••••••"
              autoComplete="off"
              spellCheck={false}
              disabled={testing}
            />
            <span className="font-medium text-[#5c5c5c]">
              Disimpan di browser ini saja (localStorage). Tidak pernah masuk ekspor atau log.
            </span>
          </label>

          {errors.length > 0 && (
            <ul className="grid gap-1 rounded border-2 border-black bg-white p-2 text-sm">
              {errors.map((e, i) => (
                <li key={i} className="flex items-start gap-1.5 font-bold text-[#b3144e]">
                  <AlertTriangle size={13} className="mt-0.5 shrink-0" strokeWidth={2.5} aria-hidden="true" />
                  {e}
                </li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-2">
            <button className="btn btn-primary" onClick={handleSave} disabled={testing}>
              <Save size={14} strokeWidth={2.5} aria-hidden="true" />
              Simpan
            </button>
            <button className="btn" onClick={handleTest} disabled={testing}>
              {testing ? (
                <Loader2 size={14} strokeWidth={2.5} className="animate-spin" aria-hidden="true" />
              ) : (
                <Plug size={14} strokeWidth={2.5} aria-hidden="true" />
              )}
              Tes koneksi
            </button>
            <button
              className="btn-icon"
              type="button"
              onClick={() => setShowKey((s) => !s)}
              aria-label={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
              title={showKey ? 'Sembunyikan API key' : 'Tampilkan API key'}
            >
              {showKey ? <EyeOff size={14} strokeWidth={2.5} /> : <Eye size={14} strokeWidth={2.5} />}
            </button>
          </div>

          {test?.state === 'ok' && (
            <p className="flex items-center gap-1.5 rounded border-2 border-black bg-[var(--color-emerald)] p-2 text-sm font-bold">
              <Check size={14} strokeWidth={2.5} aria-hidden="true" />
              {test.message || 'Koneksi berhasil. Siap generate metadata.'}
            </p>
          )}
          {failed && (
            <div className="flex flex-wrap items-center gap-2 rounded border-2 border-black bg-[var(--color-pink)] p-2 text-sm font-bold">
              <AlertTriangle size={14} strokeWidth={2.5} aria-hidden="true" />
              <span>{test.message || 'Koneksi gagal.'}</span>
            </div>
          )}
        </div>
    </section>
  )
}
