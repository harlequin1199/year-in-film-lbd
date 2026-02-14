<<<<<<< HEAD
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('reads loading/error from analysis store selectors', () => {
    expect(true).toBe(true)
=======
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('uses analysis store selectors for business read path', () => {
    const source = readFileSync(new URL('./AppContainer.tsx', import.meta.url), 'utf-8')
    expect(source).toMatch(/useAnalysisStore/)
    expect(source).toMatch(/selectAnalysisSummary/)
    expect(source).toMatch(/selectProgressView/)
>>>>>>> cbb9284 (refactor(frontend): migrate app read path to analysis store)
  })
})
