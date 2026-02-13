import { useState, useRef, useEffect } from 'react'
import Stars from './Stars'
import { formatYear } from '../utils/format'
import type { HiddenGem, OverratedFilm } from '../types/stats.types'

const TAB_GEMS = 'gems'
const TAB_OVERRATED = 'overrated'

const GAP_PX = 16

function getColumnsFromWidth(width: number): number {
  if (width < 520) return 2
  if (width < 900) return 3
  return 6
}

interface HiddenGemsSectionProps {
  hiddenGems?: HiddenGem[]
  overrated?: OverratedFilm[]
  simplifiedEmpty?: boolean
}

export default function HiddenGemsSection({ hiddenGems = [], overrated = [], simplifiedEmpty = false }: HiddenGemsSectionProps) {
  const [activeTab, setActiveTab] = useState<'gems' | 'overrated'>(TAB_GEMS)
  const scrollRef = useRef<HTMLDivElement>(null)
  const gridRef = useRef<HTMLDivElement>(null)
  const gems = hiddenGems || []
  const overratedList = overrated || []

  const renderPoster = (film: HiddenGem | OverratedFilm, isOverrated: boolean) => {
    const diffLabel = isOverrated ? `-${film.diff}★` : `+${film.diff}★`
    const badgeClass = isOverrated
      ? 'hidden-gems-badge hidden-gems-badge-overrated'
      : 'hidden-gems-badge hidden-gems-badge-gems'
    const image = film.poster_url ? (
      <img src={film.poster_url} alt="" loading="lazy" />
    ) : (
      <div className="hidden-gems-poster-fallback">Нет постера</div>
    )
    return (
      <div className="hidden-gems-poster-wrap">
        {film.letterboxd_url ? (
          <a href={film.letterboxd_url} target="_blank" rel="noreferrer" className="hidden-gems-poster-link">
            {image}
          </a>
        ) : (
          image
        )}
        <span className={badgeClass}>{diffLabel}</span>
      </div>
    )
  }

  const showGems = activeTab === TAB_GEMS
  const list = showGems ? gems : overratedList
  const isEmpty = list.length === 0

  useEffect(() => {
    if (isEmpty || !scrollRef.current || !gridRef.current) return
    const scrollEl = scrollRef.current
    const gridEl = gridRef.current
    const updateScroll = () => {
      const width = scrollEl.offsetWidth
      const columns = getColumnsFromWidth(width)
      const rows = Math.ceil(list.length / columns)
      if (rows <= 2) {
        scrollEl.style.maxHeight = ''
        scrollEl.style.overflowY = ''
        return
      }
      const first = gridEl.querySelector('.hidden-gems-tile') as HTMLElement | null
      if (!first) return
      const tileHeight = first.offsetHeight
      const rowHeight = tileHeight + GAP_PX
      scrollEl.style.maxHeight = `${2 * rowHeight + GAP_PX}px`
      scrollEl.style.overflowY = 'auto'
    }
    updateScroll()
    const ro = new ResizeObserver(updateScroll)
    ro.observe(scrollEl)
    return () => ro.disconnect()
  }, [list.length, isEmpty])
  const simplifiedMessage = 'Недоступно в упрощённом режиме на телефоне.'
  const emptyTitleGems = simplifiedEmpty ? 'Упрощённый режим' : 'Тёмных лошадок не найдено'
  const emptyTitleOverrated = simplifiedEmpty ? 'Упрощённый режим' : 'Переоценённых фильмов не найдено'
  const emptyTitle = showGems ? emptyTitleGems : emptyTitleOverrated
  const emptyText = simplifiedEmpty
    ? simplifiedMessage
    : showGems
      ? 'В этом периоде нет фильмов, которые ты оценил намного выше среднего рейтинга TMDb.'
      : 'В этом периоде нет фильмов, которые TMDb оценил намного выше твоей оценки.'

  return (
    <section className="card hidden-gems-section">
      <div className="hidden-gems-section-header">
        <div className="hidden-gems-header-left">
          <h3>Особое мнение</h3>
          <p>
            {showGems
              ? 'Фильмы, которые ты оценил значительно выше, чем TMDb'
              : 'Фильмы, которые TMDb оценил значительно выше тебя'}
          </p>
        </div>
        <div className="hidden-gems-tabs">
          <button
            type="button"
            className={`hidden-gems-tab ${activeTab === TAB_GEMS ? 'hidden-gems-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_GEMS)}
          >
            Тёмные лошадки
          </button>
          <button
            type="button"
            className={`hidden-gems-tab ${activeTab === TAB_OVERRATED ? 'hidden-gems-tab--active' : ''}`}
            onClick={() => setActiveTab(TAB_OVERRATED)}
          >
            Переоценённые
          </button>
        </div>
      </div>
      {isEmpty ? (
        <div className="hidden-gems-empty">
          <div className="hidden-gems-empty-title">{emptyTitle}</div>
          <p className="hidden-gems-empty-text">{emptyText}</p>
        </div>
      ) : (
        <div className="hidden-gems-grid-scroll" ref={scrollRef}>
          <div className="hidden-gems-grid" ref={gridRef}>
            {list.map((film) => (
            <article key={`${film.title}-${film.year}`} className="hidden-gems-tile">
              {renderPoster(film, activeTab === TAB_OVERRATED)}
              <div className="hidden-gems-info">
                <h4 className="hidden-gems-title" title={film.title}>
                  {film.title}
                </h4>
                <div className="hidden-gems-year">{formatYear(film.year)}</div>
                <div className="hidden-gems-ratings">
                  <span className="hidden-gems-you">
                    Ты: <Stars rating={film.rating} />
                  </span>
                  <span className="hidden-gems-tmdb">
                    TMDb: <Stars rating={film.tmdb_stars} />
                  </span>
                </div>
              </div>
            </article>
          ))}
          </div>
        </div>
      )}
    </section>
  )
}
