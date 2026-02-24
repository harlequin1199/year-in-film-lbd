# Frontend (Year in Film)

React SPA для Year in Film dashboard.

- Корневой README (общее позиционирование и архитектура): `../README.md`
- Live Demo: https://year-in-film-lbd.vercel.app/

## Стек

- React 19
- TypeScript
- Vite
- Vitest
- ESLint
- Zustand
- IndexedDB

## Локальный запуск

```bash
npm ci
npm run dev
```

По умолчанию приложение доступно на `http://localhost:5173`.

## Сборка

```bash
npm run build
npm run preview
```

## Переменные окружения

См. `.env.example`.

- `VITE_API_URL` - backend API base URL.
- `VITE_BACKEND_URL` - backend origin alias для интеграционных сценариев.
- `VITE_SENTRY_ENABLED` - enable frontend Sentry (`true/false`).
- `VITE_SENTRY_DSN` - frontend Sentry DSN.
- `VITE_SENTRY_ENVIRONMENT` - deployment environment.
- `VITE_SENTRY_RELEASE` - release identifier.
- `VITE_USE_MOCKS` - optional local mock mode.

## Тесты и линт

```bash
npm run lint
npm run test
npm run test:coverage
```

## FSD layout для аналитики

Секции аналитики следуют Feature-Sliced Design:

- `src/widgets/analytics-overview/*` - section-level composition.
- `src/features/*` - interaction-level behavior and controls.
- `src/entities/stats/*` - domain logic and domain-focused UI.
- `src/shared/*` - reusable UI and config utilities.

Подробные правила и примеры: `../docs/frontend-fsd-guide.md`.
