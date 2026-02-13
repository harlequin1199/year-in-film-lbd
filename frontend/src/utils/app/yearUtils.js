export function extractYears(films) {
  if (!films || !Array.isArray(films) || films.length === 0) return []

  return [...new Set(films
    .map((film) => {
      const date = film?.date
      if (!date) return null
      const year = typeof date === 'string' ? date.slice(0, 4) : date.getFullYear?.()
      return year ? parseInt(year, 10) : null
    })
    .filter(Boolean))].sort((a, b) => a - b)
}
