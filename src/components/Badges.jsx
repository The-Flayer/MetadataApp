import { AlertTriangle, AlertCircle, Info } from 'lucide-react'

const STYLE = {
  error: { cls: 'badge-error', Icon: AlertTriangle, label: 'Error' },
  warn: { cls: 'badge-warn', Icon: AlertCircle, label: 'Peringatan' },
  info: { cls: 'badge-info', Icon: Info, label: 'Info' },
}

// Renders validateAsset() output. Every badge carries a text label (PRD §7: never color-only).
// ponytail: code is shown as a mono prefix; if codes turn out to be user-hostile, drop it.
export default function Badges({ badges = [], className = '' }) {
  if (!badges.length) return null
  return (
    <div className={`flex flex-wrap gap-1.5 ${className}`}>
      {badges.map((b, i) => {
        const s = STYLE[b.level] || STYLE.info
        const { Icon, label } = s
        return (
          <span
            key={i}
            className={`badge ${s.cls}`}
            role="status"
            title={`${label}: ${b.message}`}
          >
            <Icon size={12} strokeWidth={2.5} aria-hidden="true" />
            <span className="mono">{b.code}</span>
            <span>{b.message}</span>
          </span>
        )
      })}
    </div>
  )
}
