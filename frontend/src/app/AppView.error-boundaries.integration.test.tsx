import { createRef } from 'react'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import AppView from './AppView'

vi.mock('../components/StatsCards', () => ({
  default: function BrokenStatsCards() {
    throw new Error('report section crashed')
  },
}))

vi.mock('../components/GenresSection', () => ({ default: () => <div /> }))
vi.mock('../components/HiddenGemsSection', () => ({ default: () => <div /> }))
vi.mock('../components/TagsTable', () => ({ default: () => <div /> }))
vi.mock('../components/FilmsGrid', () => ({ default: () => <div /> }))
vi.mock('../components/ProgressStatus', () => ({ default: () => <div /> }))
vi.mock('../components/WatchTimeCard', () => ({ default: () => <div /> }))
vi.mock('../components/LanguagesSection', () => ({ default: () => <div /> }))
vi.mock('../components/ToggleRankedList', () => ({ default: () => <div /> }))
vi.mock('../components/BadgesSection', () => ({ default: () => <div /> }))
vi.mock('../components/ListsProgressSection', () => ({ default: () => <div /> }))
vi.mock('../components/YearFilter', () => ({ default: () => <div /> }))
vi.mock('../components/LazyChartsSection', () => ({ default: () => <div /> }))
vi.mock('../components/FavoriteDecades', () => ({ default: () => <div /> }))

function createProps(): any {
  return {
    isMobile: () => false,
    demoDropdownRef: createRef<HTMLDivElement>(),
    showDemoDropdown: false,
    setShowDemoDropdown: vi.fn(),
    loading: false,
    analysis: { warnings: [] },
    computed: {
      stats: { totalFilms: 1, avgRating: 4, count45: 1, oldestYear: 2024, newestYear: 2024 },
      topRatedFilms: [],
      hiddenGems: [],
      overrated: [],
      topGenres: [],
      topGenresByAvgMin8: [],
      genreOfTheYear: null,
      topTags: [],
      yearsByLoveScore: [],
      decades: [],
      watchTime: { totalMinutes: 0 },
      totalLanguagesCount: 0,
      topLanguagesByCount: [],
      topCountriesByCount: [],
      topCountriesByAvgRating: [],
      topDirectorsByCount: [],
      topDirectorsByAvgRating: [],
      topActorsByCount: [],
      topActorsByAvgRating: [],
      badges: [],
    },
    availableYears: [],
    selectedYears: [],
    handleToggleYear: vi.fn(),
    handleResetYears: vi.fn(),
    summaryText: '',
    filteredFilms: [],
    handleLoadDemoCSV: vi.fn(),
    handleLoadDemoReport: vi.fn(),
    handleUpload: vi.fn(),
    lastUploadedFileName: '',
    SHOW_MOCK_UI: false,
    demoMockId: '',
    setDemoMockId: vi.fn(),
    MOCK_OPTIONS: [],
    handleLoadDemo: vi.fn(),
    handleClearCache: vi.fn(),
    cacheCleared: false,
    lastReportAvailable: false,
    handleOpenLastReport: vi.fn(),
    showResumeModal: false,
    resumeState: null,
    handleResumeStartOver: vi.fn(),
    handleResumeContinue: vi.fn(),
    showMobileModal: false,
    handleMobileCancel: vi.fn(),
    handleMobileContinue: vi.fn(),
    progress: null,
    handleCancelAnalysis: vi.fn(),
    retryMessage: '',
    error: '',
    setError: vi.fn(),
    posterSetIdsTop12: new Set<number>(),
    simplifiedEmpty: false,
  }
}

describe('AppView feature boundaries', () => {
  it('keeps upload controls visible when report section crashes', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<AppView {...createProps()} />)

    expect(screen.getByTestId('feature-upload')).toBeInTheDocument()
    expect(screen.getByText(/error id/i)).toBeInTheDocument()
  })
})
