import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('FeatureErrorBoundary', () => {
  it('provides scoped fallback', () => {
    const source = readFileSync(new URL('./FeatureErrorBoundary.tsx', import.meta.url), 'utf-8')
    expect(source).toMatch(/class FeatureErrorBoundary/)
    expect(source).toMatch(/featureName/)
    expect(source).toMatch(/TechnicalFallback/)
  })
})
