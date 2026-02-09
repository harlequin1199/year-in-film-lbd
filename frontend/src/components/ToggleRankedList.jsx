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
  sectionKey,
  translateName,
}) {
  const [mode, setMode] = useState('count')
  const [expanded, setExpanded] = useState(false)
  const items = mode === 'count' ? byCount : byAvg
  const fullList = items || []
  const limit = 10
  const list = expanded ? fullList : fullList.slice(0, limit)
  const hasMore = fullList.length > limit
  const fewItems = fullList.length > 0 && fullList.length < 3
  const displayName = (item) => (translateName ? translateName(item.name) : item.name)

  return (
    <section className="card" data-section={sectionKey || undefined}>
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
      {fewItems && <div className="empty-inline section-empty-few">Слишком мало записей для рейтинга.</div>}
      {list.length > 0 && !fewItems && (
        <div className="table">
          <div className="table-head table-head--wide">
            <span>Имя</span>
            <span>Счёт</span>
            <span>Средняя</span>
            <span>4.5–5★</span>
          </div>
          {list.map((item, index) => (
            <div className="table-row table-row--wide" key={`${item.name}-${index}`}>
              <span className="tag-name">{displayName(item)}</span>
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
      {hasMore && (
        <button
          type="button"
          className="show-more-btn"
          onClick={() => setExpanded((e) => !e)}
        >
          {expanded ? 'Свернуть' : 'Показать ещё'}
        </button>
      )}
    </section>
  )
}

export default ToggleRankedList
