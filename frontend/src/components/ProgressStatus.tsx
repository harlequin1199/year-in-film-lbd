import { formatNumber } from '../utils/format'
import type { Progress } from '../types'
import { normalizeMojibakeText } from '../utils/normalizeMojibakeText'

const DISPLAY_STEPS = [
  { key: 'parsing', label: '\u0427\u0442\u0435\u043d\u0438\u0435 CSV' },
  { key: 'stage1', label: '\u0411\u0430\u0437\u043e\u0432\u0430\u044f \u0441\u0442\u0430\u0442\u0438\u0441\u0442\u0438\u043a\u0430' },
  { key: 'tmdb_search', label: '\u041f\u043e\u0438\u0441\u043a \u0444\u0438\u043b\u044c\u043c\u043e\u0432 \u0432 TMDb' },
  { key: 'tmdb_details', label: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u0434\u0430\u043d\u043d\u044b\u0445 TMDb' },
  { key: 'finalizing', label: '\u0424\u0438\u043d\u0430\u043b\u0438\u0437\u0430\u0446\u0438\u044f \u043e\u0442\u0447\u0451\u0442\u0430' },
] as const

interface ProgressStatusProps {
  progress: Progress | null
  onCancel?: () => void
  retryMessage?: string
}

function ProgressStatus({ progress, onCancel, retryMessage }: ProgressStatusProps) {
  if (!progress) return null

  const total = progress.total || 0
  const done = progress.done || 0
  const percent = progress.percent ?? (total ? Math.min(100, Math.round((done / total) * 100)) : 0)
  const stage = progress.stage || 'parsing'

  const stageLabelByKey = Object.fromEntries(DISPLAY_STEPS.map((step) => [step.key, step.label])) as Record<string, string>
  const fallbackStageLabel = stage === 'analytics' ? stageLabelByKey.tmdb_details : stageLabelByKey[stage]
  const normalizedMessage = normalizeMojibakeText(progress.message || '')
  const hasBrokenEncoding = /�|ï¿½|Ð|Ñ|Ã/.test(progress.message || '') || normalizedMessage !== (progress.message || '')
  const displayTitle = progress.message
    ? (hasBrokenEncoding && fallbackStageLabel ? fallbackStageLabel : normalizedMessage)
    : (fallbackStageLabel || '\u0410\u043d\u0430\u043b\u0438\u0437\u0438\u0440\u0443\u044e \u0432\u0430\u0448 \u0433\u043e\u0434 \u0432 \u043a\u0438\u043d\u043e')

  const stepIndex = (() => {
    if (stage === 'parsing') return 0
    if (stage === 'stage1') return 1
    if (stage === 'tmdb_search') return 2
    if (stage === 'tmdb_details' || stage === 'analytics') return 3
    return 4
  })()

  return (
    <section className="progress-card">
      <div className="progress-header">
        <div className="spinner" />
        <div>
          <p className="progress-title">{displayTitle}</p>
          <p className="progress-subtitle">
            {'\u041e\u0431\u0440\u0430\u0431\u043e\u0442\u0430\u043d\u043e'} {formatNumber(done)} {'\u0438\u0437'} {formatNumber(total)}
          </p>
          {retryMessage && <p className="progress-retry-message">{normalizeMojibakeText(retryMessage)}</p>}
        </div>
        <div className="progress-percent">{percent}%</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-steps" aria-label={'\u042d\u0442\u0430\u043f\u044b \u043e\u0431\u0440\u0430\u0431\u043e\u0442\u043a\u0438'}>
        {DISPLAY_STEPS.map((s, i) => (
          <span
            key={s.key}
            className={`progress-step ${i < stepIndex ? 'done' : ''} ${i === stepIndex ? 'active' : ''}`}
          >
            <span className="progress-step-dot" />
            {s.label}
          </span>
        ))}
      </div>
      {onCancel && (
        <div className="progress-actions">
          <button type="button" className="btn btn-secondary btn-small" onClick={onCancel}>
            {'\u041e\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0430\u043d\u0430\u043b\u0438\u0437'}
          </button>
        </div>
      )}
    </section>
  )
}

export default ProgressStatus
