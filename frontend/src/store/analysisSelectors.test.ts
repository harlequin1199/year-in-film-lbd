import { describe, expect, it } from 'vitest'
import { selectAnalysisSummary } from './analysisSelectors'

describe('analysis selectors', () => {
  it('returns stable summary shape', () => {
    const out = selectAnalysisSummary({ analysis: null, loading: false, error: '' } as never)
    expect(out).toEqual({ hasAnalysis: false, loading: false, error: '' })
  })
})
