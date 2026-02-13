import { Suspense, lazy } from 'react'
import UploadZone from '../components/UploadZone.jsx'
import StatsCards from '../components/StatsCards.jsx'
import GenresSection from '../components/GenresSection.jsx'
import HiddenGemsSection from '../components/HiddenGemsSection.jsx'
import TagsTable from '../components/TagsTable.jsx'
import FilmsGrid from '../components/FilmsGrid.jsx'
import ProgressStatus from '../components/ProgressStatus.jsx'
import WatchTimeCard from '../components/WatchTimeCard.jsx'
import LanguagesSection from '../components/LanguagesSection.jsx'
import ToggleRankedList from '../components/ToggleRankedList.jsx'
import BadgesSection from '../components/BadgesSection.jsx'
import ListsProgressSection from '../components/ListsProgressSection.jsx'
import YearFilter from '../components/YearFilter.jsx'
import { formatNumber, formatRating } from '../utils/format.js'
import { getCountryNameRu } from '../utils/countriesRu.js'
import { getLetterboxdCountryUrl, getLetterboxdDirectorUrl, getLetterboxdActorUrl } from '../utils/letterboxdUrl.js'

const LazyChartsSection = lazy(() => import('../components/LazyChartsSection.jsx'))
const LazyFavoriteDecades = lazy(() => import('../components/FavoriteDecades.jsx'))

