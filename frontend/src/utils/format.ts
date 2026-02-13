const numberFormatter = new Intl.NumberFormat('ru-RU')

export const formatNumber = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return numberFormatter.format(value)
}

export const formatRating = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return value.toFixed(2).replace('.', ',')
}

export const formatLoveScore = (value: number | null | undefined): string => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return value.toFixed(1).replace('.', ',')
}

export const formatYear = (value: number | string | null | undefined): string => {
  if (!value) return '-'
  return String(value)
}

export const formatFilmsCount = (count: number | null | undefined): string => {
  if (count === null || count === undefined || Number.isNaN(count)) return '-'
  const num = Number(count)
  const lastDigit = num % 10
  const lastTwoDigits = num % 100
  
  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return `${formatNumber(num)} фильмов`
  }
  if (lastDigit === 1) {
    return `${formatNumber(num)} фильм`
  }
  if (lastDigit >= 2 && lastDigit <= 4) {
    return `${formatNumber(num)} фильма`
  }
  return `${formatNumber(num)} фильмов`
}
