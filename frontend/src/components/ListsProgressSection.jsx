import { useMemo } from 'react'
import { MOVIE_LISTS } from '../data/movieLists.js'

const R = 52
const CIRCUMFERENCE = 2 * Math.PI * R

function ListsProgressSection({ films }) {
  const userTmdbIds = useMemo(
    () => new Set((films || []).map((f) => f.tmdb_id).filter(Boolean)),
    [films]
  )

  const progress = useMemo(
    () =>
      MOVIE_LISTS.map((list) => {
        let watched = 0
        for (const id of list.tmdbIds) {
          if (userTmdbIds.has(id)) watched++
        }
        const percent = list.total > 0 ? Math.round((watched / list.total) * 100) : 0
        return { ...list, watched, percent }
      }),
    [userTmdbIds]
  )

  if (userTmdbIds.size === 0) {
    return (
      <section className="card lists-progress">
        <div className="card-header">
          <h3>Прогресс по киноспискам</h3>
          <p>Нет данных — необходимы TMDb-идентификаторы фильмов.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="card lists-progress">
      <div className="card-header">
        <h3>Прогресс по киноспискам</h3>
        <p>Сколько фильмов из главных списков ты уже посмотрел</p>
      </div>
      <div className="lists-progress-ring-grid">
        {progress.map((item) => {
          const offset = CIRCUMFERENCE * (1 - item.percent / 100)
          return (
            <div className="lists-progress-ring-item" key={item.id}>
              <svg className="lists-progress-ring" viewBox="0 0 120 120">
                <defs>
                  <linearGradient id={`ring-grad-${item.id}`} x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#f7c843" />
                    <stop offset="100%" stopColor="#c07b32" />
                  </linearGradient>
                </defs>
                <circle className="ring-bg" cx="60" cy="60" r={R} />
                <circle
                  className="ring-fill"
                  cx="60"
                  cy="60"
                  r={R}
                  stroke={`url(#ring-grad-${item.id})`}
                  strokeDasharray={CIRCUMFERENCE}
                  strokeDashoffset={offset}
                />
                <text className="ring-percent" x="60" y="56">{item.percent}%</text>
                <text className="ring-count" x="60" y="74">
                  {item.watched}/{item.total}
                </text>
              </svg>
              <span className="ring-label">
                {item.url ? (
                  <a href={item.url} target="_blank" rel="noopener noreferrer">
                    {item.name}
                  </a>
                ) : (
                  item.name
                )}
              </span>
              {item.description && (
                <span className="ring-desc">{item.description}</span>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default ListsProgressSection
