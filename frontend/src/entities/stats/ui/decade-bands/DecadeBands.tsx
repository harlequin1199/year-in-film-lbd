interface DecadeBoundary {
  decade: number
  x: number
}

interface DecadeBandsProps {
  boundaries: DecadeBoundary[]
  chartWidth: number
  height: number
}

export function DecadeBands({ boundaries, chartWidth, height }: DecadeBandsProps) {
  return (
    <>
      {boundaries.map((boundary, index) => {
        const nextBoundary = index < boundaries.length - 1 ? boundaries[index + 1] : { x: chartWidth }
        const x1 = boundary.x
        const x2 = nextBoundary?.x ?? chartWidth
        const width = x2 - x1
        const bgColor = index % 2 === 0 ? 'rgba(42, 50, 66, 0.15)' : 'rgba(42, 50, 66, 0.08)'

        return (
          <rect key={`decade-bg-${boundary.decade}`} x={x1} y={0} width={width} height={height} fill={bgColor} />
        )
      })}
      {boundaries.map(({ decade, x }) => (
        <line
          key={`decade-${decade}`}
          x1={x}
          y1={0}
          x2={x}
          y2={height}
          stroke="#2a3242"
          strokeWidth="1"
          strokeDasharray="2 2"
          opacity="0.5"
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </>
  )
}
