import { formatNumber } from '../utils/format'
import type { WatchTime } from '../types/stats.types'

function formatDays(value: number | null | undefined): string | null {
  if (value == null || Number.isNaN(value)) return null
  const n = Number(value)
  const str = n.toFixed(1).replace('.', ',')
  return `${str} дня`
}

interface WatchTimeCardProps {
  watchTime: WatchTime | null
}

function WatchTimeCard({ watchTime }: WatchTimeCardProps) {
  if (!watchTime) return null

  const hasRuntime = watchTime.totalRuntimeMinutes != null && watchTime.totalRuntimeMinutes > 0
  const daysValue = hasRuntime && watchTime.totalRuntimeDays != null ? formatDays(watchTime.totalRuntimeDays) : null

  return (
    <section className="card">
      <div className="card-header">
        <h3>Время в кино</h3>
        <p>Сколько часов ты провёл за просмотром</p>
      </div>
      <div className="watchtime-grid">
        <div className="watchtime-item">
          <span className="watchtime-label">Всего часов</span>
          <span className="watchtime-value">{formatNumber(watchTime.totalRuntimeHours)}</span>
        </div>
        <div className="watchtime-item">
          <span className="watchtime-label">Минут всего</span>
          <span className="watchtime-value">{formatNumber(watchTime.totalRuntimeMinutes)}</span>
        </div>
        {daysValue != null && (
          <div className="watchtime-item">
            <span className="watchtime-label">В днях</span>
            <span className="watchtime-value">{daysValue}</span>
          </div>
        )}
        <div className="watchtime-item">
          <span className="watchtime-label">Средняя длительность</span>
          <span className="watchtime-value">{formatNumber(watchTime.avgRuntimeMinutes)}</span>
        </div>
      </div>
    </section>
  )
}

export default WatchTimeCard
