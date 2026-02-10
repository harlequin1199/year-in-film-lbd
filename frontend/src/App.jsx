import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react'
import UploadZone from './components/UploadZone.jsx'
import StatsCards from './components/StatsCards.jsx'
import GenresSection from './components/GenresSection.jsx'
import HiddenGemsSection from './components/HiddenGemsSection.jsx'
import TagsTable from './components/TagsTable.jsx'
import FilmsGrid from './components/FilmsGrid.jsx'
import ProgressStatus from './components/ProgressStatus.jsx'
import WatchTimeCard from './components/WatchTimeCard.jsx'
import LanguagesSection from './components/LanguagesSection.jsx'
import ToggleRankedList from './components/ToggleRankedList.jsx'
import BadgesSection from './components/BadgesSection.jsx'
import ListsProgressSection from './components/ListsProgressSection.jsx'
import YearFilter from './components/YearFilter.jsx'
import { formatNumber, formatRating } from './utils/format.js'
import {
  computeAggregations,
  computeStage1FromRows,
  getComputedFromStage1,
  filterFilmsByYears,
  formatYearRange,
  getYearRangeLabel,
} from './utils/analyticsClient.js'
import { enrichFilmsPhase1Only, runStagedAnalysis } from './utils/tmdbProxyClient.js'
import { clearCache, clearResumeState, getResumeState, getLastReport, setLastReport, setResumeState as persistResumeState } from './utils/indexedDbCache.js'
import { getCountryNameRu } from './utils/countriesRu.js'
import { USE_MOCKS, MOCK_OPTIONS, loadMock } from './mocks/index.js'

const LazyChartsSection = lazy(() => import('./components/LazyChartsSection.jsx'))
const LazyFavoriteDecades = lazy(() => import('./components/FavoriteDecades.jsx'))

const SHOW_MOCK_UI = import.meta.env.DEV && USE_MOCKS
const MOBILE_WIDTH = 600
function isMobile() {
  if (typeof window === 'undefined') return false
  return window.innerWidth < MOBILE_WIDTH || /mobile|android|iphone|ipad/i.test(navigator.userAgent)
}

const BIG_FILE_MOBILE_THRESHOLD = 2000
const RESUME_PERSIST_INTERVAL_MS = 3000