function AppView(props) {
  const {
    isMobile,
    demoDropdownRef,
    showDemoDropdown,
    setShowDemoDropdown,
    loading,
    analysis,
    computed,
    availableYears,
    selectedYears,
    handleToggleYear,
    handleResetYears,
    summaryText,
    filteredFilms,
    handleLoadDemoCSV,
    handleLoadDemoReport,
    handleUpload,
    lastUploadedFileName,
    SHOW_MOCK_UI,
    demoMockId,
    setDemoMockId,
    MOCK_OPTIONS,
    handleLoadDemo,
    handleClearCache,
    cacheCleared,
    lastReportAvailable,
    handleOpenLastReport,
    showResumeModal,
    resumeState,
    handleResumeStartOver,
    handleResumeContinue,
    showMobileModal,
    handleMobileCancel,
    handleMobileContinue,
    progress,
    handleCancelAnalysis,
    retryMessage,
    error,
    setError,
    posterSetIdsTop12,
    simplifiedEmpty,
  } = props

  return (
    <div className="app" id="dashboard-root">
      <header className="hero">
        <div style={{ position: 'relative' }}>
          {isMobile() && (
            <div
              ref={demoDropdownRef}
              style={{
                position: 'absolute',
                top: 0,
                right: 0,
                zIndex: 10,
              }}
            >
              <button
                type="button"
                className="demo-button"
                onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                disabled={loading}
                aria-expanded={showDemoDropdown}
                aria-haspopup="true"
              >
                Демо
              </button>
              {showDemoDropdown && (
                <div className="demo-dropdown-menu">
                  <button
                    type="button"
                    className="demo-dropdown-item"
                    onClick={() => {
                      handleLoadDemoCSV()
                      setShowDemoDropdown(false)
                    }}
                    disabled={loading}
                  >
                    Запустить демо (CSV, полный расчёт)
                  </button>
                  <button
                    type="button"
                    className="demo-dropdown-item"
                    onClick={() => {
                      handleLoadDemoReport()
                      setShowDemoDropdown(false)
                    }}
                    disabled={loading}
                  >
                    Открыть готовый демо-отчёт (мгновенно)
                  </button>
                </div>
              )}
            </div>
          )}
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
          {!isMobile() && (
            <div
              ref={demoDropdownRef}
              style={{
                position: 'relative',
                alignSelf: 'flex-end',
                marginBottom: '12px',
              }}
            >
              <button
                type="button"
                className="demo-button"
                onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                disabled={loading}
                aria-expanded={showDemoDropdown}
                aria-haspopup="true"
              >
                Демо
              </button>
              {showDemoDropdown && (
                <div className="demo-dropdown-menu">
                  <button
                    type="button"
                    className="demo-dropdown-item"
                    onClick={() => {
                      handleLoadDemoCSV()
                      setShowDemoDropdown(false)
                    }}
                    disabled={loading}
                  >
                    Запустить демо (CSV, полный расчёт)
                  </button>
                  <button
                    type="button"
                    className="demo-dropdown-item"
                    onClick={() => {
                      handleLoadDemoReport()
                      setShowDemoDropdown(false)
                    }}
                    disabled={loading}
                  >
                    Открыть готовый демо-отчёт (мгновенно)
                  </button>
                </div>
              )}
            </div>
          )}
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
            CSV-файл целиком не загружается на сервер; на backend отправляются только данные, нужные для TMDb-обогащения (например, title/year/tmdb_ids); кеш хранится локально в IndexedDB.
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

      {!analysis && (
        <section className={`empty-state ${loading && progress ? 'empty-state-loading' : ''}`}>
          <h2>Начните с ratings.csv</h2>
          <p>
            <a
              href="https://letterboxd.com/data/export/"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              Экспортируйте
            </a>{' '}
            свои оценки из Letterboxd и перетащите файл выше,
            чтобы получить ваш киногод.
          </p>
        </section>
      )}

      {!loading && analysis && computed && computed.stats.totalFilms > 0 && (
        <main className="dashboard">
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
          <section className="grid">
            <TagsTable
              tags={computed.topTags}
              emptyMessage={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : undefined}
            />
          </section>
          <section className="grid">
            <ListsProgressSection films={filteredFilms} />
          </section>
          <section className="grid">
            <Suspense fallback={null}>
              <LazyChartsSection
                films={filteredFilms}
                yearsByLoveScore={computed.yearsByLoveScore}
              />
            </Suspense>
          </section>
          <section className="grid">
            <Suspense fallback={null}>
              <LazyFavoriteDecades films={filteredFilms} decades={computed.decades} />
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
              getLetterboxdUrl={getLetterboxdCountryUrl}
            />
          </section>
          <section className="grid">
            <ToggleRankedList
              title="Режиссёры"
              subtitle="Те, кого ты смотришь чаще всего"
              byCount={simplifiedEmpty ? [] : computed.topDirectorsByCount}
              byAvg={simplifiedEmpty ? [] : computed.topDirectorsByAvgRating}
              emptyText={simplifiedEmpty ? 'Недоступно в упрощённом режиме на телефоне.' : 'Нет данных по режиссёрам.'}
              sectionKey="directors"
              getLetterboxdUrl={getLetterboxdDirectorUrl}
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
              getLetterboxdUrl={getLetterboxdActorUrl}
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

      <footer className={`app-footer ${!loading && analysis && computed && computed.stats.totalFilms > 0 ? 'app-footer-with-content' : ''}`}>
        <div className="app-footer-content">
          {!loading && analysis && computed && computed.stats.totalFilms > 0 && (
            <div id="love-score" className="app-footer-love-score">
              <div className="app-footer-love-score-content">
                <div className="app-footer-love-score-text">
                  <h2 className="app-footer-love-score-title">Love Score</h2>
                  <p>
                    Единый показатель (0–100) для определения самых любимых жанров, тем, стран, режиссёров, актёров и периодов.
                  </p>
                  <p>
                    Формула учитывает три фактора: <strong>оценку выше вашей средней</strong> (65% веса), <strong>частоту просмотра</strong> (35% веса) и <strong>уверенность в данных</strong> (зависит от количества просмотров).
                  </p>
                  <p>
                    Частота просмотра учитывает не только абсолютное количество, но и относительную частоту: для <strong>жанров</strong> и <strong>стран</strong> сравнивается с глобальной частотой в базе TMDb (чтобы учесть, что некоторые жанры и страны реже встречаются), для <strong>периодов времени</strong> — с глобальной частотой фильмов в TMDb по годам/десятилетиям (чтобы учесть разную доступность фильмов разных эпох).
                  </p>
                  <p>
                    Чем выше оценка относительно вашей средней и чем чаще вы смотрите контент этого типа (с учётом его редкости), тем выше Love Score.
                  </p>
                </div>
                <div className="app-footer-love-score-examples-wrapper">
                  <p className="app-footer-love-score-examples-title">
                    <strong>Примеры:</strong>
                  </p>
                  <div className="love-score-examples">
                    <div className="love-score-example">
                      <div className="love-score-example-title">Мало фильмов, но высокий LS</div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Ваша средняя:</span>
                        <span className="love-score-example-value">3.5★</span>
                      </div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Жанр «Драма»:</span>
                        <span className="love-score-example-value">4.5★</span>
                      </div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Количество фильмов:</span>
                        <span className="love-score-example-value">15</span>
                      </div>
                      <div className="love-score-example-item love-score-example-result">
                        <span className="love-score-example-label">Love Score:</span>
                        <span className="love-score-example-value">≈ 45</span>
                      </div>
                    </div>
                    <div className="love-score-example love-score-example-low">
                      <div className="love-score-example-title">Много фильмов, но низкий LS</div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Ваша средняя:</span>
                        <span className="love-score-example-value">3.5★</span>
                      </div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Жанр «Комедия»:</span>
                        <span className="love-score-example-value">3.0★</span>
                      </div>
                      <div className="love-score-example-item">
                        <span className="love-score-example-label">Количество фильмов:</span>
                        <span className="love-score-example-value">45</span>
                      </div>
                      <div className="love-score-example-item love-score-example-result">
                        <span className="love-score-example-label">Love Score:</span>
                        <span className="love-score-example-value">≈ 20</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
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
        </div>
      </footer>
    </div>
  )
}

export default AppView
