import type { RankedEntity } from '../../../types/stats.types'

interface DonutSegment {
  id: string
  dash: number
  gap: number
  offset: number
}

export function buildDonutSegments(top: RankedEntity[], radius = 52): DonutSegment[] {
  const circumference = 2 * Math.PI * radius
  const total = (top || []).reduce((acc, item) => acc + item.count, 0) || 1
  let offset = 0

  return (top || []).map((item) => {
    const portion = item.count / total
    const dash = portion * circumference
    const gap = circumference - dash
    const segment = {
      id: item.name,
      dash,
      gap,
      offset: -offset,
    }
    offset += dash
    return segment
  })
}
