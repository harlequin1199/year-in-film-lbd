import { formatYear } from './format.js'

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

  const genreMap = new Map()
  const tagMap = new Map()
  const directorMap = new Map()
  const actorMap = new Map()
  const countryMap = new Map()
  const languageMap = new Map()

  const runtimeValues = []
  let totalRuntime = 0

  const monthMap = new Map()
  const weekdayMap = new Map()
  const weekdayNames = ['Понедельник', 'Вторник', 'Среда', 'Четверг', 'Пятница', 'Суббота', 'Воскресенье']

  films.forEach((film) => {
    const rating = film.rating || 0

    ;(film.genres || []).forEach((name) => {
      const stats = genreMap.get(name) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      genreMap.set(name, stats)
    })
    ;(film.keywords || []).forEach((name) => {
      const stats = tagMap.get(name) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      tagMap.set(name, stats)
    })
    ;(film.directors || []).forEach((name) => {
      const stats = directorMap.get(name) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      directorMap.set(name, stats)
    })
    ;(film.actors || []).forEach((name) => {
      const stats = actorMap.get(name) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      actorMap.set(name, stats)
    })
    ;(film.countries || []).forEach((name) => {
      const stats = countryMap.get(name) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      countryMap.set(name, stats)
    })

    if (film.original_language) {
      const stats = languageMap.get(film.original_language) || { count: 0, sum: 0, high_45: 0 }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
      languageMap.set(film.original_language, stats)
    }

    if (film.runtime) {
      runtimeValues.push(film.runtime)
      totalRuntime += film.runtime
    }

    const date = parseDate(film.watchedDate)
    if (date) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      const monthStats = monthMap.get(monthKey) || { count: 0, sum: 0, rated: 0 }
      monthStats.count += 1
      monthStats.sum += rating
      if (film.rating !== null && film.rating !== undefined) monthStats.rated += 1
      monthMap.set(monthKey, monthStats)

      const weekday = date.getDay() === 0 ? 6 : date.getDay() - 1
      const weekdayStats = weekdayMap.get(weekday) || { count: 0, sum: 0, rated: 0 }
      weekdayStats.count += 1
      weekdayStats.sum += rating
      if (film.rating !== null && film.rating !== undefined) weekdayStats.rated += 1
      weekdayMap.set(weekday, weekdayStats)
    }
  })

  const topGenres = buildRankedByCount(genreMap)
  const topTags = []
  tagMap.forEach((stats, name) => {
    const avg = stats.count ? stats.sum / stats.count : 0
    const loveScore = Number((stats.high_45 * avg).toFixed(2))
    topTags.push({
      name,
      count: stats.count,
      avg_rating: Number(avg.toFixed(2)),
      high_45: stats.high_45,
      loveScore,
    })
  })
  topTags.sort((a, b) => {
    if (b.loveScore !== a.loveScore) return b.loveScore - a.loveScore
    return b.count - a.count
  })

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

  const watchesByMonth = Array.from(monthMap.entries())
    .sort((a, b) => (a[0] > b[0] ? 1 : -1))
    .map(([month, stats]) => ({
      month,
      count: stats.count,
      avg_rating: stats.rated ? Number((stats.sum / stats.rated).toFixed(2)) : 0,
    }))

  const watchesByWeekday = Array.from({ length: 7 }).map((_, index) => {
    const stats = weekdayMap.get(index) || { count: 0, sum: 0, rated: 0 }
    return {
      weekday: index,
      nameRu: weekdayNames[index],
      count: stats.count,
      avg_rating: stats.rated ? Number((stats.sum / stats.rated).toFixed(2)) : 0,
    }
  })

  const countriesByCount = buildRankedByCount(countryMap)
  const countriesByAvg = buildRankedByAvg(countryMap, 5)
  const directorsByCount = buildRankedByCount(directorMap)
  const directorsByAvg = buildRankedByAvg(directorMap, 3)
  const actorsByCount = buildRankedByCount(actorMap)
  const actorsByAvg = buildRankedByAvg(actorMap, 3)

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

  const topGenresByAvg = buildRankedByAvg(genreMap, 5)
  const topGenresByAvgMin8 = buildRankedByAvg(genreMap, 8)
  const topCountriesByAvg = buildRankedByAvg(countryMap, 5)
  const topDirectorsByAvg = buildRankedByAvg(directorMap, 3)
  const topTagsByAvg = buildRankedByAvg(tagMap, 8)

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

  const decadeMap = new Map()
  films.forEach((film) => {
    if (!film.year) return
    const decade = Math.floor(film.year / 10) * 10
    const stats = decadeMap.get(decade) || { count: 0, sum: 0, rated: 0 }
    stats.count += 1
    if (film.rating !== null && film.rating !== undefined) {
      stats.sum += film.rating
      stats.rated += 1
    }
    decadeMap.set(decade, stats)
  })

  let mostWatchedDecade = null
  let mostLovedDecade = null
  if (decadeMap.size) {
    mostWatchedDecade = [...decadeMap.entries()].sort((a, b) => b[1].count - a[1].count)[0][0]
    const loved = [...decadeMap.entries()].filter(([, stats]) => stats.count >= 5 && stats.rated)
    if (loved.length) {
      mostLovedDecade = loved.sort((a, b) => {
        const aAvg = a[1].sum / a[1].rated
        const bAvg = b[1].sum / b[1].rated
        if (bAvg !== aAvg) return bAvg - aAvg
        return b[1].count - a[1].count
      })[0][0]
    }
  }

  addBadge('Фильмов за год', stats.totalFilms, 'Всего фильмов', 'film', 'gold')
  addBadge('Средняя оценка', stats.avgRating, 'Средняя по всем фильмам', 'star', 'gold', true)
  addBadge('Пятёрки', fiveStarCount, 'Оценки 5★', 'star', 'purple')
  addBadge('Оценки 4.5–5★', stats.count45, 'Очень высокие оценки', 'star', 'purple')
  if (topGenres.length) {
    addBadge('Самый частый жанр', topGenres[0].count, `Жанр: ${topGenres[0].name}`, 'tag', 'green')
  }
  if (topGenresByAvg.length) {
    addBadge(
      'Самый любимый жанр',
      topGenresByAvg[0].avg_rating,
      `Жанр: ${topGenresByAvg[0].name}`,
      'heart',
      'green',
      true,
    )
  }
  if (countriesByCount.length) {
    addBadge('Самая частая страна', countriesByCount[0].count, `Страна: ${countriesByCount[0].name}`, 'globe', 'blue')
  }
  if (topCountriesByAvg.length) {
    addBadge(
      'Самая любимая страна',
      topCountriesByAvg[0].avg_rating,
      `Страна: ${topCountriesByAvg[0].name}`,
      'heart',
      'blue',
      true,
    )
  }
  if (directorsByCount.length) {
    addBadge('Самый частый режиссёр', directorsByCount[0].count, `Режиссёр: ${directorsByCount[0].name}`, 'trophy', 'purple')
  }
  if (topDirectorsByAvg.length) {
    addBadge(
      'Самый любимый режиссёр',
      topDirectorsByAvg[0].avg_rating,
      `Режиссёр: ${topDirectorsByAvg[0].name}`,
      'heart',
      'purple',
      true,
    )
  }
  if (mostWatchedDecade) {
    addBadge('Самое частое десятилетие', `${mostWatchedDecade}-е`, 'Чаще всего', 'calendar', 'gold')
  }
  if (mostLovedDecade) {
    const stats = decadeMap.get(mostLovedDecade)
    const avg = stats.rated ? stats.sum / stats.rated : 0
    addBadge('Самое любимое десятилетие', Number(avg.toFixed(2)), `${mostLovedDecade}-е`, 'heart', 'gold', true)
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

  const decades = [...decadeMap.entries()]
    .map(([decade, data]) => ({
      decade,
      count: data.count,
      avgRating: data.rated ? Number((data.sum / data.rated).toFixed(2)) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  let genreOfTheYear = null
  const genreIndexCandidates = []
  genreMap.forEach((stats, name) => {
    if (stats.count < 8) return
    const avg = stats.count ? stats.sum / stats.count : 0
    const index = stats.high_45 * avg
    genreIndexCandidates.push({
      name,
      count: stats.count,
      avg_rating: Number(avg.toFixed(2)),
      high_45: stats.high_45,
      genreIndex: Number(index.toFixed(2)),
    })
  })
  if (genreIndexCandidates.length > 0) {
    genreIndexCandidates.sort((a, b) => b.genreIndex - a.genreIndex)
    genreOfTheYear = genreIndexCandidates[0]
  } else if (topGenres.length > 0) {
    const g = topGenres[0]
    genreOfTheYear = {
      name: g.name,
      count: g.count,
      avg_rating: g.avg_rating,
      high_45: g.high_45,
      genreIndex: Number((g.high_45 * g.avg_rating).toFixed(2)),
    }
  }

  const hiddenGems = computeHiddenGems(films)
  const overrated = computeOverrated(films)

  return {
    stats,
    topGenres,
    topGenresByAvg,
    topGenresByAvgMin8,
    genreOfTheYear,
    hiddenGems,
    overrated,
    topTags,
    topRatedFilms,
    watchTime,
    watchesByMonth,
    watchesByWeekday,
    totalLanguagesCount: languageMap.size,
    topLanguagesByCount,
    topCountriesByCount: countriesByCount,
    topCountriesByAvgRating: countriesByAvg,
    topDirectorsByCount: directorsByCount,
    topDirectorsByAvgRating: directorsByAvg,
    topActorsByCount: actorsByCount,
    topActorsByAvgRating: actorsByAvg,
    timeline: watchesByMonth.map((item) => ({ month: item.month, count: item.count })),
    badges: trimmedBadges,
    decades,
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
    const date = parseDate(film.watchedDate ?? film.date)
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
