import { formatNumber } from '../utils/format.js'

const DISPLAY_STEPS = [
  { key: 'parsing', label: 'Чтение CSV' },
  { key: 'stage1', label: 'Базовая статистика' },
  { key: 'tmdb_search', label: 'Поиск фильмов в TMDb' },
  { key: 'tmdb_details', label: 'Загрузка данных TMDb' },
  { key: 'credits_keywords', label: 'Актёры и режиссёры (опц.)' },
  { key: 'finalizing', label: 'Финализация отчёта' },
]

function ProgressStatus({ progress, onCancel, retryMessage }) {
  if (!progress) return null
  const total = progress.total || 0
  const done = progress.done || 0
  const percent = progress.percent ?? (total ? Math.min(100, Math.round((done / total) * 100)) : 0)
  const stage = progress.stage || 'parsing'
  const stepIndex = (() => {
    if (stage === 'parsing') return 0
    if (stage === 'stage1') return 1
    if (stage === 'tmdb_search') return 2
    if (stage === 'tmdb_details' || stage === 'analytics') return 3
    if (stage === 'credits_keywords') return 4
    return 5
  })()

  return (
    <section className="progress-card">
      <div className="progress-header">
        <div className="spinner" />
        <div>
          <p className="progress-title">{progress.message || 'Анализирую ваш год в кино'}</p>
          <p className="progress-subtitle">
            Обработано {formatNumber(done)} из {formatNumber(total)}
          </p>
          {retryMessage && <p className="progress-retry-message">{retryMessage}</p>}
        </div>
        <div className="progress-percent">{percent}%</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
      <div className="progress-steps" aria-label="Этапы обработки">
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
            Остановить анализ
          </button>
        </div>
      )}
    </section>
  )
}

export default ProgressStatus
