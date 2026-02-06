import Stars from './Stars.jsx'
import { formatYear } from '../utils/format.js'

function FilmsGrid({ films }) {
  if (!films || films.length === 0) return null

  const renderPoster = (film) => {
    const image = film.poster_url ? (
      <img src={film.poster_url} alt={film.title} loading="lazy" />
    ) : (
      <div className="poster-fallback">Постера нет</div>
    )
    if (!film.letterboxd_url) {
      return image
    }
    return (
      <a href={film.letterboxd_url} target="_blank" rel="noreferrer">
        {image}
      </a>
    )
  }

  return (
    <section className="card">
      <div className="card-header">
        <h3>Лучшее по оценкам</h3>
        <p>Двенадцать самых высоко оценённых фильмов</p>
      </div>
      <div className="films-grid">
        {films.map((film) => (
          <article className="film" key={`${film.title}-${film.year}`}>
            <div className="poster">
              {renderPoster(film)}
            </div>
            <div className="film-info">
              <h4>{film.title}</h4>
              <div className="film-meta">
                <span>{formatYear(film.year)}</span>
                <Stars rating={film.rating} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}

export default FilmsGrid
