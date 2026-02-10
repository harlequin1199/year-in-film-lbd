/**
 * Mock mode: load demo JSON instead of calling backend.
 * Only used when VITE_USE_MOCKS=true (e.g. in .env.local).
 */

export const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === 'true' || import.meta.env.VITE_USE_MOCKS === true

export const MOCK_OPTIONS = [
  { id: 'mock_ratings_only', label: 'Только ratings', file: 'mock_ratings_only.json', error: false },
  { id: 'mock_multi_year', label: 'Много лет (до 10)', file: 'mock_multi_year.json', error: false },
  { id: 'mock_empty_sections', label: 'Пустые секции (нет жанров/режиссёров)', file: 'mock_empty_sections.json', error: false },
  { id: 'mock_huge_dataset', label: 'Большой набор (30+ фильмов)', file: 'mock_huge_dataset.json', error: false },
  { id: 'mock_tmdb_error', label: 'Нет постеров / TMDb-данных', file: 'mock_tmdb_error.json', error: false },
  { id: 'mock_full_demo', label: 'Полный демо-отчёт (минимум 3 элемента в каждом списке)', file: 'mock_full_demo.json', error: false },
  { id: 'mock_error', label: 'Ошибка TMDb (демо ошибки)', file: null, error: true },
]

const modules = import.meta.glob('./*.json')

async function loadMockFile(fileName) {
  const key = `./${fileName}`
  const loader = modules[key]
  if (!loader) throw new Error(`Mock not found: ${fileName}`)
  const mod = await loader()
  const data = mod?.default ?? mod
  if (!data) throw new Error(`Mock empty: ${fileName}`)
  return data
}

/**
 * Load a mock result by option id.
 * @param {string} optionId - id from MOCK_OPTIONS (e.g. 'mock_ratings_only')
 * @returns {Promise<{ data: object | null, error: string | null }>}
 */
export async function loadMock(optionId) {
  const option = MOCK_OPTIONS.find((o) => o.id === optionId)
  if (!option) return { data: null, error: 'Неизвестный демо-отчёт' }
  if (option.error) {
    return { data: null, error: 'Ошибка TMDb (демо)' }
  }
  try {
    const data = await loadMockFile(option.file)
    return { data, error: null }
  } catch (e) {
    return { data: null, error: e.message || 'Не удалось загрузить демо' }
  }
}
