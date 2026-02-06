import Stars from './Stars.jsx'
import { formatNumber, formatRating } from '../utils/format.js'
import { getLanguageRu } from '../utils/languageRu.js'

function LanguagesSection({ totalLanguagesCount, topLanguagesByCount }) {
  const list = topLanguagesByCount || []
  const pills = list.slice(0, 6)

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
      {list.length === 0 && <div className="empty-inline">Нет данных по языкам.</div>}
      {list.length > 0 && (
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
      )}
    </section>
  )
}

export default LanguagesSection
