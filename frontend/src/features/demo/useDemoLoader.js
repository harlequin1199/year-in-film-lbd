import { useCallback, useState } from 'react'
import { loadMock } from '../../mocks/index.js'
import { setLastReport } from '../../utils/indexedDbCache.js'
import { extractYears } from '../../utils/app/yearUtils.js'
import { buildDemoReportStages, buildDemoStages, playStageProgress } from '../../utils/app/stageUtils.js'

export function useDemoLoader({ abortControllerRef, setAnalysis, setError, setLoading, setProgress, setSimplifiedMode, setLastUploadedFileName, setLastReportAvailable, runAnalysis }) {
  const [demoMockId, setDemoMockId] = useState('mock_ratings_only')

  const handleLoadDemo = useCallback(async () => {
    setError('')
    setLoading(true)
    setAnalysis(null)
    setSimplifiedMode(false)
    abortControllerRef.current = new AbortController()

    try {
      const { data, error: mockError } = await loadMock(demoMockId)
      if (abortControllerRef.current?.signal.aborted) return
      if (mockError) {
        setError(mockError)
        return
      }
      const filmsCount = data?.filmsLite?.length || data?.filmsLiteAll?.length || 0
      const complete = await playStageProgress(buildDemoStages(filmsCount), setProgress, () => abortControllerRef.current?.signal.aborted)
      if (!complete || abortControllerRef.current?.signal.aborted) return
      setProgress({ stage: 'finalizing', message: 'Готово', total: filmsCount, done: filmsCount, percent: 100 })
      await new Promise((resolve) => setTimeout(resolve, 200))
      setAnalysis(data)
      setLastUploadedFileName('demo fixture (local)')
    } catch (err) {
      setError(err.message || 'Не удалось загрузить demo fixture')
    } finally {
      setLoading(false)
      setProgress(null)
      abortControllerRef.current = null
    }
  }, [abortControllerRef, demoMockId, setAnalysis, setError, setLastUploadedFileName, setLoading, setProgress, setSimplifiedMode])

  const handleLoadDemoCSV = useCallback(async () => {
    setError('')
    setLoading(true)
    setAnalysis(null)
    setSimplifiedMode(false)
    abortControllerRef.current = new AbortController()

    try {
      const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
      const API_BASE = envApiUrl || 'http://localhost:8000'
      const response = await fetch(`${API_BASE}/api/demo-csv`)
      if (!response.ok) throw new Error(`Ошибка загрузки CSV: ${response.statusText}`)
      const blob = await response.blob()
      const csvFile = new File([blob], 'demo_ratings_1000.csv', { type: 'text/csv' })
      await runAnalysis(csvFile, false)
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err.message || 'Не удалось запустить демо через CSV (полный расчёт)')
    } finally {
      abortControllerRef.current = null
    }
  }, [abortControllerRef, runAnalysis, setAnalysis, setError, setLoading, setSimplifiedMode])

  const handleLoadDemoReport = useCallback(async () => {
    setError('')
    setLoading(true)
    setAnalysis(null)
    setSimplifiedMode(false)
    abortControllerRef.current = new AbortController()

    try {
      const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
      const API_BASE = envApiUrl || 'http://localhost:8000'
      const response = await fetch(`${API_BASE}/api/demo-report`)
      if (!response.ok) throw new Error(`Ошибка загрузки отчёта: ${response.statusText}`)
      const data = await response.json()
      if (abortControllerRef.current?.signal.aborted) return

      const filmsLite = Array.isArray(data?.filmsLite) ? data.filmsLite : (Array.isArray(data?.filmsLiteAll) ? data.filmsLiteAll : [])
      const filmsLiteAll = Array.isArray(data?.filmsLiteAll) ? data.filmsLiteAll : (Array.isArray(data?.filmsLite) ? data.filmsLite : [])
      let availableYears = Array.isArray(data?.availableYears) ? data.availableYears : []
      if (!availableYears.length) {
        availableYears = extractYears(filmsLiteAll.length ? filmsLiteAll : filmsLite)
      }
      const normalizedData = {
        filmsLite,
        filmsLiteAll,
        availableYears,
        simplifiedMode: data?.simplifiedMode || false,
        fileName: data?.fileName || 'demo report asset (готовый)',
        warnings: Array.isArray(data?.warnings) ? data.warnings : [],
        ...(data?.stage1 ? { stage1: data.stage1 } : {}),
      }

      const filmsCount = normalizedData.filmsLite?.length || normalizedData.filmsLiteAll?.length || 0
      const complete = await playStageProgress(buildDemoReportStages(filmsCount), setProgress, () => abortControllerRef.current?.signal.aborted)
      if (!complete || abortControllerRef.current?.signal.aborted) return

      setProgress({ stage: 'finalizing', message: 'Готово', total: filmsCount, done: filmsCount, percent: 100 })
      await new Promise((resolve) => setTimeout(resolve, 200))
      setAnalysis(normalizedData)
      setLastUploadedFileName('demo report asset (готовый)')
      await setLastReport(normalizedData)
      setLastReportAvailable(true)
    } catch (err) {
      if (err?.name !== 'AbortError') setError(err.message || 'Не удалось открыть demo report asset (мгновенный режим)')
    } finally {
      setLoading(false)
      setProgress(null)
      abortControllerRef.current = null
    }
  }, [abortControllerRef, setAnalysis, setError, setLastReportAvailable, setLastUploadedFileName, setLoading, setProgress, setSimplifiedMode])

  return { demoMockId, setDemoMockId, handleLoadDemo, handleLoadDemoCSV, handleLoadDemoReport }
}
