# Letterboxd Year in Review

A full-stack web app that turns your [Letterboxd](https://letterboxd.com/) export into a rich, visual **Year in Film** report — think Spotify Wrapped, but for movies.

Upload your `ratings.csv` (and optionally `diary.csv`) and get an interactive dashboard with personalized stats, charts, rankings, and insights about your movie-watching habits.

## Features

- **Overview stats** — total films, average rating, 4.5-5 star count, year range
- **Top-rated films** — poster grid of your highest-rated movies (via TMDb)
- **Genre breakdown** — most watched vs. highest-rated genres, Genre of the Year
- **Hidden gems & overrated** — films where your rating diverges most from the TMDb consensus
- **Themes & tags** — keyword analysis across your entire watchlist
- **Directors & actors** — top by count and by average rating
- **Countries & languages** — geographic diversity of your taste
- **Decades** — which era you gravitate toward
- **Watch time** — total hours, longest / shortest film
- **Timeline & activity** — viewing patterns by month and weekday (diary mode)
- **Badges** — achievement-style cards summarizing highlights
- **Year filter** — slice the analysis by specific calendar years
- **Progressive loading** — instant CSV stats, then TMDb enrichment with resume support

## Architecture

```
┌────────────────────┐      ┌────────────────────┐
│   Frontend (SPA)   │─────▸│  Backend API (REST)│
│   React + Vite     │      │  FastAPI + SQLite  │
│   Vercel           │      │  Render            │
└────────────────────┘      └────────────────────┘
```

| Service | Role | Hosting |
|---|---|---|
| **Frontend** | CSV parsing, analytics computation, UI | Vercel |
| **Backend** | Batch TMDb search/details/credits/keywords with SQLite cache | Render |

All heavy analytics run **client-side**. Data policy:

- The CSV file is **not** uploaded to the server in full.
- Only fields required for TMDb enrichment are sent to the backend (for example: `title`, `year`, `tmdb_ids`).
- Enrichment cache and resume state are stored locally in **IndexedDB**.

## Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | React 19, Vite 7, Web Workers, IndexedDB |
| Backend | Python, FastAPI, Uvicorn, SQLite, httpx |
| Data | TMDb API v3, Letterboxd CSV export |

## Quick Start

### Prerequisites

- Node.js 18+
- Python 3.10+
- [TMDb API key](https://www.themoviedb.org/settings/api) (free)

### 1. Backend

```bash
cd backend
cp .env.example .env
# Edit .env and add your TMDB_API_KEY

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) — the frontend talks to `localhost:8000` by default.


## Testing

- **Frontend (npm script):**
  ```bash
  cd frontend
  npm run test
  ```
- **Backend (pip + pytest):**
  ```bash
  cd backend
  pip install -r requirements.txt -r requirements-dev.txt
  python -m pytest
  ```

All tests are deterministic and use mocks/fixtures (no external TMDb calls).

## Deployment

### Backend → Render

1. Create a **Web Service**, connect the repo.
2. **Root directory:** `backend`
3. **Build command:** `pip install -r requirements.txt -c constraints.txt`
4. **Start command:**
   ```
   gunicorn -k uvicorn.workers.UvicornWorker main:app --bind 0.0.0.0:$PORT
   ```
5. **Environment variables:**
   | Variable | Required | Description |
   |---|---|---|
   | `TMDB_API_KEY` | Yes | TMDb API key |
   | `FRONTEND_ORIGIN` | Recommended (required in prod) | In production, set this to the exact frontend URL (e.g. `https://your-project.vercel.app`) so CORS allows only that origin. If omitted, backend falls back to localhost-only origins for development (`http://localhost:5173`, `http://localhost:3000`). |

> Free tier: 512 MB RAM. The backend is optimized to stay within this limit.

## Dependency Update Policy

- Backend dependencies in `backend/requirements.txt` are version-ranged for safe patch/minor updates.
- `backend/constraints.txt` pins exact versions used in production builds (especially on Render) for reproducibility.
- Recommended cadence: run a dependency bump every 2–4 weeks, then perform a smoke-check (`/health`, one TMDb batch request, frontend ↔ backend connectivity) before deploying.

## Production Runbook

### Typical symptoms

- **Long first request (cold start):** the first API call after idle time is significantly slower than normal.
- **Spikes of 429 / 5xx:** enrichment requests intermittently fail with rate limits or upstream errors.
- **Enrichment delays:** progress stalls or moves much slower than expected on large datasets.

### Quick checks

1. **Backend health:** call `GET /health` and confirm a fast `200 OK` response.
2. **Minimal TMDb smoke test:** run one small `/tmdb/search/batch` request (single known title/year) to validate end-to-end enrichment path.
3. **Frontend connectivity:** verify the frontend can reach the backend URL configured via `VITE_API_URL` (network tab + no CORS errors).

### Actions

1. **Retry/backoff wait:** for transient 429/5xx bursts, wait and retry with exponential backoff.
2. **Reduce load:** temporarily lower enrichment `batch` size and request `concurrency`.
3. **Resume from saved state:** restart enrichment from IndexedDB resume state instead of re-uploading/reprocessing from scratch.

### Environment variables and common misconfigurations

| Variable | Where | Typical misconfig | What to check |
|---|---|---|---|
| `VITE_API_URL` | Frontend (Vercel/local) | Missing protocol, wrong domain, points to stale backend, trailing path that breaks endpoint URLs | Must be full backend origin (e.g. `https://your-api.onrender.com`) and match the active backend deployment |
| `FRONTEND_ORIGIN` | Backend (Render/local prod mode) | Not set in production, typo in domain, includes extra slash/path, mismatch with actual frontend URL | Must exactly match deployed frontend origin so CORS preflight succeeds |
| `TMDB_API_KEY` | Backend | Missing/invalid key, rotated key not updated in env | Verify key exists in runtime env and TMDb requests succeed |

### Frontend → Vercel

1. Import the repo on [vercel.com](https://vercel.com/).
2. **Root directory:** `frontend`
3. **Framework Preset:** Vite
4. **Environment variable:**
   | Variable | Required | Description |
   |---|---|---|
   | `VITE_API_URL` | Yes | Backend URL (e.g. `https://your-api.onrender.com`) |

Vercel handles SPA routing automatically for Vite projects.

## How It Works

1. User uploads their Letterboxd CSV export (`ratings.csv` + optional `diary.csv`)
2. Frontend parses the CSV in a **Web Worker** and shows instant basic stats
3. Frontend sends only the data required for TMDb enrichment (for example: `title`, `year`, `tmdb_ids`) in batches to the backend
4. Enrichment cache and progress are saved to **IndexedDB** locally — if the page is closed, analysis resumes where it left off
5. Once enrichment is complete, the full analytics dashboard is rendered client-side

## Project Structure

```
├── backend/                 # FastAPI backend
│   ├── main.py              # API endpoints
│   ├── tmdb_batch.py        # Batch TMDb search
│   ├── tmdb_batch_movies.py # Batch movie details + credits + keywords
│   ├── cache.py             # SQLite write-behind cache
│   └── requirements.txt
├── frontend/                # React SPA
│   ├── src/
│   │   ├── App.jsx          # Main app & orchestration
│   │   ├── components/      # UI components (sections, charts, cards)
│   │   ├── utils/           # Analytics engine, CSV parsing, formatting
│   │   ├── workers/         # Web Workers for heavy parsing
│   │   └── mocks/           # Demo data for testing
│   └── vite.config.js
└── README.md
```

## License

This project is for personal / portfolio use.

Data provided by [The Movie Database (TMDb)](https://www.themoviedb.org/). This product uses the TMDb API but is not endorsed or certified by TMDb.
