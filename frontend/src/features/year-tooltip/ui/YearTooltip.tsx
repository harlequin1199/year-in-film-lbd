interface YearTooltipProps {
  title: string
  count: string
  avg: string
  loveScore: string | null
  x: number
  y: number
}

export function YearTooltip({ title, count, avg, loveScore, x, y }: YearTooltipProps) {
  return (
    <div className="byyear-tooltip" style={{ left: x, top: y }}>
      <div className="byyear-tooltip-title">{title}</div>
      <div>Фильмов: {count}</div>
      <div>Средняя: {avg}</div>
      {loveScore != null && <div>Love Score: {loveScore}</div>}
    </div>
  )
}
