import { useState } from 'react'
import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'
import LoveScoreInfo from './LoveScoreInfo.jsx'

const LIMIT = 10

function TagsTable({ tags, emptyMessage }) {
  const [expanded, setExpanded] = useState(false)
  const full = tags || []
  const list = expanded ? full : full.slice(0, LIMIT)
  const hasMore = full.length > LIMIT
  const showEmpty = full.length === 0
  const fewItems = full.length > 0 && full.length < 3

  return (
    <section className="card">
      <div className="card-header">
        <h3>Любимые темы</h3>
        <p>Ключевые слова, которые вам особенно понравились</p>
      </div>
      {showEmpty ? (
        <div className="empty-inline">{emptyMessage || 'Нет данных по любимым темам.'}</div>
      ) : fewItems ? (
        <div className="empty-inline section-empty-few">Слишком мало записей для рейтинга.</div>
      ) : (
        <>
          <div className="table">
            <div className="table-head">
              <span>Тема</span>
              <span>Счёт</span>
              <span>Средняя</span>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Love Score
                <LoveScoreInfo variant="icon-only" />
              </span>
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
        </>
      )}
    </section>
  )
}

export default TagsTable
