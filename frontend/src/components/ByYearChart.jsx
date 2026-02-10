import { useMemo, useState } from 'react'
import { formatNumber, formatRating, formatYear } from '../utils/format.js'

const BAR_HEIGHT = 220

const getBarWidth = (yearCount) => {
  if (yearCount <= 40) return 10
  if (yearCount <= 80) return 6
  if (yearCount <= 120) return 4
  return 2
}

function ByYearChart({ films, yearsByLoveScore }) {
  const [mode, setMode] = useState('count')
  const [tooltip, setTooltip] = useState(null)

  const loveScoreByYear = useMemo(() => {
    const map = new Map()
    ;(yearsByLoveScore || []).forEach((item) => {
      map.set(Number(item.name), { loveScore: item.loveScore, count: item.count, avg_rating: item.avg_rating })
    })
    return map
  }, [yearsByLoveScore])

  const data = useMemo(() => {
    if (!films || films.length === 0) return null
    const years = films.map((film) => film.year).filter(Boolean)
    if (years.length === 0) return null

    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const yearMap = new Map()

    for (let year = minYear; year <= maxYear; year += 1) {
      yearMap.set(year, { count: 0, sum: 0, rated: 0 })
    }

    films.forEach((film) => {
      if (!film.year) return
      const entry = yearMap.get(film.year)
      if (!entry) return
      entry.count += 1
      if (film.rating !== null && film.rating !== undefined) {
        entry.sum += film.rating
        entry.rated += 1
      }
    })

    const yearEntries = Array.from(yearMap.entries()).map(([year, stats]) => {
      const avgRating = stats.rated ? stats.sum / stats.rated : null
      const loveData = loveScoreByYear.get(year)
      return {
        year,
        count: stats.count,
        avgRating,
        loveScore: loveData?.loveScore ?? null,
      }
    })

    return { minYear, maxYear, yearEntries }
  }, [films, loveScoreByYear])

  if (!data) return null

  const { minYear, maxYear, yearEntries } = data
  const maxCount = Math.max(...yearEntries.map((entry) => entry.count), 1)
  const yearCount = maxYear - minYear + 1
  const barWidth = getBarWidth(yearCount)
  const gap = yearCount > 120 ? 0 : 1
  const chartWidth = yearCount * (barWidth + gap)

  const handleMove = (event, entry) => {
    const tooltipWidth = 220
    const tooltipHeight = 78
    const left = Math.max(8, Math.min(event.clientX + 12, window.innerWidth - tooltipWidth - 8))
    const top = Math.max(8, Math.min(event.clientY + 12, window.innerHeight - tooltipHeight - 8))
    setTooltip({
      entry,
      x: left,
      y: top,
    })
  }

  const getHeight = (entry) => {
    if (mode === 'count') {
      if (entry.count === 0) return 0
      const scaled = Math.sqrt(entry.count / maxCount) * BAR_HEIGHT
      return Math.max(2, scaled)
    }
    if (mode === 'loveScore') {
      if (entry.loveScore == null) return 0
      return Math.max(2, (entry.loveScore / 100) * BAR_HEIGHT)
    }
    if (entry.count === 0 || entry.avgRating === null) return 0
    const scaled = Math.pow(entry.avgRating / 5, 1.2) * BAR_HEIGHT
    return Math.max(2, scaled)
  }

  const tooltipContent = tooltip?.entry
    ? {
        title: formatYear(tooltip.entry.year),
        count: formatNumber(tooltip.entry.count),
        avg:
          tooltip.entry.avgRating !== null ? formatRating(tooltip.entry.avgRating) : '—',
        loveScore: tooltip.entry.loveScore != null ? formatNumber(Math.round(tooltip.entry.loveScore)) : null,
      }
    : null

  return (
    <section className="card">
      <div className="card-header byyear-header">
        <div>
          <h3>По годам</h3>
          <p>Распределение фильмов по годам</p>
        </div>
        <div className="byyear-tabs">
          <button
            type="button"
            className={`byyear-tab ${mode === 'count' ? 'active' : ''}`}
            onClick={() => setMode('count')}
          >
            ФИЛЬМЫ
          </button>
          <button
            type="button"
            className={`byyear-tab ${mode === 'rating' ? 'active' : ''}`}
            onClick={() => setMode('rating')}
          >
            ОЦЕНКИ
          </button>
          <button
            type="button"
            className={`byyear-tab ${mode === 'loveScore' ? 'active' : ''}`}
            onClick={() => setMode('loveScore')}
          >
            LOVE SCORE
          </button>
        </div>
      </div>
      <div className="byyear-chart">
        <svg
          className="byyear-svg"
          width="100%"
          height={BAR_HEIGHT}
          viewBox={`0 0 ${chartWidth} ${BAR_HEIGHT}`}
          preserveAspectRatio="none"
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="byyear-count" x1="0" y1="0" x2={chartWidth} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#27ae60" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#22d3ee" />
            </linearGradient>
            <linearGradient id="byyear-rating" x1="0" y1="0" x2={chartWidth} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#1f8f52" />
              <stop offset="50%" stopColor="#0f8d7f" />
              <stop offset="100%" stopColor="#14a8c6" />
            </linearGradient>
            <linearGradient id="byyear-lovescore" x1="0" y1="0" x2={chartWidth} y2="0" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#e84393" />
              <stop offset="50%" stopColor="#a855f7" />
              <stop offset="100%" stopColor="#6366f1" />
            </linearGradient>
          </defs>
          <line x1="0" y1={BAR_HEIGHT} x2={chartWidth} y2={BAR_HEIGHT} stroke="#1f2430" strokeWidth="1" />
          {yearEntries.map((entry, index) => {
            const height = getHeight(entry)
            const x = index * (barWidth + gap)
            const y = BAR_HEIGHT - height
            return (
              <rect
                key={entry.year}
                x={x}
                y={y}
                width={barWidth}
                height={height}
                rx="1.5"
                fill={
                  mode === 'count'
                    ? 'url(#byyear-count)'
                    : mode === 'loveScore'
                      ? 'url(#byyear-lovescore)'
                      : 'url(#byyear-rating)'
                }
                onMouseMove={(event) => handleMove(event, entry)}
                onMouseLeave={() => setTooltip(null)}
              />
            )
          })}
        </svg>
        <div className="byyear-axis">
          <span>{formatYear(minYear)}</span>
          <span>{formatYear(maxYear)}</span>
        </div>
        {tooltipContent && (
          <div className="byyear-tooltip" style={{ left: tooltip.x, top: tooltip.y }}>
            <div className="byyear-tooltip-title">{tooltipContent.title}</div>
            <div>Фильмов: {tooltipContent.count}</div>
            <div>Средняя: {tooltipContent.avg}</div>
            {tooltipContent.loveScore != null && (
              <div>Love Score: {tooltipContent.loveScore}</div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default ByYearChart
