import { useEffect, useMemo, useRef, useState } from 'react'
import {
  computeAggregations,
  filterFilmsByYears,
  formatYearRange,
  getComputedFromStage1,
} from '../utils/analyticsClient'
import { clearCache, getLastReport } from '../utils/indexedDbCache'
import { MOCK_OPTIONS, USE_MOCKS } from '../mocks'
import { isMobileClient } from '../utils/app/mobileRules'
import AppView from './AppView'
import { useResumeState } from '../features/resume/useResumeState'
import { useCsvAnalysisFlow } from '../features/upload/useCsvAnalysisFlow'
import { useDemoLoader } from '../features/demo/useDemoLoader'
import { useAnalysisStore } from '../store/analysisStore'
<<<<<<< HEAD
=======
import { selectAnalysisSummary, selectProgressView } from '../store/analysisSelectors'
>>>>>>> cbb9284 (refactor(frontend): migrate app read path to analysis store)

const SHOW_MOCK_UI = import.meta.env.DEV && USE_MOCKS

function AppContainer() {
  const [availableYears, setAvailableYears] = useState<number[]>([])
  const [selectedYears, setSelectedYears] = useState<number[]>([])
  const [cacheCleared, setCacheCleared] = useState(false)
  const [showDemoDropdown, setShowDemoDropdown] = useState(false)
  const demoDropdownRef = useRef<HTMLDivElement | null>(null)

  const {
    resumeState,
    showResumeModal,
    lastReportAvailable,
    setLastReportAvailable,
    updateResumeModalVisibility,
    clearResume,
    persistResume,
  } = useResumeState()

  const flow = useCsvAnalysisFlow({
    persistResume,
    onReportSaved: () => setLastReportAvailable(true),
  })

  const {
<<<<<<< HEAD
    setAnalysis,
    setError,
=======
    analysis: flowAnalysis,
    setAnalysis,
    loading: flowLoading,
    error: flowError,
    setError,
    progress: flowProgress,
    retryMessage,
    lastUploadedFileName,
>>>>>>> cbb9284 (refactor(frontend): migrate app read path to analysis store)
    setLastUploadedFileName,
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
  } = flow
  const { loading, error, progress, analysis, retryMessage, lastUploadedFileName } = useAnalysisStore((s) => ({
    loading: s.loading,
    error: s.error,
    progress: s.progress,
    analysis: s.analysis,
    retryMessage: s.retryMessage,
    lastUploadedFileName: s.lastUploadedFileName,
  }))

  useEffect(() => {
<<<<<<< HEAD
    updateResumeModalVisibility()
=======
    useAnalysisStore.setState({
      analysis: flowAnalysis,
      loading: flowLoading,
      error: flowError,
      progress: flowProgress,
      retryMessage,
      lastUploadedFileName,
      simplifiedMode: flow.simplifiedMode,
    })
  }, [flowAnalysis, flowError, flowLoading, flowProgress, flow.simplifiedMode, lastUploadedFileName, retryMessage])

  const analysisSummary = useAnalysisStore(selectAnalysisSummary)
  const progressView = useAnalysisStore(selectProgressView)
  const analysis = useAnalysisStore((state) => state.analysis)
  const progress = useAnalysisStore((state) => state.progress)
  const hasProgress = progressView.hasProgress
  const loading = analysisSummary.loading
  const error = analysisSummary.error

  useEffect(() => {
    updateResumeModalVisibility(loading)
>>>>>>> cbb9284 (refactor(frontend): migrate app read path to analysis store)
  }, [loading, updateResumeModalVisibility])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (demoDropdownRef.current && !demoDropdownRef.current.contains(event.target as Node)) {
        setShowDemoDropdown(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && showDemoDropdown) setShowDemoDropdown(false)
    }
    if (!showDemoDropdown) return undefined
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [showDemoDropdown])

  useEffect(() => {
    if (!analysis) return
    const years = analysis.availableYears || []
    setAvailableYears(years)
    setSelectedYears(years.length === 1 && years[0] !== undefined ? [years[0]] : [])
  }, [analysis])

  const handleUpload = async (ratingsFile: File) => {
    if (!ratingsFile) return
    if (USE_MOCKS && !import.meta.env.DEV) {
      setError('В режиме демо используйте блок «Демо-отчёт» ниже.')
      return
    }
    await runAnalysis(ratingsFile, false, isMobileClient())
  }

  const handleMobileContinue = async () => {
    setShowMobileModal(false)
    if (!pendingFiles) return

    setError('')
    setLoading(true)
    setAnalysis(null)
    abortControllerRef.current = new AbortController()
    setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: pendingFiles.parsedRows.length, done: 0, percent: 2 })
    setLastUploadedFileName('')

    try {
      await runAnalysisFromRows(pendingFiles.parsedRows, true, abortControllerRef.current.signal, '')
    } catch (err) {
      const error = err as Error & { name?: string }
      if (error?.name !== 'AbortError') setError(error.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
      setProgress(null)
      abortControllerRef.current = null
      setPendingFiles(null)
    }
  }

  const handleOpenLastReport = async () => {
    try {
      const report = await getLastReport()
      if (!report) return
      setAnalysis(report)
      setLastUploadedFileName(report.fileName || 'последний отчёт')
    } catch {
      setError('Не удалось загрузить последний отчёт')
    }
  }

  const handleClearCache = async () => {
    try {
      await clearCache()
      setCacheCleared(true)
      setTimeout(() => setCacheCleared(false), 2000)
    } catch {
      setError('Не удалось очистить кеш')
    }
  }

  const filmsAll = useMemo(() => analysis?.filmsLiteAll || analysis?.filmsLite || [], [analysis])
  const filteredFilms = useMemo(() => selectedYears.length ? filterFilmsByYears(filmsAll, selectedYears) : filmsAll, [filmsAll, selectedYears])
  const computed = useMemo(() => {
    if (!analysis) return null
    if (analysis.stage1 && (!analysis.filmsLite || analysis.filmsLite.length === 0)) return getComputedFromStage1(analysis.stage1)
    return computeAggregations(filteredFilms)
  }, [analysis, filteredFilms])

  const posterSetIdsTop12 = useMemo(() => new Set<number>((computed?.topRatedFilms || []).slice(0, 12).map((f) => f.tmdb_id).filter((id): id is number => typeof id === 'number' && Boolean(id))), [computed?.topRatedFilms])
  const summaryText = formatYearRange(selectedYears, availableYears)

  const { demoMockId, setDemoMockId, handleLoadDemo, handleLoadDemoCSV, handleLoadDemoReport } = useDemoLoader({
    abortControllerRef,
    setAnalysis,
    setError,
    setLoading,
    setProgress,
    setSimplifiedMode: flow.setSimplifiedMode,
    setLastUploadedFileName,
    setLastReportAvailable,
    runAnalysis: (file: File, simplified: boolean) => runAnalysis(file, simplified, isMobileClient()),
  })

  return (
    <AppView
      isMobile={isMobileClient}
      demoDropdownRef={demoDropdownRef}
      showDemoDropdown={showDemoDropdown}
      setShowDemoDropdown={setShowDemoDropdown}
      loading={loading}
      analysis={analysis}
      computed={computed}
      availableYears={availableYears}
      selectedYears={selectedYears}
      handleToggleYear={(year) => setSelectedYears((prev) => {
        const exists = prev.includes(year)
        if (!exists && prev.length >= 10) return prev
        const next = exists ? prev.filter((item) => item !== year) : [...prev, year]
        return next.length === 0 ? [] : next
      })}
      handleResetYears={() => setSelectedYears([])}
      summaryText={summaryText}
      filteredFilms={filteredFilms}
      handleLoadDemoCSV={handleLoadDemoCSV}
      handleLoadDemoReport={handleLoadDemoReport}
      handleUpload={handleUpload}
      lastUploadedFileName={lastUploadedFileName}
      SHOW_MOCK_UI={SHOW_MOCK_UI}
      demoMockId={demoMockId || MOCK_OPTIONS[0]?.id || ''}
      setDemoMockId={setDemoMockId}
      MOCK_OPTIONS={MOCK_OPTIONS}
      handleLoadDemo={handleLoadDemo}
      handleClearCache={handleClearCache}
      cacheCleared={cacheCleared}
      lastReportAvailable={lastReportAvailable}
      handleOpenLastReport={handleOpenLastReport}
      showResumeModal={showResumeModal}
      resumeState={resumeState}
      handleResumeStartOver={clearResume}
      handleResumeContinue={clearResume}
      showMobileModal={showMobileModal}
      handleMobileCancel={() => { setShowMobileModal(false); setPendingFiles(null) }}
      handleMobileContinue={handleMobileContinue}
      progress={hasProgress ? progress : null}
      handleCancelAnalysis={cancelAnalysis}
      retryMessage={retryMessage}
      error={error}
      setError={setError}
      posterSetIdsTop12={posterSetIdsTop12}
      simplifiedEmpty={analysis?.simplifiedMode}
    />
  )
}

export default AppContainer
