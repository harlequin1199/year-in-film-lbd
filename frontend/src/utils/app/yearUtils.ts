import type { Film } from '../../types'

export function extractYears(films: Film[]): number[] {
  if (!films || !Array.isArray(films) || films.length === 0) return []

  return [...new Set(films
    .map((film) => {
      const date = film?.date
      if (!date) return null
      const year = typeof date === 'string' ? date.slice(0, 4) : (typeof date === 'object' && date !== null && 'getFullYear' in date ? String((date as Date).getFullYear()) : null)
      return year ? parseInt(year, 10) : null
    })
    .filter((y): y is number => Boolean(y)))].sort((a, b) => a - b)
}
