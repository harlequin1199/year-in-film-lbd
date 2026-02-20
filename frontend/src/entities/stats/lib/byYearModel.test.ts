import { expect, test } from 'vitest'
import { buildByYearModel } from './byYearModel'

test('builds continuous year range and aggregates counts', () => {
  const model = buildByYearModel(
    [
      { year: 2000, rating: 4 },
      { year: 2002, rating: 2 },
    ] as any,
    [],
  )

  expect(model?.minYear).toBe(2000)
  expect(model?.maxYear).toBe(2002)
  expect(model?.yearEntries.find((x) => x.year === 2001)?.count).toBe(0)
})
