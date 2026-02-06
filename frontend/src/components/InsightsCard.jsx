function InsightsCard({ insights }) {
  const items = insights || []

  return (
    <section className="card">
      <div className="card-header">
        <h3>Инсайты года</h3>
        <p>Короткие наблюдения о твоём кино-году</p>
      </div>
      {items.length === 0 && <div className="empty-inline">Нет данных для инсайтов.</div>}
      {items.length > 0 && (
        <ul className="insights-list">
          {items.map((insight, index) => (
            <li key={`${insight}-${index}`} className="insight-item">
              {insight}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default InsightsCard
