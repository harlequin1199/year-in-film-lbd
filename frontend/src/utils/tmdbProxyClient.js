import * as cache from './indexedDbCache.js'

const PROXY_BASE = (import.meta.env.VITE_TMDB_PROXY_BASE || '').trim().replace(/\/$/, '')
const DEFAULT_CONCURRENCY = 4
const HIGH_LOAD_CONCURRENCY = 2
const HIGH_LOAD_THRESHOLD = 5000
const MAX_IN_FLIGHT = 200

function tmdbRating5(voteAverage) {
  if (voteAverage == null || Number.isNaN(voteAverage)) return null
  return Math.round((voteAverage / 2) * 10) / 10
}

async function fetchJson(url) {
  const res = await fetch(url)
  if (!res.ok) {
    const t = await res.text()
    throw new Error(t || `HTTP ${res.status}`)
  }
  return res.json()
}

export async function searchMovie(title, year) {
  const cached = await cache.getSearch(title, year)
  if (cached !== undefined) return cached
  const qs = new URLSearchParams({ title: (title || '').trim().slice(0, 120) })
  if (year != null && year >= 1800 && year <= 2100) qs.set('year', String(year))
  const data = await fetchJson(`${PROXY_BASE}/search?${qs}`)
  const id = data.tmdb_id ?? null
  await cache.setSearch(title, year, id)
  return id
}

export async function getMovieMinimal(tmdbId) {
  const cached = await cache.getMovie(tmdbId)
  if (cached) return cached
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}`)
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

export async function getCredits(tmdbId) {
  const cached = await cache.getCredits(tmdbId)
  if (cached) return cached
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}/credits`)
  const out = { directors: data.directors || [], actors: data.actors || [] }
  await cache.setCredits(tmdbId, out)
  return out
}

export async function getKeywords(tmdbId) {
  const cached = await cache.getKeywords(tmdbId)
  if (cached) return cached
  const data = await fetchJson(`${PROXY_BASE}/movie/${tmdbId}/keywords`)
  const out = { keywords: data.keywords || [] }
  await cache.setKeywords(tmdbId, out)
  return out
}

function runQueue(tasks, concurrency, onProgress) {
  return new Promise((resolve, reject) => {
    let index = 0
    let inFlight = 0
    const results = []
    const next = () => {
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

export async function enrichFilmsTwoPhase(rows, diaryRows, onProgress) {
  if (!PROXY_BASE) throw new Error('VITE_TMDB_PROXY_BASE не задан')
  const total = rows.length
  const concurrency = total > HIGH_LOAD_THRESHOLD ? HIGH_LOAD_CONCURRENCY : DEFAULT_CONCURRENCY
  const batchSize = Math.min(200, Math.max(concurrency * 2, 50))
  const films = []

  const mergeDiary = (filmsList, diary) => {
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

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const tasks = batch.map((row) => async () => {
      const tmdbId = await searchMovie(row.title, row.year)
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
      const movie = await getMovieMinimal(tmdbId)
      const poster_path = movie.poster_path
      const poster_url = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null
      const poster_url_w342 = poster_path ? `https://image.tmdb.org/t/p/w342${poster_path}` : null
      const va = movie.vote_average
      const vc = movie.vote_count || 0
      return {
        ...row,
        tmdb_id: tmdbId,
        poster_path,
        poster_url,
        poster_url_w342,
        tmdb_vote_average: va,
        tmdb_vote_count: vc,
        tmdb_stars: tmdbRating5(va),
        genres: movie.genres || [],
        keywords: [],
        directors: [],
        actors: [],
        countries: movie.production_countries || [],
        runtime: movie.runtime,
        original_language: movie.original_language,
      }
    })
    const batchResults = await runQueue(tasks, concurrency, (done, totalBatch) => {
      if (onProgress) onProgress({ stage: 'tmdb_details', done: i + done, total, message: 'Загрузка данных TMDb' })
    })
    films.push(...batchResults)
  }

  if (diaryRows && diaryRows.length > 0) mergeDiary(films, diaryRows)

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
  for (let j = 0; j < idList.length; j += batchSize) {
    const chunk = idList.slice(j, j + batchSize)
    const creditTasks = chunk.map((id) => () => getCredits(id))
    const keywordTasks = chunk.map((id) => () => getKeywords(id))
    const credResults = await runQueue(creditTasks, concurrency)
    const kwResults = await runQueue(keywordTasks, concurrency)
    chunk.forEach((id, i) => {
      if (credResults[i]) creditsMap.set(id, credResults[i])
      if (kwResults[i]) keywordsMap.set(id, kwResults[i])
    })
    if (onProgress) onProgress({ stage: 'tmdb_details', done: total, total, message: 'Загрузка данных TMDb (фаза 2)' })
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

export async function enrichFilmsPhase1Only(rows, diaryRows, onProgress) {
  if (!PROXY_BASE) throw new Error('VITE_TMDB_PROXY_BASE не задан')
  const total = rows.length
  const concurrency = total > HIGH_LOAD_THRESHOLD ? HIGH_LOAD_CONCURRENCY : DEFAULT_CONCURRENCY
  const batchSize = Math.min(200, Math.max(concurrency * 2, 50))
  const films = []

  const mergeDiary = (filmsList, diary) => {
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

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const tasks = batch.map((row) => async () => {
      const tmdbId = await searchMovie(row.title, row.year)
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
      const movie = await getMovieMinimal(tmdbId)
      const poster_path = movie.poster_path
      const poster_url = poster_path ? `https://image.tmdb.org/t/p/w500${poster_path}` : null
      const poster_url_w342 = poster_path ? `https://image.tmdb.org/t/p/w342${poster_path}` : null
      const va = movie.vote_average
      const vc = movie.vote_count || 0
      return {
        ...row,
        tmdb_id: tmdbId,
        poster_path,
        poster_url,
        poster_url_w342,
        tmdb_vote_average: va,
        tmdb_vote_count: vc,
        tmdb_stars: tmdbRating5(va),
        genres: movie.genres || [],
        keywords: [],
        directors: [],
        actors: [],
        countries: movie.production_countries || [],
        runtime: movie.runtime,
        original_language: movie.original_language,
      }
    })
    const batchResults = await runQueue(tasks, concurrency, (done, totalBatch) => {
      if (onProgress) onProgress({ stage: 'tmdb_details', done: i + done, total, message: 'Загрузка данных TMDb' })
    })
    films.push(...batchResults)
  }

  if (diaryRows && diaryRows.length > 0) mergeDiary(films, diaryRows)
  return films
}
