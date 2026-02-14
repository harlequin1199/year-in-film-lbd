import { describe, expect, it } from 'vitest'
import { selectAnalysisSummary, selectProgressView } from './analysisSelectors'

describe('analysis selectors', () => {
  it('returns stable summary shape', () => {
    const out = selectAnalysisSummary({
      analysis: null,
      loading: false,
      error: '',
    })

    expect(out).toEqual({ hasAnalysis: false, loading: false, error: '' })
  })

  it('returns progress visibility data', () => {
    const out = selectProgressView({
      progress: { stage: 'x', message: 'y', done: 1, total: 2, percent: 50 },
      loading: true,
    })

    expect(out).toEqual({
      hasProgress: true,
      loading: true,
      percent: 50,
      stage: 'x',
      message: 'y',
    })
  })
})
