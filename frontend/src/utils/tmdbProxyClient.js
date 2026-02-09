import * as cache from './indexedDbCache.js'
import { fetchWithRetry } from './fetchWithRetry.js'

const API_BASE = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '')
const PROXY_BASE = (import.meta.env.VITE_TMDB_PROXY_BASE || '').trim().replace(/\/$/, '')
const DEFAULT_CONCURRENCY = 4
const HIGH_LOAD_CONCURRENCY = 2
const HIGH_LOAD_THRESHOLD = 5000
const MAX_IN_FLIGHT = 200
const BATCH_SIZE = 25
const PARALLEL_BATCHES = 3

function tmdbRating5(voteAverage) {
  if (voteAverage == null || Number.isNaN(voteAverage)) return null
  return Math.round((voteAverage / 2) * 10) / 10
}

function searchKey(title, year) {
  return `${(title || '').trim().toLowerCase()}:${year ?? 0}`
}

async function fetchJson(url, opts = {}) {
  const { onRetryMessage, signal } = opts
  const res = await fetchWithRetry(url, { signal }, { onRetryMessage })
  const data = await res.json()
  return data
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
  
  if (API_BASE) {
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
  
  if (!PROXY_BASE) throw new Error('VITE_API_URL or VITE_TMDB_PROXY_BASE must be set')
  const qs = new URLSearchParams({ title: (title || '').trim().slice(0, 120) })
  if (year != null && year >= 1800 && year <= 2100) qs.set('year', String(year))
  const data = await fetchJson(`${PROXY_BASE}/search?${qs}`, opts)
  const id = data.tmdb_id ?? null
  await cache.setSearch(title, year, id)
  return id
}

export async function getMovieMinimal(tmdbId, opts = {}) {
  const cached = await cache.getMovie(tmdbId)
  if (cached) return cached
  
  if (API_BASE) {
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
      id: tmdbId,
      poster_path: null,
      genres: [],
      runtime: null,
      vote_average: null,
      vote_count: 0,
      original_language: null,
      production_countries: [],
      release_date: null,
    }
  }
  
  if (!PROXY_BASE) {
    return {
      id: tmdbId,
      poster_path: null,
      genres: [],
      runtime: null,
      vote_average: null,
      vote_count: 0,
      original_language: null,
      production_countries: [],
      release_date: null,
    }
  }
  
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}`, opts)
  const out = {
    id: data.id,
    poster_path: data.poster_path ?? null,
    genres: data.genres || [],
    runtime: data.runtime ?? null,
    vote_average: data.vote_average ?? null,
    vote_count: data.vote_count ?? 0,
    original_language: data.original_language ?? null,
    production_countries: data.production_countries || [],
    release_date: data.release_date ?? null,
  }
  await cache.setMovie(tmdbId, out)
  return out
}

export async function getCredits(tmdbId, opts = {}) {
  const cached = await cache.getCredits(tmdbId)
  if (cached) return cached
  
  if (API_BASE) {
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
  
  if (!PROXY_BASE) return { directors: [], actors: [] }
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}/credits`, opts)
  const out = { directors: data.directors || [], actors: data.actors || [] }
  await cache.setCredits(tmdbId, out)
  return out
}

