import { describe, expect, it } from 'vitest'

import { parseRfcCsvLine, parseRatings } from './csvParse'

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
})
