import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('FeatureErrorBoundary', () => {
  it('provides scoped fallback', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/errors/FeatureErrorBoundary.tsx'), 'utf-8')
    expect(source).toMatch(/class FeatureErrorBoundary/)
    expect(source).toMatch(/featureName/)
    expect(source).toMatch(/TechnicalFallback/)
  })
})
