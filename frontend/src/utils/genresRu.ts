/**
 * Локализация названий жанров TMDB (EN → RU).
 * Ключи — как приходят из API (English).
 */
const genreNamesRu: Record<string, string> = {
  Action: 'Боевик',
  Adventure: 'Приключения',
  Animation: 'Анимация',
  Comedy: 'Комедия',
  Crime: 'Криминал',
  Documentary: 'Документальный',
  Drama: 'Драма',
  Family: 'Семейный',
  Fantasy: 'Фэнтези',
  History: 'История',
  Horror: 'Ужасы',
  Music: 'Музыкальный',
  Mystery: 'Детектив',
  Romance: 'Мелодрама',
  'Science Fiction': 'Научная фантастика',
  'TV Movie': 'ТВ фильм',
  Thriller: 'Триллер',
  War: 'Военный',
  Western: 'Вестерн',
}

/**
 * @param name — название жанра (обычно на английском из TMDB)
 * @returns — название на русском или исходное, если перевода нет
 */
export function getGenreNameRu(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return ''
  const key = name.trim()
  return genreNamesRu[key] || name
}
