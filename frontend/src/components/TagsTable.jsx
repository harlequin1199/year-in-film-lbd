import { useState } from 'react'
import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'

const LIMIT = 10

function TagsTable({ tags, emptyMessage }) {
  const [expanded, setExpanded] = useState(false)
  const full = tags || []
  const list = expanded ? full : full.slice(0, LIMIT)
  const hasMore = full.length > LIMIT
  const showEmpty = full.length === 0 && emptyMessage

  return (
    <section className="card">
      <div className="card-header">
        <h3>Любимые темы</h3>
        <p>Ключевые слова, которые вам особенно понравились</p>
      </div>
      {showEmpty ? (
        <p className="text-muted">{emptyMessage}</p>
      ) : (
        <>
          <div className="table">
            <div className="table-head">
              <span>Тема</span>
              <span>Счёт</span>
              <span>Средняя</span>
              <span>Индекс любви*</span>
            </div>
            {list.map((tag) => (
              <div className="table-row" key={tag.name}>
                <span className="tag-name">{tag.name}</span>
                <span>{formatNumber(tag.count)}</span>
                <span className="rating-cell">
                  {formatRating(tag.avg_rating)}
                  <Stars rating={tag.avg_rating} />
                </span>
                <span>{formatNumber(tag.loveScore)}</span>
              </div>
            ))}
          </div>
          {hasMore && (
            <button type="button" className="show-more-btn" onClick={() => setExpanded((e) => !e)}>
              {expanded ? 'Свернуть' : 'Показать ещё'}
            </button>
          )}
          <p className="table-footnote">
            Индекс любви* = (количество фильмов на 4.5–5★) × (средняя оценка темы)
          </p>
        </>
      )}
    </section>
  )
}

export default TagsTable
