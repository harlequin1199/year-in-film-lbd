import { useState } from 'react'
import { formatNumber, formatRating } from '../utils/format.js'
import { getGenreNameRu } from '../utils/genresRu.js'
import { getGenreIcon } from '../utils/genreIcons.js'
import Stars from './Stars.jsx'
import LoveScoreInfo from './LoveScoreInfo.jsx'

export default function GenresSection({
  topGenres,
  topGenresByAvgMin8,
  genreOfTheYear,
}) {
  const [highlightedGenre, setHighlightedGenre] = useState(null)
  const [mode, setMode] = useState('count')
  
  const topGenresList = topGenres || []
  const byCount = topGenresList
  const byAvg = topGenresByAvgMin8 || []
  const totalGenreCount = topGenresList.reduce((acc, g) => acc + g.count, 0)
  
  const items = mode === 'count' ? byCount : byAvg
  const fullList = items || []
  const fewItems = fullList.length > 0 && fullList.length < 3
  const showIndex = mode === 'avg' && fullList.length > 0 && fullList[0].loveScore != null
  const showPct = mode === 'count' && totalGenreCount > 0

  const genreIcon = genreOfTheYear ? getGenreIcon(genreOfTheYear.name) : null

  return (
    <section className="card genres-section">
      <div className="card-header">
        <h3>Жанры</h3>
        <p>Доля жанров и любимые жанры года</p>
      </div>

      {genreOfTheYear && genreIcon && (
        <div className="genres-year-block" style={{ '--genre-color': genreIcon.color, '--genre-bg-color': genreIcon.bgColor }}>
          <div className="genres-year-content">
            <div className="genres-year-left">
              <div className="genres-year-label">Жанр года</div>
              <div className="genres-year-name">{getGenreNameRu(genreOfTheYear.name)}</div>
              <div className="genres-year-subtitle">
                Фильмов: {formatNumber(genreOfTheYear.count)} • Средняя:{' '}
                <span className="genres-year-stars">
                  <Stars rating={genreOfTheYear.avg_rating} />
                </span>{' '}
                ({formatRating(genreOfTheYear.avg_rating)}) • 4.5–5★: {formatNumber(genreOfTheYear.high_45)}
              </div>
              <div className="genres-year-index">
                Love Score: {formatNumber(Math.round(genreOfTheYear.loveScore))}
                <LoveScoreInfo variant="icon-only" />
              </div>
            </div>
            <div className="genres-year-right">
              <div className="genres-year-icon">
                <img 
                  src={genreIcon.iconUrl} 
                  alt={getGenreNameRu(genreOfTheYear.name)}
                  className="genres-year-icon-img"
                  onError={(e) => {
                    // Fallback на эмодзи если изображение не загрузилось
                    e.target.style.display = 'none'
                    const fallback = e.target.nextElementSibling
                    if (fallback) fallback.style.display = 'inline-block'
                  }}
                />
                <span className="genres-year-icon-fallback" style={{ display: 'none' }}>
                  {genreIcon.fallback}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="toggle-group">
        <button
          type="button"
          className={`toggle-button ${mode === 'count' ? 'active' : ''}`}
          onClick={() => setMode('count')}
        >
          Чаще всего
        </button>
        <button
          type="button"
          className={`toggle-button ${mode === 'avg' ? 'active' : ''}`}
          onClick={() => setMode('avg')}
        >
          Самые любимые
        </button>
      </div>

      {fullList.length === 0 && <div className="empty-inline">Нет данных</div>}
      {fewItems && <div className="empty-inline section-empty-few">Слишком мало записей для рейтинга.</div>}
      
      {fullList.length > 0 && !fewItems && (
        <div className="table">
          <div className={`table-head ${showIndex ? 'table-head--with-index' : 'table-head--wide'}`}>
            <span>Жанр</span>
            <span>Счёт</span>
            <span>Средняя</span>
            {showIndex && (
              <span title="Love Score 0–100" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Love Score
                <LoveScoreInfo variant="icon-only" />
              </span>
            )}
            <span>4.5–5★</span>
          </div>
          {fullList.map((g, index) => {
            const rank = index + 1
            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
            const pct = showPct ? ((g.count / totalGenreCount) * 100).toFixed(1) : null
            const isHighlighted = highlightedGenre === g.name
            
            return (
              <div
                key={g.name}
                className={`table-row ${showIndex ? 'table-row--with-index' : 'table-row--wide'} ${rankClass} ${isHighlighted ? 'genres-list-item-highlight' : ''}`}
                onMouseEnter={() => setHighlightedGenre(g.name)}
                onMouseLeave={() => setHighlightedGenre(null)}
              >
                <span className="tag-name">
                  {rank <= 3 && <span className="rank-badge">{rank}</span>}
                  {getGenreNameRu(g.name)}
                </span>
                <span>
                  {formatNumber(g.count)}
                  {showPct && pct && ` (${pct}%)`}
                </span>
                <span className="rating-cell">
                  {formatRating(g.avg_rating)}
                  <Stars rating={g.avg_rating} />
                </span>
                {showIndex && (
                  <span>{g.loveScore != null ? formatNumber(Math.round(g.loveScore)) : '—'}</span>
                )}
                <span>{formatNumber(g.high_45)}</span>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
