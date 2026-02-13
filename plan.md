# План миграции frontend на TypeScript

Цель: перевести frontend приложения на TypeScript (последняя версия) в строгом режиме (`strict: true`).

---

## Статус

### Выполнено

- **Конфигурация**
  - `tsconfig.json` и `tsconfig.node.json` (strict, noUncheckedIndexedAccess и др.)
  - `vite.config.js` → `vite.config.ts`
  - `eslint.config.js` → `eslint.config.ts` с поддержкой TypeScript

- **Типы** (`src/types/`)
  - `film.types.ts`, `stats.types.ts`, `analysis.types.ts`, `api.types.ts`, `index.ts`
  - `vite-env.d.ts` для переменных окружения

- **Точки входа и приложение**
  - `main.jsx` → `main.tsx`, `App.jsx` → `App.tsx`
  - `app/AppView.jsx` → `AppView.tsx`, `app/AppContainer.jsx` → `AppContainer.tsx`

- **Утилиты** (`src/utils/`)
  - format, countriesRu, genresRu, languageRu, letterboxdUrl, colors
  - app: mobileRules, stageUtils, yearUtils
  - indexedDbCache, fetchWithRetry, genreGlobalFrequency, yearGlobalFrequency, countryGlobalFrequency
  - analyticsClient, tmdbProxyClient, genreIcons

- **Фичи** (`src/features/`)
  - resume/useResumeState, demo/useDemoLoader, upload/useCsvAnalysisFlow
  - insights/loveScore

- **Компоненты** (`src/components/`)
  - Все UI-компоненты переведены в `.tsx` (Stars, LoveScoreInfo, ProgressStatus, YearFilter, InsightsCard, DonutRow, WatchTimeCard, BadgesSection, UploadZone, StatsCards, MilestonesSection, FilmsGrid, TagsTable, RankedList, ToggleRankedList, LazyChartsSection, ByYearChart, LanguagesSection, FavoriteDecades, HiddenGemsSection, ListsProgressSection, GenresSection и др.)

- **Данные и моки**
  - `src/mocks/index.js` → `index.ts`
  - `src/data/movieLists.js` → `movieLists.ts`

- **Workers** (`src/workers/`)
  - `csvParseCore.ts` — парсинг RFC CSV и Letterboxd ratings, тип `ParsedRatingRow`
  - `csvParse.worker.ts` — Web Worker для парсинга без блокировки UI
  - `csvParse.ts` — реэкспорт для обратной совместимости

- **Тесты**
  - `src/workers/csvParse.test.ts`, `src/utils/fetchWithRetry.test.ts` — переведены на TypeScript, Vitest запускает их без доп. настройки

- **Сборка и проверки**
  - `npm run build` и `npx tsc --noEmit` проходят без ошибок
  - `npm run test` — 7 тестов (2 файла) проходят

---

## Осталось

- ~~Workers (csvParseCore, csvParse.worker, csvParse)~~ — выполнено
- ~~Тесты (csvParse.test, fetchWithRetry.test)~~ — выполнено
- **Финальная проверка**
  - Сборка (`npm run build`), тесты (`npm run test`) и линтер (`npm run lint`) проходят
  - Установлен `jiti` для загрузки `eslint.config.ts`; в ESLint заданы `project: ["./tsconfig.json", "./tsconfig.node.json"]`, глобал `React`, пустые интерфейсы в `stats.types.ts` заменены на type-алиасы
  - Рекомендуется ручная проверка приложения (загрузка CSV, воркер парсинга)

---

## Заметки

- Бекенд на Render (free tier), лимит памяти 512 MB — учитывать при деплое.
- Для совместимости типов между `loveScore.ts` (локальный `RankedEntity` с loveScore/ratingLift) и `GenreStats[]` в `analyticsClient.ts` используется `@ts-expect-error` с пояснением; на runtime структура совпадает.
