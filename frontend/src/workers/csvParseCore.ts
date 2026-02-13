/**
 * RFC-style CSV parsing and Letterboxd ratings parsing.
 */

export interface ParsedRatingRow {
  title: string
  year: number | null
  rating: number | null
  date: string | null
  letterboxd_url: string | null
}

export function parseRfcCsvLine(line: string): string[] {
  const out: string[] = []
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

function findCol(
  fieldnames: string[],
  ...candidates: string[]
): string | null {
  const norm = fieldnames.map((h) => (h || '').toLowerCase().trim())
  for (const c of candidates) {
    const cnorm = c.toLowerCase().trim()
    for (let i = 0; i < norm.length; i++) {
      const n = norm[i]
      const f = fieldnames[i]
      if (n != null && f != null && (n.includes(cnorm) || cnorm.includes(n))) return f
    }
  }
  return null
}

export function parseRatings(text: string): ParsedRatingRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim())
  const firstLine = lines[0]
  if (lines.length < 2 || firstLine === undefined) return []
  const header = parseRfcCsvLine(firstLine)
  const nameCol = findCol(header, 'Name', 'name', 'Title')
  if (!nameCol) return []
  const yearCol = findCol(header, 'Year', 'year')
  const ratingCol = findCol(header, 'Rating', 'rating')
  const dateCol = findCol(header, 'Date', 'date')
  const uriCol = findCol(header, 'Letterboxd URI', 'URI', 'letterboxd')
  const rows: ParsedRatingRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i]
    if (line === undefined) continue
    const cells = parseRfcCsvLine(line)
    const row: Record<string, string> = {}
    header.forEach((h, idx) => {
      const cell = cells[idx]
      row[h] = cell !== undefined ? cell : ''
    })
    const title = (row[nameCol] ?? '').trim()
    if (!title) continue
    rows.push({
      title,
      year: yearCol ? parseInt(String(row[yearCol] ?? ''), 10) || null : null,
      rating: ratingCol ? parseFloat(String(row[ratingCol] ?? '')) || null : null,
      date: dateCol ? String(row[dateCol] ?? '').trim() || null : null,
      letterboxd_url: uriCol ? String(row[uriCol] ?? '').trim() || null : null,
    })
  }
  return rows
}
