import { formatNumber, formatYear } from '../utils/format.js'

function YearFilter({
  availableYears,
  selectedYears,
  onToggleYear,
  onReset,
  summaryText,
  filmCount,
}) {
  const years = availableYears || []
  const sorted = [...years].sort((a, b) => a - b)
  const visible = sorted.slice(-10)
  const extra = sorted.slice(0, Math.max(0, sorted.length - 10))

  return (
    <div className="year-filter">
      <div className="year-pills">
        <button
          type="button"
          className={`pill-button ${selectedYears.length === 0 ? 'active' : ''}`}
          onClick={onReset}
        >
          Все годы
        </button>
        {visible.map((year) => (
          <button
            type="button"
            key={year}
            className={`pill-button ${selectedYears.includes(year) ? 'active' : ''}`}
            onClick={() => onToggleYear(year)}
          >
            {formatYear(year)}
          </button>
        ))}
        {extra.length > 0 && (
          <div className="pill-dropdown">
            <button type="button" className="pill-button">
              Ещё…
            </button>
            <div className="pill-dropdown-menu">
              {extra.map((year) => (
                <button
                  type="button"
                  key={year}
                  className={`pill-button ${selectedYears.includes(year) ? 'active' : ''}`}
                  onClick={() => onToggleYear(year)}
                >
                  {formatYear(year)}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="year-summary">
        <span>{summaryText}</span>
        <span>Фильмов: {formatNumber(filmCount)}</span>
      </div>
      <p className="year-hint">Можно выбрать несколько лет — статистика будет суммарной.</p>
    </div>
  )
}

export default YearFilter
