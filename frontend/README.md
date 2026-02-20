# Frontend

React SPA for the Year in Film dashboard.

## Stack

- React 19
- TypeScript
- Vite
- Vitest
- ESLint
- Zustand
- IndexedDB

## Local run

```bash
npm ci
npm run dev
```

Default URL: `http://localhost:5173`.

## Build

```bash
npm run build
npm run preview
```

## Environment

See `.env.example`.

- `VITE_API_URL` backend API base URL.
- `VITE_BACKEND_URL` backend origin alias for integration scenarios.
- `VITE_SENTRY_ENABLED` enable frontend Sentry (`true/false`).
- `VITE_SENTRY_DSN` frontend Sentry DSN.
- `VITE_SENTRY_ENVIRONMENT` deployment environment.
- `VITE_SENTRY_RELEASE` release identifier.
- `VITE_USE_MOCKS` optional local mock mode.

## Tests and lint

```bash
npm run lint
npm run test
npm run test:coverage
```

## FSD layout for analytics

Analytics sections now follow Feature-Sliced Design:

- `src/widgets/analytics-overview/*` section-level composition.
- `src/features/*` interaction-level behavior and controls.
- `src/entities/stats/*` domain logic and domain-focused UI.
- `src/shared/*` reusable UI and config utilities.

Detailed rules and examples: `../docs/frontend-fsd-guide.md`.

