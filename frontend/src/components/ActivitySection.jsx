import { formatNumber, formatRating } from '../utils/format.js'

function ActivitySection({ watchesByMonth, watchesByWeekday }) {
  const months = watchesByMonth || []
  const weekdays = watchesByWeekday || []
  const maxMonth = Math.max(...months.map((item) => item.count), 1)
  const maxWeekday = Math.max(...weekdays.map((item) => item.count), 1)

  return (
    <section className="card">
      <div className="card-header">
        <h3>Активность</h3>
        <p>Когда ты смотрел фильмы чаще всего</p>
      </div>
      {months.length === 0 && weekdays.length === 0 && (
        <div className="empty-inline">Нет данных по активности.</div>
      )}
      <div className="activity-grid">
        <div className="activity-panel">
          <h4>По месяцам</h4>
          <div className="activity-bars">
            {months.map((item) => (
              <div className="activity-bar" key={item.month}>
                <div
                  className="activity-bar-fill"
                  style={{ height: `${(item.count / maxMonth) * 100}%` }}
                  title={`${item.month} • ${formatNumber(item.count)} • Ср. ${formatRating(item.avg_rating)}`}
                />
                <span>{item.month}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="activity-panel">
          <h4>По дням недели</h4>
          <div className="activity-bars activity-bars--compact">
            {weekdays.map((item) => (
              <div className="activity-bar" key={item.weekday}>
                <div
                  className="activity-bar-fill"
                  style={{ height: `${(item.count / maxWeekday) * 100}%` }}
                  title={`${item.nameRu} • ${formatNumber(item.count)} • Ср. ${formatRating(item.avg_rating)}`}
                />
                <span>{item.nameRu}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

export default ActivitySection
