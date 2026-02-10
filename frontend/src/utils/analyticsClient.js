import { formatFilmsCount, formatNumber, formatRating, formatYear } from './format.js'
import { getGenreNameRu } from './genresRu.js'
import { getCountryNameRu } from './countriesRu.js'
import {
  calculateUserBaselineRating,
  buildEntityStats,
  buildRankedByLoveScore,
  ENTITY_CONFIGS,
} from '../features/insights/loveScore.js'

const parseDate = (value) => {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

const buildRankedByCount = (map) => {
  const list = []
  map.forEach((stats, name) => {
    const avg = stats.count ? stats.sum / stats.count : 0
    list.push({
      name,
      count: stats.count,
      avg_rating: Number(avg.toFixed(2)),
      high_45: stats.high_45,
      share_45: stats.count ? Number((stats.high_45 / stats.count).toFixed(2)) : 0,
    })
  })
  list.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count
    return b.avg_rating - a.avg_rating
  })
  return list
}

const TOP_LIST_MAX = 10

const buildRankedByAvg = (map, minCount) => {
  const list = []
  map.forEach((stats, name) => {
    if (stats.count < minCount) return
    const avg = stats.count ? stats.sum / stats.count : 0
    list.push({
      name,
      count: stats.count,
      avg_rating: Number(avg.toFixed(2)),
      high_45: stats.high_45,
      share_45: stats.count ? Number((stats.high_45 / stats.count).toFixed(2)) : 0,
    })
  })
  list.sort((a, b) => {
    if (b.avg_rating !== a.avg_rating) return b.avg_rating - a.avg_rating
    return b.count - a.count
  })
  return list
}

/**
 * Stage 1: CSV-only stats (no TMDb). Use right after parse for instant partial result.
 */
export function computeStage1FromRows(rows) {
  if (!rows || rows.length === 0) {
    return {
      stats: { totalFilms: 0, avgRating: 0, count45: 0, oldestYear: null, newestYear: null },
      ratingDistribution: [],
      top12ByRating: [],
    }
  }
  const ratings = rows.map((r) => r.rating).filter((r) => r !== null && r !== undefined)
  const years = rows.map((r) => r.year).filter(Boolean)
  const stats = {
    totalFilms: rows.length,
    avgRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0,
    count45: ratings.filter((r) => r >= 4.5).length,
    oldestYear: years.length ? Math.min(...years) : null,
    newestYear: years.length ? Math.max(...years) : null,
  }
  const buckets = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  const ratingDistribution = buckets.map((low, i) => {
    const high = buckets[i + 1] ?? 5.5
    const count = ratings.filter((r) => r >= low && r < high).length
    return { min: low, max: high, count }
  })
  const top12ByRating = [...rows]
    .filter((r) => r.rating != null)
    .sort((a, b) => (b.rating || 0) - (a.rating || 0) || (b.year || 0) - (a.year || 0))
    .slice(0, 12)
    .map((r) => ({ title: r.title, year: r.year, rating: r.rating }))
  return { stats, ratingDistribution, top12ByRating }
}

/** Partial computed from Stage 1 only (for progressive UI before TMDb data). */
export function getComputedFromStage1(stage1) {
  if (!stage1) return null
  const { stats, top12ByRating } = stage1
  const topRatedFilms = (top12ByRating || []).map((r) => ({
    title: r.title,
    year: r.year,
    rating: r.rating,
    poster_url: null,
    poster_url_w342: null,
    tmdb_id: null,
  }))
  return {
    stats: stats || { totalFilms: 0, avgRating: 0, count45: 0, oldestYear: null, newestYear: null },
    topRatedFilms,
    topGenres: [],
    topGenresByAvg: [],
    topGenresByAvgMin8: [],
    genreOfTheYear: null,
    hiddenGems: [],
    overrated: [],
    topTags: [],
    watchTime: null,
    totalLanguagesCount: 0,
    topLanguagesByCount: [],
    topCountriesByCount: [],
    topCountriesByAvgRating: [],
    topDirectorsByCount: [],
    topDirectorsByAvgRating: [],
    topActorsByCount: [],
    topActorsByAvgRating: [],
    badges: [],
    decades: [],
    yearsByLoveScore: [],
  }
}