function App() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)
  const [availableYears, setAvailableYears] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const [lastUploadedFileName, setLastUploadedFileName] = useState('')
  const [demoMockId, setDemoMockId] = useState(MOCK_OPTIONS[0]?.id || 'mock_ratings_only')
  const [showMobileModal, setShowMobileModal] = useState(false)
  const [pendingFiles, setPendingFiles] = useState(null)
  const [simplifiedMode, setSimplifiedMode] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)
  const [retryMessage, setRetryMessage] = useState('')
  const [resumeState, setResumeState] = useState(null)
  const [showResumeModal, setShowResumeModal] = useState(false)
  const [lastReportAvailable, setLastReportAvailable] = useState(false)

  const abortControllerRef = useRef(null)
  const progressRef = useRef(null)
  const persistIntervalRef = useRef(null)

  useEffect(() => {
    getResumeState().then((s) => {
      if (s && s.stage && s.updatedAt) setResumeState(s)
    })
    getLastReport().then((r) => setLastReportAvailable(!!r))
  }, [])

  useEffect(() => {
    if (resumeState && !loading) setShowResumeModal(true)
  }, [resumeState, loading])

  const extractYears = (films) => [...new Set(films.map((f) => {
    const d = f.date
    if (!d) return null
    const y = typeof d === 'string' ? d.slice(0, 4) : d.getFullYear?.()
    return y ? parseInt(y, 10) : null
  }).filter(Boolean))].sort((a, b) => a - b)

  const runAnalysisFromRows = async (parsedRows, simplified = false, signal = null, fileName = '') => {
    try {
      const opts = {
        signal: signal || abortControllerRef.current?.signal,
        onRetryMessage: (msg) => setRetryMessage(msg || ''),
      }

      setProgress({ stage: 'stage1', message: 'Базовая статистика', total: 1, done: 1, percent: 8 })
      const stage1 = computeStage1FromRows(parsedRows)
      setAnalysis({
        stage1,
        filmsLite: [],
        filmsLiteAll: [],
        availableYears: [],
        simplifiedMode: simplified,
        fileName,
        warnings: [],
      })

      if (simplified) {
        const films = await enrichFilmsPhase1Only(parsedRows, (p) => { progressRef.current = p; setProgress(p) }, opts)
        const availableYearsFromFilms = extractYears(films)
        setAnalysis((prev) => ({
          ...prev,
          filmsLite: films,
          filmsLiteAll: films,
          stage1: undefined,
          availableYears: availableYearsFromFilms,
        }))
        setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
        await setLastReport({ filmsLite: films, filmsLiteAll: films, availableYears: availableYearsFromFilms, simplifiedMode: true, fileName })
        setLastReportAvailable(true)
        await clearResumeState()
        return
      }

      setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: parsedRows.length, done: 0, percent: 8 })
      const films = await runStagedAnalysis(parsedRows, {
        ...opts,
        onProgress: (p) => { progressRef.current = p; setProgress(p) },
        onPartialResult: (partial) => {
          if (partial.films) {
            const years = extractYears(partial.films)
            setAnalysis((prev) => ({
              ...prev,
              filmsLite: partial.films,
              filmsLiteAll: partial.films,
              ...(partial.stage >= 3 ? { stage1: undefined } : {}),
              availableYears: years,
              warnings: partial.warnings || prev.warnings,
            }))
          }
        },
      })

      setProgress({ stage: 'finalizing', message: 'Финализация отчёта', total: films.length, done: films.length, percent: 95 })
      const availableYearsFromFilms = extractYears(films)
      const result = {
        filmsLite: films,
        filmsLiteAll: films,
        availableYears: availableYearsFromFilms,
        simplifiedMode: false,
        fileName,
        warnings: [],
      }
      setAnalysis(result)
      setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
      await setLastReport(result)
      setLastReportAvailable(true)
      await clearResumeState()
    } catch (err) {
      setAnalysis(null)
      throw err
    }
  }

  const runAnalysis = async (ratingsFile, simplified = false) => {
    setError('')
    setRetryMessage('')
    setLoading(true)
    setAnalysis(null)
    setProgress({ stage: 'parsing', message: 'Чтение CSV', total: 1, done: 0, percent: 0 })
    setLastUploadedFileName(ratingsFile?.name || '')
    abortControllerRef.current = new AbortController()
    const fileName = ratingsFile?.name || ''

    const clearTimers = () => {
      if (persistIntervalRef.current) {
        clearInterval(persistIntervalRef.current)
        persistIntervalRef.current = null
      }
    }

    try {
      const ratingsText = await ratingsFile.text()

      const parsedRows = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/csvParse.worker.js', import.meta.url), { type: 'module' })
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

      if (!parsedRows || parsedRows.length === 0) {
        setError('В CSV нет записей о фильмах')
        setLoading(false)
        setProgress(null)
        return
      }

      const mobile = isMobile()
      if (mobile && parsedRows.length > BIG_FILE_MOBILE_THRESHOLD && !simplified) {
        setPendingFiles({ parsedRows })
        setShowMobileModal(true)
        setLoading(false)
        setProgress(null)
        return
      }

      const rowCount = parsedRows.length
      persistIntervalRef.current = setInterval(() => {
        const p = progressRef.current
        if (p && p.stage && p.stage !== 'parsing') {
          persistResumeState({
            runId: `${Date.now()}`,
            fileName,
            rowCount,
            stage: p.stage,
            done: p.done ?? 0,
            total: p.total ?? 0,
            updatedAt: Date.now(),
          }).catch(() => {})
        }
      }, RESUME_PERSIST_INTERVAL_MS)

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
  }

  const handleCancelAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
    }
  }

  const handleUpload = async (ratingsFile) => {
    if (!ratingsFile) return
    if (USE_MOCKS) {
      setError('В режиме демо используйте блок «Демо-отчёт» ниже.')
      return
    }
    await runAnalysis(ratingsFile, false)
  }

  const handleMobileContinue = async () => {
    setShowMobileModal(false)
    if (pendingFiles) {
      setError('')
      setLoading(true)
      setAnalysis(null)
      abortControllerRef.current = new AbortController()
      setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: pendingFiles.parsedRows.length, done: 0, percent: 2 })
      setLastUploadedFileName('')
      try {
        await runAnalysisFromRows(pendingFiles.parsedRows, true, abortControllerRef.current.signal, '')
        setSimplifiedMode(true)
      } catch (err) {
        setAnalysis(null)
        if (err?.name !== 'AbortError') setError(err.message || 'Произошла ошибка')
      } finally {
        setLoading(false)
        setProgress(null)
        abortControllerRef.current = null
      }
      setPendingFiles(null)
    }
  }

  const handleMobileCancel = () => {
    setShowMobileModal(false)
    setPendingFiles(null)
  }

  const handleResumeContinue = async () => {
    setShowResumeModal(false)
    setResumeState(null)
    await clearResumeState().catch(() => {})
  }

  const handleResumeStartOver = async () => {
    setShowResumeModal(false)
    setResumeState(null)
    await clearResumeState().catch(() => {})
  }

  const handleOpenLastReport = async () => {
    try {
      const report = await getLastReport()
      if (report) {
        setAnalysis(report)
        setLastUploadedFileName(report.fileName || 'последний отчёт')
      }
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

  useEffect(() => {
    if (!analysis) return
    const years = analysis.availableYears || []
    setAvailableYears(years)
    if (years.length === 1) {
      setSelectedYears([years[0]])
    } else {
      setSelectedYears([])
    }
  }, [analysis])

  const filmsAll = analysis?.filmsLiteAll || analysis?.filmsLite || []
  const filteredFilms = useMemo(() => {
    if (!analysis) return []
    if (selectedYears.length === 0) return filmsAll
    return filterFilmsByYears(filmsAll, selectedYears)
  }, [analysis, filmsAll, selectedYears])

  const computed = useMemo(() => {
    if (!analysis) return null
    if (analysis.stage1 && (!analysis.filmsLite || analysis.filmsLite.length === 0)) {
      return getComputedFromStage1(analysis.stage1)
    }
    return computeAggregations(filteredFilms)
  }, [analysis, filteredFilms])

  const posterSetIdsTop12 = useMemo(
    () => new Set((computed?.topRatedFilms || []).slice(0, 12).map((f) => f.tmdb_id).filter(Boolean)),
    [computed?.topRatedFilms]
  )

  const summaryText = formatYearRange(selectedYears, availableYears)
  const yearsLabel = getYearRangeLabel(selectedYears.length ? selectedYears : availableYears)
  const yearsHeader = (() => {
    if (!availableYears.length) return 'Все годы'
    if (selectedYears.length === 0) {
      return `${availableYears[0]}–${availableYears[availableYears.length - 1]}`
    }
    const sorted = [...selectedYears].sort((a, b) => a - b)
    if (sorted.length === 1) return `${sorted[0]}`
    return sorted.join(' + ')
  })()

  const handleToggleYear = (year) => {
    setSelectedYears((prev) => {
      const exists = prev.includes(year)
      if (!exists && prev.length >= 10) return prev
      const next = exists ? prev.filter((item) => item !== year) : [...prev, year]
      return next.length === 0 ? [] : next
    })
  }

  const handleResetYears = () => {
    setSelectedYears([])
  }

  const handleLoadDemo = async () => {
    setError('')
    setLoading(true)
    setAnalysis(null)
    setSimplifiedMode(false)
    abortControllerRef.current = new AbortController()
    
    try {
      // Сначала загружаем данные, чтобы узнать реальное количество фильмов
      const { data, error: mockError } = await loadMock(demoMockId)
      
      if (abortControllerRef.current?.signal.aborted) {
        setLoading(false)
        setProgress(null)
        return
      }
      
      if (mockError) {
        setAnalysis(null)
        setError(mockError)
        setLoading(false)
        setProgress(null)
        return
      }
      
      // Получаем реальное количество фильмов из загруженных данных
      const filmsCount = data?.filmsLite?.length || data?.filmsLiteAll?.length || 0
      
      // Симуляция прогресса загрузки демо-отчёта с реальным количеством фильмов
      const simulateProgress = async () => {
        const stages = [
          { stage: 'parsing', message: 'Чтение CSV', percent: 4, delay: 300 },
          { stage: 'stage1', message: 'Базовая статистика', percent: 8, delay: 400 },
          { stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', percent: 75, delay: 600 },
          { stage: 'tmdb_details', message: 'Загрузка данных TMDb', percent: 90, delay: 800 },
          { stage: 'credits_keywords', message: 'Загрузка актёров и режиссёров', percent: 95, delay: 500 },
          { stage: 'finalizing', message: 'Финализация отчёта', percent: 100, delay: 300 },
        ]
        
        for (const stageInfo of stages) {
          if (abortControllerRef.current?.signal.aborted) return
          const done = Math.round((stageInfo.percent / 100) * filmsCount)
          setProgress({
            stage: stageInfo.stage,
            message: stageInfo.message,
            total: filmsCount,
            done: done,
            percent: stageInfo.percent,
          })
          await new Promise(resolve => setTimeout(resolve, stageInfo.delay))
        }
      }
      
      await simulateProgress()
      
      if (abortControllerRef.current?.signal.aborted) {
        setLoading(false)
        setProgress(null)
        return
      }
      
      setProgress({ stage: 'finalizing', message: 'Готово', total: filmsCount, done: filmsCount, percent: 100 })
      await new Promise(resolve => setTimeout(resolve, 200))
      setAnalysis(data)
      setLastUploadedFileName('демо')
      setLoading(false)
      setProgress(null)
    } catch (err) {
      setAnalysis(null)
      setLoading(false)
      setProgress(null)
      setError(err.message || 'Не удалось загрузить демо')
    } finally {
      abortControllerRef.current = null
    }
  }

  const simplifiedEmpty = analysis?.simplifiedMode

  return (
    <div className="app" id="dashboard-root">
      <header className="hero">
        <div>
          <p className="eyebrow">Letterboxd · Итоги года</p>
          <h1>Твой год в кино</h1>
          {!loading && analysis && computed && computed.stats.totalFilms > 0 && (
            <p className="hero-summary-line" aria-live="polite">
              {formatNumber(computed.stats.totalFilms)} фильма · {formatRating(computed.stats.avgRating)}★ · {formatNumber(computed.stats.count45)} фильмов 4.5+ · {computed.stats.oldestYear}–{computed.stats.newestYear}
            </p>
          )}
          <p className="subtitle">
            Загрузите экспорт рейтингов Letterboxd и увидьте год через любимые
            жанры, темы и самые высокие оценки.
          </p>
          {!loading && analysis && computed && computed.stats.totalFilms > 0 && (
            <YearFilter
              availableYears={availableYears}
              selectedYears={selectedYears}
              onToggleYear={handleToggleYear}
              onReset={handleResetYears}
              summaryText={summaryText}
              filmCount={filteredFilms.length || computed?.stats?.totalFilms || 0}
            />
          )}
        </div>
        <div className="hero-actions">
          <UploadZone
            onUpload={handleUpload}
            loading={loading}
            selectedFileName={analysis ? lastUploadedFileName : ''}
            selectedFilmCount={analysis ? filteredFilms.length : 0}
          />
          {SHOW_MOCK_UI && (
            <div className="mock-demo-block">
              <label className="mock-demo-label" htmlFor="demo-select">
                Демо-отчёт
              </label>
              <div className="mock-demo-row">
                <select
                  id="demo-select"
                  className="mock-demo-select"
                  value={demoMockId}
                  onChange={(e) => setDemoMockId(e.target.value)}
                  disabled={loading}
                >
                  {MOCK_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  className="btn btn-secondary mock-demo-btn"
                  onClick={handleLoadDemo}
                  disabled={loading}
                >
                  Загрузить демо
                </button>
              </div>
            </div>
          )}
          <p className="upload-privacy">
            Файл обрабатывается только в браузере. Никуда не отправляется.
          </p>
          <p className="upload-settings">
            <button
              type="button"
              className="btn-link btn-link-small"
              onClick={handleClearCache}
              disabled={loading}
            >
              {cacheCleared ? 'Кеш очищен' : 'Очистить кеш'}
            </button>
            {lastReportAvailable && !analysis && !loading && (
              <span className="upload-settings-sep"> · </span>
            )}
            {lastReportAvailable && !analysis && !loading && (
              <button
                type="button"
                className="btn-link btn-link-small"
                onClick={handleOpenLastReport}
              >
                Открыть последний отчёт
              </button>
            )}
          </p>
        </div>
      </header>

      {showResumeModal && resumeState && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="resume-modal-title">
          <div className="modal-card">
            <h2 id="resume-modal-title">Продолжить?</h2>
            <p>
              Похоже, анализ был прерван. Продолжить?
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleResumeStartOver}>
                Начать заново
              </button>
              <button type="button" className="btn" onClick={handleResumeContinue}>
                Продолжить
              </button>
            </div>
          </div>
        </div>
      )}

      {showMobileModal && (
        <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="mobile-modal-title">
          <div className="modal-card">
            <h2 id="mobile-modal-title">Большой файл</h2>
            <p>
              На телефоне обработка может быть очень долгой.
              Рекомендуем открыть сайт на ПК.
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" onClick={handleMobileCancel}>
                Отмена
              </button>
              <button type="button" className="btn" onClick={handleMobileContinue}>
                Продолжить (упрощённый режим)
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <ProgressStatus
          progress={progress}
          onCancel={handleCancelAnalysis}
          retryMessage={retryMessage}
        />
      )}
      {error && (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" className="btn btn-secondary btn-small" onClick={() => setError('')}>
            Повторить
          </button>
        </div>
      )}
      {analysis?.warnings?.length > 0 && (
        <div className="warning-banner" role="alert">
          {analysis.warnings.join(' ')}
        </div>
      )}

      {!analysis && !loading && (
        <section className="empty-state">
          <h2>Начните с ratings.csv</h2>
          <p>
            Экспортируйте свои оценки из Letterboxd и перетащите файл выше,
            чтобы получить ваш киногод.
          </p>
        </section>
      )}

      {!loading && analysis && computed && computed.stats.totalFilms > 0 && (
        <main className="dashboard">
          {computed.summarySentence && (
            <p className="summary-sentence" aria-live="polite">
              {computed.summarySentence}
            </p>
          )}
          <StatsCards stats={computed.stats} />
          <FilmsGrid films={computed.topRatedFilms} posterSetIds={posterSetIdsTop12} />
          <section className="grid">
            <HiddenGemsSection
              hiddenGems={simplifiedEmpty ? [] : computed.hiddenGems}
              overrated={simplifiedEmpty ? [] : computed.overrated}
              simplifiedEmpty={simplifiedEmpty}
            />
          </section>
          <section className="grid">
            <GenresSection
              topGenres={computed.topGenres}
              topGenresByAvgMin8={computed.topGenresByAvgMin8}
              genreOfTheYear={computed.genreOfTheYear}
            />
          </section>
          <section className="grid grid--two-cols">
            <TagsTable
              tags={computed.topTags}
              emptyMessage={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : undefined}
            />
            <ListsProgressSection films={filteredFilms} />
            <Suspense fallback={null}>
              <LazyChartsSection
                films={filteredFilms}
              />
            </Suspense>
          </section>
          <section className="grid">
            <Suspense fallback={null}>
              <LazyFavoriteDecades films={filteredFilms} />
            </Suspense>
          </section>
          <section className="grid">
            <WatchTimeCard watchTime={computed.watchTime} />
          </section>
          <section className="grid">
            <LanguagesSection
              totalLanguagesCount={computed.totalLanguagesCount}
              topLanguagesByCount={computed.topLanguagesByCount}
            />
          </section>
          <section className="grid">
            <ToggleRankedList
              title="Страны"
              subtitle="География твоего кино-года"
              byCount={computed.topCountriesByCount}
              byAvg={computed.topCountriesByAvgRating}
              emptyText={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : 'Нет данных по странам.'}
              sectionKey="countries"
              translateName={getCountryNameRu}
            />
            <ToggleRankedList
              title="Режиссёры"
              subtitle="Те, кого ты смотришь чаще всего"
              byCount={simplifiedEmpty ? [] : computed.topDirectorsByCount}
              byAvg={simplifiedEmpty ? [] : computed.topDirectorsByAvgRating}
              emptyText={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : 'Нет данных по режиссёрам.'}
              sectionKey="directors"
            />
          </section>
          <section className="grid">
            <ToggleRankedList
              title="Актёры"
              subtitle="Любимые лица твоего года"
              byCount={simplifiedEmpty ? [] : computed.topActorsByCount}
              byAvg={simplifiedEmpty ? [] : computed.topActorsByAvgRating}
              emptyText={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : 'Нет данных по актёрам.'}
              sectionKey="actors"
            />
          </section>
          <section className="grid">
            <BadgesSection badges={computed.badges} />
          </section>
        </main>
      )}
      {!loading && analysis && computed && computed.stats.totalFilms > 0 && selectedYears.length > 0 && filteredFilms.length === 0 && (
        <section className="empty-state">
          <h2>Нет фильмов для выбранного периода</h2>
          <p>Попробуй выбрать другие годы или сбросить фильтр.</p>
        </section>
      )}

      <footer className="app-footer">
        <a
          href="https://www.themoviedb.org/"
          target="_blank"
          rel="noopener noreferrer"
          className="tmdb-attribution"
          aria-label="TMDb"
        >
          <span className="tmdb-logo" aria-hidden="true">
            <svg width="32" height="16" viewBox="0 0 32 16" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="0" y="0" width="32" height="16" rx="4" fill="currentColor" opacity="0.2" />
              <text x="16" y="11" textAnchor="middle" fill="currentColor" fontSize="8" fontWeight="700" fontFamily="system-ui, sans-serif">tm</text>
            </svg>
          </span>
          <span className="tmdb-text">Данные о фильмах предоставлены TMDb.</span>
        </a>
      </footer>
    </div>
  )
}

export default App
