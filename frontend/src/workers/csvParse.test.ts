import { describe, expect, it } from 'vitest'

import { parseRfcCsvLine, parseRatings } from './csvParseCore'

describe('csv parser worker helpers', () => {
  it('parses quoted fields and escaped quotes', () => {
    const cells = parseRfcCsvLine('"Movie, The","He said ""wow""",2023')
    expect(cells).toEqual(['Movie, The', 'He said "wow"', '2023'])
  })

  it('supports tab delimiter', () => {
    const cells = parseRfcCsvLine('Movie\t2024\t4.5')
    expect(cells).toEqual(['Movie', '2024', '4.5'])
  })

  it('ignores empty lines while parsing ratings', () => {
    const text = ['Name,Year,Rating', '', 'Film A,2022,4', '   ', 'Film B,2021,3.5'].join('\n')
    const rows = parseRatings(text)

    expect(rows).toHaveLength(2)
    expect(rows.map((r) => r.title)).toEqual(['Film A', 'Film B'])
  })

  it('returns empty result when no name/title column exists', () => {
    const text = ['Year,Rating', '2022,4'].join('\n')
    expect(parseRatings(text)).toEqual([])
  })

  it('handles missing optional columns and skips rows without title', () => {
    const text = [
      'Name,Year,Rating',
      ',2020,4.5',
      'Film C,not-a-year,',
    ].join('\n')
    const rows = parseRatings(text)

    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual({
      title: 'Film C',
      year: null,
      rating: null,
      date: null,
      letterboxd_url: null,
    })
  })
})
