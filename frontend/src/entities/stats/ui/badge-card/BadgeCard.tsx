import { useRef, useEffect, useCallback, type ReactElement } from 'react'
import { formatNumber, formatRating } from '../../../../utils/format'
import type { Badge } from '../../../../types/stats.types'

const ICONS: Record<string, ReactElement> = {
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

const BASE_FONT = 20
const MIN_FONT = 14
const STEP = 1

interface AutoFitValueProps {
  text: string
  title?: string
}

function AutoFitValue({ text, title }: AutoFitValueProps) {
  const ref = useRef<HTMLParagraphElement>(null)

  const fit = useCallback(() => {
    const el = ref.current
    if (!el) return

    const origWrap = el.style.overflowWrap
    const origBreak = el.style.wordBreak
    const origWhite = el.style.whiteSpace
    const origOverflow = el.style.overflow
    const origMaxH = el.style.maxHeight

    el.style.fontSize = `${BASE_FONT}px`
    el.style.overflowWrap = 'normal'
    el.style.wordBreak = 'keep-all'
    el.style.whiteSpace = 'normal'
    el.style.overflow = 'visible'
    el.style.maxHeight = 'none'

    let size = BASE_FONT
    while (size > MIN_FONT && el.scrollWidth > el.clientWidth) {
      size -= STEP
      el.style.fontSize = `${size}px`
    }

    el.style.overflowWrap = origWrap
    el.style.wordBreak = origBreak
    el.style.whiteSpace = origWhite
    el.style.overflow = origOverflow
    el.style.maxHeight = origMaxH
  }, [])

  useEffect(() => {
    fit()
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null
    if (ref.current?.parentElement && ro) ro.observe(ref.current.parentElement)
    return () => ro?.disconnect()
  }, [text, fit])

  return (
    <p className="badge-value" ref={ref} title={title}>
      {text}
    </p>
  )
}

export function BadgeCard({ badge }: { badge: Badge }) {
  const displayValue = badge.isRating
    ? formatRating(badge.value as number)
    : typeof badge.value === 'string'
      ? badge.value
      : formatNumber(badge.value as number)

  return (
    <div className={`badge-card tone-${badge.tone || 'gold'}`}>
      <div className="badge-icon-wrap" aria-hidden="true">
        {ICONS[badge.iconKey] || ICONS.film}
      </div>
      <div className="badge-content">
        <p className="badge-title">{badge.title}</p>
        <AutoFitValue text={displayValue} title={typeof badge.value === 'string' ? badge.value : undefined} />
        <p className="badge-subtitle">{badge.subtitle}</p>
      </div>
    </div>
  )
}
