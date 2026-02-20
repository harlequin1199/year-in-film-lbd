export const BY_YEAR_BAR_HEIGHT = 220

export function getByYearBarWidth(yearCount: number): number {
  if (yearCount <= 40) return 10
  if (yearCount <= 80) return 6
  if (yearCount <= 120) return 4
  return 2
}

export function getByYearBarGap(yearCount: number): number {
  return yearCount > 120 ? 0 : 1
}
