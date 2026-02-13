import { describe, expect, it } from 'vitest'
import { useAnalysisStore } from './analysisStore'

describe('analysis store', () => {
  it('resets analysis at startRun', () => {
    const store = useAnalysisStore.getState()
    store.completeRun({ filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: false, warnings: [], fileName: '' })
    store.startRun('ratings.csv')
    expect(useAnalysisStore.getState().analysis).toBeNull()
  })
})
