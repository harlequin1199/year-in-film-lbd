# Year in Film (Letterboxd)

Полноценное fullstack-приложение, которое превращает экспорт из Letterboxd в интерактивный годовой отчет по фильмам.

Пользователь загружает `ratings.csv` и получает дашборд в стиле «Spotify Wrapped», но для кино: метрики, ранжирования, графики, теги, десятилетия и персональные инсайты.

## Что умеет проект

- Быстрый старт анализа сразу после загрузки CSV.
- Пошаговое обогащение данных через TMDb (постеры, жанры, актеры, режиссеры, ключевые слова).
- Режим возобновления анализа после перезагрузки страницы (IndexedDB).
- Фильтрация отчета по годам.
- Обработка ошибок рендеринга через `AppErrorBoundary` и `FeatureErrorBoundary`.
- Отправка клиентских crash-событий на backend: `POST /api/client-errors`.

## Архитектура

- `frontend` (React + Vite):
  - парсинг CSV,
  - расчет аналитики,
  - UI и визуализация,
  - локальный кэш и resume-состояние.
- `backend` (FastAPI):
  - batch-endpoints для TMDb,
  - прокси TMDb-изображений,
  - write-behind SQLite-кэш,
  - intake endpoint для клиентских ошибок.

Принцип приватности данных:
- полный CSV не отправляется на сервер;
- на backend уходит только минимум полей, нужный для TMDb enrichment.

## Стек

- Frontend: `React 19`, `TypeScript`, `Vite 7`, `Vitest`, `zustand`.
- Backend: `Python`, `FastAPI`, `httpx`, `SQLite`.
- Интеграции: `TMDb API v3`.

## Быстрый старт (локально)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Добавьте TMDB_API_KEY в .env
python -m pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm ci
npm run dev
```

Откройте `http://localhost:5173`.

## Переменные окружения

### Backend

- `TMDB_API_KEY` (обязательно): ключ TMDb.
- `FRONTEND_ORIGIN` (рекомендуется в production): origin фронтенда для CORS.
- `DATABASE_URL` (опционально/production): PostgreSQL для хранения client error событий.

### Frontend

- `VITE_API_URL`: base URL backend API.
- `VITE_BACKEND_URL`: алиас backend origin для интеграционных сценариев.
- `VITE_CLIENT_ERRORS_PATH` (опционально): путь для intake клиентских ошибок.

## Тестирование и качество

Frontend:

```bash
cd frontend
npm run lint
npm run test
npm run test:coverage
```

Backend:

```bash
cd backend
python -m pytest -q
python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=15
```

CI запускает обязательные проверки в GitHub Actions (`.github/workflows/ci.yml`).

## Полезные endpoint'ы

- `GET /health`
- `POST /tmdb/search/batch`
- `POST /tmdb/movies/batch`
- `POST /tmdb/movies/credits/batch`
- `POST /tmdb/movies/keywords/batch`
- `POST /tmdb/movies/full/batch`
- `POST /api/client-errors`
- `GET /api/demo-report`
- `GET /api/demo-csv`

## Документация

- ADR:
  - `docs/adr/ADR-001-analysis-store-boundaries.md`
  - `docs/adr/ADR-002-analysis-lifecycle-invariants.md`
  - `docs/adr/ADR-003-analysis-persistence-strategy.md`
- Чеклист baseline/quality: `docs/plans/2026-02-14-senior-portfolio-foundation-checklist.md`
- Инструкции по demo-asset: `docs/demo-report.md`

## Структура репозитория

```text
backend/
frontend/
docs/
```

## Лицензия

Проект для портфолио и персонального использования.

Используются данные The Movie Database (TMDb). Продукт не аффилирован с TMDb и не сертифицирован TMDb.
