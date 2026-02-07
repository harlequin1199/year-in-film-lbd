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
import YearFilter from './components/YearFilter.jsx'
import { computeAggregations, computeHiddenGems, filterFilmsByYears, formatYearRange, getYearRangeLabel } from './utils/analyticsClient.js'

const LazyChartsSection = lazy(() => import('./components/LazyChartsSection.jsx'))
const LazyFavoriteDecades = lazy(() => import('./components/FavoriteDecades.jsx'))

// Backend URL: set VITE_API_URL in Cloudflare Pages; fallback for local dev
const API_URL = (import.meta.env.VITE_API_URL || '').trim() || 'http://localhost:8000'

function App() {
  const [analysis, setAnalysis] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [progress, setProgress] = useState(null)
  const [jobId, setJobId] = useState('')
  const [exporting, setExporting] = useState(false)
  const [availableYears, setAvailableYears] = useState([])
  const [selectedYears, setSelectedYears] = useState([])
  const intervalRef = useRef(null)

  useEffect(() => {
    if (!jobId) return undefined

    const poll = async () => {
      try {
        const response = await fetch(`${API_URL}/api/progress/${jobId}`)
        if (!response.ok) {
          throw new Error('Не удалось получить прогресс')
        }
        const data = await response.json()
        setProgress(data)

        if (data.status === 'done') {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          const resultResponse = await fetch(`${API_URL}/api/result/${jobId}`)
          if (!resultResponse.ok) {
            throw new Error('Не удалось получить результаты анализа')
          }
          const resultData = await resultResponse.json()
          setAnalysis(resultData)
          setLoading(false)
          setJobId('')
          setProgress(null)
        }

        if (data.status === 'error') {
          clearInterval(intervalRef.current)
          intervalRef.current = null
          setLoading(false)
          setJobId('')
          setProgress(null)
          setError('Произошла ошибка во время анализа')
        }
      } catch (err) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
        setLoading(false)
        setJobId('')
        setProgress(null)
        setError(err.message || 'Ошибка анализа')
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 500)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [jobId])

  const handleUpload = async (ratingsFile, diaryFile = null) => {
    if (!ratingsFile) return
    setError('')
    setLoading(true)
    setAnalysis(null)
    setProgress({ total: 0, done: 0, status: 'processing' })

    const formData = new FormData()
    formData.append('ratings_file', ratingsFile)
    if (diaryFile) formData.append('diary_file', diaryFile)

    try {
      const response = await fetch(`${API_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        throw new Error('Не удалось загрузить файл для анализа')
      }
      const data = await response.json()
      if (!data.job_id) {
        throw new Error('Сервис анализа недоступен')
      }
      setJobId(data.job_id)
    } catch (err) {
      setError(err.message || 'Произошла ошибка')
      setLoading(false)
      setProgress(null)
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
  const fileName = `year-in-film_${yearsLabel || 'all'}.pdf`
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

  const handleExport = async () => {
    if (!analysis || !computed || exporting) return
    setExporting(true)
    try {
      const { exportPdfReport } = await import('./utils/exportPdfReport.js')
      exportPdfReport({
        stats: computed.stats,
        watchTime: computed.watchTime,
        selectedYearsLabel: yearsHeader,
        filePeriod: yearsLabel || 'all',
        topRatedFilms: computed.topRatedFilms,
        topGenres: computed.topGenres,
        topGenresByAvg: computed.topGenresByAvg,
        topTags: computed.topTags,
        decades: computed.decades,
        topDirectorsByCount: computed.topDirectorsByCount,
        topActorsByCount: computed.topActorsByCount,
        topCountriesByCount: computed.topCountriesByCount,
        topLanguagesByCount: computed.topLanguagesByCount,
        badges: computed.badges,
      })
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="app" id="dashboard-root">
      <header className="hero">
        <div>
          <p className="eyebrow">Letterboxd · Итоги года</p>
          <h1>Твой год в кино</h1>
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
          <button
            className="btn btn-secondary"
            type="button"
            onClick={handleExport}
            disabled={!analysis || exporting}
          >
            Экспорт в PDF
          </button>
          <UploadZone onUpload={handleUpload} loading={loading} />
          <p className="upload-privacy">
            Файл обрабатывается на сервере. Данные не сохраняются после перезапуска сервера.
          </p>
          <p className="upload-wake-hint">
            Если сервис долго не использовался, сервер может просыпаться 5–10 секунд — это нормально.
          </p>
        </div>
      </header>

      {loading && <ProgressStatus progress={progress} />}
      {error && <div className="error-banner">{error}</div>}
      {exporting && <div className="export-overlay">Готовлю PDF…</div>}

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
          <StatsCards stats={computed.stats} />
          <FilmsGrid films={computed.topRatedFilms} />
          <section className="grid">
            <HiddenGemsSection hiddenGems={computed.hiddenGems} overrated={computed.overrated} />
          </section>
          <section className="grid">
            <GenresSection
              topGenres={computed.topGenres}
              topGenresByAvgMin8={computed.topGenresByAvgMin8}
              genreOfTheYear={computed.genreOfTheYear}
            />
          </section>
          <section className="grid">
            <TagsTable tags={computed.topTags} />
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
              emptyText="Нет данных по странам."
            />
            <ToggleRankedList
              title="Режиссёры"
              subtitle="Те, кого ты смотришь чаще всего"
              byCount={computed.topDirectorsByCount}
              byAvg={computed.topDirectorsByAvgRating}
              emptyText="Нет данных по режиссёрам."
            />
          </section>
          <section className="grid">
            <ToggleRankedList
              title="Актёры"
              subtitle="Любимые лица твоего года"
              byCount={computed.topActorsByCount}
              byAvg={computed.topActorsByAvgRating}
              emptyText="Нет данных по актёрам."
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
