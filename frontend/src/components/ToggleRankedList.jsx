import { useState } from 'react'
import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'

function ToggleRankedList({
  title,
  subtitle,
  byCount,
  byAvg,
  emptyText,
  countLabel = 'Чаще всего',
  avgLabel = 'Самые любимые',
}) {
  const [mode, setMode] = useState('count')
  const items = mode === 'count' ? byCount : byAvg
  const list = (items || []).slice(0, 10)

  return (
    <section className="card">
      <div className="card-header">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div className="toggle-group">
        <button
          type="button"
          className={`toggle-button ${mode === 'count' ? 'active' : ''}`}
          onClick={() => setMode('count')}
        >
          {countLabel}
        </button>
        <button
          type="button"
          className={`toggle-button ${mode === 'avg' ? 'active' : ''}`}
          onClick={() => setMode('avg')}
        >
          {avgLabel}
        </button>
      </div>
      {list.length === 0 && <div className="empty-inline">{emptyText}</div>}
      {list.length > 0 && (
        <div className="table">
          <div className="table-head table-head--wide">
            <span>Имя</span>
            <span>Счёт</span>
            <span>Средняя</span>
            <span>4.5–5★</span>
          </div>
          {list.map((item, index) => (
            <div className="table-row table-row--wide" key={`${item.name}-${index}`}>
              <span className="tag-name">{item.name}</span>
              <span>{formatNumber(item.count)}</span>
              <span className="rating-cell">
                {formatRating(item.avg_rating)}
                <Stars rating={item.avg_rating} />
              </span>
              <span>{formatNumber(item.high_45)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

export default ToggleRankedList
