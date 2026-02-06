import { formatNumber, formatRating } from '../utils/format.js'

const ICONS = {
  film: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <path d="M3 5h18v14H3zM7 5v14M17 5v14" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  star: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <path
        d="M12 3.5l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.8 19.2l1-5.7-4.1-4 5.7-.8L12 3.5z"
        fill="currentColor"
      />
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <path
        d="M12 20s-7-4.6-9-8.4C1.4 8.2 3.3 5 6.6 5c2 0 3.2 1.1 4.4 2.6C12.2 6.1 13.4 5 15.4 5c3.3 0 5.2 3.2 3.6 6.6C19 15.4 12 20 12 20z"
        fill="currentColor"
      />
    </svg>
  ),
  globe: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <path d="M12 7v6l4 2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  ),
  trophy: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <path
        d="M6 4h12v3c0 3.3-2.7 6-6 6s-6-2.7-6-6V4z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
      />
      <path d="M8 20h8M10 13v4m4-4v4" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
  tag: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <path d="M3 12l8-8h6l4 4v6l-8 8z" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <circle cx="15" cy="9" r="1.6" fill="currentColor" />
    </svg>
  ),
  calendar: (
    <svg viewBox="0 0 24 24" className="badge-icon" aria-hidden="true">
      <rect x="4" y="6" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path d="M8 4v4M16 4v4M4 10h16" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  ),
}

function BadgesSection({ badges }) {
  const items = badges || []

  return (
    <section className="card">
      <div className="card-header">
        <h3>Бейджи</h3>
        <p>Прогресс по небольшим целям</p>
      </div>
      <div className="badge-grid">
        {items.map((badge) => (
          <div className={`badge-card tone-${badge.tone || 'gold'}`} key={badge.title}>
            <div className="badge-icon-wrap">{ICONS[badge.iconKey] || ICONS.film}</div>
            <span className="badge-title">{badge.title}</span>
            <span className="badge-value">
              {badge.isRating
                ? formatRating(badge.value)
                : typeof badge.value === 'string'
                  ? badge.value
                  : formatNumber(badge.value)}
            </span>
            <span className="badge-subtitle">{badge.subtitle}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

export default BadgesSection
