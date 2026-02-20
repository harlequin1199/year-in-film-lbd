import type { Film } from '../../../types/film.types'
import type { YearStats } from '../../../types/stats.types'

export interface ByYearEntry {
  year: number
  count: number
  avgRating: number | null
  loveScore: number | null
}

export interface ByYearModel {
  minYear: number
  maxYear: number
  yearEntries: ByYearEntry[]
}

export function buildByYearModel(films: Film[], yearsByLoveScore: YearStats[]): ByYearModel | null {
  if (!films || films.length === 0) return null

  const years = films.map((film) => film.year).filter((year): year is number => year !== null && year !== undefined)
  if (years.length === 0) return null

  const minYear = Math.min(...years)
  const maxYear = Math.max(...years)

  const loveScoreByYear = new Map<number, { loveScore: number; count: number; avg_rating: number }>()
  ;(yearsByLoveScore || []).forEach((item) => {
    loveScoreByYear.set(Number(item.name), { loveScore: item.loveScore, count: item.count, avg_rating: item.avg_rating })
  })

  const yearMap = new Map<number, { count: number; sum: number; rated: number }>()
  for (let year = minYear; year <= maxYear; year += 1) {
    yearMap.set(year, { count: 0, sum: 0, rated: 0 })
  }

  films.forEach((film) => {
    if (!film.year) return
    const entry = yearMap.get(film.year)
    if (!entry) return
    entry.count += 1
    if (film.rating !== null && film.rating !== undefined) {
      entry.sum += film.rating
      entry.rated += 1
    }
  })

  const yearEntries: ByYearEntry[] = Array.from(yearMap.entries()).map(([year, stats]) => {
    const avgRating = stats.rated ? stats.sum / stats.rated : null
    const loveData = loveScoreByYear.get(year)
    return {
      year,
      count: stats.count,
      avgRating,
      loveScore: loveData?.loveScore ?? null,
    }
  })

  return { minYear, maxYear, yearEntries }
}
