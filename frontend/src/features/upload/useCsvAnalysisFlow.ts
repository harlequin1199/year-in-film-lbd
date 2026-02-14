import { useCallback, useRef, useState } from 'react'
import { computeStage1FromRows } from '../../utils/analyticsClient'
import { enrichFilmsPhase1Only, runStagedAnalysis } from '../../utils/tmdbProxyClient'
import { clearResumeState } from '../../utils/indexedDbCache'
import { extractYears } from '../../utils/app/yearUtils'
import { shouldForceSimplifiedMobileMode } from '../../utils/app/mobileRules'
import type { Analysis, Progress, FilmRow, Film, ResumeState } from '../../types'
import { useAnalysisStore } from '../../store/analysisStore'
import { finalizeAnalysisEffects } from './analysisEffects'

interface UseCsvAnalysisFlowProps {
  persistResume: (state: ResumeState & { timestamp: number }) => void
  onReportSaved: () => void
}

interface PendingFiles {
  parsedRows: FilmRow[]
}

export function useCsvAnalysisFlow({ persistResume, onReportSaved }: UseCsvAnalysisFlowProps) {
  const [simplifiedMode, setSimplifiedMode] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFiles | null>(null)
  const analysis = useAnalysisStore((s) => s.analysis)
  const loading = useAnalysisStore((s) => s.loading)
  const error = useAnalysisStore((s) => s.error)
  const progress = useAnalysisStore((s) => s.progress)
  const retryMessage = useAnalysisStore((s) => s.retryMessage)
  const lastUploadedFileName = useAnalysisStore((s) => s.lastUploadedFileName)

  const abortControllerRef = useRef<AbortController | null>(null)
  const progressRef = useRef<Progress | null>(null)
  const persistIntervalRef = useRef<number | null>(null)

  const clearTimers = useCallback(() => {
    if (persistIntervalRef.current !== null) {
      clearInterval(persistIntervalRef.current)
      persistIntervalRef.current = null
    }
  }, [])

  const setAnalysisState = useCallback((next: Analysis | null | ((prev: Analysis | null) => Analysis | null)) => {
    useAnalysisStore.setState((state) => ({
      analysis: typeof next === 'function'
        ? (next as (prev: Analysis | null) => Analysis | null)(state.analysis)
        : next,
    }))
  }, [])

  const setLoadingState = useCallback((next: boolean) => {
    useAnalysisStore.setState({ loading: next })
  }, [])

  const setErrorState = useCallback((next: string) => {
    useAnalysisStore.setState({ error: next })
  }, [])

  const setProgressState = useCallback((next: Progress | null) => {
    useAnalysisStore.setState({ progress: next })
  }, [])

  const setRetryMessageState = useCallback((next: string) => {
    useAnalysisStore.setState({ retryMessage: next })
  }, [])

  const setLastUploadedFileNameState = useCallback((next: string) => {
    useAnalysisStore.setState({ lastUploadedFileName: next })
  }, [])

  const runAnalysisFromRows = useCallback(async (
    parsedRows: FilmRow[],
    simplified = false,
    signal: AbortSignal | null = null,
    fileName = ''
  ) => {
    const { setProgress: dispatchProgress, completeRun } = useAnalysisStore.getState()

    const opts = {
      signal: signal || abortControllerRef.current?.signal || undefined,
      onRetryMessage: (msg: string) => setRetryMessageState(msg || ''),
    }

    const stage1Progress: Progress = { stage: 'stage1', message: 'Базовая статистика', total: 1, done: 1, percent: 8 }
    setProgressState(stage1Progress)
    dispatchProgress(stage1Progress)

    const stage1 = computeStage1FromRows(parsedRows)
    setAnalysisState({ stage1, filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: simplified, fileName, warnings: [] })

    if (simplified) {
      const films = await enrichFilmsPhase1Only(parsedRows, (p: Progress) => {
        progressRef.current = p
        setProgressState(p)
        dispatchProgress(p)
      }, opts)

      const availableYears = extractYears(films)
      const result: Analysis = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: true, fileName, warnings: [] }
      setAnalysisState((prev) => ({ ...prev, ...result, stage1: undefined }))
      completeRun(result)

      const doneProgress: Progress = { stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 }
      setProgressState(doneProgress)
      dispatchProgress(doneProgress)
      await finalizeAnalysisEffects(result, onReportSaved)
      return
    }

    const searchProgress: Progress = { stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: parsedRows.length, done: 0, percent: 8 }
    setProgressState(searchProgress)
    dispatchProgress(searchProgress)

    const films = await runStagedAnalysis(parsedRows, {
      ...opts,
      onProgress: (p: Progress) => {
        progressRef.current = p
        setProgressState(p)
        dispatchProgress(p)
      },
      onPartialResult: (partial: { films?: Film[]; stage?: number; warnings?: string[] }) => {
        if (!partial.films) return
        const years = extractYears(partial.films)
        setAnalysisState((prev) => ({
          ...prev!,
          filmsLite: partial.films!,
          filmsLiteAll: partial.films!,
          ...(partial.stage && partial.stage >= 3 ? { stage1: undefined } : {}),
          availableYears: years,
          warnings: partial.warnings || prev?.warnings || [],
        }))
      },
    })

    if (!Array.isArray(films)) throw new Error(`runStagedAnalysis вернул неверный результат: ${typeof films}`)

    const availableYears = extractYears(films)
    const result: Analysis = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: false, fileName, warnings: [] }

    const finalizeProgress: Progress = { stage: 'finalizing', message: 'Финализация отчета', total: films.length, done: films.length, percent: 95 }
    setProgressState(finalizeProgress)
    dispatchProgress(finalizeProgress)

    setAnalysisState(result)
    completeRun(result)

    const doneProgress: Progress = { stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 }
    setProgressState(doneProgress)
    dispatchProgress(doneProgress)

    await finalizeAnalysisEffects(result, onReportSaved)
  }, [onReportSaved, setAnalysisState, setProgressState, setRetryMessageState])

  const runAnalysis = useCallback(async (ratingsFile: File, simplified = false, isMobile = false) => {
    const { startRun, setProgress: dispatchProgress, failRun, abortRun, cleanupRun } = useAnalysisStore.getState()

    setErrorState('')
    setRetryMessageState('')

    const fileName = ratingsFile?.name || ''
    startRun(fileName)

    setLoadingState(true)
    setAnalysisState(null)

    const parsingProgress: Progress = { stage: 'parsing', message: 'Чтение CSV', total: 1, done: 0, percent: 0 }
    setProgressState(parsingProgress)
    dispatchProgress(parsingProgress)

    setLastUploadedFileNameState(fileName)
    abortControllerRef.current = new AbortController()

    try {
      const ratingsText = await ratingsFile.text()
      const parsedRows = await new Promise<FilmRow[]>((resolve, reject) => {
        const worker = new Worker(new URL('../../workers/csvParse.worker.ts', import.meta.url), { type: 'module' })
        worker.postMessage({ type: 'parse', ratingsText })
        worker.onmessage = (ev: MessageEvent<{ type: string; rows?: FilmRow[]; message?: string } | Progress>) => {
          const data = ev.data as { type?: string; rows?: FilmRow[]; message?: string } | Progress
          if ('type' in data && data.type === 'progress') {
            const p = data as Progress
            setProgressState(p)
            dispatchProgress(p)
          }
          if ('type' in data && data.type === 'rows') {
            worker.terminate()
            resolve((data as { rows: FilmRow[] }).rows)
          }
          if ('type' in data && data.type === 'error') {
            worker.terminate()
            reject(new Error((data as { message: string }).message))
          }
        }
        worker.onerror = () => reject(new Error('Ошибка парсинга CSV'))
      })

      if (!parsedRows?.length) {
        setErrorState('В CSV нет записей о фильмах')
        setLoadingState(false)
        setProgressState(null)
        cleanupRun()
        return
      }

      if (shouldForceSimplifiedMobileMode({ isMobile, rowsCount: parsedRows.length, simplified })) {
        setPendingFiles({ parsedRows })
        setShowMobileModal(true)
        setLoadingState(false)
        setProgressState(null)
        cleanupRun()
        return
      }

      persistIntervalRef.current = window.setInterval(() => {
        const p = progressRef.current
        if (p && p.stage && p.stage !== 'parsing') {
          persistResume({ runId: `${Date.now()}`, fileName, rowCount: parsedRows.length, stage: p.stage, done: p.done ?? 0, total: p.total ?? 0, timestamp: Date.now() })
        }
      }, 3000)

      await runAnalysisFromRows(parsedRows, simplified, abortControllerRef.current.signal, fileName)
      if (simplified) setSimplifiedMode(true)
    } catch (err) {
      setAnalysisState(null)
      const caught = err as Error & { name?: string }
      if (caught?.name === 'AbortError') {
        setErrorState('Анализ остановлен.')
        abortRun()
        clearResumeState().catch(() => {})
      } else {
        setErrorState(caught.message || 'Произошла ошибка')
        failRun(caught.message || 'Произошла ошибка')
      }
    } finally {
      clearTimers()
      setLoadingState(false)
      setProgressState(null)
      setRetryMessageState('')
      cleanupRun()
      abortControllerRef.current = null
    }
  }, [clearTimers, persistResume, runAnalysisFromRows, setAnalysisState, setErrorState, setLoadingState, setProgressState, setRetryMessageState, setLastUploadedFileNameState])

  const cancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return {
    analysis,
    setAnalysis: setAnalysisState,
    loading,
    error,
    setError: setErrorState,
    progress,
    retryMessage,
    lastUploadedFileName,
    setLastUploadedFileName: setLastUploadedFileNameState,
    simplifiedMode,
    setSimplifiedMode,
    showMobileModal,
    setShowMobileModal,
    pendingFiles,
    setPendingFiles,
    runAnalysis,
    runAnalysisFromRows,
    cancelAnalysis,
    abortControllerRef,
    setLoading: setLoadingState,
    setProgress: setProgressState,
  }
}
