import ByYearChart from './ByYearChart'
import type { Film } from '../types/film.types'
import type { YearStats } from '../types/stats.types'

/**
 * Lazy-loaded chunk: by-year chart (vendor-charts).
 * Loaded after main dashboard to reduce initial bundle size.
 */
interface LazyChartsSectionProps {
  films: Film[]
  yearsByLoveScore: YearStats[]
}

function LazyChartsSection({ films, yearsByLoveScore }: LazyChartsSectionProps) {
  return (
    <div style={{ display: 'contents' }}>
      <section className="chart-by-year-row">
        <ByYearChart films={films} yearsByLoveScore={yearsByLoveScore} />
      </section>
    </div>
  )
}

export default LazyChartsSection
