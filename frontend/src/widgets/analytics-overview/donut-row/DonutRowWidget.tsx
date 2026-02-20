import { useMemo } from 'react'
import { buildDonutSegments } from '../../../entities/stats/lib/donutSegments'
import { CardSectionHeader } from '../../../shared/ui/card-section-header'
import { LegendList } from '../../../shared/ui/legend-list'
import type { RankedEntity } from '../../../types/stats.types'
import { CHART_COLORS } from '../../../utils/colors'
import { getGenreNameRu } from '../../../utils/genresRu'

interface DonutRowWidgetProps {
  genres: RankedEntity[]
}

function DonutRowWidget({ genres }: DonutRowWidgetProps) {
  const top = (genres || []).slice(0, 6)
  const segments = useMemo(() => buildDonutSegments(top, 52), [top])
  const legendItems = top.map((genre, index) => ({
    id: genre.name,
    label: getGenreNameRu(genre.name),
    color: CHART_COLORS[index % CHART_COLORS.length],
    count: genre.count,
  }))

  return (
    <section className="card">
      <CardSectionHeader title="Жанры" description="Доля жанров в вашей киноленте года" />
      <div className="donut-row">
        <svg viewBox="0 0 120 120" className="donut">
          <circle className="donut-ring" cx="60" cy="60" r="52" />
          {segments.map((segment, index) => (
            <circle
              key={segment.id}
              className="donut-segment"
              cx="60"
              cy="60"
              r="52"
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
              strokeDasharray={`${segment.dash} ${segment.gap}`}
              strokeDashoffset={segment.offset}
            />
          ))}
        </svg>
        <LegendList items={legendItems} />
      </div>
    </section>
  )
}

export default DonutRowWidget
