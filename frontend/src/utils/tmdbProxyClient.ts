import * as cache from './indexedDbCache'
import { fetchWithRetry } from './fetchWithRetry'
import type { FilmRow, Film } from '../types/film.types'
import type { Progress } from '../types/analysis.types'
import type { TmdbMovie, TmdbCredits, TmdbKeywords } from '../types/api.types'

// Для локальной разработки используем localhost:8000 если VITE_API_URL не задан
const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const API_BASE = envApiUrl || 'http://localhost:8000'

/**
 * Generate proxy URL for TMDB images
 */
function getTmdbImageUrl(poster_path: string | null, size: string = 'w500'): string | null {
  if (!poster_path || !API_BASE) return null
  // Remove leading slash if present
  const path = poster_path.startsWith('/') ? poster_path.slice(1) : poster_path
  return `${API_BASE}/tmdb/image/${size}/${path}`
}

const DEFAULT_CONCURRENCY = 4
const HIGH_LOAD_CONCURRENCY = 2
const HIGH_LOAD_THRESHOLD = 5000
const MAX_IN_FLIGHT = 200

interface BatchParams {
  batchSize: number
  parallelBatches: number
}

interface FetchOptions {
  signal?: AbortSignal
  onRetryMessage?: (message: string) => void
}

interface RunStagedAnalysisOptions {
  onProgress?: (progress: Progress) => void
  onPartialResult?: (partial: { stage?: number; films?: Film[]; warnings?: string[] }) => void
  signal?: AbortSignal
  onRetryMessage?: (message: string) => void
}

interface SearchItem {
  title: string
  year: number | null
}

interface SearchResult {
  title: string
  year: number | null
  tmdb?: {
    tmdb_id: number
    poster_path?: string | null
    genres?: string[]
    runtime?: number | null
    vote_average?: number | null
    vote_count?: number
    original_language?: string | null
    production_countries?: string[]
    release_date?: string | null
  }
}

interface BatchResult {
  tmdb_id: number
  movie?: TmdbMovie | null
  credits?: TmdbCredits | null
  keywords?: TmdbKeywords | null
}

/**
 * Adaptive batch processing parameters based on data volume.
 * Optimized for smooth progress and maximum backend utilization (TMDb ~25 req/s).
 */
function getBatchParams(totalItems: number): BatchParams {
  if (totalItems <= 1000) {
    // Small volume (≤1000): maximize speed with smooth progress
    return { batchSize: 100, parallelBatches: 6 }
  } else {
    // Large volume (1000-10000): balance speed and stability
    return { batchSize: 80, parallelBatches: 5 }
  }
}

function tmdbRating5(voteAverage: number | null | undefined): number | null {
  if (voteAverage == null || Number.isNaN(voteAverage)) return null
  return Math.round((voteAverage / 2) * 10) / 10
}

function searchKey(title: string, year: number | null): string {
  return `${(title || '').trim().toLowerCase()}:${year ?? 0}`
}

async function fetchJsonPost<T>(url: string, body: unknown, opts: FetchOptions = {}): Promise<T> {
  const { onRetryMessage, signal } = opts
  const res = await fetchWithRetry(
    url,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    },
    { onRetryMessage }
  )
  const data = await res.json()
  return data as T
}

export async function searchMovie(title: string, year: number | null, opts: FetchOptions = {}): Promise<number | null> {
  const cached = await cache.getSearch(title, year)
  if (cached !== undefined) return cached
  
  const data = await fetchJsonPost<{ results?: SearchResult[] }>(
    `${API_BASE}/tmdb/search/batch`,
    { items: [{ title, year }] },
    opts
  )
  const result = data.results?.[0]
  if (result) {
    const id = result.tmdb?.tmdb_id ?? null
    await cache.setSearch(title, year, id)
    if (id && result.tmdb) {
      await cache.setMovie(id, {
        id: result.tmdb.tmdb_id,
        poster_path: result.tmdb.poster_path ?? null,
        genres: result.tmdb.genres || [],
        runtime: result.tmdb.runtime ?? null,
        vote_average: result.tmdb.vote_average ?? null,
        vote_count: result.tmdb.vote_count || 0,
        original_language: result.tmdb.original_language ?? null,
        production_countries: result.tmdb.production_countries || [],
        release_date: result.tmdb.release_date ?? null,
      })
    }
    return id
  }
  return null
}

