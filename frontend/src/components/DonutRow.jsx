import { formatNumber } from '../utils/format.js'
import { CHART_COLORS } from '../utils/colors.js'
import { getGenreNameRu } from '../utils/genresRu.js'

function DonutRow({ genres }) {
  const top = (genres || []).slice(0, 6)
  const total = top.reduce((acc, g) => acc + g.count, 0) || 1
  let offset = 0

  return (
    <section className="card">
      <div className="card-header">
        <h3>Жанры</h3>
        <p>Доля жанров в вашей киноленте года</p>
      </div>
      <div className="donut-row">
        <svg viewBox="0 0 120 120" className="donut">
          <circle className="donut-ring" cx="60" cy="60" r="52" />
          {top.map((genre, index) => {
            const portion = genre.count / total
            const dash = portion * 2 * Math.PI * 52
            const gap = 2 * Math.PI * 52 - dash
            const circle = (
              <circle
                key={genre.name}
                className="donut-segment"
                cx="60"
                cy="60"
                r="52"
                stroke={CHART_COLORS[index % CHART_COLORS.length]}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={-offset}
              />
            )
            offset += dash
            return circle
          })}
        </svg>
        <div className="legend">
          {top.map((genre, index) => (
            <div className="legend-item" key={genre.name}>
              <span className="swatch" style={{ background: CHART_COLORS[index % CHART_COLORS.length] }} />
              <span>{getGenreNameRu(genre.name)}</span>
              <span className="legend-count">{formatNumber(genre.count)}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

export default DonutRow
