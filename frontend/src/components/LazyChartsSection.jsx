import TimelineChart from './TimelineChart.jsx'
import ByYearChart from './ByYearChart.jsx'

/**
 * Lazy-loaded chunk: timeline + by-year charts (vendor-charts).
 * Loaded after main dashboard to reduce initial bundle size.
 */
function LazyChartsSection({ timeline, films, hasDiary }) {
  const tl = timeline || []
  const monthsWithData = tl.filter((m) => m.count > 0)
  const uniqueMonths = new Set(tl.map((m) => m.month)).size
  const showTimeline = hasDiary && uniqueMonths > 1 && monthsWithData.length > 0

  return (
    <div style={{ display: 'contents' }}>
      {showTimeline && <TimelineChart timeline={timeline} />}
      {!showTimeline && !hasDiary && (
        <section className="card activity-unavailable">
          <div className="card-header">
            <h3>Активность недоступна</h3>
            <p>ratings.csv содержит дату выставления оценки, а не дату просмотра. Чтобы построить активность по месяцам, добавь diary.csv.</p>
          </div>
        </section>
      )}
      <section className="chart-by-year-row">
        <ByYearChart films={films} />
      </section>
    </div>
  )
}

export default LazyChartsSection
