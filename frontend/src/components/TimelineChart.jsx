import { formatNumber } from '../utils/format.js'

function TimelineChart({ timeline }) {
  const maxCount = Math.max(...(timeline || []).map((item) => item.count), 1)
  const data = (timeline || []).slice(-12)

  return (
    <section className="card">
      <div className="card-header">
        <h3>Активность по месяцам</h3>
        <p>Сколько фильмов вы отметили каждый месяц</p>
      </div>
      <div className="timeline">
        {data.map((item) => (
          <div className="timeline-bar" key={item.month}>
            <span className="timeline-label">{item.month}</span>
            <div className="timeline-track">
              <div
                className="timeline-fill"
                style={{ width: `${(item.count / maxCount) * 100}%` }}
              />
            </div>
            <span className="timeline-count">{formatNumber(item.count)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default TimelineChart