export async function getMovieMinimal(tmdbId: number, opts: FetchOptions = {}): Promise<TmdbMovie> {
  const cached = await cache.getMovie(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) {
    return {
      id: tmdbId, poster_path: null, genres: [], runtime: null,
      vote_average: null, vote_count: 0, original_language: null,
      production_countries: [], release_date: null,
    }
  }

  const data = await fetchJsonPost<{ results?: Array<{ movie?: TmdbMovie }> }>(
    `${API_BASE}/tmdb/movies/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.movie) {
    const out: TmdbMovie = {
      id: result.movie.id,
      poster_path: result.movie.poster_path ?? null,
      genres: result.movie.genres || [],
      runtime: result.movie.runtime ?? null,
      vote_average: result.movie.vote_average ?? null,
      vote_count: result.movie.vote_count || 0,
      original_language: result.movie.original_language ?? null,
      production_countries: result.movie.production_countries || [],
      release_date: result.movie.release_date ?? null,
    }
    await cache.setMovie(tmdbId, out)
    return out
  }
  return {
    id: tmdbId, poster_path: null, genres: [], runtime: null,
    vote_average: null, vote_count: 0, original_language: null,
    production_countries: [], release_date: null,
  }
}

export async function getCredits(tmdbId: number, opts: FetchOptions = {}): Promise<TmdbCredits> {
  const cached = await cache.getCredits(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) return { directors: [], actors: [] }

  const data = await fetchJsonPost<{ results?: Array<{ credits?: TmdbCredits }> }>(
    `${API_BASE}/tmdb/movies/credits/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.credits) {
    const out: TmdbCredits = { directors: result.credits.directors || [], actors: result.credits.actors || [] }
    await cache.setCredits(tmdbId, out)
    return out
  }
  return { directors: [], actors: [] }
}

