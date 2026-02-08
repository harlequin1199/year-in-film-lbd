import { Suspense, lazy, useEffect, useMemo, useState } from 'react'
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
import YearFilter from './components/YearFilter.jsx'
import { formatNumber, formatRating } from './utils/format.js'
import {
  computeAggregations,
  filterFilmsByYears,
  formatYearRange,
  getYearRangeLabel,
} from './utils/analyticsClient.js'
import { enrichFilmsPhase1Only, enrichFilmsTwoPhase } from './utils/tmdbProxyClient.js'
import { clearCache } from './utils/indexedDbCache.js'
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

  const runAnalysisFromRows = async (parsedRows, parsedDiary, simplified = false) => {
    setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: parsedRows.length, done: 0, percent: 2 })
    const films = simplified
      ? await enrichFilmsPhase1Only(parsedRows, parsedDiary, setProgress)
      : await enrichFilmsTwoPhase(parsedRows, parsedDiary, setProgress)
    setProgress({ stage: 'finalizing', message: 'Подготовка отчёта', total: films.length, done: films.length, percent: 98 })
    const hasDiary = parsedDiary && parsedDiary.length > 0
    const availableYearsFromFilms = [...new Set(films.map((f) => {
      const d = f.watchedDate || f.date
      if (!d) return null
      const y = typeof d === 'string' ? d.slice(0, 4) : d.getFullYear?.()
      return y ? parseInt(y, 10) : null
    }).filter(Boolean))].sort((a, b) => a - b)
    setAnalysis({
      filmsLite: films,
      filmsLiteAll: films,
      hasDiary,
      dataSource: hasDiary ? 'both' : 'ratings',
      availableYears: availableYearsFromFilms,
      simplifiedMode: simplified,
    })
    setProgress({ stage: 'finalizing', message: 'Готово', total: films.length, done: films.length, percent: 100 })
  }

  const runAnalysis = async (ratingsFile, diaryFile, simplified = false) => {
    setError('')
    setLoading(true)
    setAnalysis(null)
    setProgress({ stage: 'parsing', message: 'Чтение CSV', total: 1, done: 0, percent: 0 })
    setLastUploadedFileName(ratingsFile?.name || '')

    try {
      const ratingsText = await ratingsFile.text()
      const diaryText = diaryFile ? await diaryFile.text() : null

      const rows = await new Promise((resolve, reject) => {
        const worker = new Worker(new URL('./workers/csvParse.worker.js', import.meta.url), { type: 'module' })
        let ratingRows = null
        let diaryRows = []
        worker.postMessage({ type: 'parse', ratingsText, diaryText })
        worker.onmessage = (ev) => {
          if (ev.data.type === 'progress') setProgress(ev.data)
          if (ev.data.type === 'rows') ratingRows = ev.data.rows
          if (ev.data.type === 'diary') diaryRows = ev.data.rows || []
          if (ev.data.type === 'error') {
            worker.terminate()
            reject(new Error(ev.data.message))
            return
          }
          if (ratingRows !== null) {
            worker.terminate()
            resolve({ rows: ratingRows, diaryRows })
          }
        }
        worker.onerror = () => reject(new Error('Ошибка парсинга CSV'))
      })

      const { rows: parsedRows, diaryRows: parsedDiary } = rows
      if (!parsedRows || parsedRows.length === 0) {
        setError('В CSV нет записей о фильмах')
        setLoading(false)
        setProgress(null)
        return
      }

      const mobile = isMobile()
      if (mobile && parsedRows.length > BIG_FILE_MOBILE_THRESHOLD && !simplified) {
        setPendingFiles({ parsedRows, parsedDiary })
        setShowMobileModal(true)
        setLoading(false)
        setProgress(null)
        return
      }

      await runAnalysisFromRows(parsedRows, parsedDiary, simplified)
      if (simplified) setSimplifiedMode(true)
    } catch (err) {
      setError(err.message || 'Произошла ошибка')
    } finally {
      setLoading(false)
      setProgress(null)
    }
  }

  const handleUpload = async (ratingsFile, diaryFile = null) => {
    if (!ratingsFile) return
    if (USE_MOCKS) {
      setError('В режиме демо используйте блок «Демо-отчёт» ниже.')
      return
    }
    await runAnalysis(ratingsFile, diaryFile, false)
  }

  const handleMobileContinue = async () => {
    setShowMobileModal(false)
    if (pendingFiles) {
      setError('')
      setLoading(true)
      setAnalysis(null)
      setProgress({ stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', total: pendingFiles.parsedRows.length, done: 0, percent: 2 })
      setLastUploadedFileName('')
      try {
        await runAnalysisFromRows(pendingFiles.parsedRows, pendingFiles.parsedDiary, true)
        setSimplifiedMode(true)
      } catch (err) {
        setError(err.message || 'Произошла ошибка')
      } finally {
        setLoading(false)
        setProgress(null)
      }
      setPendingFiles(null)
    }
  }

  const handleMobileCancel = () => {
    setShowMobileModal(false)
    setPendingFiles(null)
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
    return computeAggregations(filteredFilms)
  }, [analysis, filteredFilms])

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
    try {
      const { data, error: mockError } = await loadMock(demoMockId)
      setLoading(false)
      if (mockError) {
        setError(mockError)
        return
      }
      setAnalysis(data)
      setLastUploadedFileName('демо')
    } catch (err) {
      setLoading(false)
      setError(err.message || 'Не удалось загрузить демо')
    }
  }

  const simplifiedEmpty = analysis?.simplifiedMode

  return (
    <div className="app" id="dashboard-root">
      <header className="hero">
        <div>
          <p className="eyebrow">Letterboxd · Итоги года</p>
          <h1>Твой год в кино</h1>
          {analysis && computed && filteredFilms.length > 0 && (
            <p className="hero-summary-line" aria-live="polite">
              {formatNumber(computed.stats.totalFilms)} фильма · {formatRating(computed.stats.avgRating)}★ · {formatNumber(computed.stats.count45)} фильмов 4.5+ · {computed.stats.oldestYear}–{computed.stats.newestYear}
            </p>
          )}
          <p className="subtitle">
            Загрузите экспорт рейтингов Letterboxd и увидьте год через любимые
            жанры, темы и самые высокие оценки.
          </p>
          {analysis && (
            <YearFilter
              availableYears={availableYears}
              selectedYears={selectedYears}
              onToggleYear={handleToggleYear}
              onReset={handleResetYears}
              summaryText={summaryText}
              filmCount={filteredFilms.length}
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
          </p>
        </div>
      </header>

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

      {loading && <ProgressStatus progress={progress} />}
      {error && <div className="error-banner">{error}</div>}

      {!analysis && !loading && (
        <section className="empty-state">
          <h2>Начните с ratings.csv</h2>
          <p>
            Экспортируйте свои оценки из Letterboxd и перетащите файл выше,
            чтобы получить ваш киногод.
          </p>
        </section>
      )}

      {analysis && computed && filteredFilms.length > 0 && (
        <main className="dashboard">
          {computed.summarySentence && (
            <p className="summary-sentence" aria-live="polite">
              {computed.summarySentence}
            </p>
          )}
          <StatsCards stats={computed.stats} />
          <FilmsGrid films={computed.topRatedFilms} />
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
            <Suspense fallback={null}>
              <LazyChartsSection
                timeline={computed.timeline}
                films={filteredFilms}
                hasDiary={analysis.hasDiary}
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
      {analysis && computed && filteredFilms.length === 0 && (
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
