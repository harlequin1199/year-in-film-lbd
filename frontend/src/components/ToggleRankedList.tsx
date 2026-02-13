import { useState } from 'react'
import Stars from './Stars'
import { formatNumber, formatRating, formatLoveScore } from '../utils/format'
import LoveScoreInfo from './LoveScoreInfo'
import type { RankedEntity, RankedEntityWithLoveScore } from '../types/stats.types'

interface ToggleRankedListProps {
  title: string
  subtitle: string
  byCount: RankedEntity[]
  byAvg: RankedEntityWithLoveScore[]
  emptyText: string
  countLabel?: string
  avgLabel?: string
  sectionKey?: string
  translateName?: (name: string) => string
  getLetterboxdUrl?: (name: string) => string
}

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
  getLetterboxdUrl,
}: ToggleRankedListProps) {
  const [mode, setMode] = useState<'count' | 'avg'>('count')
  const [expanded, setExpanded] = useState(false)
  const items = mode === 'count' ? byCount : byAvg
  const fullList = items || []
  const limit = 10
  const list = expanded ? fullList : fullList.slice(0, limit)
  const hasMore = fullList.length > limit
  const fewItems = fullList.length > 0 && fullList.length < 3
  const showIndex = mode === 'avg' && fullList.length > 0 && (fullList[0] as RankedEntityWithLoveScore).loveScore != null
  const displayName = (item: RankedEntity | RankedEntityWithLoveScore) => (translateName ? translateName(item.name) : item.name)

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
          <div className={`table-head ${showIndex ? 'table-head--with-index' : 'table-head--wide'}`}>
            <span>Имя</span>
            <span>Фильмов</span>
            <span>Средняя</span>
            <span>4.5–5★</span>
            {showIndex && (
              <span title="Love Score 0–100" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                Love Score
                <LoveScoreInfo variant="icon-only" />
              </span>
            )}
          </div>
          {list.map((item, index) => {
            const rank = index + 1
            const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
            const itemWithLoveScore = item as RankedEntityWithLoveScore
            return (
              <div className={`table-row ${showIndex ? 'table-row--with-index' : 'table-row--wide'} ${rankClass}`} key={`${item.name}-${index}`}>
                <span className="tag-name">
                  {rank <= 3 && <span className="rank-badge">{rank}</span>}
                  {getLetterboxdUrl ? (
                    <a 
                      href={getLetterboxdUrl(item.name)} 
                      target="_blank" 
                      rel="noreferrer"
                      style={{ color: 'inherit', textDecoration: 'none' }}
                    >
                      {displayName(item)}
                    </a>
                  ) : (
                    displayName(item)
                  )}
                </span>
                <span>{formatNumber(item.count)}</span>
                <span className="rating-cell">
                  {formatRating(item.avg_rating)}
                  <Stars rating={item.avg_rating} />
                </span>
                <span>{formatNumber(item.high_45)}</span>
                {showIndex && (
                  <span>{itemWithLoveScore.loveScore != null ? formatLoveScore(itemWithLoveScore.loveScore) : '—'}</span>
                )}
              </div>
            )
          })}
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
