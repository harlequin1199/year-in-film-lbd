import { beforeEach, describe, expect, it } from 'vitest'
import type { Analysis, Progress } from '../types'
import { useAnalysisStore } from './analysisStore'

const baseAnalysis: Analysis = {
  filmsLite: [],
  filmsLiteAll: [],
  availableYears: [],
  simplifiedMode: false,
  fileName: '',
  warnings: [],
}

const progress: Progress = {
  stage: 'tmdb_search',
  message: 'progress',
  done: 1,
  total: 2,
  percent: 50,
}

describe('analysisStore lifecycle', () => {
  beforeEach(() => {
    useAnalysisStore.getState().resetForTests()
  })

  it('resets analysis and starts loading at startRun', () => {
    const store = useAnalysisStore.getState()
    store.completeRun(baseAnalysis)
    store.startRun('ratings.csv')

    const next = useAnalysisStore.getState()
    expect(next.analysis).toBeNull()
    expect(next.loading).toBe(true)
    expect(next.lastUploadedFileName).toBe('ratings.csv')
  })

  it('applies terminal cleanup on failRun', () => {
    const store = useAnalysisStore.getState()
    store.startRun('ratings.csv')
    store.setProgress(progress)
    store.failRun('boom')

    const next = useAnalysisStore.getState()
    expect(next.loading).toBe(false)
    expect(next.progress).toBeNull()
    expect(next.error).toBe('boom')
  })

  it('sets aborted message on abortRun', () => {
    const store = useAnalysisStore.getState()
    store.startRun('ratings.csv')
    store.setProgress(progress)
    store.abortRun()

    const next = useAnalysisStore.getState()
    expect(next.loading).toBe(false)
    expect(next.progress).toBeNull()
    expect(next.error).toMatch(/остановлен/i)
  })
})
