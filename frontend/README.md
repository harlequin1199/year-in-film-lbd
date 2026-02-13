# Frontend — Year in Film

React SPA that parses Letterboxd CSV exports and renders an interactive analytics dashboard. All analytics computation happens client-side.

## Tech Stack

- **React 19** — UI components
- **Vite 7** — build tooling and dev server
- **Web Workers** — off-main-thread CSV parsing for large files
- **IndexedDB** — persistent cache and resume state for TMDb enrichment

## Development

```bash
npm install
npm run dev
```

Opens at [http://localhost:5173](http://localhost:5173). The dev server proxies `/tmdb/*` requests to the backend at `localhost:8000` (configured in `vite.config.js`).

## Build

```bash
npm run build     # production build → dist/
npm run preview   # preview the production build locally
```

## Environment Variables

| Variable | Default | Description |
|---|---|---|
| `VITE_API_URL` | `http://localhost:8000` | Backend API base URL |

## Project Structure

```
src/
├── App.jsx                  # Main app: file upload, orchestration, layout
├── components/
│   ├── StatsCards.jsx        # Overview metrics (films, avg rating, etc.)
│   ├── FilmsGrid.jsx         # Top-rated films poster grid
│   ├── GenresSection.jsx     # Genre breakdown (by count & avg rating)
│   ├── TagsTable.jsx         # Keywords / themes table
│   ├── DirectorsSection.jsx  # Directors rankings
│   ├── ActorsSection.jsx     # Actors rankings
│   ├── CountriesSection.jsx  # Countries breakdown
│   ├── LanguagesSection.jsx  # Languages diversity
│   ├── TimelineChart.jsx     # Monthly viewing timeline
│   ├── BadgesSection.jsx     # Achievement-style highlight cards
│   ├── HiddenGemsSection.jsx # Under-appreciated films
│   ├── DecadesSection.jsx    # Favorite decades
│   ├── WatchTimeCard.jsx     # Total watch time
│   ├── YearFilter.jsx        # Filter by calendar year
│   ├── Stars.jsx             # Star rating display
│   └── ...
├── utils/
│   ├── analyticsClient.js    # Main analytics engine (aggregations, badges)
│   ├── csvParser.js          # CSV → structured data
│   ├── format.js             # Number/date formatting helpers
│   ├── genresRu.js           # Genre name localization (EN → RU)
│   ├── countriesRu.js        # Country name localization (EN → RU)
│   └── genreIcons.js         # Genre icon mapping
├── workers/
│   └── csvWorker.js          # Web Worker for parsing large CSVs
├── mocks/                    # Demo / test data (JSON)
└── styles/                   # CSS
```

## Key Design Decisions

- **Client-side analytics** — the backend only provides TMDb data; all stats, rankings, and charts are computed in the browser. This keeps the backend stateless and lightweight.
- **Data policy** — the CSV file is not uploaded to the server in full; only fields required for TMDb enrichment are sent to the backend (for example: `title`, `year`, `tmdb_ids`); enrichment cache and resume state are stored locally in IndexedDB.
- **Progressive loading** — basic stats (from CSV only) appear instantly. TMDb enrichment (posters, genres, directors, etc.) loads in the background with a progress indicator.
- **Resume support** — enrichment progress is saved to IndexedDB. If the user closes the tab and returns, analysis continues from where it left off.
- **Simplified mode** — on mobile or with very large datasets, a lighter analysis path is used to keep the UI responsive.
- **Russian localization** — genre and country names are localized to Russian for the UI, while internal data stays in English for TMDb compatibility.
