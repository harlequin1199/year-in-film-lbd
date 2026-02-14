# Error Boundaries And Fallback UX Design

Date: 2026-02-14
Status: Approved
Owner: fullstack

## Context
The frontend has complex render-heavy areas (upload pipeline and report panels). A render crash in one subtree can break user flow and remove recovery options.
Current backend does not provide a dedicated client crash intake endpoint or structured storage for UI crash events.

## Goals
- Add resilient React error boundaries at global and feature levels.
- Provide technical fallback UX with actionable recovery paths.
- Send crash events to backend through a stable API contract.
- Persist client crash events in PostgreSQL for investigation.

## Non-Goals
- Replacing existing async/domain error handling in analysis flows.
- Building full incident management, deduplication, or alerting system now.
- Introducing third-party observability platform as mandatory dependency.

## Approved Scope
- Boundary topology: `global + feature boundaries`.
- Fallback style: technical.
- Logging path: frontend -> `POST /api/client-errors` -> PostgreSQL.
- Storage strategy: PostgreSQL table `client_error_events`.

## Considered Approaches
1. Basic production baseline (recommended, approved)
- `AppErrorBoundary` + 2 feature boundaries + unified technical fallback + backend intake + Postgres storage.
- Pros: strong reliability/UX signal with moderate complexity.
- Cons: no first-phase grouping/alerting.

2. Observability-first
- Adds fingerprinting, alerting, incident UI.
- Pros: better operations day one.
- Cons: larger scope and delivery time.

3. Infra-minimal
- Mostly global boundary with basic logging.
- Pros: fastest.
- Cons: weaker partial recovery and lower resilience.

## Target Architecture
- Global boundary:
  - Wrap app root in `frontend/src/main.tsx` with `AppErrorBoundary`.
  - Render fullscreen fallback on unrecoverable app-shell crash.
- Feature boundaries:
  - Upload/analysis section boundary.
  - Report/results section boundary.
  - Failure in one feature should not unmount the other feature subtree.
- Shared fallback:
  - `TechnicalFallback` supports `global` and `feature` modes.
  - Displays `Error ID`.
  - Actions: `Retry`, `Reload`, `Go Home`.

## Components And Data Flow
- Frontend:
  - `AppErrorBoundary` (class component with `getDerivedStateFromError` and `componentDidCatch`).
  - `FeatureErrorBoundary` (same mechanics, scoped fallback).
  - `TechnicalFallback`:
    - `Retry`: boundary state reset.
    - `Reload`: `window.location.reload()`.
    - `Go Home`: route to `/`.
- Error ID:
  - Generate with `crypto.randomUUID()`.
  - Reused in UI and backend payload for correlation.
- Client payload fields:
  - `errorId`, `message`, `stack`, `componentStack`.
  - `boundaryScope` (`global|feature`), `featureName`.
  - `route`, `userAgent`, `timestamp`.
- Backend:
  - `POST /api/client-errors` with DTO validation.
  - Service persists event in PostgreSQL table `client_error_events`.

## Error Handling Rules
- Boundaries handle render/lifecycle crashes only.
- Existing async pipeline errors (`fetch`, timers, workers) remain in current domain error flow and UI messaging.
- Boundary logging is fire-and-forget. Logging failures must not crash fallback rendering.
- Backend protections:
  - Validate required fields.
  - Trim oversized `stack`/`componentStack` (target cap: 16KB per field).
  - Return `201` on save success with `errorId`.
  - On DB failure, log server-side and return controlled error without exposing internals.

## Backend Data Model
Table: `client_error_events`
- `id` UUID primary key.
- `error_id` text/varchar indexed (unique preferred).
- `message` text.
- `stack` text.
- `component_stack` text.
- `scope` text.
- `feature_name` text nullable.
- `route` text nullable.
- `user_agent` text nullable.
- `created_at` timestamptz default now.

## Testing Strategy
- Frontend unit:
  - Global boundary renders fallback when child throws.
  - Feature boundary isolates failure to local subtree.
  - `TechnicalFallback` wires `Retry`, `Reload`, `Go Home` correctly.
- Frontend integration:
  - Upload failure does not kill report subtree.
  - Report failure does not kill upload controls.
  - Crash payload includes expected correlation/context fields.
- Backend tests:
  - Valid payload -> `201`.
  - Invalid payload -> `422`.
  - Long stacks are trimmed to configured limit.

## Definition Of Done
- Global boundary and two feature boundaries are active in app.
- Technical fallback shows `Error ID` and 3 recovery actions.
- Frontend sends crash event to `/api/client-errors`.
- Backend stores events in PostgreSQL `client_error_events`.
- Targeted frontend/backend tests pass for boundary behavior and API contract.

## Risks And Mitigations
- Risk: boundary catches repeated deterministic crashes causing loop.
- Mitigation: keep explicit `Reload` path and avoid auto-retry loops.
- Risk: large stack payloads affecting storage/perf.
- Mitigation: enforce field-size caps in backend.
- Risk: noisy non-actionable logs.
- Mitigation: include scope/feature/route metadata for quick triage.

## Next Step
Use `writing-plans` to produce an implementation plan from this approved design.

## Verification Checklist
- [x] Global boundary shows fullscreen technical fallback.
- [x] Feature boundary crash does not unmount unrelated section.
- [x] Fallback shows Error ID and Retry/Reload/Go Home actions.
- [x] Backend stores crash event in `client_error_events`.
