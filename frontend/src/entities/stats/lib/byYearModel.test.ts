import { expect, test } from 'vitest'
import type { Film } from '../../../types/film.types'
import { buildByYearModel } from './byYearModel'

test('builds continuous year range and aggregates counts', () => {
  const films = [
    { year: 2000, rating: 4 },
    { year: 2002, rating: 2 },
  ] as unknown as Film[]

  const model = buildByYearModel(
    films,
    [],
  )

  expect(model?.minYear).toBe(2000)
  expect(model?.maxYear).toBe(2002)
  expect(model?.yearEntries.find((x) => x.year === 2001)?.count).toBe(0)
})
