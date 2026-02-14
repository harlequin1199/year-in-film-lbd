import { useCallback, useRef, useState, type SetStateAction } from 'react'
import { computeStage1FromRows } from '../../utils/analyticsClient'
import { enrichFilmsPhase1Only, runStagedAnalysis } from '../../utils/tmdbProxyClient'
import { clearResumeState, setLastReport } from '../../utils/indexedDbCache'
import { extractYears } from '../../utils/app/yearUtils'
import { shouldForceSimplifiedMobileMode } from '../../utils/app/mobileRules'
import type { Analysis, Progress, FilmRow, Film, ResumeState } from '../../types'
import { useAnalysisStore } from '../../store/analysisStore'

interface UseCsvAnalysisFlowProps {
  persistResume: (state: ResumeState & { timestamp: number }) => void
  onReportSaved: () => void
}

interface PendingFiles {
  parsedRows: FilmRow[]
}

export function useCsvAnalysisFlow({ persistResume, onReportSaved }: UseCsvAnalysisFlowProps) {
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState<PendingFiles | null>(null)

  const analysis = useAnalysisStore((state) => state.analysis)
  const loading = useAnalysisStore((state) => state.loading)
  const error = useAnalysisStore((state) => state.error)
  const progress = useAnalysisStore((state) => state.progress)
  const retryMessage = useAnalysisStore((state) => state.retryMessage)
  const lastUploadedFileName = useAnalysisStore((state) => state.lastUploadedFileName)
  const simplifiedMode = useAnalysisStore((state) => state.simplifiedMode)

  const startRun = useAnalysisStore((state) => state.startRun)
  const completeRun = useAnalysisStore((state) => state.completeRun)
  const failRun = useAnalysisStore((state) => state.failRun)
  const abortRun = useAnalysisStore((state) => state.abortRun)
  const cleanupRun = useAnalysisStore((state) => state.cleanupRun)

  const abortControllerRef = useRef<AbortController | null>(null)
  const progressRef = useRef<Progress | null>(null)
  const persistIntervalRef = useRef<number | null>(null)

  const setAnalysis = useCallback((value: SetStateAction<Analysis | null>) => {
    useAnalysisStore.setState((state) => ({
      analysis: typeof value === 'function' ? (value as (prev: Analysis | null) => Analysis | null)(state.analysis) : value,
    }))
  }, [])

  const setLoading = useCallback((value: boolean) => {
    useAnalysisStore.setState({ loading: value })
  }, [])

  const setError = useCallback((value: string) => {
    useAnalysisStore.setState({ error: value })
  }, [])

  const setProgress = useCallback((value: Progress | null) => {
    useAnalysisStore.setState({ progress: value })
  }, [])

  const setRetryMessage = useCallback((value: string) => {
    useAnalysisStore.setState({ retryMessage: value })
  }, [])

  const setLastUploadedFileName = useCallback((value: string) => {
    useAnalysisStore.setState({ lastUploadedFileName: value })
  }, [])

  const setSimplifiedMode = useCallback((value: boolean) => {
    useAnalysisStore.setState({ simplifiedMode: value })
  }, [])

  const clearTimers = useCallback(() => {
    if (persistIntervalRef.current !== null) {
      clearInterval(persistIntervalRef.current)
      persistIntervalRef.current = null
    }
  }, [])

  const runAnalysisFromRows = useCallback(async (
    parsedRows: FilmRow[],
    simplified = false,
    signal: AbortSignal | null = null,
    fileName = '',
  ) => {
    const opts = {
      signal: signal || abortControllerRef.current?.signal || undefined,
      onRetryMessage: (message: string) => setRetryMessage(message || ''),
    }

    setProgress({ stage: 'stage1', message: 'Базовая статистика', total: 1, done: 1, percent: 8 })
    const stage1 = computeStage1FromRows(parsedRows)
    setAnalysis({ stage1, filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: simplified, fileName, warnings: [] })

    if (simplified) {
      const films = await enrichFilmsPhase1Only(parsedRows, (nextProgress: Progress) => {
        progressRef.current = nextProgress
        setProgress(nextProgress)
      }, opts)

      const availableYears = extractYears(films)
      const result: Analysis = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: true, fileName, warnings: [] }
      setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
      completeRun(result)
      await setLastReport(result)
      onReportSaved()
      await clearResumeState()
      return
    }

    setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: parsedRows.length, done: 0, percent: 8 })
    const films = await runStagedAnalysis(parsedRows, {
      ...opts,
      onProgress: (nextProgress: Progress) => {
        progressRef.current = nextProgress
        setProgress(nextProgress)
      },
      onPartialResult: (partial: { films?: Film[]; stage?: number; warnings?: string[] }) => {
        if (!partial.films) return

        const years = extractYears(partial.films)
        setAnalysis((prev) => ({
          ...prev!,
          filmsLite: partial.films!,
          filmsLiteAll: partial.films!,
          ...(partial.stage && partial.stage >= 3 ? { stage1: undefined } : {}),
          availableYears: years,
          warnings: partial.warnings || prev?.warnings || [],
        }))
      },
    })

    if (!Array.isArray(films)) {
      throw new Error(`runStagedAnalysis вернул неверный результат: ${typeof films}`)
    }

    const availableYears = extractYears(films)
    const result: Analysis = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: false, fileName, warnings: [] }
    setProgress({ stage: 'finalizing', message: 'Финализация отчёта', total: films.length, done: films.length, percent: 95 })
    completeRun(result)
    setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
    await setLastReport(result)
    onReportSaved()
    await clearResumeState()
  }, [completeRun, onReportSaved, setAnalysis, setProgress, setRetryMessage])

  const runAnalysis = useCallback(async (ratingsFile: File, simplified = false, isMobile = false) => {
    const fileName = ratingsFile?.name || ''
    setRetryMessage('')
    startRun(fileName)
    setProgress({ stage: 'parsing', message: 'Чтение CSV', total: 1, done: 0, percent: 0 })
    abortControllerRef.current = new AbortController()

    try {
      const ratingsText = await ratingsFile.text()
      const parsedRows = await new Promise<FilmRow[]>((resolve, reject) => {
        const worker = new Worker(new URL('../../workers/csvParse.worker.ts', import.meta.url), { type: 'module' })
        worker.postMessage({ type: 'parse', ratingsText })
        worker.onmessage = (event: MessageEvent<{ type: string; rows?: FilmRow[]; message?: string } | Progress>) => {
          const data = event.data as { type?: string; rows?: FilmRow[]; message?: string } | Progress
          if ('type' in data && data.type === 'progress') setProgress(data as Progress)
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
        setError('В CSV нет записей о фильмах')
        setLoading(false)
        setProgress(null)
        return
      }

      if (shouldForceSimplifiedMobileMode({ isMobile, rowsCount: parsedRows.length, simplified })) {
        setPendingFiles({ parsedRows })
        setShowMobileModal(true)
        setLoading(false)
        setProgress(null)
        return
      }

      persistIntervalRef.current = window.setInterval(() => {
        const currentProgress = progressRef.current
        if (currentProgress && currentProgress.stage && currentProgress.stage !== 'parsing') {
          persistResume({
            runId: `${Date.now()}`,
            fileName,
            rowCount: parsedRows.length,
            stage: currentProgress.stage,
            done: currentProgress.done ?? 0,
            total: currentProgress.total ?? 0,
            timestamp: Date.now(),
          })
        }
      }, 3000)

      await runAnalysisFromRows(parsedRows, simplified, abortControllerRef.current.signal, fileName)
      if (simplified) setSimplifiedMode(true)
    } catch (cause) {
      const nextError = cause as Error & { name?: string }
      if (nextError?.name === 'AbortError') {
        abortRun()
        clearResumeState().catch(() => undefined)
      } else {
        failRun(nextError.message || 'Произошла ошибка')
      }
    } finally {
      clearTimers()
      cleanupRun()
      abortControllerRef.current = null
    }
  }, [abortRun, cleanupRun, clearTimers, failRun, persistResume, runAnalysisFromRows, setError, setLoading, setProgress, setRetryMessage, setSimplifiedMode, startRun])

  const cancelAnalysis = useCallback(() => {
    abortControllerRef.current?.abort()
  }, [])

  return {
    analysis,
    setAnalysis,
    loading,
    error,
    setError,
    progress,
    retryMessage,
    lastUploadedFileName,
    setLastUploadedFileName,
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
    setLoading,
    setProgress,
  }
}
