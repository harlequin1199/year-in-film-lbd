import { useId } from 'react'

function Star({ fill }) {
  const gradientId = useId()
  const percent = Math.round(fill * 100)

  return (
    <svg viewBox="0 0 24 24" className="star" aria-hidden="true">
      <defs>
        <linearGradient id={gradientId}>
          <stop offset={`${percent}%`} stopColor="#f7c843" />
          <stop offset={`${percent}%`} stopColor="#2a3242" />
        </linearGradient>
      </defs>
      <path
        d="M12 3.5l2.6 5.2 5.7.8-4.1 4 1 5.7L12 16.8 6.8 19.2l1-5.7-4.1-4 5.7-.8L12 3.5z"
        fill={`url(#${gradientId})`}
        stroke="#f7c843"
        strokeWidth="0.6"
      />
    </svg>
  )
}

function Stars({ rating = 0 }) {
  const safeRating = Math.max(0, Math.min(5, rating || 0))
  const stars = Array.from({ length: 5 }, (_, index) => {
    const value = safeRating - index
    const fill = Math.max(0, Math.min(1, value))
    return <Star key={index} fill={fill} />
  })

  return <div className="stars">{stars}</div>
}

export default Stars
