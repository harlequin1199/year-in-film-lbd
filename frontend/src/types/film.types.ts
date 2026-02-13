/**
 * Film row from CSV (before TMDb enrichment)
 */
export interface FilmRow {
  title: string
  year: number | null
  rating: number | null
  date: string | null
  tmdb_id?: number | null
}

/**
 * Film with TMDb metadata
 */
export interface Film {
  // From CSV
  title: string
  year: number | null
  rating: number | null
  date: string | null
  
  // TMDb data
  tmdb_id: number | null
  poster_path: string | null
  poster_url: string | null
  poster_url_w342: string | null
  tmdb_vote_average: number | null
  tmdb_vote_count: number
  tmdb_stars: number | null
  
  // Metadata
  genres: string[]
  keywords: string[]
  directors: string[]
  actors: string[]
  countries: string[]
  runtime: number | null
  original_language: string | null
  letterboxd_url?: string | null
}

/**
 * Simplified film (for progressive loading)
 */
export interface FilmLite {
  title: string
  year: number | null
  rating: number | null
  poster_url: string | null
  poster_url_w342: string | null
  tmdb_id: number | null
}
