import { useCallback, useRef, useState } from 'react'
import { computeStage1FromRows } from '../../utils/analyticsClient.js'
import { enrichFilmsPhase1Only, runStagedAnalysis } from '../../utils/tmdbProxyClient.js'
import { clearResumeState, setLastReport } from '../../utils/indexedDbCache.js'
import { extractYears } from '../../utils/app/yearUtils.js'
import { shouldForceSimplifiedMobileMode } from '../../utils/app/mobileRules.js'

export function useCsvAnalysisFlow({ persistResume, onReportSaved }) {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)
  const [retryMessage, setRetryMessage] = useState('')
  const [lastUploadedFileName, setLastUploadedFileName] = useState('')
  const [simplifiedMode, setSimplifiedMode] = useState(false)
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)

  const abortControllerRef = useRef(null)
  const progressRef = useRef(null)
  const persistIntervalRef = useRef(null)

  const clearTimers = useCallback(() => {
    if (persistIntervalRef.current) {
      clearInterval(persistIntervalRef.current)
      persistIntervalRef.current = null
    }
  }, [])

  const runAnalysisFromRows = useCallback(async (parsedRows, simplified = false, signal = null, fileName = '') => {
    const opts = {
      signal: signal || abortControllerRef.current?.signal,
      onRetryMessage: (msg) => setRetryMessage(msg || ''),
    }

    setProgress({ stage: 'stage1', message: 'Базовая статистика', total: 1, done: 1, percent: 8 })
    const stage1 = computeStage1FromRows(parsedRows)
    setAnalysis({ stage1, filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: simplified, fileName, warnings: [] })

    if (simplified) {
      const films = await enrichFilmsPhase1Only(parsedRows, (p) => {
        progressRef.current = p
        setProgress(p)
      }, opts)
      const availableYears = extractYears(films)
      const result = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: true, fileName }
      setAnalysis((prev) => ({ ...prev, ...result, stage1: undefined }))
      setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
      await setLastReport(result)
      onReportSaved()
      await clearResumeState()
      return
    }

    setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: parsedRows.length, done: 0, percent: 8 })
    const films = await runStagedAnalysis(parsedRows, {
      ...opts,
      onProgress: (p) => {
        progressRef.current = p
        setProgress(p)
      },
      onPartialResult: (partial) => {
        if (!partial.films) return
        const years = extractYears(partial.films)
        setAnalysis((prev) => ({
          ...prev,
          filmsLite: partial.films,
          filmsLiteAll: partial.films,
          ...(partial.stage >= 3 ? { stage1: undefined } : {}),
          availableYears: years,
          warnings: partial.warnings || prev.warnings,
        }))
      },
    })

    if (!Array.isArray(films)) throw new Error(`runStagedAnalysis вернул неверный результат: ${typeof films}`)

    const availableYears = extractYears(films)
    const result = { filmsLite: films, filmsLiteAll: films, availableYears, simplifiedMode: false, fileName, warnings: [] }
    setProgress({ stage: 'finalizing', message: 'Финализация отчёта', total: films.length, done: films.length, percent: 95 })
    setAnalysis(result)
    setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
    await setLastReport(result)
    onReportSaved()
    await clearResumeState()
  }, [onReportSaved])

  const runAnalysis = useCallback(async (ratingsFile, simplified = false, isMobile = false) => {
    setError('')
    setRetryMessage('')
    setLoading(true)
    setAnalysis(null)
    setProgress({ stage: 'parsing', message: 'Чтение CSV', total: 1, done: 0, percent: 0 })
    setLastUploadedFileName(ratingsFile?.name || '')
    abortControllerRef.current = new AbortController()
    const fileName = ratingsFile?.name || ''

    try {
      const ratingsText = await ratingsFile.text()
      const parsedRows = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('../../workers/csvParse.worker.js', import.meta.url), { type: 'module' })
        worker.postMessage({ type: 'parse', ratingsText })
        worker.onmessage = (ev) => {
          if (ev.data.type === 'progress') setProgress(ev.data)
          if (ev.data.type === 'rows') {
            worker.terminate()
            resolve(ev.data.rows)
          }
          if (ev.data.type === 'error') {
            worker.terminate()
            reject(new Error(ev.data.message))
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

      persistIntervalRef.current = setInterval(() => {
        const p = progressRef.current
        if (p && p.stage && p.stage !== 'parsing') {
          persistResume({ runId: `${Date.now()}`, fileName, rowCount: parsedRows.length, stage: p.stage, done: p.done ?? 0, total: p.total ?? 0, updatedAt: Date.now() })
        }
      }, 3000)

      await runAnalysisFromRows(parsedRows, simplified, abortControllerRef.current.signal, fileName)
      if (simplified) setSimplifiedMode(true)
    } catch (err) {
      setAnalysis(null)
      if (err?.name === 'AbortError') {
        setError('Анализ остановлен.')
        clearResumeState().catch(() => {})
      } else {
        setError(err.message || 'Произошла ошибка')
      }
    } finally {
      clearTimers()
      setLoading(false)
      setProgress(null)
      setRetryMessage('')
      abortControllerRef.current = null
    }
  }, [clearTimers, persistResume, runAnalysisFromRows])

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
