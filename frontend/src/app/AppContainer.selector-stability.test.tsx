import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('AppContainer selector stability', () => {
  it('uses useShallow wrapper for object selectors from zustand store', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/AppContainer.tsx'), 'utf-8')
    expect(source).toMatch(/useShallow/)
    expect(source).toMatch(/useAnalysisStore\(useShallow\(selectAnalysisSummary\)\)/)
    expect(source).toMatch(/useAnalysisStore\(useShallow\(selectProgressView\)\)/)
  })
})
