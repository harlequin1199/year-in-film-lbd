# Year in Film (Letterboxd)

Fullstack app that transforms Letterboxd export data into an interactive yearly film report.

## What it does

- Upload `ratings.csv` and build analytics dashboard.
- Enrich data with TMDb metadata (posters, genres, cast, crew, keywords).
- Show rankings, trends, decade breakdowns, badges, and summary stats.
- Resume interrupted analysis from local state (IndexedDB).
- Use Sentry and `/metrics` for observability.

## Architecture

- `frontend`:
  - React + TypeScript + Vite app.
  - CSV parsing, analytics calculations, dashboard rendering.
  - FSD structure for analytics UI:
    - `src/widgets/analytics-overview/*` (composed sections)
    - `src/features/*` (interaction logic)
    - `src/entities/*` (domain models and domain UI)
    - `src/shared/*` (reusable UI/config)
- `backend`:
  - FastAPI service for TMDb batch endpoints and proxy/cache flows.

Privacy model:
- Full CSV is not uploaded to backend.
- Backend receives only minimal fields required for TMDb enrichment.

## Tech stack

- Frontend: React 19, TypeScript, Vite, Vitest, ESLint, Zustand
- Backend: Python, FastAPI, httpx, SQLite
- Integrations: TMDb API v3, Sentry

## Quick start

Backend:

```bash
cd backend
cp .env.example .env
# set TMDB_API_KEY in .env
python -m pip install -r requirements.txt -r requirements-dev.txt
uvicorn app.main:app --reload --port 8000
```

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Open `http://localhost:5173`.

## Environment variables

Backend:
- `TMDB_API_KEY` required.
- `FRONTEND_ORIGIN` recommended for production CORS.
- `SENTRY_ENABLED`, `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` optional.

Frontend:
- `VITE_API_URL` backend API base URL.
- `VITE_BACKEND_URL` backend origin alias for integration scenarios.
- `VITE_SENTRY_ENABLED`, `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE` optional.
- `VITE_USE_MOCKS` optional local mock mode.

## Testing and quality

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
python -m pytest --cov=app --cov-report=term-missing
```

## Documentation

- Frontend FSD guide: `docs/frontend-fsd-guide.md`
- Observability runbook: `docs/ops/observability-runbook.md`
- ADRs: `docs/adr/*`

