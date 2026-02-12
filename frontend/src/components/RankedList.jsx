import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'

function RankedList({ title, subtitle, items, nameLabel }) {
  const top = (items || []).slice(0, 10)

  return (
    <section className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="table">
        <div className="table-head table-head--wide">
          <span>{nameLabel}</span>
          <span>Фильмов</span>
          <span>Средняя</span>
          <span>4.5–5★</span>
        </div>
        {top.map((item, index) => {
          const rank = index + 1
          const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
          return (
            <div className={`table-row table-row--wide ${rankClass}`} key={`${item.name}-${index}`}>
              <span className="tag-name">
                {rank <= 3 && <span className="rank-badge">{rank}</span>}
                {item.name}
              </span>
              <span>{formatNumber(item.count)}</span>
              <span className="rating-cell">
                {formatRating(item.avg_rating)}
                <Stars rating={item.avg_rating} />
              </span>
              <span>{formatNumber(item.high_45)}</span>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default RankedList
