import Stars from './Stars.jsx'
import { formatRating, formatYear } from '../utils/format.js'

function FavoriteDecades({ films, decades }) {
  if (!films) return null

  const decadesList = (decades || [])
    .slice(0, 3)

  const getPostersForDecade = (decadeNum) => {
    return films
      .filter((film) => film.year != null && Math.floor(film.year / 10) * 10 === decadeNum)
      .map((film) => film.poster_url || null)
      .slice(0, 12)
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3>Любимые десятилетия</h3>
        <p>Самые сильные эпохи в вашей истории просмотров</p>
      </div>
      {decadesList.length === 0 && (
        <div className="decade-empty">
          Недостаточно данных для расчёта десятилетий.
        </div>
      )}
      <div className="decade-list">
        {decadesList.map((decade) => {
          const posters = getPostersForDecade(decade.decade)
          return (
            <div className="decade-row" key={decade.decade}>
              <div className="decade-info">
                <span className="decade-title">{formatYear(decade.decade)}-е</span>
                <div className="decade-rating">
                  <span>★ Средняя {formatRating(decade.avgRating)}</span>
                  <Stars rating={decade.avgRating} />
                </div>
              </div>
              <div className="decade-posters">
                {posters.map((poster, index) => (
                  <div className="decade-poster" key={`${decade.decade}-${index}`}>
                    {poster ? (
                      <img src={poster} alt="" loading="lazy" />
                    ) : (
                      <div className="decade-poster-fallback" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default FavoriteDecades
