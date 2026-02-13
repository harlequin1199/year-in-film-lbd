import type { Film } from './film.types'
import type {
  Stats,
  RatingBucket,
  RankedEntityWithLoveScore,
  GenreStats,
  CountryStats,
  DirectorStats,
  ActorStats,
  LanguageStats,
  TagStats,
  WatchTime,
  Badge,
  DecadeStats,
  YearStats,
  HiddenGem,
  OverratedFilm,
} from './stats.types'

/**
 * Stage 1 analysis (CSV-only, before TMDb enrichment)
 */
export interface Stage1 {
  stats: Stats
  ratingDistribution: RatingBucket[]
  top12ByRating: Array<{
    title: string
    year: number | null
    rating: number | null
  }>
}

/**
 * Computed aggregations from films
 */
export interface Computed {
  stats: Stats
  topRatedFilms: Film[]
  topGenres: GenreStats[]
  topGenresByAvg: GenreStats[]
  topGenresByAvgMin8: GenreStats[]
  genreOfTheYear: GenreStats | null
  hiddenGems: HiddenGem[]
  overrated: OverratedFilm[]
  topTags: TagStats[]
  watchTime: WatchTime
  totalLanguagesCount: number
  topLanguagesByCount: LanguageStats[]
  topCountriesByCount: CountryStats[]
  topCountriesByAvgRating: RankedEntityWithLoveScore[]
  topDirectorsByCount: DirectorStats[]
  topDirectorsByAvgRating: RankedEntityWithLoveScore[]
  topActorsByCount: ActorStats[]
  topActorsByAvgRating: RankedEntityWithLoveScore[]
  badges: Badge[]
  decades: DecadeStats[]
  yearsByLoveScore: YearStats[]
}

/**
 * Analysis result
 */
export interface Analysis {
  stage1?: Stage1
  filmsLite: Film[]
  filmsLiteAll: Film[]
  availableYears: number[]
  simplifiedMode: boolean
  fileName: string
  warnings: string[]
}

/**
 * Progress status
 */
export interface Progress {
  stage: string
  message: string
  total: number
  done: number
  percent: number
}

/**
 * Resume state
 */
export interface ResumeState {
  stage: number | string
  filmsProcessed?: number
  totalFilms?: number
  fileName: string
  timestamp?: number
  runId?: string
  rowCount?: number
  done?: number
  total?: number
}
