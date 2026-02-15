# Frontend (Year in Film)

SPA-приложение на React, которое:
- принимает CSV из Letterboxd,
- выполняет аналитику в браузере,
- показывает интерактивный отчет,
- сохраняет прогресс анализа локально.

## Основные технологии

- `React 19`
- `TypeScript`
- `Vite 7`
- `Vitest`
- `zustand`
- `IndexedDB`

## Локальный запуск

```bash
npm ci
npm run dev
```

По умолчанию приложение открывается на `http://localhost:5173`.

## Сборка

```bash
npm run build
npm run preview
```

## Переменные окружения

См. `frontend/.env.example`.

- `VITE_API_URL` — base URL backend API.
- `VITE_BACKEND_URL` — алиас backend origin для интеграционных сценариев.
- `VITE_SENTRY_ENABLED` — включает client-side error reporting в Sentry (`true/false`).
- `VITE_SENTRY_DSN` — DSN для Sentry browser SDK.
- `VITE_SENTRY_ENVIRONMENT` — окружение (`development`, `production`).
- `VITE_SENTRY_RELEASE` — идентификатор релиза (commit SHA/version).
- `VITE_USE_MOCKS` — (опционально, dev) запуск в mock-режиме.

## Тесты и линт

```bash
npm run lint
npm run test
npm run test:coverage
```

Порог покрытия задан в `frontend/vite.config.ts`.

## Ключевые модули

- `src/app/AppContainer.tsx` — оркестрация загрузки, прогресса и анализа.
- `src/app/AppView.tsx` — компоновка основного UI.
- `src/features/upload/useCsvAnalysisFlow.ts` — pipeline анализа и управление стадиями.
- `src/store/analysisStore.ts` — глобальное состояние анализа.
- `src/features/errors/*` — error boundaries и fallback UX.
- `src/workers/*` — воркеры для тяжелых операций (парсинг CSV).

## Поток данных

`upload -> parse worker -> TMDb enrichment -> computed analytics -> render report`

## Принципы

- Основная аналитика выполняется на клиенте.
- Backend используется как enrichment/интеграционный слой для TMDb.
- Прогресс и часть кэша сохраняются локально (resume после перезагрузки).

