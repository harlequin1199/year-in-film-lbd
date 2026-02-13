import { describe, expect, it } from 'vitest'
import { useAnalysisStore } from './analysisStore'

describe('analysis store', () => {
  it('resets analysis at startRun', () => {
    const store = useAnalysisStore.getState()
    store.completeRun({ filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: false, warnings: [], fileName: '' })
    store.startRun('ratings.csv')
    expect(useAnalysisStore.getState().analysis).toBeNull()
  })

  it('follows terminal cleanup on failRun', () => {
    const store = useAnalysisStore.getState()
    store.startRun('ratings.csv')
    store.setProgress({ stage: 'tmdb_search', message: 'x', done: 1, total: 2, percent: 50 })
    store.failRun('boom')
    const next = useAnalysisStore.getState()
    expect(next.loading).toBe(false)
    expect(next.progress).toBeNull()
    expect(next.error).toBe('boom')
  })
})
