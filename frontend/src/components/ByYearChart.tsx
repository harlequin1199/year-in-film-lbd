import { useMemo, useState, useRef, useEffect, MouseEvent } from 'react'
import { formatNumber, formatRating, formatYear, formatLoveScore } from '../utils/format'
import LoveScoreInfo from './LoveScoreInfo'
import type { Film } from '../types/film.types'
import type { YearStats } from '../types/stats.types'

const BAR_HEIGHT = 220

const getBarWidth = (yearCount: number): number => {
  if (yearCount <= 40) return 10
  if (yearCount <= 80) return 6
  if (yearCount <= 120) return 4
  return 2
}

interface ByYearChartProps {
  films: Film[]
  yearsByLoveScore: YearStats[]
}

interface TooltipState {
  entry: {
    year: number
    count: number
    avgRating: number | null
    loveScore: number | null
  }
  x: number
  y: number
}

interface YearEntry {
  year: number
  count: number
  avgRating: number | null
  loveScore: number | null
}

interface DecadeBoundary {
  decade: number
  x: number
}

function ByYearChart({ films, yearsByLoveScore }: ByYearChartProps) {
  const [mode, setMode] = useState<'count' | 'rating' | 'loveScore'>('count')
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)
  const [containerWidth, setContainerWidth] = useState<number | null>(null)
  const chartContainerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const updateWidth = () => {
      if (chartContainerRef.current) {
        const nextWidth = chartContainerRef.current.offsetWidth
        setContainerWidth((prev) => (prev === nextWidth ? prev : nextWidth))
      }
    }

    updateWidth()
    const resizeObserver = new ResizeObserver(updateWidth)
    if (chartContainerRef.current) resizeObserver.observe(chartContainerRef.current)
    window.addEventListener('resize', updateWidth)
    return () => {
      resizeObserver.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  const loveScoreByYear = useMemo(() => {
    const map = new Map<number, { loveScore: number; count: number; avg_rating: number }>()
    ;(yearsByLoveScore || []).forEach((item) => {
      map.set(Number(item.name), { loveScore: item.loveScore, count: item.count, avg_rating: item.avg_rating })
    })
    return map
  }, [yearsByLoveScore])

  const data = useMemo(() => {
    if (!films || films.length === 0) return null
    const years = films.map((film) => film.year).filter((year): year is number => year !== null && year !== undefined)
    if (years.length === 0) return null

    const minYear = Math.min(...years)
    const maxYear = Math.max(...years)
    const yearMap = new Map<number, { count: number; sum: number; rated: number }>()

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

    const yearEntries: YearEntry[] = Array.from(yearMap.entries()).map(([year, stats]) => {
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

  // Calculate decade boundaries
  const minDecade = Math.floor(minYear / 10) * 10
  const maxDecade = Math.floor(maxYear / 10) * 10
  const decadeBoundaries: DecadeBoundary[] = []
  for (let decade = minDecade; decade <= maxDecade; decade += 10) {
    // Use the first year of the decade that falls within our range, or the decade start if it's before minYear
    const yearForDecade = Math.max(decade, minYear)
    if (yearForDecade <= maxYear) {
      const yearIndex = yearForDecade - minYear
      // Allow yearIndex to be equal to yearCount for the last decade boundary
      if (yearIndex >= 0 && yearIndex <= yearCount) {
        // Clamp x to chartWidth to ensure it's within bounds
        const x = Math.min(yearIndex * (barWidth + gap), chartWidth)
        decadeBoundaries.push({ decade, x })
      }
    }
  }

  const handleMove = (event: MouseEvent<SVGRectElement>, entry: YearEntry) => {
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

  const getHeight = (entry: YearEntry): number => {
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
        loveScore: tooltip.entry.loveScore != null ? formatLoveScore(tooltip.entry.loveScore) : null,
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
          <LoveScoreInfo variant="icon-only" className="byyear-love-score-info" />
        </div>
      </div>
      <div className="byyear-chart" ref={chartContainerRef}>
        {/* Decade labels at the top - positioned between divider lines */}
        {decadeBoundaries.length > 1 && (() => {
          // Get actual container width for better distance calculation
          const actualWidth = containerWidth || chartWidth
          
          // Calculate minimum distance in pixels (approximately 45px for a 4-digit label with spacing)
          const minDistancePx = 45
          const edgeMarginPx = 25
          const edgeMarginPercent = actualWidth > 0 ? (edgeMarginPx / actualWidth) * 100 : 3
          
          const visibleLabels: Array<{ decade: number; percent: number }> = []
          
          decadeBoundaries.forEach((boundary, index) => {
            // For each decade boundary, show label between it and the next one
            // For the last boundary, show label between it and the end of chart
            const nextBoundary = index < decadeBoundaries.length - 1 
              ? decadeBoundaries[index + 1] 
              : { x: chartWidth }
            
            // Calculate center position between two decade boundaries
            const centerX = (boundary.x + (nextBoundary?.x ?? chartWidth)) / 2
            const percent = (centerX / chartWidth) * 100
            
            // Check if label is too close to edges
            if (percent < edgeMarginPercent || percent > 100 - edgeMarginPercent) {
              return
            }
            
            // Check distance from previous label (in pixels)
            const prevLabel = visibleLabels.length > 0 ? visibleLabels[visibleLabels.length - 1] : null
            if (prevLabel) {
              const distancePx = Math.abs(percent - prevLabel.percent) * actualWidth / 100
              if (distancePx < minDistancePx) {
                return
              }
            }
            
            // Check distance to next label (if exists)
            const nextBoundaryIndex = index + 1
            if (nextBoundaryIndex < decadeBoundaries.length) {
              const nextNextBoundary = nextBoundaryIndex < decadeBoundaries.length - 1
                ? decadeBoundaries[nextBoundaryIndex + 1]
                : { x: chartWidth }
              const nextBoundaryItem = decadeBoundaries[nextBoundaryIndex]
              if (!nextBoundaryItem) return
              const nextCenterX = (nextBoundaryItem.x + (nextNextBoundary?.x ?? chartWidth)) / 2
              const nextPercent = (nextCenterX / chartWidth) * 100
              const nextDistancePx = Math.abs(nextPercent - percent) * actualWidth / 100
              if (nextDistancePx < minDistancePx) {
                return
              }
            }
            
            visibleLabels.push({ decade: boundary.decade, percent })
          })
          
          return visibleLabels.length > 0 ? (
            <div className="byyear-decade-labels-top">
              {visibleLabels.map(({ decade, percent }) => (
                <span
                  key={`decade-top-${decade}`}
                  className="byyear-decade-label-top"
                  style={{ left: `${percent}%` }}
                >
                  {decade}
                </span>
              ))}
            </div>
          ) : null
        })()}
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
          {/* Decade background rectangles */}
          {decadeBoundaries.map((boundary, index) => {
            const nextBoundary = index < decadeBoundaries.length - 1 
              ? decadeBoundaries[index + 1] 
              : { x: chartWidth }
            const x1 = boundary.x
            const x2 = nextBoundary?.x ?? chartWidth
            const width = x2 - x1
            
            // Alternate between two subtle background colors
            const bgColor = index % 2 === 0 ? 'rgba(42, 50, 66, 0.15)' : 'rgba(42, 50, 66, 0.08)'
            
            return (
              <rect
                key={`decade-bg-${boundary.decade}`}
                x={x1}
                y={0}
                width={width}
                height={BAR_HEIGHT}
                fill={bgColor}
              />
            )
          })}
          <line x1="0" y1={BAR_HEIGHT} x2={chartWidth} y2={BAR_HEIGHT} stroke="#1f2430" strokeWidth="1" vectorEffect="non-scaling-stroke" />
          {/* Decade divider lines */}
          {decadeBoundaries.map(({ decade, x }) => {
            // Always show divider lines for all decades (including boundaries)
            // Use vector-effect="non-scaling-stroke" to prevent line width from scaling
            return (
              <line
                key={`decade-${decade}`}
                x1={x}
                y1={0}
                x2={x}
                y2={BAR_HEIGHT}
                stroke="#2a3242"
                strokeWidth="1"
                strokeDasharray="2 2"
                opacity="0.5"
                vectorEffect="non-scaling-stroke"
              />
            )
          })}
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
        {tooltipContent && tooltip && (
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
