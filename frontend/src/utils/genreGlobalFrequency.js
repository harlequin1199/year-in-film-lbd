/**
 * Глобальные частоты жанров из TMDb (в процентах от общего количества фильмов).
 * Данные получены через TMDb API discover endpoint.
 * 
 * Значения представляют долю фильмов каждого жанра от общего количества фильмов в TMDb.
 * Например, Drama составляет ~22.13% всех фильмов в TMDb.
 */
export const GENRE_GLOBAL_FREQUENCY = {
  'Drama': 22.131086350532495,
  'Documentary': 16.723635410627637,
  'Comedy': 13.101805157365568,
  'Horror': 5.424208010038359,
  'Animation': 5.364009625388152,
  'Romance': 4.84160200767172,
  'Thriller': 4.594057990581097,
  'Music': 4.082054051478354,
  'Action': 3.757157492634037,
  'Crime': 3.206397865260449,
  'Family': 2.488702875703837,
  'TV Movie': 2.4733753186622933,
  'Fantasy': 2.252912632924863,
  'Adventure': 2.109087732395149,
  'Science Fiction': 2.0100542420801,
  'Mystery': 1.995838528554524,
  'History': 1.6703860479522226,
  'War': 0.9897789813925046,
  'Western': 0.7838496787566414,
}

/**
 * Получить глобальную частоту жанра (в процентах).
 * 
 * @param {string} genreName - Название жанра на английском (как в TMDb)
 * @returns {number} - Глобальная частота жанра в процентах (0-100), или null если жанр не найден
 */
export function getGenreGlobalFrequency(genreName) {
  if (!genreName || typeof genreName !== 'string') return null
  return GENRE_GLOBAL_FREQUENCY[genreName.trim()] ?? null
}

/**
 * Создать Map с глобальными частотами жанров для использования в расчётах.
 * 
 * @returns {Map<string, number>} - Map: название жанра → глобальная частота (%)
 */
export function createGenreGlobalFrequencyMap() {
  const map = new Map()
  for (const [genre, frequency] of Object.entries(GENRE_GLOBAL_FREQUENCY)) {
    map.set(genre, frequency)
  }
  return map
}
