import * as cache from './indexedDbCache.js'
import { fetchWithRetry } from './fetchWithRetry.js'

// Для локальной разработки используем localhost:8000 если VITE_API_URL не задан
const envApiUrl = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const API_BASE = envApiUrl || 'http://localhost:8000'

/**
 * Generate proxy URL for TMDB images
 */
function getTmdbImageUrl(poster_path, size = 'w500') {
  if (!poster_path || !API_BASE) return null
  // Remove leading slash if present
  const path = poster_path.startsWith('/') ? poster_path.slice(1) : poster_path
  return `${API_BASE}/tmdb/image/${size}/${path}`
}

const DEFAULT_CONCURRENCY = 4
const HIGH_LOAD_CONCURRENCY = 2
const HIGH_LOAD_THRESHOLD = 5000
const MAX_IN_FLIGHT = 200


/**
 * Adaptive batch processing parameters based on data volume.
 * Optimized for smooth progress and maximum backend utilization (TMDb ~25 req/s).
 */
function getBatchParams(totalItems) {
  if (totalItems <= 1000) {
    // Small volume (≤1000): maximize speed with smooth progress
    return { batchSize: 100, parallelBatches: 6 }
  } else {
    // Large volume (1000-10000): balance speed and stability
    return { batchSize: 80, parallelBatches: 5 }
  }
}

function tmdbRating5(voteAverage) {
  if (voteAverage == null || Number.isNaN(voteAverage)) return null
  return Math.round((voteAverage / 2) * 10) / 10
}

function searchKey(title, year) {
  return `${(title || '').trim().toLowerCase()}:${year ?? 0}`
}

async function fetchJsonPost(url, body, opts = {}) {
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
  return data
}

export async function searchMovie(title, year, opts = {}) {
  const cached = await cache.getSearch(title, year)
  if (cached !== undefined) return cached
  
  const data = await fetchJsonPost(
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
        poster_path: result.tmdb.poster_path,
        genres: result.tmdb.genres || [],
        runtime: result.tmdb.runtime,
        vote_average: result.tmdb.vote_average,
        vote_count: result.tmdb.vote_count || 0,
        original_language: result.tmdb.original_language,
        production_countries: result.tmdb.production_countries || [],
        release_date: result.tmdb.release_date,
      })
    }
    return id
  }
  return null
}

export async function getMovieMinimal(tmdbId, opts = {}) {
  const cached = await cache.getMovie(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) {
    return {
      id: tmdbId, poster_path: null, genres: [], runtime: null,
      vote_average: null, vote_count: 0, original_language: null,
      production_countries: [], release_date: null,
    }
  }

  const data = await fetchJsonPost(
    `${API_BASE}/tmdb/movies/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.movie) {
    const out = {
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

export async function getCredits(tmdbId, opts = {}) {
  const cached = await cache.getCredits(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) return { directors: [], actors: [] }

  const data = await fetchJsonPost(
    `${API_BASE}/tmdb/movies/credits/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.credits) {
    const out = { directors: result.credits.directors || [], actors: result.credits.actors || [] }
    await cache.setCredits(tmdbId, out)
    return out
  }
  return { directors: [], actors: [] }
}

export async function getKeywords(tmdbId, opts = {}) {
  const cached = await cache.getKeywords(tmdbId)
  if (cached) return cached
  
  if (!API_BASE) return { keywords: [] }

  const data = await fetchJsonPost(
    `${API_BASE}/tmdb/movies/keywords/batch`,
    { tmdb_ids: [tmdbId] },
    opts
  )
  const result = data.results?.[0]
  if (result && result.keywords) {
    const out = { keywords: result.keywords || [] }
    await cache.setKeywords(tmdbId, out)
    return out
  }
  return { keywords: [] }
}

