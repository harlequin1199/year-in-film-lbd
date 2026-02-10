/**
 * Web Worker: parse CSV without blocking UI.
 * Posts: { type: 'progress', stage, message, done, total }
 *        { type: 'rows', rows } for ratings
 */

function parseRfcCsvLine(line) {
  const out = []
  let cur = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') {
        cur += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (inQuotes) {
      cur += c
    } else if (c === ',' || c === '\t') {
      out.push(cur.trim())
      cur = ''
    } else {
      cur += c
    }
  }
  out.push(cur.trim())
  return out
}

function findCol(fieldnames, ...candidates) {
  const norm = fieldnames.map((h) => (h || '').toLowerCase().trim())
  for (const c of candidates) {
    const cnorm = c.toLowerCase().trim()
    for (let i = 0; i < norm.length; i++) {
      if (norm[i].includes(cnorm) || cnorm.includes(norm[i])) return fieldnames[i]
    }
  }
  return null
}

function parseRatings(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  if (lines.length < 2) return []
  const header = parseRfcCsvLine(lines[0])
  const nameCol = findCol(header, 'Name', 'name', 'Title')
  if (!nameCol) return []
  const yearCol = findCol(header, 'Year', 'year')
  const ratingCol = findCol(header, 'Rating', 'rating')
  const dateCol = findCol(header, 'Date', 'date')
  const uriCol = findCol(header, 'Letterboxd URI', 'URI', 'letterboxd')
  const rows = []
  for (let i = 1; i < lines.length; i++) {
    const cells = parseRfcCsvLine(lines[i])
    const row = {}
    header.forEach((h, idx) => {
      row[h] = cells[idx] !== undefined ? cells[idx] : ''
    })
    const title = (row[nameCol] || '').trim()
    if (!title) continue
    rows.push({
      title,
      year: yearCol ? parseInt(row[yearCol], 10) || null : null,
      rating: ratingCol ? parseFloat(row[ratingCol]) || null : null,
      date: dateCol ? (row[dateCol] || '').trim() : null,
      letterboxd_url: uriCol ? (row[uriCol] || '').trim() || null : null,
    })
  }
  return rows
}

self.onmessage = async (e) => {
  const { type, ratingsText } = e.data
  if (type !== 'parse') return
  try {
    self.postMessage({ type: 'progress', stage: 'parsing', message: 'Чтение CSV', done: 0, total: 1, percent: 0 })
    const rows = parseRatings(ratingsText || '')
    self.postMessage({ type: 'progress', stage: 'parsing', message: 'Чтение CSV', done: 1, total: 1, percent: 4 })
    self.postMessage({ type: 'rows', rows })
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || 'Ошибка парсинга CSV' })
  }
}