export async function getKeywords(tmdbId, opts = {}) {
  const cached = await cache.getKeywords(tmdbId)
  if (cached) return cached
  
  if (API_BASE) {
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
  
  if (!PROXY_BASE) return { keywords: [] }
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}/keywords`, opts)
  const out = { keywords: data.keywords || [] }
  await cache.setKeywords(tmdbId, out)
  return out
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

async function processBatchesParallel(items, batchSize, parallelBatches, processor, opts = {}) {
  const { signal, onProgress } = opts
  const batches = []
  for (let i = 0; i < items.length; i += batchSize) {
    batches.push({
      items: items.slice(i, i + batchSize),
      startIndex: i,
    })
  }
  
  let processed = 0
  const results = []
  
  for (let i = 0; i < batches.length; i += parallelBatches) {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    
    const batchGroup = batches.slice(i, i + parallelBatches)
    const batchPromises = batchGroup.map(async (batch) => {
      const batchResults = await processor(batch.items, batch.startIndex)
      processed += batch.items.length
      if (onProgress) {
        onProgress({
          done: processed,
          total: items.length,
        })
      }
      return batchResults
    })
    
    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults.flat())
    
    if (i + parallelBatches < batches.length) {
      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }
  
  return results
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
export async function runStagedAnalysis(rows, diaryRows, { onProgress, onPartialResult, signal, onRetryMessage } = {}) {
  if (!API_BASE && !PROXY_BASE) throw new Error('VITE_API_URL или VITE_TMDB_PROXY_BASE должен быть задан')
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

  if (API_BASE) {
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
    
    await processBatchesParallel(
      searchItems,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const searchTasks = uniqueKeys.map((k) => {
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

    let searchDone = 0
    for (let j = 0; j < searchTasks.length; j += 50) {
      const chunk = searchTasks.slice(j, j + 50)
      const chunkKeys = uniqueKeys.slice(j, j + 50)
      const results = await runQueue(chunk, CONCURRENCY_SEARCH, {
        signal,
        onProgress: (done, batchLen) => {
          searchDone = j + done
          const calculatedPercent = 8 + Math.min(67, Math.round((searchDone / uniqueKeys.length) * 67))
          if (onProgress) onProgress({ stage: 'tmdb_search', message: `Поиск фильмов в TMDb: ${searchDone} / ${uniqueKeys.length}`, done: searchDone, total: uniqueKeys.length, percent: calculatedPercent })
        },
      })
      chunkKeys.forEach((key, i) => keyToTmdbId.set(key, results[i]))
    }
  }

  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    resolvedTmdbIds[i] = keyToTmdbId.get(k) ?? null
  })

  const filmsStage2 = rows.map((row, i) => ({ ...row, tmdb_id: resolvedTmdbIds[i] ?? null }))
  if (onPartialResult) onPartialResult({ stage: 2, films: filmsStage2 })

  const uniqueIds = [...new Set(resolvedTmdbIds.filter(Boolean))]
  const movieMap = new Map()

  if (API_BASE && uniqueIds.length > 0) {
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
    
    await processBatchesParallel(
      uniqueIds,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const movieTasks = uniqueIds.map((id) => async () => {
      try {
        const movie = await getMovieMinimal(id, fetchOpts)
        movieMap.set(id, movie)
        return movie
      } catch {
        return null
      }
    })

    let movieDone = 0
    for (let j = 0; j < movieTasks.length; j += 50) {
      const chunk = movieTasks.slice(j, j + 50)
      await runQueue(chunk, CONCURRENCY_MOVIE, {
        signal,
        onProgress: (done, batchLen) => {
          movieDone = j + done
          const calculatedPercent = 75 + Math.min(15, Math.round((movieDone / uniqueIds.length) * 15))
          if (onProgress) onProgress({ stage: 'tmdb_details', message: `Загрузка данных TMDb: ${movieDone} / ${uniqueIds.length}`, done: movieDone, total: uniqueIds.length, percent: calculatedPercent })
        },
      })
    }
  }

  const films = rows.map((row, i) => {
    const tmdbId = resolvedTmdbIds[i]
    if (!tmdbId) return emptyFilm(row)
    const movie = movieMap.get(tmdbId)
    const poster_path = movie?.poster_path ?? null
    const poster_url = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null
    const poster_url_w342 = poster_path ? `https://image.tmdb.org/t/p/w342${poster_path}` : null
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

  if (diaryRows?.length > 0) mergeDiary(films, diaryRows)
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

  if (API_BASE && creditsToFetch.length > 0) {
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
    
    await processBatchesParallel(
      creditsToFetch,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const creditTasks = creditsToFetch.map((id) => async () => {
      try {
        return await getCredits(id, fetchOpts)
      } catch {
        return null
      }
    })

    let creditsDone = 0
    for (let j = 0; j < creditTasks.length; j += 20) {
      const chunk = creditTasks.slice(j, j + 20)
      const chunkIds = creditsToFetch.slice(j, j + 20)
      const results = await runQueue(chunk, CONCURRENCY_CREDITS, {
        signal,
        onProgress: (done, batchLen) => {
          creditsDone = j + done
          if (onProgress) onProgress({ stage: 'credits_keywords', message: 'Загрузка актёров и режиссёров (опционально)', done: creditsDone, total: creditTasks.length, percent: 90 + Math.min(5, Math.round((creditsDone / creditTasks.length) * 5)) })
        },
      })
      chunkIds.forEach((id, i) => { if (results[i]) creditsMap.set(id, results[i]) })
    }
  }

  if (API_BASE && keywordsToFetch.length > 0) {
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
    
    await processBatchesParallel(
      keywordsToFetch,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const keywordTasks = keywordsToFetch.map((id) => async () => {
      try {
        return await getKeywords(id, fetchOpts)
      } catch {
        return null
      }
    })

    let keywordsDone = 0
    for (let j = 0; j < keywordTasks.length; j += 20) {
      const chunk = keywordTasks.slice(j, j + 20)
      const chunkIds = keywordsToFetch.slice(j, j + 20)
      const results = await runQueue(chunk, CONCURRENCY_KEYWORDS, {
        signal,
        onProgress: (done, batchLen) => {
          keywordsDone = j + done
          if (onProgress) onProgress({ stage: 'credits_keywords', message: 'Загрузка актёров и режиссёров (опционально)', done: keywordsDone, total: keywordTasks.length, percent: 90 + Math.min(5, Math.round((keywordsDone / keywordTasks.length) * 5)) })
        },
      })
      chunkIds.forEach((id, i) => { if (results[i]) keywordsMap.set(id, results[i]) })
    }
  }

  films.forEach((f) => {
    const id = f.tmdb_id
    if (!id) return
    const cred = creditsMap.get(id)
    if (cred) {
      f.directors = cred.directors || []
      f.actors = (cred.actors || []).slice(0, 10)
    }
    const kw = keywordsMap.get(id)
    if (kw) f.keywords = (kw.keywords || []).slice(0, 20)
  })

  const warnings = []
  if (idList.length >= CREDITS_CAP) warnings.push('Большой файл: загрузка актёров/режиссёров ограничена для стабильности.')
  if (onPartialResult) onPartialResult({ stage: 4, films, warnings })
  return films
}

function mergeDiary(filmsList, diary) {
  const byUri = new Map()
  const byKey = new Map()
  diary.forEach((e) => {
    const d = e.date && e.date.match(/^\d{4}-\d{2}-\d{2}/) ? e.date.slice(0, 10) : e.date
    if (!d) return
    const name = (e.name || '').toLowerCase().trim()
    const year = e.year ?? 0
    if (e.letterboxd_uri) byUri.set(e.letterboxd_uri, d)
    byKey.set(`${name}:${year}`, d)
  })
  filmsList.forEach((f) => {
    const uri = (f.letterboxd_url || '').trim()
    const name = (f.title || '').toLowerCase().trim()
    const year = f.year ?? 0
    f.watchedDate = (uri && byUri.get(uri)) || byKey.get(`${name}:${year}`) || null
  })
}

/**
 * Smart Phase 1: dedupe search by (title, year); fetch /movie only for unique tmdb_id.
 * Then optionally run Phase 2 (credits/keywords) for selected candidates.
 */
export async function enrichFilmsTwoPhase(rows, diaryRows, onProgress, opts = {}) {
  const { signal, onRetryMessage } = opts
  if (!API_BASE && !PROXY_BASE) throw new Error('VITE_API_URL или VITE_TMDB_PROXY_BASE должен быть задан')
  const total = rows.length
  const concurrency = total > HIGH_LOAD_THRESHOLD ? HIGH_LOAD_CONCURRENCY : DEFAULT_CONCURRENCY
  const batchSize = Math.min(MAX_IN_FLIGHT, Math.max(concurrency * 2, 50))
  const fetchOpts = { signal, onRetryMessage }

  // Step 1: unique search keys
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

  if (API_BASE) {
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
    
    await processBatchesParallel(
      searchItems,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const searchTasks = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? parts.pop() : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return async () => searchMovie(title, Number.isNaN(year) ? null : year, fetchOpts)
    })

    let searchDone = 0
    for (let j = 0; j < searchTasks.length; j += batchSize) {
      const chunk = searchTasks.slice(j, j + batchSize)
      const chunkKeys = uniqueKeys.slice(j, j + batchSize)
      const results = await runQueue(chunk, concurrency, {
        signal,
        onProgress: (done, batchLen) => {
          searchDone = j + done
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
      })
      chunkKeys.forEach((key, i) => keyToTmdbId.set(key, results[i]))
    }
  }

  rows.forEach((row, i) => {
    const k = searchKey(row.title, row.year)
    resolvedTmdbIds[i] = keyToTmdbId.get(k) ?? null
  })

  const uniqueIds = [...new Set(resolvedTmdbIds.filter(Boolean))]
  const movieTotal = uniqueIds.length
  const movieMap = new Map()

  if (API_BASE && uniqueIds.length > 0) {
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
          const movie = await getMovieMinimal(id, fetchOpts)
          movieMap.set(id, movie)
          return movie
        })
        await runQueue(movieTasks, concurrency, { signal })
        return chunk.map(() => ({ movie: null }))
      }
    }
    
    await processBatchesParallel(
      uniqueIds,
      BATCH_SIZE,
      PARALLEL_BATCHES,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          movieDone = done
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
      }
    )
  } else {
    const movieTasks = uniqueIds.map((id) => async () => {
      const movie = await getMovieMinimal(id, fetchOpts)
      movieMap.set(id, movie)
      return movie
    })

    let movieDone = 0
    for (let j = 0; j < movieTasks.length; j += batchSize) {
      const chunk = movieTasks.slice(j, j + batchSize)
      const chunkIds = uniqueIds.slice(j, j + batchSize)
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
    const poster_url = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null
    const poster_url_w342 = poster_path ? `https://image.tmdb.org/t/p/w342${poster_path}` : null
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

  if (diaryRows?.length > 0) mergeDiary(films, diaryRows)

  const BEST_CAP = 200
  const GEMS_CAP = 300
  const OVERRATED_CAP = 300
  const DECADE_CAP = 500
  const idsForPhase2 = new Set()
  const byRating = [...films].sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0))
  byRating.slice(0, BEST_CAP).forEach((f) => f.tmdb_id && idsForPhase2.add(f.tmdb_id))
  const gemScore = (f) => {
    const u = f.rating ?? 0
    const t = f.tmdb_stars
    const vc = f.tmdb_vote_count ?? 0
    if (u < 3.5 || vc < 200 || t == null) return -999
    return u - t
  }
  [...films].sort((a, b) => gemScore(b) - gemScore(a)).slice(0, GEMS_CAP).forEach((f) => {
    if (gemScore(f) >= 1.5 && f.tmdb_id) idsForPhase2.add(f.tmdb_id)
  })
  const overScore = (f) => {
    const t = f.tmdb_stars
    const u = f.rating ?? 0
    if (t == null) return -999
    return t - u
  }
  [...films].sort((a, b) => overScore(b) - overScore(a)).slice(0, OVERRATED_CAP).forEach((f) => {
    if (f.tmdb_id) idsForPhase2.add(f.tmdb_id)
  })
  byRating.slice(0, DECADE_CAP).forEach((f) => f.tmdb_id && idsForPhase2.add(f.tmdb_id))

  const idList = [...idsForPhase2]
  const creditsMap = new Map()
  const keywordsMap = new Map()
  
  if (API_BASE && idList.length > 0) {
    let phase2Done = 0
    const batchProcessor = async (chunk) => {
      try {
        const [creditsData, keywordsData] = await Promise.all([
          fetchJsonPost(`${API_BASE}/tmdb/movies/credits/batch`, { tmdb_ids: chunk }, fetchOpts),
          fetchJsonPost(`${API_BASE}/tmdb/movies/keywords/batch`, { tmdb_ids: chunk }, fetchOpts),
        ])
        
        const cachePromises = []
        creditsData.results?.forEach((result) => {
          if (result.credits) {
            creditsMap.set(result.tmdb_id, result.credits)
            cachePromises.push(
              cache.setCredits(result.tmdb_id, result.credits).catch((err) => {
                console.warn('Failed to cache credits:', err)
              })
            )
          }
        })
        keywordsData.results?.forEach((result) => {
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
        
        return { credits: creditsData.results || [], keywords: keywordsData.results || [] }
      } catch (err) {
        if (err?.name === 'AbortError') throw err
        const creditTasks = chunk.map((id) => () => getCredits(id, fetchOpts))
        const keywordTasks = chunk.map((id) => () => getKeywords(id, fetchOpts))
        const credResults = await runQueue(creditTasks, concurrency, { signal })
        const kwResults = await runQueue(keywordTasks, concurrency, { signal })
        chunk.forEach((id, i) => {
          if (credResults[i]) creditsMap.set(id, credResults[i])
          if (kwResults[i]) keywordsMap.set(id, kwResults[i])
        })
        return { credits: [], keywords: [] }
      }
    }
    
    await processBatchesParallel(
      idList,
      BATCH_SIZE,
      PARALLEL_BATCHES,
      batchProcessor,
      {
        signal,
        onProgress: ({ done }) => {
          phase2Done = done
          if (onProgress) {
            onProgress({
              stage: 'tmdb_details',
              message: 'Загрузка данных TMDb (фаза 2)',
              done: total,
              total,
              percent: 90 + Math.min(5, Math.round((phase2Done / idList.length) * 5)),
            })
          }
        },
      }
    )
  } else {
    for (let j = 0; j < idList.length; j += batchSize) {
      const chunk = idList.slice(j, j + batchSize)
      const creditTasks = chunk.map((id) => () => getCredits(id, fetchOpts))
      const keywordTasks = chunk.map((id) => () => getKeywords(id, fetchOpts))
      const credResults = await runQueue(creditTasks, concurrency, { signal })
      const kwResults = await runQueue(keywordTasks, concurrency, { signal })
      chunk.forEach((id, i) => {
        if (credResults[i]) creditsMap.set(id, credResults[i])
        if (kwResults[i]) keywordsMap.set(id, kwResults[i])
      })
      if (onProgress) {
        onProgress({
          stage: 'tmdb_details',
          message: 'Загрузка данных TMDb (фаза 2)',
          done: total,
          total,
          percent: 95,
        })
      }
    }
  }

  films.forEach((f) => {
    const id = f.tmdb_id
    if (!id) return
    const cred = creditsMap.get(id)
    if (cred) {
      f.directors = cred.directors || []
      f.actors = (cred.actors || []).slice(0, 10)
    }
    const kw = keywordsMap.get(id)
    if (kw) f.keywords = (kw.keywords || []).slice(0, 20)
  })

  return films
}

export async function enrichFilmsPhase1Only(rows, diaryRows, onProgress, opts = {}) {
  const { signal, onRetryMessage } = opts
  if (!API_BASE && !PROXY_BASE) throw new Error('VITE_API_URL или VITE_TMDB_PROXY_BASE должен быть задан')
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

  if (API_BASE) {
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
    
    await processBatchesParallel(
      searchItems,
      BATCH_SIZE,
      PARALLEL_BATCHES,
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
  } else {
    const searchTasks = uniqueKeys.map((k) => {
      const parts = k.split(':')
      const yearPart = parts.length > 1 ? parts.pop() : '0'
      const title = parts.join(':') || ''
      const year = yearPart === '0' || yearPart === '' ? null : parseInt(yearPart, 10)
      return async () => searchMovie(title, Number.isNaN(year) ? null : year, fetchOpts)
    })

    let searchDone = 0
    for (let j = 0; j < searchTasks.length; j += batchSize) {
      const chunk = searchTasks.slice(j, j + batchSize)
      const chunkKeys = uniqueKeys.slice(j, j + batchSize)
      const results = await runQueue(chunk, concurrency, {
        signal,
        onProgress: (done, batchLen) => {
          searchDone = j + done
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
      })
      chunkKeys.forEach((key, i) => keyToTmdbId.set(key, results[i]))
    }
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
    const poster_url = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null
    const poster_url_w342 = poster_path ? `https://image.tmdb.org/t/p/w342${poster_path}` : null
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

  if (diaryRows?.length > 0) mergeDiary(films, diaryRows)
  return films
}
