/**
 * Love Score: единая формула для расчёта "любимых" сущностей
 * (жанры, темы, страны, режиссёры, актёры).
 */

const DEFAULT_MAX_RATING_SPREAD = 2

/**
 * Средняя оценка пользователя по всем фильмам (baseline).
 * @param {Array<{ rating?: number | null }>} movies
 * @returns {number} 0..5
 */
export function calculateUserBaselineRating(movies) {
  if (!movies?.length) return 0
  const withRating = movies
    .map((m) => m.rating)
    .filter((r) => r !== null && r !== undefined)
  if (!withRating.length) return 0
  const sum = withRating.reduce((a, b) => a + b, 0)
  return Number((sum / withRating.length).toFixed(2))
}

/**
 * Собрать статистику по сущностям с ограничением maxPerMovie на фильм.
 * @param {Array<{ rating?: number | null, [key: string]: unknown }>} movies
 * @param {(film: object) => string[]} extractor — (film) => массив сущностей
 * @param {{ maxPerMovie: number, k: number, maxRatingSpread?: number }} config
 * @param {number} baseline
 * @returns {Map<string, { count: number, weightedCount: number, sum: number, high_45: number, avgRating: number, bayesianAvgRating: number, ratingLift: number }>}
 */
export function buildEntityStats(movies, extractor, config, baseline) {
  const { maxPerMovie, k } = config
  const prior = baseline
  const weight = k
  const map = new Map()

  for (const film of movies) {
    const rating = film.rating != null ? Number(film.rating) : 0
    const entities = (extractor(film) || []).slice(0, maxPerMovie)
    for (const name of entities) {
      let stats = map.get(name)
      if (!stats) {
        stats = { count: 0, sum: 0, high_45: 0 }
        map.set(name, stats)
      }
      stats.count += 1
      stats.sum += rating
      if (rating >= 4.5) stats.high_45 += 1
    }
  }

  const result = new Map()
  map.forEach((raw, name) => {
    const count = raw.count
    const sum = raw.sum
    const avgRating = count ? sum / count : 0
    const bayesianAvgRating = count + weight ? (sum + prior * weight) / (count + weight) : prior
    const ratingLift = avgRating - baseline
    result.set(name, {
      count,
      weightedCount: count,
      sum,
      high_45: raw.high_45,
      avgRating: Number(avgRating.toFixed(2)),
      bayesianAvgRating: Number(bayesianAvgRating.toFixed(2)),
      ratingLift: Number(ratingLift.toFixed(2)),
    })
  })
  return result
}

/**
 * Вычислить Love Score 0..100 для одной сущности.
 * @param {{ count: number, avgRating: number, ratingLift?: number }} stats
 * @param {number} baseline
 * @param {number} maxN — макс. count среди сущностей (после maxPerMovie)
 * @param {{ k: number, maxRatingSpread?: number }} config
 * @returns {number} 0..100
 */
export function calculateLoveScore(stats, baseline, maxN, config) {
  const n = stats.count
  const k = config.k ?? 5
  const spread = config.maxRatingSpread ?? DEFAULT_MAX_RATING_SPREAD
  const lift = stats.ratingLift ?? (stats.avgRating - baseline)
  const ratingNorm = Math.max(-1, Math.min(1, lift / spread))
  const ratingComponent = (ratingNorm + 1) / 2
  const maxN1 = Math.max(1, maxN)
  const frequencyComponent = Math.log(1 + n) / Math.log(1 + maxN1)
  const confidence = n / (n + k)
  const score = confidence * (0.65 * ratingComponent + 0.35 * frequencyComponent)
  return Number((Math.max(0, Math.min(1, score)) * 100).toFixed(2))
}

/**
 * Ранжированный список сущностей по Love Score.
 * @param {Map<string, object>} entityMap — результат buildEntityStats
 * @param {number} baseline
 * @param {number} maxN
 * @param {{ k: number, minCount: number, maxRatingSpread?: number }} config
 * @returns {Array<{ name: string, count: number, avg_rating: number, high_45: number, share_45: number, loveScore: number, ratingLift: number }>}
 */
export function buildRankedByLoveScore(entityMap, baseline, maxN, config) {
  const minCount = config.minCount ?? 0
  const list = []
  entityMap.forEach((stats, name) => {
    if (stats.count < minCount) return
    const loveScore = calculateLoveScore(stats, baseline, maxN, config)
    const share_45 = stats.count ? Number((stats.high_45 / stats.count).toFixed(2)) : 0
    list.push({
      name,
      count: stats.count,
      avg_rating: stats.avgRating,
      high_45: stats.high_45,
      share_45,
      loveScore,
      ratingLift: stats.ratingLift,
    })
  })
  list.sort((a, b) => {
    if (b.loveScore !== a.loveScore) return b.loveScore - a.loveScore
    return b.count - a.count
  })
  return list
}

export const ENTITY_CONFIGS = {
  genres: { maxPerMovie: 3, k: 5, minCount: 5, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  themes: { maxPerMovie: 20, k: 8, minCount: 8, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  countries: { maxPerMovie: 2, k: 5, minCount: 5, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  directors: { maxPerMovie: 20, k: 3, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  actors: { maxPerMovie: 50, k: 3, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  decades: { maxPerMovie: 1, k: 5, minCount: 12, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  years: { maxPerMovie: 1, k: 5, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
}
