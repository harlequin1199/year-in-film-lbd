import Stars from './Stars.jsx'
import { formatYear } from '../utils/format.js'

function MilestonesSection({ milestones }) {
  if (!milestones) return null

  const items = [25, 50, 100, 250, 500].map((index) => milestones[`milestone${index}`])

  return (
    <section className="card">
      <div className="card-header">
        <h3>Вехи года</h3>
        <p>Ключевые просмотры по ходу года</p>
      </div>
      <div className="milestone-grid">
        {items.map((item, idx) => (
          <div className="milestone-card" key={`milestone-${idx}`}>
            <div className="milestone-count">{[25, 50, 100, 250, 500][idx]}</div>
            {item ? (
              <>
                <div className="milestone-poster">
                  {item.poster_url ? (
                    <img src={item.poster_url} alt={item.title} />
                  ) : (
                    <div className="poster-fallback">Постера нет</div>
                  )}
                </div>
                <div className="milestone-info">
                  <h4>{item.title}</h4>
                  <span>{formatYear(item.year)}</span>
                  <Stars rating={item.rating} />
                </div>
              </>
            ) : (
              <div className="milestone-empty">Нет данных</div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}

export default MilestonesSection
