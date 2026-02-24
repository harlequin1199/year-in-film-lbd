# Year in Film (Letterboxd)

Полноценное fullstack-приложение, которое превращает экспорт `ratings.csv` из Letterboxd в интерактивный годовой кино-отчёт в стиле «Spotify Wrapped».

[![Live Demo](https://img.shields.io/badge/demo-vercel-0a0a0a?logo=vercel)](https://year-in-film-lbd.vercel.app/)
[![React](https://img.shields.io/badge/react-19-149eca?logo=react)](https://react.dev/)
[![FastAPI](https://img.shields.io/badge/fastapi-backend-009485?logo=fastapi)](https://fastapi.tiangolo.com/)
[![TypeScript](https://img.shields.io/badge/typescript-frontend-3178c6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/python-backend-3776ab?logo=python)](https://www.python.org/)

- Live Demo: https://year-in-film-lbd.vercel.app/
- Repository: https://github.com/harlequin1199/year-in-film-lbd

## Для кого и зачем

- Для пользователей Letterboxd: быстрый персональный отчёт по просмотрам за год без ручной аналитики.
- Для инженеров: пример production-minded fullstack-проекта с акцентом на отказоустойчивость, наблюдаемость и качество.
- Для портфолио: демонстрация инженерных решений, ADR-подхода и осознанного использования AI.

## Архитектура и ключевые решения

### Поток данных

1. Пользователь загружает `ratings.csv` во frontend.
2. Frontend парсит CSV, считает базовую аналитику и формирует batch-запросы.
3. Backend (FastAPI) делает enrichment через TMDb и кэширует результаты в SQLite.
4. Frontend объединяет локальные данные с enrichment и строит дашборд.
5. Состояние анализа сохраняется в IndexedDB, чтобы поддерживать resume после перезагрузки.

### Инженерные trade-offs

| Решение | Почему | Компромисс |
| --- | --- | --- |
| CSV обрабатывается в frontend | Приватность и быстрый отклик на клиенте | Нагрузка на браузер пользователя |
| Batch API для TMDb на backend | Меньше latency и лучше контроль rate limits | Сложнее orchestration и обработка частичных ошибок |
| SQLite write-behind cache | Повторные запросы быстрее и дешевле | Нужно следить за актуальностью кэша |
| IndexedDB resume-state | Пользователь не теряет прогресс enrichment | Усложнение жизненного цикла состояния |
| Error boundaries + Sentry + `/metrics` | Быстрее диагностика runtime-проблем | Дополнительная операционная настройка |

### Принцип приватности данных

- Полный CSV не отправляется на сервер.
- На backend передаются только поля, необходимые для поиска и обогащения данных через TMDb.

### ADR и инженерная дисциплина

- `docs/adr/ADR-001-analysis-store-boundaries.md`
- `docs/adr/ADR-002-analysis-lifecycle-invariants.md`
- `docs/adr/ADR-003-analysis-persistence-strategy.md`
- `docs/adr/ADR-004-observability-sentry-grafana.md`

## Технологический стек

- Frontend: `React 19`, `TypeScript`, `Vite 7`, `zustand`, `Vitest`, `ESLint`.
- Backend: `Python`, `FastAPI`, `httpx`, `SQLite`.
- Integrations: `TMDb API v3`.
- Observability: `Sentry` (frontend + backend), `Grafana` через `/metrics`.
- Deploy: `Vercel` (frontend), backend API отдельно.

## Что было самым сложным

Сложнее всего было обеспечить стабильный enrichment без ухудшения UX: при долгой обработке пользователь не должен терять прогресс, а система должна корректно переживать перезагрузку страницы и частичные сбои внешнего API.

Рассматривались два подхода: полностью серверная оркестрация и гибридная модель. Выбран гибрид: расчёты и управление сессией анализа на frontend, batch enrichment и кэширование на backend. Это дало лучший баланс между приватностью данных, отзывчивостью интерфейса и контролем над внешними запросами.

## Как использовался AI (осознанно)

- AI применялся для ускорения вспомогательных задач: черновики формулировок, проверка полноты документации, гипотезы по рефакторингу.
- AI не использовался как источник «финальных» архитектурных решений без проверки.
- Все существенные изменения валидировались вручную через тесты, lint и ревью диффов.

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
- `SENTRY_ENABLED` (optional): enable backend Sentry SDK (`true/false`).
- `SENTRY_DSN` (optional): Sentry DSN for backend.
- `SENTRY_ENVIRONMENT` (optional): `development`/`production`.
- `SENTRY_RELEASE` (optional): release identifier (commit SHA/version).

### Frontend

- `VITE_API_URL`: base URL backend API.
- `VITE_BACKEND_URL`: алиас backend origin для интеграционных сценариев.
- `VITE_SENTRY_ENABLED` (optional): enable frontend Sentry SDK (`true/false`).
- `VITE_SENTRY_DSN` (optional): Sentry DSN for frontend.
- `VITE_SENTRY_ENVIRONMENT` (optional): `development`/`production`.
- `VITE_SENTRY_RELEASE` (optional): release identifier (commit SHA/version).
- `VITE_USE_MOCKS` (optional): local mock mode.

## Тестирование и качество

### Frontend

```bash
cd frontend
npm run lint
npm run test
npm run test:coverage
```

### Backend

```bash
cd backend
python -m pytest -q
python -m pytest --cov=app --cov-report=term-missing
```

CI запускает обязательные проверки в GitHub Actions: `.github/workflows/ci.yml`.

## Полезные endpoint'ы

- `GET /health`
- `POST /tmdb/search/batch`
- `POST /tmdb/movies/batch`
- `POST /tmdb/movies/credits/batch`
- `POST /tmdb/movies/keywords/batch`
- `POST /tmdb/movies/full/batch`
- `GET /metrics`
- `GET /api/demo-report`
- `GET /api/demo-csv`

## Документация

- Frontend FSD guide: `docs/frontend-fsd-guide.md`
- Baseline/quality checklist: `docs/plans/2026-02-14-senior-portfolio-foundation-checklist.md`
- Demo asset guide: `docs/demo-report.md`
- Observability runbook: `docs/ops/observability-runbook.md`

## Структура репозитория

```text
backend/
frontend/
docs/
```

## Лицензия

Проект для портфолио и персонального использования.

Используются данные The Movie Database (TMDb). Продукт не аффилирован с TMDb и не сертифицирован TMDb.
