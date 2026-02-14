import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

describe('csv analysis flow writes via store actions', () => {
  it('dispatches lifecycle actions', () => {
    const source = readFileSync(new URL('./useCsvAnalysisFlow.ts', import.meta.url), 'utf-8')
    expect(source).toMatch(/useAnalysisStore/)
    expect(source).toMatch(/startRun/)
    expect(source).toMatch(/completeRun/)
    expect(source).toMatch(/failRun/)
    expect(source).toMatch(/abortRun/)
  })
})
