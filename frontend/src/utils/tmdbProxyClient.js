import * as cache from './indexedDbCache.js'
import { fetchWithRetry } from './fetchWithRetry.js'

const API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')

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
  
  if (!API_BASE) throw new Error('VITE_API_URL must be set')
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
const CONCURRENCY_MOVIE = 3
const CONCURRENCY_CREDITS = 1
const CONCURRENCY_KEYWORDS = 1
const CREDITS_CAP = 400
const KEYWORDS_CAP = 400

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
  if (!API_BASE) {
    throw new Error('VITE_API_URL не задан')
  }
  const { signal, onRetryMessage } = opts
  const data = await fetchJsonPost(
    `${API_BASE}/tmdb/search/batch`,
    { items },
    { signal, onRetryMessage }
  )
  return data.results || []
}

/**
 * Progressive staged analysis: Stage 2 (search) -> Stage 3 (movie) -> Stage 4 (credits/keywords capped).
 * Stage 1 is computed by caller from rows. onPartialResult(partial) called after each stage for progressive UI.
 */
export async function runStagedAnalysis(rows, { onProgress, onPartialResult, signal, onRetryMessage } = {}) {
  if (!API_BASE) throw new Error('VITE_API_URL должен быть задан')
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
            const calculatedPercent = 8 + Math.min(67, Math.round((searchDone / uniqueKeys.length) * 67))
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

  if (uniqueIds.length > 0) {
    let movieDone = 0
    const batchProcessor = async (chunk) => {
      try {
        const data = await fetchJsonPost(
          `${API_BASE}/tmdb/movies/batch`,
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
        })
        
        await Promise.allSettled(cachePromises)
        if (cachePromises.length > 0) {
          await new Promise(resolve => setTimeout(resolve, 10))
        }
        
        return data.results || []
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        const movieTasks = chunk.map((id) => async () => {
          try {
            const movie = await getMovieMinimal(id, fetchOpts)
            movieMap.set(id, movie)
            return movie
          } catch {
            return null
          }
        })
        await runQueue(movieTasks, CONCURRENCY_MOVIE, { signal })
        return chunk.map(() => ({ movie: null }))
      }
    }
    
    const movieParams = getBatchParams(uniqueIds.length)
    await processBatchesParallel(
      uniqueIds,
      movieParams.batchSize,
      movieParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          movieDone = done
          if (onProgress) {
            const calculatedPercent = 75 + Math.min(15, Math.round((movieDone / uniqueIds.length) * 15))
            onProgress({
              stage: 'tmdb_details',
              message: `Загрузка данных TMDb: ${movieDone} / ${uniqueIds.length}`,
              done: movieDone,
              total: uniqueIds.length,
              percent: calculatedPercent,
            })
          }
        },
      }
    )
  }

  const films = rows.map((row, i) => {
    const tmdbId = resolvedTmdbIds[i]
    if (!tmdbId) return emptyFilm(row)
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

  if (onPartialResult) onPartialResult({ stage: 3, films })

  const byRating = [...films].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0))
  const gemScore = (f) => {
    const u = f.rating ?? 0
    const t = f.tmdb_stars
    const vc = f.tmdb_vote_count ?? 0
    if (u < 3.5 || vc < 200 || t == null) return -999
    return u - t
  }
  const overScore = (f) => {
    const t = f.tmdb_stars
    const u = f.rating ?? 0
    if (t == null) return -999
    return t - u
  }
  const idsForCredits = new Set()
  byRating.slice(0, 250).forEach((f) => f.tmdb_id && idsForCredits.add(f.tmdb_id))
  films.slice().sort((a, b) => gemScore(b) - gemScore(a)).slice(0, 150).forEach((f) => {
    if (gemScore(f) >= 1.5 && f.tmdb_id) idsForCredits.add(f.tmdb_id)
  })
  films.slice().sort((a, b) => overScore(b) - overScore(a)).slice(0, 150).forEach((f) => {
    if (f.tmdb_id) idsForCredits.add(f.tmdb_id)
  })
  const idList = Array.from(idsForCredits).slice(0, CREDITS_CAP)
  const creditsMap = new Map()
  const keywordsMap = new Map()
  const creditsToFetch = idList.slice(0, CREDITS_CAP)
  const keywordsToFetch = idList.slice(0, KEYWORDS_CAP)

  if (creditsToFetch.length > 0) {
    let creditsDone = 0
    const batchProcessor = async (chunk) => {
      try {
        const data = await fetchJsonPost(
          `${API_BASE}/tmdb/movies/credits/batch`,
          { tmdb_ids: chunk },
          fetchOpts
        )
        
        const cachePromises = []
        data.results?.forEach((result) => {
          if (result.credits) {
            creditsMap.set(result.tmdb_id, result.credits)
            cachePromises.push(
              cache.setCredits(result.tmdb_id, result.credits).catch((err) => {
                console.warn('Failed to cache credits:', err)
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
        const creditTasks = chunk.map((id) => async () => {
          try {
            return await getCredits(id, fetchOpts)
          } catch {
            return null
          }
        })
        const results = await runQueue(creditTasks, CONCURRENCY_CREDITS, { signal })
        chunk.forEach((id, i) => { if (results[i]) creditsMap.set(id, results[i]) })
        return results.map((credits, i) => ({ tmdb_id: chunk[i], credits }))
      }
    }
    
    const creditsParams = getBatchParams(creditsToFetch.length)
    await processBatchesParallel(
      creditsToFetch,
      creditsParams.batchSize,
      creditsParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          creditsDone = done
          if (onProgress) {
            onProgress({
              stage: 'credits_keywords',
              message: 'Загрузка актёров и режиссёров (опционально)',
              done: creditsDone,
              total: creditsToFetch.length,
              percent: 90 + Math.min(2.5, Math.round((creditsDone / creditsToFetch.length) * 2.5)),
            })
          }
        },
      }
    )
  }

  if (keywordsToFetch.length > 0) {
    let keywordsDone = 0
    const batchProcessor = async (chunk) => {
      try {
        const data = await fetchJsonPost(
          `${API_BASE}/tmdb/movies/keywords/batch`,
          { tmdb_ids: chunk },
          fetchOpts
        )
        
        const cachePromises = []
        data.results?.forEach((result) => {
          if (result.keywords) {
            keywordsMap.set(result.tmdb_id, { keywords: result.keywords })
            cachePromises.push(
              cache.setKeywords(result.tmdb_id, result.keywords).catch((err) => {
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
        const keywordTasks = chunk.map((id) => async () => {
          try {
            return await getKeywords(id, fetchOpts)
          } catch {
            return null
          }
        })
        const results = await runQueue(keywordTasks, CONCURRENCY_KEYWORDS, { signal })
        chunk.forEach((id, i) => { if (results[i]) keywordsMap.set(id, results[i]) })
        return results.map((keywords, i) => ({ tmdb_id: chunk[i], keywords: keywords?.keywords || [] }))
      }
    }
    
    const keywordsParams = getBatchParams(keywordsToFetch.length)
    await processBatchesParallel(
      keywordsToFetch,
      keywordsParams.batchSize,
      keywordsParams.parallelBatches,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          keywordsDone = done
          if (onProgress) {
            onProgress({
              stage: 'credits_keywords',
              message: 'Загрузка актёров и режиссёров (опционально)',
              done: keywordsDone,
              total: keywordsToFetch.length,
              percent: 92.5 + Math.min(2.5, Math.round((keywordsDone / keywordsToFetch.length) * 2.5)),
            })
          }
        },
      }
    )
  }

  films.forEach((f) => {
    const id = f.tmdb_id
    if (!id) return
    const cred = creditsMap.get(id)
    if (cred) {
      f.directors = (cred.directors || []).slice(0, 10)
      f.actors = (cred.actors || []).slice(0, 20)
    }
    const kw = keywordsMap.get(id)
    if (kw) f.keywords = (kw.keywords || []).slice(0, 20)
  })

  const warnings = []
  if (idList.length >= CREDITS_CAP) warnings.push('Большой файл: загрузка актёров/режиссёров ограничена для стабильности.')
  if (onPartialResult) onPartialResult({ stage: 4, films, warnings })
  return films
}

export async function enrichFilmsPhase1Only(rows, onProgress, opts = {}) {
  const { signal, onRetryMessage } = opts
  if (!API_BASE) throw new Error('VITE_API_URL должен быть задан')
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
              percent: 8 + Math.min(67, Math.round((searchDone / searchTotal) * 67)),
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
            percent: 75 + Math.min(15, Math.round((movieDone / movieTotal) * 15)),
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
