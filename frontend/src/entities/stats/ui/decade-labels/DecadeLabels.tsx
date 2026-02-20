interface DecadeBoundary {
  decade: number
  x: number
}

interface DecadeLabelsProps {
  boundaries: DecadeBoundary[]
  chartWidth: number
  containerWidth: number | null
}

export function DecadeLabels({ boundaries, chartWidth, containerWidth }: DecadeLabelsProps) {
  if (boundaries.length <= 1) return null

  const actualWidth = containerWidth || chartWidth
  const minDistancePx = 45
  const edgeMarginPx = 25
  const edgeMarginPercent = actualWidth > 0 ? (edgeMarginPx / actualWidth) * 100 : 3

  const visibleLabels: Array<{ decade: number; percent: number }> = []

  boundaries.forEach((boundary, index) => {
    const nextBoundary = index < boundaries.length - 1 ? boundaries[index + 1] : { x: chartWidth }
    const centerX = (boundary.x + (nextBoundary?.x ?? chartWidth)) / 2
    const percent = (centerX / chartWidth) * 100

    if (percent < edgeMarginPercent || percent > 100 - edgeMarginPercent) return

    const prevLabel = visibleLabels.length > 0 ? visibleLabels[visibleLabels.length - 1] : null
    if (prevLabel) {
      const distancePx = (Math.abs(percent - prevLabel.percent) * actualWidth) / 100
      if (distancePx < minDistancePx) return
    }

    const nextBoundaryIndex = index + 1
    if (nextBoundaryIndex < boundaries.length) {
      const nextNextBoundary = nextBoundaryIndex < boundaries.length - 1 ? boundaries[nextBoundaryIndex + 1] : { x: chartWidth }
      const nextBoundaryItem = boundaries[nextBoundaryIndex]
      if (!nextBoundaryItem) return
      const nextCenterX = (nextBoundaryItem.x + (nextNextBoundary?.x ?? chartWidth)) / 2
      const nextPercent = (nextCenterX / chartWidth) * 100
      const nextDistancePx = (Math.abs(nextPercent - percent) * actualWidth) / 100
      if (nextDistancePx < minDistancePx) return
    }

    visibleLabels.push({ decade: boundary.decade, percent })
  })

  if (visibleLabels.length === 0) return null

  return (
    <div className="byyear-decade-labels-top">
      {visibleLabels.map(({ decade, percent }) => (
        <span key={`decade-top-${decade}`} className="byyear-decade-label-top" style={{ left: `${percent}%` }}>
          {decade}
        </span>
      ))}
    </div>
  )
}