function runQueue(tasks, concurrency, opts = {}) {
  const { signal, onProgress } = opts
  return new Promise((resolve, reject) => {
    let index = 0
    let inFlight = 0
    const results = []
    const next = () => {
      if (signal?.aborted) {
        reject(new DOMException('Aborted', 'AbortError'))
        return
      }
      while (inFlight < concurrency && index < tasks.length) {
        const i = index++
        if (i >= tasks.length) break
        inFlight++
        tasks[i]()
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

/**
 * Process items in batches with a concurrency limit. As soon as one batch request
 * completes, the next one is started (no waiting for the whole "wave"). All
 * requests go to the backend API.
 */
function processBatchesParallel(items, batchSize, parallelBatches, processor, opts = {}) {
  const { signal, onProgress } = opts
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push({
      items: items.slice(i, i + batchSize),
      startIndex: i,
    })
  }

  let processed = 0
  const results = new Array(batches.length)

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

function emptyFilm(row) {
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

async function searchBatch(items, opts = {}) {
  const { signal, onRetryMessage } = opts
  const data = await fetchJsonPost(
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
export async function runStagedAnalysis(rows, { onProgress, onPartialResult, signal, onRetryMessage } = {}) {
  const fetchOpts = { signal, onRetryMessage }

  const keyToIndexes = new Map()
  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    if (!keyToIndexes.has(k)) keyToIndexes.set(k, [])
    keyToIndexes.get(k).push(i)
  })
  const uniqueKeys = [...keyToIndexes.keys()]
  const resolvedTmdbIds = new Array(rows.length).fill(null)
  const keyToTmdbId = new Map()

  // Stage 2: Search
  {
    let searchDone = 0
    const searchItems = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? parts.pop() : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return {
        title,
        year: Number.isNaN(year) ? null : year,
      }
    })

    const batchProcessor = async (chunk, startIndex) => {
      const chunkKeys = uniqueKeys.slice(startIndex, startIndex + chunk.length)
      try {
        const results = await searchBatch(chunk, fetchOpts)
        
        const cachePromises = []
        results.forEach((result, idx) => {
          if (idx >= chunkKeys.length) return
          const key = chunkKeys[idx]
          const tmdbId = result.tmdb?.tmdb_id ?? null
          keyToTmdbId.set(key, tmdbId)
          
          if (tmdbId && result.tmdb) {
            cachePromises.push(
              cache.setMovie(tmdbId, {
                id: result.tmdb.tmdb_id,
                poster_path: result.tmdb.poster_path,
                genres: result.tmdb.genres || [],
                runtime: result.tmdb.runtime,
                vote_average: result.tmdb.vote_average,
                vote_count: result.tmdb.vote_count || 0,
                original_language: result.tmdb.original_language,
                production_countries: result.tmdb.production_countries || [],
                release_date: result.tmdb.release_date,
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
        if (err?.name === 'AbortError') throw err
        console.warn('Batch search failed, falling back to individual requests', err)
        const searchTasks = chunk.map((item, idx) => {
          const k = chunkKeys[idx]
          const parts = k.split(':')
          const yearPart = parts.length > 1 ? parts.pop() : '0'
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
        chunkKeys.forEach((key, i) => keyToTmdbId.set(key, fallbackResults[i]))
        return fallbackResults.map((id, i) => ({ tmdb: id ? { tmdb_id: id } : null }))
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

  const filmsStage2 = rows.map((row, i) => ({ ...row, tmdb_id: resolvedTmdbIds[i] ?? null }))
  if (onPartialResult) onPartialResult({ stage: 2, films: filmsStage2 })

  const uniqueIds = [...new Set(resolvedTmdbIds.filter(Boolean))]
  const movieMap = new Map()
  const creditsMap = new Map()
  const keywordsMap = new Map()

  // Stage 3: Load full metadata (movies + credits + keywords) using unified endpoint
  if (uniqueIds.length > 0) {
    let fullDone = 0
    const batchProcessor = async (chunk) => {
      try {
        const data = await fetchJsonPost(
          `${API_BASE}/tmdb/movies/full/batch`,
          { tmdb_ids: chunk },
          fetchOpts
        )
        
        const cachePromises = []
        
        data.results?.forEach((result) => {
          if (result.movie) {
            const movie = {
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
            const keywords = Array.isArray(result.keywords) ? result.keywords : []
            keywordsMap.set(result.tmdb_id, { keywords })
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
        if (err?.name === 'AbortError') throw err
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
  const films = rows.map((row, i) => {
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
  
  const warnings = []
  if (onPartialResult) onPartialResult({ stage: 4, films, warnings })
  
  return films
}

export async function enrichFilmsPhase1Only(rows, onProgress, opts = {}) {
  const { signal, onRetryMessage } = opts
  const total = rows.length
  const concurrency = total > HIGH_LOAD_THRESHOLD ? HIGH_LOAD_CONCURRENCY : DEFAULT_CONCURRENCY
  const batchSize = Math.min(MAX_IN_FLIGHT, Math.max(concurrency * 2, 50))
  const fetchOpts = { signal, onRetryMessage }

  const keyToIndexes = new Map()
  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    if (!keyToIndexes.has(k)) keyToIndexes.set(k, [])
    keyToIndexes.get(k).push(i)
  })
  const uniqueKeys = [...keyToIndexes.keys()]
  const searchTotal = uniqueKeys.length
  const resolvedTmdbIds = new Array(rows.length).fill(null)
  const keyToTmdbId = new Map()

  {
    const searchItems = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? parts.pop() : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return {
        title,
        year: Number.isNaN(year) ? null : year,
      }
    })

    let searchDone = 0
    const batchProcessor = async (chunk, startIndex) => {
      const chunkKeys = uniqueKeys.slice(startIndex, startIndex + chunk.length)
      try {
        const results = await searchBatch(chunk, fetchOpts)
        
        const cachePromises = []
        results.forEach((result, idx) => {
          if (idx >= chunkKeys.length) return
          const key = chunkKeys[idx]
          const tmdbId = result.tmdb?.tmdb_id ?? null
          keyToTmdbId.set(key, tmdbId)
          
          if (tmdbId && result.tmdb) {
            cachePromises.push(
              cache.setMovie(tmdbId, {
                id: result.tmdb.tmdb_id,
                poster_path: result.tmdb.poster_path,
                genres: result.tmdb.genres || [],
                runtime: result.tmdb.runtime,
                vote_average: result.tmdb.vote_average,
                vote_count: result.tmdb.vote_count || 0,
                original_language: result.tmdb.original_language,
                production_countries: result.tmdb.production_countries || [],
                release_date: result.tmdb.release_date,
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
        if (err?.name === 'AbortError') throw err
        const searchTasks = chunk.map((item, idx) => {
          const k = chunkKeys[idx]
          const parts = k.split(':')
          const yearPart = parts.length > 1 ? parts.pop() : '0'
          const title = parts.join(':') || ''
          const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
          return async () => searchMovie(title, Number.isNaN(year) ? null : year, fetchOpts)
        })
        const fallbackResults = await runQueue(searchTasks, concurrency, { signal })
        chunkKeys.forEach((key, i) => keyToTmdbId.set(key, fallbackResults[i]))
        return fallbackResults.map((id, i) => ({ tmdb: id ? { tmdb_id: id } : null }))
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

  const uniqueIds = [...new Set(resolvedTmdbIds.filter(Boolean))]
  const movieTotal = uniqueIds.length
  const movieMap = new Map()

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
      onProgress: (done, batchLen) => {
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

  const films = rows.map((row, i) => {
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
