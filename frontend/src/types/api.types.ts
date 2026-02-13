/**
 * TMDb Movie response (simplified for caching)
 */
export interface TmdbMovie {
  id: number
  poster_path: string | null
  genres: string[]
  runtime: number | null
  vote_average: number | null
  vote_count: number
  original_language: string | null
  production_countries: string[]
  release_date: string | null
}

/**
 * TMDb Credits response (simplified for caching)
 */
export interface TmdbCredits {
  directors: string[]
  actors: string[]
}

/**
 * TMDb Keywords response (simplified for caching)
 */
export interface TmdbKeywords {
  keywords: string[]
}

/**
 * TMDb Search result
 */
export interface TmdbSearchResult {
  id: number
  title: string
  release_date: string
  poster_path: string | null
}

/**
 * TMDb Search response
 */
export interface TmdbSearchResponse {
  results: TmdbSearchResult[]
  total_results: number
  total_pages: number
}
