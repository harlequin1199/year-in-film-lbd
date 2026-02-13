/**
 * Basic statistics
 */
export interface Stats {
  totalFilms: number
  avgRating: number
  count45: number
  oldestYear: number | null
  newestYear: number | null
}

/**
 * Rating distribution bucket
 */
export interface RatingBucket {
  min: number
  max: number
  count: number
}

/**
 * Ranked entity (genre, country, director, actor, etc.)
 */
export interface RankedEntity {
  name: string
  count: number
  avg_rating: number
  high_45: number
  share_45: number
}

/**
 * Ranked entity with Love Score
 */
export interface RankedEntityWithLoveScore extends RankedEntity {
  loveScore: number
  ratingLift: number
}

/**
 * Genre statistics
 */
export type GenreStats = RankedEntityWithLoveScore

/**
 * Country statistics
 */
export type CountryStats = RankedEntity

/**
 * Director statistics
 */
export type DirectorStats = RankedEntity

/**
 * Actor statistics
 */
export type ActorStats = RankedEntity

/**
 * Language statistics
 */
export interface LanguageStats {
  language: string
  count: number
  avg_rating: number
  high_45: number
}

/**
 * Tag/Theme statistics
 */
export type TagStats = RankedEntityWithLoveScore

/**
 * Watch time statistics
 */
export interface WatchTime {
  totalRuntimeMinutes: number
  totalRuntimeHours: number
  totalRuntimeDays: number
  avgRuntimeMinutes: number
}

/**
 * Badge
 */
export interface Badge {
  title: string
  value: number | string | null
  subtitle: string
  iconKey: string
  tone: string
  isRating?: boolean
}

/**
 * Decade statistics
 */
export interface DecadeStats {
  decade: number
  count: number
  avgRating: number
  loveScore: number
  ratingLift: number
}

/**
 * Year statistics with Love Score
 */
export interface YearStats {
  name: string
  count: number
  avg_rating: number
  high_45: number
  share_45: number
  loveScore: number
  ratingLift: number
}

/**
 * Hidden gem film
 */
export interface HiddenGem {
  title: string
  year: number | null
  rating: number | null
  tmdb_stars: number | null
  diff: number
  poster_url: string | null
  poster_url_w342: string | null
  tmdb_id: number | null
  letterboxd_url?: string | null
}

/**
 * Overrated film
 */
export interface OverratedFilm {
  title: string
  year: number | null
  rating: number | null
  tmdb_stars: number | null
  diff: number
  poster_url: string | null
  poster_url_w342: string | null
  tmdb_id: number | null
  letterboxd_url?: string | null
}
