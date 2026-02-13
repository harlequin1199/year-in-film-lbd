/**
 * Love Score: единая формула для расчёта "любимых" сущностей
 * (жанры, темы, страны, режиссёры, актёры).
 */

import type { Film } from '../../types'

const DEFAULT_MAX_RATING_SPREAD = 2

interface EntityStats {
  count: number
  weightedCount: number
  sum: number
  high_45: number
  avgRating: number
  bayesianAvgRating: number
  ratingLift: number
}

interface EntityConfig {
  maxPerMovie: number
  k: number
  minCount: number
  maxRatingSpread: number
}

interface LoveScoreConfig {
  k?: number
  maxRatingSpread?: number
  useRelativeFrequency?: boolean
  avgCountPerEntity?: number | null
  totalFilms?: number
  useGlobalFrequency?: boolean
  globalFrequencyMap?: Map<string, number>
}

interface RankedEntity {
  name: string
  count: number
  avg_rating: number
  high_45: number
  share_45: number
  loveScore: number
  ratingLift: number
}

/**
 * Средняя оценка пользователя по всем фильмам (baseline).
 */
export function calculateUserBaselineRating(movies: Array<{ rating?: number | null }>): number {
  if (!movies?.length) return 0
  const withRating = movies
    .map((m) => m.rating)
    .filter((r): r is number => r !== null && r !== undefined)
  if (!withRating.length) return 0
  const sum = withRating.reduce((a, b) => a + b, 0)
  return Number((sum / withRating.length).toFixed(2))
}

/**
 * Собрать статистику по сущностям с ограничением maxPerMovie на фильм.
 */
export function buildEntityStats(
  movies: Film[],
  extractor: (film: Film) => string[],
  config: EntityConfig,
  baseline: number
): Map<string, EntityStats> {
  const { maxPerMovie, k } = config
  const prior = baseline
  const weight = k
  const map = new Map<string, { count: number; sum: number; high_45: number }>()

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

  const result = new Map<string, EntityStats>()
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
 */
export function calculateLoveScore(
  stats: { count: number; avgRating: number; ratingLift?: number },
  baseline: number,
  maxN: number,
  config: LoveScoreConfig,
  entityName: string | null = null
): number {
  const n = stats.count
  const k = config.k ?? 5
  const spread = config.maxRatingSpread ?? DEFAULT_MAX_RATING_SPREAD
  const lift = stats.ratingLift ?? (stats.avgRating - baseline)
  const ratingNorm = Math.max(-1, Math.min(1, lift / spread))
  const ratingComponent = (ratingNorm + 1) / 2
  
  // Frequency component: absolute frequency normalized by maxN
  const maxN1 = Math.max(1, maxN)
  const absoluteFrequencyComponent = Math.log(1 + n) / Math.log(1 + maxN1)
  
  // Relative frequency component: how much this entity stands out relative to average
  // Used for time periods (decades, years) to account for different availability
  // OR for genres to account for global frequency differences
  let relativeFrequencyComponent = absoluteFrequencyComponent
  
  // Global frequency: compare user's frequency to global frequency (for genres)
  if (config.useGlobalFrequency && config.globalFrequencyMap && config.totalFilms && entityName) {
    const globalFreqPercent = config.globalFrequencyMap.get(entityName)
    if (globalFreqPercent != null && globalFreqPercent > 0) {
      const userFrequency = (n / config.totalFilms) * 100 // User's frequency in %
      const globalFrequency = globalFreqPercent // Global frequency in %
      // Calculate relative ratio: how many times above/below global frequency
      const relativeRatio = userFrequency / globalFrequency
      // Normalize relative ratio using logarithmic scale to prevent extreme values
      // Ratio of 1.0 = matches global frequency, >1.0 = above global, <1.0 = below global
      // Use log scale: log(1 + ratio) / log(3) gives us 0..1 range for ratio 0..2
      const relativeNorm = Math.min(2, Math.max(0.5, relativeRatio))
      relativeFrequencyComponent = Math.log(1 + relativeNorm) / Math.log(3)
    }
  }
  // Relative frequency from user's collection (for time periods)
  else if (config.useRelativeFrequency && config.avgCountPerEntity && config.totalFilms) {
    const avgCount = config.avgCountPerEntity
    if (avgCount > 0) {
      // Calculate relative ratio: how many times above/below average
      const relativeRatio = n / avgCount
      // Normalize relative ratio using logarithmic scale to prevent extreme values
      // Ratio of 1.0 = average, >1.0 = above average, <1.0 = below average
      // Use log scale: log(1 + ratio) / log(3) gives us 0..1 range for ratio 0..2
      const relativeNorm = Math.min(2, Math.max(0.5, relativeRatio))
      relativeFrequencyComponent = Math.log(1 + relativeNorm) / Math.log(3)
    }
  }
  
  // Combine absolute and relative frequency (weighted average)
  // For time periods and genres, give more weight to relative frequency to account for availability differences
  const frequencyWeight = (config.useRelativeFrequency || config.useGlobalFrequency) ? 0.6 : 1.0
  const frequencyComponent = frequencyWeight * relativeFrequencyComponent + (1 - frequencyWeight) * absoluteFrequencyComponent
  
  const confidence = n / (n + k)
  const score = confidence * (0.65 * ratingComponent + 0.35 * frequencyComponent)
  return Number((Math.max(0, Math.min(1, score)) * 100).toFixed(2))
}

/**
 * Ранжированный список сущностей по Love Score.
 */
export function buildRankedByLoveScore(
  entityMap: Map<string, EntityStats>,
  baseline: number,
  maxN: number,
  config: LoveScoreConfig & { minCount?: number }
): RankedEntity[] {
  const minCount = config.minCount ?? 0
  const list: RankedEntity[] = []
  
  // Calculate average count per entity for relative frequency (if enabled)
  let avgCountPerEntity: number | null = null
  if (config.useRelativeFrequency && config.totalFilms && entityMap.size > 0) {
    const totalCount = Array.from(entityMap.values()).reduce((sum, stats) => sum + stats.count, 0)
    avgCountPerEntity = totalCount / entityMap.size
  }
  
  entityMap.forEach((stats, name) => {
    if (stats.count < minCount) return
    const loveScore = calculateLoveScore(stats, baseline, maxN, {
      ...config,
      avgCountPerEntity,
    }, name)
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

export const ENTITY_CONFIGS: Record<string, EntityConfig> = {
  genres: { maxPerMovie: 3, k: 5, minCount: 5, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  themes: { maxPerMovie: 20, k: 8, minCount: 8, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  countries: { maxPerMovie: 2, k: 5, minCount: 5, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  directors: { maxPerMovie: 20, k: 3, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  actors: { maxPerMovie: 50, k: 3, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  decades: { maxPerMovie: 1, k: 5, minCount: 12, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
  years: { maxPerMovie: 1, k: 5, minCount: 3, maxRatingSpread: DEFAULT_MAX_RATING_SPREAD },
}