export const computeAggregations = (films) => {
  const ratings = films.map((film) => film.rating).filter((r) => r !== null && r !== undefined)
  const years = films.map((film) => film.year).filter(Boolean)
  const stats = {
    totalFilms: films.length,
    avgRating: ratings.length ? Number((ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(2)) : 0,
    count45: ratings.filter((r) => r >= 4.5).length,
    oldestYear: years.length ? Math.min(...years) : null,
    newestYear: years.length ? Math.max(...years) : null,
  }

  const baseline = calculateUserBaselineRating(films)
  const genreConfig = ENTITY_CONFIGS.genres
  const themesConfig = ENTITY_CONFIGS.themes
  const countriesConfig = ENTITY_CONFIGS.countries
  const directorsConfig = ENTITY_CONFIGS.directors
  const actorsConfig = ENTITY_CONFIGS.actors

  const genreMap = buildEntityStats(films, (f) => f.genres || [], genreConfig, baseline)
  const tagMap = buildEntityStats(films, (f) => f.keywords || [], themesConfig, baseline)
  const directorMap = buildEntityStats(films, (f) => f.directors || [], directorsConfig, baseline)
  const actorMap = buildEntityStats(films, (f) => f.actors || [], actorsConfig, baseline)
  const countryMap = buildEntityStats(films, (f) => f.countries || [], countriesConfig, baseline)

  const languageMap = new Map()
  const runtimeValues = []
  let totalRuntime = 0
  films.forEach((film) => {
    const rating = film.rating || 0
    if (film.original_language) {
      const s = languageMap.get(film.original_language) || { count: 0, sum: 0, high_45: 0 }
      s.count += 1
      s.sum += rating
      if (rating >= 4.5) s.high_45 += 1
      languageMap.set(film.original_language, s)
    }
    if (film.runtime) {
      runtimeValues.push(film.runtime)
      totalRuntime += film.runtime
    }
  })

  const maxNGenres = genreMap.size ? Math.max(...Array.from(genreMap.values()).map((s) => s.count)) : 0
  const maxNTags = tagMap.size ? Math.max(...Array.from(tagMap.values()).map((s) => s.count)) : 0
  const maxNCountries = countryMap.size ? Math.max(...Array.from(countryMap.values()).map((s) => s.count)) : 0
  const maxNDirectors = directorMap.size ? Math.max(...Array.from(directorMap.values()).map((s) => s.count)) : 0
  const maxNActors = actorMap.size ? Math.max(...Array.from(actorMap.values()).map((s) => s.count)) : 0

  const topGenres = buildRankedByCount(genreMap)
  const topTags = buildRankedByLoveScore(tagMap, baseline, maxNTags, themesConfig)

  const topRatedFilms = [...films]
    .sort((a, b) => {
      const aRating = a.rating || 0
      const bRating = b.rating || 0
      if (bRating !== aRating) return bRating - aRating
      return (b.year || 0) - (a.year || 0)
    })
    .slice(0, 12)

  const watchTime = {
    totalRuntimeMinutes: totalRuntime,
    totalRuntimeHours: totalRuntime ? Math.round(totalRuntime / 60) : 0,
    totalRuntimeDays: totalRuntime ? Number((totalRuntime / 60 / 24).toFixed(1)) : 0,
    avgRuntimeMinutes: runtimeValues.length
      ? Number((runtimeValues.reduce((a, b) => a + b, 0) / runtimeValues.length).toFixed(2))
      : 0,
  }

  const countriesByCount = buildRankedByCount(countryMap)
  const countriesByAvg = buildRankedByLoveScore(countryMap, baseline, maxNCountries, countriesConfig)
  const directorsByCount = buildRankedByCount(directorMap)
  const directorsByAvg = buildRankedByLoveScore(directorMap, baseline, maxNDirectors, directorsConfig)
  const actorsByCount = buildRankedByCount(actorMap)
  const actorsByAvg = buildRankedByLoveScore(actorMap, baseline, maxNActors, actorsConfig)

  const topLanguagesByCount = buildRankedByCount(languageMap).map((lang) => ({
    language: lang.name,
    count: lang.count,
    avg_rating: lang.avg_rating,
    high_45: lang.high_45,
  }))

  const badges = []
  const addBadge = (title, value, subtitle, iconKey, tone, isRating = false) => {
    if (value === null || value === undefined) return
    badges.push({ title, value, subtitle, iconKey, tone, isRating })
  }

  const topGenresByAvg = buildRankedByAvg(genreMap, genreConfig.minCount)
  const topGenresByAvgMin8 = buildRankedByLoveScore(genreMap, baseline, maxNGenres, genreConfig)
  const topCountriesByAvg = countriesByAvg
  const topDirectorsByAvg = directorsByAvg
  const topTagsByAvg = topTags

  const fiveStarCount = ratings.filter((r) => r === 5).length
  let longestFilm = null
  let shortestFilm = null
  films.forEach((film) => {
    if (!film.runtime) return
    if (!longestFilm || film.runtime > longestFilm.runtime) {
      longestFilm = { runtime: film.runtime, title: film.title || 'Неизвестно' }
    }
    if (!shortestFilm || film.runtime < shortestFilm.runtime) {
      shortestFilm = { runtime: film.runtime, title: film.title || 'Неизвестно' }
    }
  })

  const decadesConfig = ENTITY_CONFIGS.decades
  const yearsConfig = ENTITY_CONFIGS.years
  const decadeExtractor = (film) => {
    if (!film.year) return []
    const decade = Math.floor(film.year / 10) * 10
    return [String(decade)]
  }
  const yearExtractor = (film) => (film.year ? [String(film.year)] : [])
  const decadeMap = buildEntityStats(films, decadeExtractor, decadesConfig, baseline)
  const yearMap = buildEntityStats(films, yearExtractor, yearsConfig, baseline)
  const maxNDecades = decadeMap.size ? Math.max(...Array.from(decadeMap.values()).map((s) => s.count)) : 0
  const maxNYears = yearMap.size ? Math.max(...Array.from(yearMap.values()).map((s) => s.count)) : 0
  const decadesByLoveScore = buildRankedByLoveScore(decadeMap, baseline, maxNDecades, decadesConfig)
  const yearsByLoveScore = buildRankedByLoveScore(yearMap, baseline, maxNYears, yearsConfig)

  let mostWatchedDecade = null
  let mostLovedDecade = null
  if (decadeMap.size) {
    const byCount = [...decadeMap.entries()].sort((a, b) => b[1].count - a[1].count)[0]
    mostWatchedDecade = byCount ? Number(byCount[0]) : null
    if (decadesByLoveScore.length > 0) {
      mostLovedDecade = Number(decadesByLoveScore[0].name)
    }
  }

  const genreOfTheYear = topGenresByAvgMin8.length > 0 ? topGenresByAvgMin8[0] : null

  addBadge('Фильмов за год', stats.totalFilms, 'Всего фильмов', 'film', 'gold')
  addBadge('Средняя оценка', stats.avgRating, 'Средняя по всем фильмам', 'star', 'gold', true)
  addBadge('Пятёрки', fiveStarCount, 'Оценки 5★', 'star', 'purple')
  addBadge('Оценки 4.5–5★', stats.count45, 'Очень высокие оценки', 'star', 'purple')
  if (genreOfTheYear) {
    addBadge(
      'Жанр года',
      getGenreNameRu(genreOfTheYear.name),
      `Love Score: ${formatNumber(Math.round(genreOfTheYear.loveScore))}`,
      'star',
      'green',
    )
  }
  if (topGenresByAvg.length) {
    const g = topGenresByAvg[0]
    addBadge(
      'Самый любимый жанр',
      getGenreNameRu(g.name),
      `Средняя оценка: ${formatRating(g.avg_rating)}`,
      'heart',
      'green',
    )
  }
  if (topGenres.length) {
    const g = topGenres[0]
    addBadge(
      'Самый частый жанр',
      getGenreNameRu(g.name),
      formatFilmsCount(g.count),
      'tag',
      'green',
    )
  }
  if (countriesByCount.length) {
    const c = countriesByCount[0]
    addBadge(
      'Самая частая страна',
      getCountryNameRu(c.name),
      formatFilmsCount(c.count),
      'globe',
      'blue',
    )
  }
  if (topCountriesByAvg.length) {
    const c = topCountriesByAvg[0]
    addBadge(
      'Самая любимая страна',
      getCountryNameRu(c.name),
      `Love Score: ${formatNumber(Math.round(c.loveScore ?? 0))}`,
      'heart',
      'blue',
    )
  }
  if (directorsByCount.length) {
    const d = directorsByCount[0]
    addBadge(
      'Самый частый режиссёр',
      d.name,
      formatFilmsCount(d.count),
      'trophy',
      'purple',
    )
  }
  if (topDirectorsByAvg.length) {
    const d = topDirectorsByAvg[0]
    addBadge(
      'Самый любимый режиссёр',
      d.name,
      `Love Score: ${formatNumber(Math.round(d.loveScore ?? 0))}`,
      'heart',
      'purple',
    )
  }
  if (mostWatchedDecade) {
    addBadge('Самое частое десятилетие', `${mostWatchedDecade}-е`, 'Чаще всего', 'calendar', 'gold')
  }
  if (mostLovedDecade != null && decadesByLoveScore.length > 0) {
    const first = decadesByLoveScore[0]
    addBadge(
      'Самое любимое десятилетие',
      `${mostLovedDecade}-е`,
      `Love Score: ${formatNumber(Math.round(first.loveScore ?? 0))}`,
      'heart',
      'gold',
    )
  }
  addBadge('Самый ранний год', stats.oldestYear ? String(stats.oldestYear) : null, 'Год старейшего фильма', 'calendar', 'green')
  addBadge('Самый новый год', stats.newestYear ? String(stats.newestYear) : null, 'Год новейшего фильма', 'calendar', 'green')
  addBadge('Всего стран', countryMap.size, 'Стран в подборке', 'globe', 'blue')
  addBadge('Всего языков', languageMap.size, 'Языков в подборке', 'globe', 'blue')
  if (totalRuntime) addBadge('Часы просмотра', Math.round(totalRuntime / 60), 'Суммарно за год', 'clock', 'gold')
  if (longestFilm) addBadge('Самый длинный фильм', longestFilm.runtime, longestFilm.title, 'clock', 'purple')
  if (shortestFilm) addBadge('Самый короткий фильм', shortestFilm.runtime, shortestFilm.title, 'clock', 'purple')
  if (topTags.length) addBadge('Самая частая тема', topTags[0].count, `Тема: ${topTags[0].name}`, 'tag', 'green')
  if (topTagsByAvg.length) {
    addBadge(
      'Самая любимая тема',
      topTagsByAvg[0].avg_rating,
      `Тема: ${topTagsByAvg[0].name}`,
      'heart',
      'green',
      true,
    )
  }

  const trimmedBadges = badges.length > 12 ? badges.slice(0, 12) : badges

  const decades = decadesByLoveScore.map((item) => ({
    decade: Number(item.name),
    count: item.count,
    avgRating: item.avg_rating,
    loveScore: item.loveScore,
    ratingLift: item.ratingLift,
  }))

  const hiddenGems = computeHiddenGems(films)
  const overrated = computeOverrated(films)

  return {
    stats,
    topGenres: topGenres.slice(0, TOP_LIST_MAX),
    topGenresByAvg: topGenresByAvg.slice(0, TOP_LIST_MAX),
    topGenresByAvgMin8: topGenresByAvgMin8.slice(0, TOP_LIST_MAX),
    genreOfTheYear,
    hiddenGems,
    overrated,
    topTags: topTags.slice(0, TOP_LIST_MAX),
    topRatedFilms,
    watchTime,
    totalLanguagesCount: languageMap.size,
    topLanguagesByCount: topLanguagesByCount.slice(0, TOP_LIST_MAX),
    topCountriesByCount: countriesByCount.slice(0, TOP_LIST_MAX),
    topCountriesByAvgRating: countriesByAvg.slice(0, TOP_LIST_MAX),
    topDirectorsByCount: directorsByCount.slice(0, TOP_LIST_MAX),
    topDirectorsByAvgRating: directorsByAvg.slice(0, TOP_LIST_MAX),
    topActorsByCount: actorsByCount.slice(0, TOP_LIST_MAX),
    topActorsByAvgRating: actorsByAvg.slice(0, TOP_LIST_MAX),
    badges: trimmedBadges,
    decades,
    yearsByLoveScore,
  }
}

/**
 * Hidden gems: user rating >= 3.5, tmdb_vote_count >= 200, diff (user - tmdb_stars) >= 1.5.
 * Sort by diff desc, then user rating desc. Top 12.
 */
export const computeHiddenGems = (films) => {
  if (!films || films.length === 0) return []
  const MIN_USER_RATING = 3.5
  const MIN_TMDB_VOTES = 200
  const MIN_DIFF = 1.5
  const list = films
    .filter((f) => {
      const user = f.rating != null ? Number(f.rating) : 0
      const vc = f.tmdb_vote_count != null ? Number(f.tmdb_vote_count) : 0
      const tmdbStars = f.tmdb_stars != null ? Number(f.tmdb_stars) : null
      if (user < MIN_USER_RATING || vc < MIN_TMDB_VOTES || tmdbStars == null) return false
      const diff = user - tmdbStars
      return diff >= MIN_DIFF
    })
    .map((f) => ({
      ...f,
      diff: Number((f.rating - f.tmdb_stars).toFixed(1)),
    }))
    .sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff
      return (b.rating || 0) - (a.rating || 0)
    })
  return list
}

