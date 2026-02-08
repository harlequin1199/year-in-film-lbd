import { useState } from 'react'
import { formatNumber, formatRating } from '../utils/format.js'
import Stars from './Stars.jsx'

function GenreList({ items, showAvg = false, totalForPct, highlightedGenre, onHoverGenre, fewItems }) {
  if (!items || items.length === 0) {
    return <p className="genres-list-empty">Нет данных</p>
  }
  if (fewItems) {
    return <p className="genres-list-empty section-empty-few">Слишком мало записей для рейтинга.</p>
  }
  const showPct = totalForPct != null && totalForPct > 0
  return (
    <ul className="genres-list">
      {items.map((g) => {
        const pct = showPct ? ((g.count / totalForPct) * 100).toFixed(1) : null
        return (
          <li
            key={g.name}
            className={`genres-list-item ${highlightedGenre === g.name ? 'genres-list-item-highlight' : ''}`}
            onMouseEnter={() => onHoverGenre?.(g.name)}
            onMouseLeave={() => onHoverGenre?.(null)}
          >
            <span className="genres-list-name">{g.name}</span>
            <span className="genres-list-meta">
              {formatNumber(g.count)}
              {showPct && ` (${pct}%)`}
              {showAvg && (
                <>
                  {' · '}
                  <span className="genres-list-stars">
                    <Stars rating={g.avg_rating} />
                  </span>
                  <span className="genres-list-avg">({formatRating(g.avg_rating)})</span>
                </>
              )}
            </span>
          </li>
        )
      })}
    </ul>
  )
}

export default function GenresSection({
  topGenres,
  topGenresByAvgMin8,
  genreOfTheYear,
}) {
  const [highlightedGenre, setHighlightedGenre] = useState(null)
  const topGenresList = topGenres || []
  const byCount = topGenresList
  const byAvg = topGenresByAvgMin8 || []
  const totalGenreCount = topGenresList.reduce((acc, g) => acc + g.count, 0)
  const fewCount = byCount.length > 0 && byCount.length < 3
  const fewAvg = byAvg.length > 0 && byAvg.length < 3

  return (
    <section className="card genres-section">
      <div className="card-header">
        <h3>Жанры</h3>
        <p>Доля жанров и любимые жанры года</p>
      </div>

      {genreOfTheYear && (
        <div className="genres-year-block">
          <div className="genres-year-label">Жанр года</div>
          <div className="genres-year-name">{genreOfTheYear.name}</div>
          <div className="genres-year-subtitle">
            Фильмов: {formatNumber(genreOfTheYear.count)} • Средняя:{' '}
            <span className="genres-year-stars">
              <Stars rating={genreOfTheYear.avg_rating} />
            </span>{' '}
            ({formatRating(genreOfTheYear.avg_rating)}) • 4.5–5★: {formatNumber(genreOfTheYear.high_45)}
          </div>
          <div className="genres-year-index">Индекс жанра: {formatNumber(genreOfTheYear.genreIndex)}</div>
        </div>
      )}

      <div className="genres-columns">
        <div className="genres-col">
          <h4 className="genres-col-title">Чаще всего</h4>
          <GenreList
            items={byCount}
            showAvg={false}
            fewItems={fewCount}
            totalForPct={totalGenreCount}
            highlightedGenre={highlightedGenre}
            onHoverGenre={setHighlightedGenre}
          />
        </div>
        <div className="genres-col genres-col-divider" aria-hidden="true" />
        <div className="genres-col">
          <div className="genres-col-header-row">
            <h4 className="genres-col-title">Самые любимые</h4>
            <span className="genres-col-hint-inline">мин. 8 фильмов</span>
          </div>
          <GenreList
            items={byAvg}
            showAvg={true}
            fewItems={fewAvg}
            highlightedGenre={highlightedGenre}
            onHoverGenre={setHighlightedGenre}
          />
        </div>
      </div>
    </section>
  )
}
