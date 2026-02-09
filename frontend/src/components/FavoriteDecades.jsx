import Stars from './Stars.jsx'
import { formatRating, formatYear } from '../utils/format.js'

function FavoriteDecades({ films }) {
  if (!films) return null

  const decadeMap = new Map()
  films.forEach((film) => {
    if (!film.year) return
    const decade = Math.floor(film.year / 10) * 10
    if (!decadeMap.has(decade)) {
      decadeMap.set(decade, { films: [], sum: 0, rated: 0 })
    }
    const entry = decadeMap.get(decade)
    entry.films.push(film)
    if (film.rating !== null && film.rating !== undefined) {
      entry.sum += film.rating
      entry.rated += 1
    }
  })

  const decades = Array.from(decadeMap.entries())
    .map(([decade, data]) => {
      const avgRating = data.rated ? data.sum / data.rated : 0
      return {
        decade,
        avgRating,
        count: data.films.length,
        posters: data.films
          .map((film) => ({
            poster_url: film.poster_url,
            letterboxd_url: film.letterboxd_url,
          }))
          .map((film) => film.poster_url || null),
      }
    })
    .filter((entry) => entry.count > 12)
    .sort((a, b) => {
      if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating
      return b.count - a.count
    })
    .slice(0, 3)

  if (decades.length === 0) {
    console.warn('Недостаточно данных для расчёта десятилетий.')
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3>Любимые десятилетия</h3>
        <p>Самые сильные эпохи в вашей истории просмотров</p>
      </div>
      {decades.length === 0 && (
        <div className="decade-empty">
          Недостаточно данных для расчёта десятилетий.
        </div>
      )}
      <div className="decade-list">
        {decades.map((decade) => (
          <div className="decade-row" key={decade.decade}>
            <div className="decade-info">
              <span className="decade-title">{formatYear(decade.decade)}-е</span>
              <div className="decade-rating">
                <span>★ Средняя {formatRating(decade.avgRating)}</span>
                <Stars rating={decade.avgRating} />
              </div>
            </div>
            <div className="decade-posters">
              {decade.posters.slice(0, 12).map((poster, index) => (
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
        ))}
      </div>
    </section>
  )
}

export default FavoriteDecades
