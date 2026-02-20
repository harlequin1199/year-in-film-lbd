import { expect, test } from 'vitest'
import { buildDonutSegments } from './donutSegments'

test('normalizes segment dash lengths to total circumference', () => {
  const segments = buildDonutSegments([{ name: 'Drama', count: 2 }], 52)
  expect(segments[0]?.dash).toBeGreaterThan(0)
})
