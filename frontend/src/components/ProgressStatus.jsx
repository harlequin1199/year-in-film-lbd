import { formatNumber } from '../utils/format.js'

function ProgressStatus({ progress }) {
  if (!progress) return null
  const total = progress.total || 0
  const done = progress.done || 0
  const percent = total ? Math.min(100, Math.round((done / total) * 100)) : 0

  return (
    <section className="progress-card">
      <div className="progress-header">
        <div className="spinner" />
        <div>
          <p className="progress-title">Анализирую ваш год в кино</p>
          <p className="progress-subtitle">
            Обработано {formatNumber(done)} из {formatNumber(total)} фильмов
          </p>
        </div>
        <div className="progress-percent">{percent}%</div>
      </div>
      <div className="progress-bar">
        <div className="progress-fill" style={{ width: `${percent}%` }} />
      </div>
    </section>
  )
}

export default ProgressStatus