/**
 * Overrated: tmdbStars - userRating >= 1.5, tmdbStars >= 3.5, tmdb_vote_count >= 200.
 * Sort by diff desc, then tmdbStars desc. Top 12. Badge shows e.g. "-1.7★".
 */
export const computeOverrated = (films) => {
  if (!films || films.length === 0) return []
  const MIN_TMDB_STARS = 3.5
  const MIN_TMDB_VOTES = 200
  const MIN_DIFF = 1.5
  const list = films
    .filter((f) => {
      const user = f.rating != null ? Number(f.rating) : 0
      const vc = f.tmdb_vote_count != null ? Number(f.tmdb_vote_count) : 0
      const tmdbStars = f.tmdb_stars != null ? Number(f.tmdb_stars) : null
      if (tmdbStars < MIN_TMDB_STARS || vc < MIN_TMDB_VOTES || tmdbStars == null) return false
      const diff = tmdbStars - user
      return diff >= MIN_DIFF
    })
    .map((f) => ({
      ...f,
      diff: Number((f.tmdb_stars - f.rating).toFixed(1)),
    }))
    .sort((a, b) => {
      if (b.diff !== a.diff) return b.diff - a.diff
      return (b.tmdb_stars || 0) - (a.tmdb_stars || 0)
    })
  return list
}

export const filterFilmsByYears = (films, years) => {
  if (!years || years.length === 0) return films
  const yearSet = new Set(years)
  return films.filter((film) => {
    const date = parseDate(film.date)
    if (!date) return false
    return yearSet.has(date.getFullYear())
  })
}

export const getYearRangeLabel = (years) => {
  if (!years || years.length === 0) return 'all'
  const sorted = [...years].sort((a, b) => a - b)
  if (sorted.length === 1) return `${sorted[0]}`
  return `${sorted[0]}-${sorted[sorted.length - 1]}`
}

export const formatYearRange = (years, availableYears) => {
  if (!availableYears || availableYears.length === 0) return 'Период: все годы'
  const range = `${availableYears[0]}–${availableYears[availableYears.length - 1]}`
  if (!years || years.length === 0) return `Период: все годы (${range})`
  const sorted = [...years].sort((a, b) => a - b)
  if (sorted.length === 1) return `Период: ${formatYear(sorted[0])}`
  return `Период: ${sorted.map((year) => formatYear(year)).join(' + ')} (суммарно)`
}
