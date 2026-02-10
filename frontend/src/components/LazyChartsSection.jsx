import ByYearChart from './ByYearChart.jsx'

/**
 * Lazy-loaded chunk: by-year chart (vendor-charts).
 * Loaded after main dashboard to reduce initial bundle size.
 */
function LazyChartsSection({ films, yearsByLoveScore }) {
  return (
    <div style={{ display: 'contents' }}>
      <section className="chart-by-year-row">
        <ByYearChart films={films} yearsByLoveScore={yearsByLoveScore} />
      </section>
    </div>
  )
}

export default LazyChartsSection
