/**
 * Утилиты для генерации URL Letterboxd с фильтрами поиска
 */

/**
 * Конвертирует ISO код языка в английское название для Letterboxd
 */
function languageCodeToName(code: string): string {
  const languageMap: Record<string, string> = {
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
function normalizeCountryName(countryName: string | null | undefined): string {
  if (!countryName) return ''
  return String(countryName)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Нормализует имя режиссёра для URL директора (в нижний регистр, заменяет пробелы на дефисы)
 */
function normalizeDirectorName(name: string | null | undefined): string {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Нормализует название жанра для URL (в нижний регистр, заменяет пробелы на дефисы)
 */
function normalizeGenreName(genreName: string | null | undefined): string {
  if (!genreName) return ''
  return String(genreName)
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Заменяем пробелы на дефисы
}

/**
 * Генерирует URL для поиска фильмов по жанру на Letterboxd
 * @param genreName - Название жанра на английском (например, "Action", "Science Fiction")
 * @returns URL для Letterboxd
 */
export function getLetterboxdGenreUrl(genreName: string): string {
  const normalized = normalizeGenreName(genreName)
  return `https://letterboxd.com/films/genre/${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по десятилетию на Letterboxd
 * @param decade - Год начала десятилетия (например, 1990)
 * @returns URL для Letterboxd
 */
export function getLetterboxdDecadeUrl(decade: number): string {
  const decadeStr = `${decade}s`
  return `https://letterboxd.com/films/decade/${decadeStr}/`
}

/**
 * Генерирует URL для поиска фильмов по языку на Letterboxd
 * @param languageCode - ISO код языка (например, "ja", "en", "ru")
 * @returns URL для Letterboxd
 */
export function getLetterboxdLanguageUrl(languageCode: string): string {
  const languageName = languageCodeToName(languageCode)
  return `https://letterboxd.com/tag/language:-${languageName}/`
}

/**
 * Генерирует URL для поиска фильмов по стране на Letterboxd
 * @param countryName - Название страны на английском (например, "United States", "Japan")
 * @returns URL для Letterboxd
 */
export function getLetterboxdCountryUrl(countryName: string): string {
  const normalized = normalizeCountryName(countryName)
  return `https://letterboxd.com/tag/country:-${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по режиссёру на Letterboxd
 * @param directorName - Имя режиссёра (например, "Christopher Nolan")
 * @returns URL для Letterboxd
 */
export function getLetterboxdDirectorUrl(directorName: string): string {
  const normalized = normalizeDirectorName(directorName)
  return `https://letterboxd.com/director/${normalized}/`
}

/**
 * Генерирует URL для поиска фильмов по актёру на Letterboxd
 * @param actorName - Имя актёра (например, "Tom Hanks")
 * @returns URL для Letterboxd
 */
export function getLetterboxdActorUrl(actorName: string): string {
  const normalized = normalizeDirectorName(actorName)
  return `https://letterboxd.com/actor/${normalized}/`
}
