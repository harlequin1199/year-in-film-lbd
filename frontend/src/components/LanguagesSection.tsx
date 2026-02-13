import { useState } from 'react'
import Stars from './Stars'
import { formatNumber, formatRating } from '../utils/format'
import { getLanguageRu } from '../utils/languageRu'
import { getLetterboxdLanguageUrl } from '../utils/letterboxdUrl'
import type { LanguageStats } from '../types/stats.types'

const LIMIT = 10

interface LanguagesSectionProps {
  totalLanguagesCount: number
  topLanguagesByCount: LanguageStats[]
}

function LanguagesSection({ totalLanguagesCount, topLanguagesByCount }: LanguagesSectionProps) {
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
              <a 
                href={getLetterboxdLanguageUrl(lang.language)} 
                target="_blank" 
                rel="noreferrer"
                style={{ color: 'inherit', textDecoration: 'none' }}
              >
                {getLanguageRu(lang.language)}
              </a>
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
              <span>Фильмов</span>
              <span>Средняя</span>
              <span>4.5–5★</span>
            </div>
            {list.map((lang) => (
              <div className="table-row" key={lang.language}>
                <span className="tag-name">
                  <a 
                    href={getLetterboxdLanguageUrl(lang.language)} 
                    target="_blank" 
                    rel="noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {getLanguageRu(lang.language)}
                  </a>
                </span>
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
