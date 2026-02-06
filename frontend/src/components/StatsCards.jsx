import Stars from './Stars.jsx'
import { formatNumber, formatRating, formatYear } from '../utils/format.js'

function StatsCards({ stats }) {
  if (!stats) return null

  return (
    <section className="stats-row">
      <div className="stat-card">
        <p className="stat-label">Просмотрено фильмов</p>
        <p className="stat-value">{formatNumber(stats.totalFilms)}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Средняя оценка</p>
        <div className="stat-rating">
          <p className="stat-value">{formatRating(stats.avgRating)}</p>
          <Stars rating={stats.avgRating} />
        </div>
      </div>
      <div className="stat-card">
        <p className="stat-label">Фильмов на 4.5–5★</p>
        <p className="stat-value">{formatNumber(stats.count45)}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Самый ранний год</p>
        <p className="stat-value">{formatYear(stats.oldestYear)}</p>
      </div>
      <div className="stat-card">
        <p className="stat-label">Самый новый год</p>
        <p className="stat-value">{formatYear(stats.newestYear)}</p>
      </div>
    </section>
  )
}

export default StatsCards
