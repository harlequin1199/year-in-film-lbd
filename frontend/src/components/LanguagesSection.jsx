import { useState } from 'react'
import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'
import { getLanguageRu } from '../utils/languageRu.js'

const LIMIT = 10

function LanguagesSection({ totalLanguagesCount, topLanguagesByCount }) {
  const [expanded, setExpanded] = useState(false)
  const full = topLanguagesByCount || []
  const list = expanded ? full : full.slice(0, LIMIT)
  const hasMore = full.length > LIMIT
  const pills = full.slice(0, 6)
  const fewItems = full.length > 0 && full.length < 3

  return (
    <section className="card">
      <div className="card-header">
        <h3>Языки</h3>
        <p>Сколько языков встретилось в твоём году</p>
      </div>
      <div className="languages-summary">
        <div>
          <span className="watchtime-label">Всего языков</span>
          <span className="watchtime-value">{formatNumber(totalLanguagesCount)}</span>
        </div>
        <div className="pill-row">
          {pills.map((lang) => (
            <span className="pill" key={lang.language}>
              {getLanguageRu(lang.language)}
            </span>
          ))}
        </div>
      </div>
      {full.length === 0 && <div className="empty-inline">Нет данных по языкам.</div>}
      {fewItems && <div className="empty-inline section-empty-few">Слишком мало записей для рейтинга.</div>}
      {full.length > 0 && !fewItems && (
        <>
          <div className="table">
            <div className="table-head">
              <span>Язык</span>
              <span>Счёт</span>
              <span>Средняя</span>
              <span>4.5–5★</span>
            </div>
            {list.map((lang) => (
              <div className="table-row" key={lang.language}>
                <span className="tag-name">{getLanguageRu(lang.language)}</span>
                <span>{formatNumber(lang.count)}</span>
                <span className="rating-cell">
                  {formatRating(lang.avg_rating)}
                  <Stars rating={lang.avg_rating} />
                </span>
                <span>{formatNumber(lang.high_45)}</span>
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

export default LanguagesSection
