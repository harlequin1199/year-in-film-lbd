import { formatNumber } from '../../../utils/format'

interface LegendItem {
  id: string
  label: string
  color: string
  count: number
}

interface LegendListProps {
  items: LegendItem[]
}

export function LegendList({ items }: LegendListProps) {
  return (
    <div className="legend legend-list">
      {items.map((item) => (
        <div className="legend-item" key={item.id}>
          <span className="swatch" style={{ background: item.color }} />
          <span>{item.label}</span>
          <span className="legend-count">{formatNumber(item.count)}</span>
        </div>
      ))}
    </div>
  )
}
