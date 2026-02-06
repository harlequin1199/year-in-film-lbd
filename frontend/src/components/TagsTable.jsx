import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'

function TagsTable({ tags }) {
  const top = (tags || []).slice(0, 10)

  return (
    <section className="card">
      <div className="card-header">
        <h3>Любимые темы</h3>
        <p>Ключевые слова, которые вам особенно понравились</p>
      </div>
      <div className="table">
        <div className="table-head">
          <span>Тема</span>
          <span>Счёт</span>
          <span>Средняя</span>
          <span>Индекс любви*</span>
        </div>
        {top.map((tag) => (
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
      <p className="table-footnote">
        Индекс любви* = (количество фильмов на 4.5–5★) × (средняя оценка темы)
      </p>
    </section>
  )
}

export default TagsTable
