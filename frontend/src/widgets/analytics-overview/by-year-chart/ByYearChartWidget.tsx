import { useMemo, useState, useRef, useEffect, type MouseEvent } from 'react'
import { formatNumber, formatRating, formatYear, formatLoveScore } from '../../../utils/format'
import { buildByYearModel } from '../../../entities/stats/lib/byYearModel'
import { DecadeBands } from '../../../entities/stats/ui/decade-bands/DecadeBands'
import { DecadeLabels } from '../../../entities/stats/ui/decade-labels/DecadeLabels'
import { ChartModeSwitch, type ChartMode } from '../../../features/chart-mode-switch/ui/ChartModeSwitch'
import { YearTooltip } from '../../../features/year-tooltip/ui/YearTooltip'
import { BY_YEAR_BAR_HEIGHT, getByYearBarGap, getByYearBarWidth } from '../../../shared/config/chart'
import type { Film } from '../../../types/film.types'
import type { YearStats } from '../../../types/stats.types'

interface ByYearChartWidgetProps {
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

interface DecadeBoundary {
  decade: number
  x: number
}

function ByYearChartWidget({ films, yearsByLoveScore }: ByYearChartWidgetProps) {
  const [mode, setMode] = useState<ChartMode>('count')
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
    const resizeObserver = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateWidth) : null
    if (chartContainerRef.current && resizeObserver) resizeObserver.observe(chartContainerRef.current)
    window.addEventListener('resize', updateWidth)
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize', updateWidth)
    }
  }, [])

  const data = useMemo(() => buildByYearModel(films, yearsByLoveScore), [films, yearsByLoveScore])

  if (!data) {
    return (
      <section className="card">
        <div className="card-header byyear-header">
          <div>
            <h3>По годам</h3>
            <p>Распределение фильмов по годам</p>
          </div>
          <ChartModeSwitch mode={mode} onChange={setMode} />
        </div>
      </section>
    )
  }

  const { minYear, maxYear, yearEntries } = data
  const maxCount = Math.max(...yearEntries.map((entry) => entry.count), 1)
  const yearCount = maxYear - minYear + 1
  const barWidth = getByYearBarWidth(yearCount)
  const gap = getByYearBarGap(yearCount)
  const chartWidth = yearCount * (barWidth + gap)

  const minDecade = Math.floor(minYear / 10) * 10
  const maxDecade = Math.floor(maxYear / 10) * 10
  const decadeBoundaries: DecadeBoundary[] = []

  for (let decade = minDecade; decade <= maxDecade; decade += 10) {
    const yearForDecade = Math.max(decade, minYear)
    if (yearForDecade <= maxYear) {
      const yearIndex = yearForDecade - minYear
      if (yearIndex >= 0 && yearIndex <= yearCount) {
        const x = Math.min(yearIndex * (barWidth + gap), chartWidth)
        decadeBoundaries.push({ decade, x })
      }
    }
  }

  const handleMove = (event: MouseEvent<SVGRectElement>, entry: (typeof yearEntries)[number]) => {
    const tooltipWidth = 220
    const tooltipHeight = 78
    const left = Math.max(8, Math.min(event.clientX + 12, window.innerWidth - tooltipWidth - 8))
    const top = Math.max(8, Math.min(event.clientY + 12, window.innerHeight - tooltipHeight - 8))
    setTooltip({ entry, x: left, y: top })
  }

  const getHeight = (entry: (typeof yearEntries)[number]): number => {
    if (mode === 'count') {
      if (entry.count === 0) return 0
      const scaled = Math.sqrt(entry.count / maxCount) * BY_YEAR_BAR_HEIGHT
      return Math.max(2, scaled)
    }

    if (mode === 'loveScore') {
      if (entry.loveScore == null) return 0
      return Math.max(2, (entry.loveScore / 100) * BY_YEAR_BAR_HEIGHT)
    }

    if (entry.count === 0 || entry.avgRating === null) return 0
    const scaled = Math.pow(entry.avgRating / 5, 1.2) * BY_YEAR_BAR_HEIGHT
    return Math.max(2, scaled)
  }

  const tooltipContent = tooltip?.entry
    ? {
        title: formatYear(tooltip.entry.year),
        count: formatNumber(tooltip.entry.count),
        avg: tooltip.entry.avgRating !== null ? formatRating(tooltip.entry.avgRating) : '—',
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
        <ChartModeSwitch mode={mode} onChange={setMode} />
      </div>
      <div className="byyear-chart" ref={chartContainerRef}>
        <DecadeLabels boundaries={decadeBoundaries} chartWidth={chartWidth} containerWidth={containerWidth} />
        <svg
          className="byyear-svg"
          width="100%"
          height={BY_YEAR_BAR_HEIGHT}
          viewBox={`0 0 ${chartWidth} ${BY_YEAR_BAR_HEIGHT}`}
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

          <DecadeBands boundaries={decadeBoundaries} chartWidth={chartWidth} height={BY_YEAR_BAR_HEIGHT} />
          <line x1="0" y1={BY_YEAR_BAR_HEIGHT} x2={chartWidth} y2={BY_YEAR_BAR_HEIGHT} stroke="#1f2430" strokeWidth="1" vectorEffect="non-scaling-stroke" />

          {yearEntries.map((entry, index) => {
            const height = getHeight(entry)
            const x = index * (barWidth + gap)
            const y = BY_YEAR_BAR_HEIGHT - height
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
          <YearTooltip
            title={tooltipContent.title}
            count={tooltipContent.count}
            avg={tooltipContent.avg}
            loveScore={tooltipContent.loveScore}
            x={tooltip.x}
            y={tooltip.y}
          />
        )}
      </div>
    </section>
  )
}

export default ByYearChartWidget
