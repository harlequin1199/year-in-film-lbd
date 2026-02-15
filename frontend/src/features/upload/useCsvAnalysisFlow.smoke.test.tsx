import { act, renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Film, FilmRow } from '../../types'
import { useAnalysisStore } from '../../store/analysisStore'
import { useCsvAnalysisFlow } from './useCsvAnalysisFlow'
import { clearResumeState, setLastReport } from '../../utils/indexedDbCache'
import { runStagedAnalysis } from '../../utils/tmdbProxyClient'

vi.mock('../../utils/analyticsClient', () => ({
  computeStage1FromRows: vi.fn(() => ({
    stats: {},
    ratingDistribution: [],
    top12ByRating: [],
  })),
}))

vi.mock('../../utils/tmdbProxyClient', () => ({
  runStagedAnalysis: vi.fn(),
  enrichFilmsPhase1Only: vi.fn(),
}))

vi.mock('../../utils/indexedDbCache', () => ({
  clearResumeState: vi.fn(async () => undefined),
  setLastReport: vi.fn(async () => undefined),
}))

vi.mock('../../utils/app/yearUtils', () => ({
  extractYears: vi.fn(() => [2024]),
}))

vi.mock('../../utils/app/mobileRules', () => ({
  shouldForceSimplifiedMobileMode: vi.fn(() => false),
}))

const parsedRows: FilmRow[] = [
  {
    title: 'Movie',
    year: 2024,
    rating: 4,
    date: '2024-01-01',
  },
]

const analyzedFilms: Film[] = [
  {
    title: 'Movie',
    year: 2024,
    rating: 4,
    date: '2024-01-01',
    tmdb_id: 123,
    poster_path: null,
    poster_url: null,
    poster_url_w342: null,
    tmdb_vote_average: 7.2,
    tmdb_vote_count: 10,
    tmdb_stars: 4,
    genres: [],
    keywords: [],
    directors: [],
    actors: [],
    countries: [],
    runtime: null,
    original_language: 'en',
  },
]

class MockWorker {
  private _onmessage: ((event: MessageEvent) => void) | null = null
  onerror: ((event: Event) => void) | null = null

  set onmessage(handler: ((event: MessageEvent) => void) | null) {
    this._onmessage = handler
    if (!handler) return
    queueMicrotask(() => {
      this._onmessage?.({
        data: {
          type: 'rows',
          rows: parsedRows,
        },
      } as MessageEvent)
    })
  }

  get onmessage() {
    return this._onmessage
  }

  postMessage() {
    return undefined
  }

  terminate() {
    return undefined
  }
}

describe('useCsvAnalysisFlow smoke', () => {
  beforeEach(() => {
    useAnalysisStore.getState().resetForTests()
    vi.restoreAllMocks()
    vi.stubGlobal('Worker', MockWorker)
  })

  it('completes a valid ratings.csv upload flow', async () => {
    vi.mocked(runStagedAnalysis).mockResolvedValue(analyzedFilms)
    const persistResume = vi.fn()
    const onReportSaved = vi.fn()
    const { result } = renderHook(() => useCsvAnalysisFlow({ persistResume, onReportSaved }))

    const file = {
      name: 'ratings.csv',
      text: vi.fn(async () => 'header'),
    } as unknown as File
    await act(async () => {
      await result.current.runAnalysis(file, false, false)
    })

    const state = useAnalysisStore.getState()
    expect(state.analysis?.filmsLite).toHaveLength(1)
    expect(state.lastUploadedFileName).toBe('ratings.csv')
    expect(state.loading).toBe(false)
    expect(state.error).toBe('')
    expect(onReportSaved).toHaveBeenCalledTimes(1)
    expect(setLastReport).toHaveBeenCalledTimes(1)
  })

  it('shows abort message when analysis is cancelled in progress', async () => {
    vi.mocked(runStagedAnalysis).mockImplementation(
      async (_rows, options?: { signal?: AbortSignal }) =>
        await new Promise<Film[]>((resolve, reject) => {
          void resolve
          const abortError = new Error('aborted')
          abortError.name = 'AbortError'
          if (options?.signal?.aborted) {
            reject(abortError)
            return
          }
          options?.signal?.addEventListener('abort', () => reject(abortError), { once: true })
        }),
    )

    const { result } = renderHook(() => useCsvAnalysisFlow({ persistResume: vi.fn(), onReportSaved: vi.fn() }))
    const file = {
      name: 'ratings.csv',
      text: vi.fn(async () => 'header'),
    } as unknown as File

    const runPromise = result.current.runAnalysis(file, false, false)
    act(() => {
      result.current.cancelAnalysis()
    })

    await act(async () => {
      await runPromise
    })

    const state = useAnalysisStore.getState()
    expect(state.loading).toBe(false)
    expect(state.progress).toBeNull()
    expect(state.error).toMatch(/остановлен/i)
    expect(clearResumeState).toHaveBeenCalled()
  })
})
