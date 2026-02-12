/**
 * Утилиты для генерации URL Letterboxd с фильтрами поиска
 */

/**
 * Конвертирует ISO код языка в английское название для Letterboxd
 */
function languageCodeToName(code) {
  const languageMap = {
    en: 'english',
    ru: 'russian',
    ja: 'japanese',
    ko: 'korean',
    fr: 'french',
    de: 'german',
    it: 'italian',
    es: 'spanish',
    pt: 'portuguese',
    zh: 'chinese',
    cn: 'chinese',
    zho: 'chinese',
    hi: 'hindi',
    sv: 'swedish',
    da: 'danish',
    no: 'norwegian',
    fi: 'finnish',
    nl: 'dutch',
    pl: 'polish',
    tr: 'turkish',
    ar: 'arabic',
    he: 'hebrew',
    th: 'thai',
    id: 'indonesian',
    vi: 'vietnamese',
    uk: 'ukrainian',
    cs: 'czech',
  }
  
  const normalizedCode = String(code).toLowerCase()
  return languageMap[normalizedCode] || normalizedCode
}

/**
 * Нормализует название страны для Letterboxd (в нижний регистр, убирает лишние пробелы)
 */
function normalizeCountryName(countryName) {
  if (!countryName) return ''
  return String(countryName)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Нормализует имя режиссёра или актёра для URL
 */
function normalizePersonName(name) {
  if (!name) return ''
  return String(name)
    .trim()
    .replace(/\s+/g, '+') // Заменяем пробелы на +
}

/**
 * Нормализует имя режиссёра для URL директора (в нижний регистр, заменяет пробелы на дефисы)
 */
function normalizeDirectorName(name) {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Нормализует название жанра для URL (в нижний регистр, заменяет пробелы на дефисы)
 */
function normalizeGenreName(genreName) {
  if (!genreName) return ''
  return String(genreName)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Генерирует URL для поиска фильмов по жанру на Letterboxd
 * @param {string} genreName - Название жанра на английском (например, "Action", "Science Fiction")
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdGenreUrl(genreName) {
  const normalized = normalizeGenreName(genreName)
  return `https://letterboxd.com/films/genre/${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по десятилетию на Letterboxd
 * @param {number} decade - Год начала десятилетия (например, 1990)
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdDecadeUrl(decade) {
  const decadeStr = `${decade}s`
  return `https://letterboxd.com/films/decade/${decadeStr}/`
}

/**
 * Генерирует URL для поиска фильмов по языку на Letterboxd
 * @param {string} languageCode - ISO код языка (например, "ja", "en", "ru")
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdLanguageUrl(languageCode) {
  const languageName = languageCodeToName(languageCode)
  return `https://letterboxd.com/tag/language:-${languageName}/`
}

/**
 * Генерирует URL для поиска фильмов по стране на Letterboxd
 * @param {string} countryName - Название страны на английском (например, "United States", "Japan")
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdCountryUrl(countryName) {
  const normalized = normalizeCountryName(countryName)
  return `https://letterboxd.com/tag/country:-${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по режиссёру на Letterboxd
 * @param {string} directorName - Имя режиссёра (например, "Christopher Nolan")
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdDirectorUrl(directorName) {
  const normalized = normalizeDirectorName(directorName)
  return `https://letterboxd.com/director/${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по актёру на Letterboxd
 * @param {string} actorName - Имя актёра (например, "Tom Hanks")
 * @returns {string} URL для Letterboxd
 */
export function getLetterboxdActorUrl(actorName) {
  const normalized = normalizeDirectorName(actorName)
  return `https://letterboxd.com/actor/${normalized}/`
}
