const numberFormatter = new Intl.NumberFormat('ru-RU')

export const formatNumber = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return numberFormatter.format(value)
}

export const formatRating = (value) => {
  if (value === null || value === undefined || Number.isNaN(value)) return '-'
  return value.toFixed(2).replace('.', ',')
}

export const formatYear = (value) => {
  if (!value) return '-'
  return String(value)
}
