import { describe, expect, it } from 'vitest'
import { useAnalysisStore } from './analysisStore'

describe('store regression', () => {
  it('keeps terminal states consistent', () => {
    const s = useAnalysisStore.getState()
    s.startRun('x.csv')
    s.completeRun({
      filmsLite: [],
      filmsLiteAll: [],
      availableYears: [],
      simplifiedMode: false,
      fileName: 'x.csv',
      warnings: [],
    })
    s.abortRun()
    const next = useAnalysisStore.getState()
    expect(next.analysis).toBeNull()
    expect(next.loading).toBe(false)
    expect(next.progress).toBeNull()
  })
})
