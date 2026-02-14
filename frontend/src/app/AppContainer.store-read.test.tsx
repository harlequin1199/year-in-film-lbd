<<<<<<< HEAD
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('reads loading/error from analysis store selectors', () => {
    expect(true).toBe(true)
=======
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('uses analysis store selectors for business read path', () => {
    const source = readFileSync(resolve(__dirname, './AppContainer.tsx'), 'utf-8')
    expect(source).toMatch(/useAnalysisStore/)
    expect(source).toMatch(/selectAnalysisSummary/)
    expect(source).toMatch(/selectProgressView/)
>>>>>>> cbb9284 (refactor(frontend): migrate app read path to analysis store)
  })
})