export async function getKeywords(tmdbId: number, opts: FetchOptions = {}): Promise<TmdbKeywords> {
  const cached = await cache.getKeywords(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) return { keywords: [] }

  const data = await fetchJsonPost<{ results?: Array<{ keywords?: string[] }> }>(
    `${API_BASE}/tmdb/movies/keywords/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.keywords) {
    const out: TmdbKeywords = { keywords: result.keywords || [] }
    await cache.setKeywords(tmdbId, out)
    return out
  }
  return { keywords: [] }
}

function runQueue<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
  opts: { signal?: AbortSignal; onProgress?: (done: number, total: number) => void } = {}
): Promise<T[]> {
  const { signal, onProgress } = opts
  return new Promise((resolve, reject) => {
    let index = 0
    let inFlight = 0
    const results: T[] = []
    const next = () => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      while (inFlight < concurrency && index < tasks.length) {
        const i = index++
        if (i >= tasks.length) break
        const task = tasks[i]
        if (!task) break
        inFlight++
        task()
          .then((v) => {
            results[i] = v
            inFlight--
            if (onProgress) onProgress(i + 1, tasks.length)
            next()
          })
          .catch((err) => {
            inFlight--
            reject(err)
          })
      }
      if (inFlight === 0 && index >= tasks.length) resolve(results)
    }
    next()
  })
}

interface Batch<T> {
  items: T[]
  startIndex: number
}

/**
 * Process items in batches with a concurrency limit. As soon as one batch request
 * completes, the next one is started (no waiting for the whole "wave"). All
 * requests go to the backend API.
 */
function processBatchesParallel<T, R>(
  items: T[],
  batchSize: number,
  parallelBatches: number,
  processor: (chunk: T[], startIndex: number) => Promise<R[]>,
  opts: { signal?: AbortSignal; onProgress?: (progress: { done: number; total: number }) => void } = {}
): Promise<R[]> {
  const { signal, onProgress } = opts
  const batches: Batch<T>[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push({
      items: items.slice(i, i + batchSize),
      startIndex: i,
    })
  }

  let processed = 0
  const results: R[][] = new Array(batches.length)

  return new Promise((resolve, reject) => {
    let index = 0
    let inFlight = 0

    const next = () => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      while (inFlight < parallelBatches && index < batches.length) {
        const i = index++
        const batch = batches[i]
        if (!batch) break
        inFlight++
        Promise.resolve(processor(batch.items, batch.startIndex))
          .then((batchResults) => {
            results[i] = batchResults
            processed += batch.items.length
            if (onProgress) onProgress({ done: processed, total: items.length })
            inFlight--
            next()
          })
          .catch((err) => {
            inFlight--
            reject(err)
          })
      }
      if (inFlight === 0 && index >= batches.length) {
        resolve(results.flat())
      }
    }
    next()
  })
}

const CONCURRENCY_SEARCH = 3

function emptyFilm(row: FilmRow): Film {
  return {
    ...row,
    tmdb_id: null,
    poster_path: null,
    poster_url: null,
    poster_url_w342: null,
    tmdb_vote_average: null,
    tmdb_vote_count: 0,
    tmdb_stars: null,
    genres: [],
    keywords: [],
    directors: [],
    actors: [],
    countries: [],
    runtime: null,
    original_language: null,
  }
}

async function searchBatch(items: SearchItem[], opts: FetchOptions = {}): Promise<SearchResult[]> {
  const { signal, onRetryMessage } = opts
  const data = await fetchJsonPost<{ results?: SearchResult[] }>(
    `${API_BASE}/tmdb/search/batch`,
    { items },
    { signal, onRetryMessage }
  )
  return data.results || []
}

/**
 * Progressive staged analysis: Stage 2 (search) -> Stage 3 (movie with credits and keywords).
 * Stage 1 is computed by caller from rows. onPartialResult(partial) called after each stage for progressive UI.
 */
export async function runStagedAnalysis(
  rows: FilmRow[],
  { onProgress, onPartialResult, signal, onRetryMessage }: RunStagedAnalysisOptions = {}
): Promise<Film[]> {
  const fetchOpts: FetchOptions = { signal, onRetryMessage }

  const keyToIndexes = new Map<string, number[]>()
  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    if (!keyToIndexes.has(k)) keyToIndexes.set(k, [])
    keyToIndexes.get(k)!.push(i)
  })
  const uniqueKeys = [...keyToIndexes.keys()]
  const resolvedTmdbIds = new Array<number | null>(rows.length).fill(null)
  const keyToTmdbId = new Map<string, number | null>()

  // Stage 2: Search
  {
    let searchDone = 0
    const searchItems: SearchItem[] = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? (parts.pop() ?? '0') : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return {
        title,
        year: Number.isNaN(year) ? null : year,
      }
    })

    const batchProcessor = async (chunk: SearchItem[], startIndex: number): Promise<SearchResult[]> => {
      const chunkKeys = uniqueKeys.slice(startIndex, startIndex + chunk.length)
      try {
        const results = await searchBatch(chunk, fetchOpts)
        
        const cachePromises: Promise<void>[] = []
        results.forEach((result, idx) => {
          if (idx >= chunkKeys.length) return
          const key = chunkKeys[idx]
          if (!key) return
          const tmdbId = result.tmdb?.tmdb_id ?? null
          keyToTmdbId.set(key, tmdbId)
          
          if (tmdbId && result.tmdb) {
            cachePromises.push(
              cache.setMovie(tmdbId, {
                id: result.tmdb.tmdb_id,
                poster_path: result.tmdb.poster_path ?? null,
                genres: result.tmdb.genres || [],
                runtime: result.tmdb.runtime ?? null,
                vote_average: result.tmdb.vote_average ?? null,
                vote_count: result.tmdb.vote_count || 0,
                original_language: result.tmdb.original_language ?? null,
                production_countries: result.tmdb.production_countries || [],
                release_date: result.tmdb.release_date ?? null,
              }).catch((err) => {
                console.warn('Failed to cache movie:', err)
              })
            )
          }
          cachePromises.push(
            cache.setSearch(result.title, result.year, tmdbId).catch((err) => {
              console.warn('Failed to cache search:', err)
            })
          )
        })
        
        await Promise.allSettled(cachePromises)
        if (cachePromises.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        return results
      } catch (err) {
        const error = err as Error & { name?: string }
        if (error?.name === 'AbortError') throw err
        console.warn('Batch search failed, falling back to individual requests', err)
        const searchTasks = chunk.map((_, idx) => {
          const k = chunkKeys[idx]
          if (!k) return async () => null
          const parts = k.split(':')
          const yearPart = parts.length > 1 ? (parts.pop() ?? '0') : '0'
          const title = parts.join(':') || ''
          const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
          return async () => {
            try {
              return await searchMovie(title, Number.isNaN(year) ? null : year, fetchOpts)
            } catch {
              return null
            }
          }
        })
        const fallbackResults = await runQueue(searchTasks, CONCURRENCY_SEARCH, { signal })
        chunkKeys.forEach((key, i) => {
          if (key && fallbackResults[i] !== undefined) {
            keyToTmdbId.set(key, fallbackResults[i] ?? null)
          }
        })
        return fallbackResults.map((id, idx) => {
          const item = chunk[idx]
          return { tmdb: id ? { tmdb_id: id } : undefined, title: item?.title || '', year: item?.year ?? null }
        })
      }
    }
    
    const searchParams = getBatchParams(searchItems.length)
    await processBatchesParallel(
      searchItems,
      searchParams.batchSize,
      searchParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          searchDone = done
          if (onProgress) {
            const calculatedPercent = 8 + Math.min(52, Math.round((searchDone / uniqueKeys.length) * 52))
            onProgress({
              stage: 'tmdb_search',
              message: `Поиск фильмов в TMDb: ${searchDone} / ${uniqueKeys.length}`,
              done: searchDone,
              total: uniqueKeys.length,
              percent: calculatedPercent,
            })
          }
        },
      }
    )
  }

  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    resolvedTmdbIds[i] = keyToTmdbId.get(k) ?? null
  })

  const filmsStage2: Film[] = rows.map((row, i) => ({ ...row, tmdb_id: resolvedTmdbIds[i] ?? null } as Film))
  if (onPartialResult) onPartialResult({ stage: 2, films: filmsStage2 })

  const uniqueIds = [...new Set(resolvedTmdbIds.filter((id): id is number => id !== null))]
  const movieMap = new Map<number, TmdbMovie>()
  const creditsMap = new Map<number, TmdbCredits>()
  const keywordsMap = new Map<number, TmdbKeywords>()

  // Stage 3: Load full metadata (movies + credits + keywords) using unified endpoint
  if (uniqueIds.length > 0) {
    let fullDone = 0
    const batchProcessor = async (chunk: number[]): Promise<BatchResult[]> => {
      try {
        const data = await fetchJsonPost<{ results?: BatchResult[] }>(
          `${API_BASE}/tmdb/movies/full/batch`,
          { tmdb_ids: chunk },
          fetchOpts
        )
        
        const cachePromises: Promise<void>[] = []
        
        data.results?.forEach((result) => {
          if (result.movie) {
            const movie: TmdbMovie = {
              id: result.movie.id,
              poster_path: result.movie.poster_path ?? null,
              genres: result.movie.genres || [],
              runtime: result.movie.runtime ?? null,
              vote_average: result.movie.vote_average ?? null,
              vote_count: result.movie.vote_count || 0,
              original_language: result.movie.original_language ?? null,
              production_countries: result.movie.production_countries || [],
              release_date: result.movie.release_date ?? null,
            }
            movieMap.set(result.tmdb_id, movie)
            cachePromises.push(
              cache.setMovie(result.tmdb_id, movie).catch((err) => {
                console.warn('Failed to cache movie:', err)
              })
            )
          }
          if (result.credits) {
            creditsMap.set(result.tmdb_id, result.credits)
            cachePromises.push(
              cache.setCredits(result.tmdb_id, result.credits).catch((err) => {
                console.warn('Failed to cache credits:', err)
              })
            )
          }
          if (result.keywords) {
            let keywords: TmdbKeywords
            if (Array.isArray(result.keywords)) {
              keywords = { keywords: result.keywords }
            } else if (result.keywords && typeof result.keywords === 'object' && 'keywords' in result.keywords) {
              keywords = { keywords: Array.isArray(result.keywords.keywords) ? result.keywords.keywords : [] }
            } else {
              keywords = { keywords: [] }
            }
            keywordsMap.set(result.tmdb_id, keywords)
            cachePromises.push(
              cache.setKeywords(result.tmdb_id, keywords).catch((err) => {
                console.warn('Failed to cache keywords:', err)
              })
            )
          }
        })
        
        await Promise.allSettled(cachePromises)
        if (cachePromises.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        return data.results || []
      } catch (err) {
        const error = err as Error & { name?: string }
        if (error?.name === 'AbortError') throw err
        // Fallback: return empty results for failed batch
        return chunk.map((id) => ({ tmdb_id: id, movie: null, credits: null, keywords: null }))
      }
    }
    
    const fullParams = getBatchParams(uniqueIds.length)
    await processBatchesParallel(
      uniqueIds,
      fullParams.batchSize,
      fullParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          fullDone = done
          if (onProgress) {
            const calculatedPercent = 60 + Math.min(35, Math.round((fullDone / uniqueIds.length) * 35))
            onProgress({
              stage: 'tmdb_details',
              message: `Загрузка данных TMDb: ${fullDone} / ${uniqueIds.length}`,
              done: fullDone,
              total: uniqueIds.length,
              percent: calculatedPercent,
            })
          }
        },
      }
    )
  }

  // Build films array with all metadata
  const films: Film[] = rows.map((row, i) => {
    const tmdbId = resolvedTmdbIds[i]
    if (!tmdbId) return emptyFilm(row)
    const movie = movieMap.get(tmdbId)
    const credits = creditsMap.get(tmdbId)
    const keywordsData = keywordsMap.get(tmdbId)
    const keywords = keywordsData?.keywords || []
    
    const poster_path = movie?.poster_path ?? null
    const poster_url = getTmdbImageUrl(poster_path, 'w500')
    const poster_url_w342 = getTmdbImageUrl(poster_path, 'w342')
    const va = movie?.vote_average ?? null
    const vc = movie?.vote_count ?? 0
    
    const directors = credits?.directors || []
    const actors = credits?.actors || []
    
    return {
      ...row,
      tmdb_id: tmdbId,
      poster_path,
      poster_url,
      poster_url_w342,
      tmdb_vote_average: va,
      tmdb_vote_count: vc,
      tmdb_stars: tmdbRating5(va),
      genres: movie?.genres || [],
      keywords,
      directors,
      actors,
      countries: movie?.production_countries || [],
      runtime: movie?.runtime ?? null,
      original_language: movie?.original_language ?? null,
    }
  })

  if (onPartialResult) onPartialResult({ stage: 3, films })
  
  const warnings: string[] = []
  if (onPartialResult) onPartialResult({ stage: 4, films, warnings })
  
  return films
}

export async function enrichFilmsPhase1Only(
  rows: FilmRow[],
  onProgress: (progress: Progress) => void,
  opts: FetchOptions = {}
): Promise<Film[]> {
  const { signal, onRetryMessage } = opts
  const total = rows.length
  const concurrency = total > HIGH_LOAD_THRESHOLD ? HIGH_LOAD_CONCURRENCY : DEFAULT_CONCURRENCY
  const batchSize = Math.min(MAX_IN_FLIGHT, Math.max(concurrency * 2, 50))
  const fetchOpts: FetchOptions = { signal, onRetryMessage }

  const keyToIndexes = new Map<string, number[]>()
  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    if (!keyToIndexes.has(k)) keyToIndexes.set(k, [])
    keyToIndexes.get(k)!.push(i)
  })
  const uniqueKeys = [...keyToIndexes.keys()]
  const searchTotal = uniqueKeys.length
  const resolvedTmdbIds = new Array<number | null>(rows.length).fill(null)
  const keyToTmdbId = new Map<string, number | null>()

  {
    const searchItems: SearchItem[] = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? (parts.pop() ?? '0') : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return {
        title,
        year: Number.isNaN(year) ? null : year,
      }
    })

    let searchDone = 0
    const batchProcessor = async (chunk: SearchItem[], startIndex: number): Promise<SearchResult[]> => {
      const chunkKeys = uniqueKeys.slice(startIndex, startIndex + chunk.length)
      try {
        const results = await searchBatch(chunk, fetchOpts)
        
        const cachePromises: Promise<void>[] = []
        results.forEach((result, idx) => {
          if (idx >= chunkKeys.length) return
          const key = chunkKeys[idx]
          if (!key) return
          const tmdbId = result.tmdb?.tmdb_id ?? null
          keyToTmdbId.set(key, tmdbId)
          
          if (tmdbId && result.tmdb) {
            cachePromises.push(
              cache.setMovie(tmdbId, {
                id: result.tmdb.tmdb_id,
                poster_path: result.tmdb.poster_path ?? null,
                genres: result.tmdb.genres || [],
                runtime: result.tmdb.runtime ?? null,
                vote_average: result.tmdb.vote_average ?? null,
                vote_count: result.tmdb.vote_count || 0,
                original_language: result.tmdb.original_language ?? null,
                production_countries: result.tmdb.production_countries || [],
                release_date: result.tmdb.release_date ?? null,
              }).catch((err) => {
                console.warn('Failed to cache movie:', err)
              })
            )
          }
          cachePromises.push(
            cache.setSearch(result.title, result.year, tmdbId).catch((err) => {
              console.warn('Failed to cache search:', err)
            })
          )
        })
        
        await Promise.allSettled(cachePromises)
        if (cachePromises.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        return results
      } catch (err) {
        const error = err as Error & { name?: string }
        if (error?.name === 'AbortError') throw err
        const searchTasks = chunk.map((_, idx) => {
          const k = chunkKeys[idx]
          if (!k) return async () => null
          const parts = k.split(':')
          const yearPart = parts.length > 1 ? (parts.pop() ?? '0') : '0'
          const title = parts.join(':') || ''
          const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
          return async () => searchMovie(title, Number.isNaN(year) ? null : year, fetchOpts)
        })
        const fallbackResults = await runQueue(searchTasks, concurrency, { signal })
        chunkKeys.forEach((key, i) => {
          if (key && fallbackResults[i] !== undefined) {
            keyToTmdbId.set(key, fallbackResults[i] ?? null)
          }
        })
        return fallbackResults.map((id, idx) => {
          const item = chunk[idx]
          return { tmdb: id ? { tmdb_id: id } : undefined, title: item?.title || '', year: item?.year ?? null }
        })
      }
    }
    
    const searchParams = getBatchParams(searchItems.length)
    await processBatchesParallel(
      searchItems,
      searchParams.batchSize,
      searchParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          searchDone = done
          if (onProgress) {
            onProgress({
              stage: 'tmdb_search',
              message: `Поиск фильмов в TMDb: ${searchDone} / ${searchTotal}`,
              done: searchDone,
              total: searchTotal,
              percent: 8 + Math.min(52, Math.round((searchDone / searchTotal) * 52)),
            })
          }
        },
      }
    )
  }

  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    resolvedTmdbIds[i] = keyToTmdbId.get(k) ?? null
  })

  const uniqueIds = [...new Set(resolvedTmdbIds.filter((id): id is number => id !== null))]
  const movieTotal = uniqueIds.length
  const movieMap = new Map<number, TmdbMovie>()

  const movieTasks = uniqueIds.map((id) => async () => {
    const movie = await getMovieMinimal(id, fetchOpts)
    movieMap.set(id, movie)
    return movie
  })

  let movieDone = 0
  for (let j = 0; j < movieTasks.length; j += batchSize) {
    const chunk = movieTasks.slice(j, j + batchSize)
    await runQueue(chunk, concurrency, {
      signal,
      onProgress: (done) => {
        movieDone = j + done
        if (onProgress) {
          onProgress({
            stage: 'tmdb_details',
            message: `Загрузка данных TMDb: ${movieDone} / ${movieTotal}`,
            done: movieDone,
            total: movieTotal,
            percent: 60 + Math.min(35, Math.round((movieDone / movieTotal) * 35)),
          })
        }
      },
    })
  }

  const films: Film[] = rows.map((row, i) => {
    const tmdbId = resolvedTmdbIds[i]
    if (!tmdbId) {
      return {
        ...row,
        tmdb_id: null,
        poster_path: null,
        poster_url: null,
        poster_url_w342: null,
        tmdb_vote_average: null,
        tmdb_vote_count: 0,
        tmdb_stars: null,
        genres: [],
        keywords: [],
        directors: [],
        actors: [],
        countries: [],
        runtime: null,
        original_language: null,
      }
    }
    const movie = movieMap.get(tmdbId)
    const poster_path = movie?.poster_path ?? null
    const poster_url = getTmdbImageUrl(poster_path, 'w500')
    const poster_url_w342 = getTmdbImageUrl(poster_path, 'w342')
    const va = movie?.vote_average ?? null
    const vc = movie?.vote_count ?? 0
    return {
      ...row,
      tmdb_id: tmdbId,
      poster_path,
      poster_url,
      poster_url_w342,
      tmdb_vote_average: va,
      tmdb_vote_count: vc,
      tmdb_stars: tmdbRating5(va),
      genres: movie?.genres || [],
      keywords: [],
      directors: [],
      actors: [],
      countries: movie?.production_countries || [],
      runtime: movie?.runtime ?? null,
      original_language: movie?.original_language ?? null,
    }
  })

  return films
}
