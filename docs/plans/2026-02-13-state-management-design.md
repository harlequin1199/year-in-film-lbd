# State Management Migration Design

Date: 2026-02-13
Status: Approved
Owner: frontend

## Context
Current frontend state is split across local `useState` in `AppContainer`, `useCsvAnalysisFlow`, and `useResumeState`.
Main pain point: predictability and traceability of transitions (`start/progress/partial/complete/fail/abort`) while preserving current behavior.

## Goals
- Centralize business state into a single observable store.
- Keep action-based lifecycle visible in DevTools.
- Prevent dual source-of-truth during migration.
- Preserve current UX and IndexedDB resume/report behavior.

## Non-Goals
- Moving all ephemeral UI state to global store.
- Functional redesign of upload/report UX.
- Introducing multiple state libraries.

## Considered Approaches
1. Zustand + slices (recommended)
- Pros: minimal boilerplate, easy incremental migration, good DevTools integration.
- Cons: less strict architectural guardrails than Redux Toolkit.

2. Redux Toolkit
- Pros: strict action model, very strong debugging discipline.
- Cons: higher complexity and migration overhead for current scope.

3. Jotai
- Pros: flexible atom composition.
- Cons: weaker single-flow visibility for this pipeline-heavy feature.

Decision: Use Zustand with explicit action protocol.

## Target Architecture
Create `frontend/src/store/analysisStore.ts` with explicit analysis lifecycle ownership:
- domain state: `analysis`, `loading`, `error`, `progress`, `retryMessage`, `lastUploadedFileName`
- local UI-session state (kept in hooks/components): `showMobileModal`, `pendingFiles`, dropdown/cache flags, year filter

Keep local component state for ephemeral UI only (drag, popovers, expanded toggles).

## Action Protocol (Single Lifecycle)
`startRun -> setProgress(parsing/stages) -> completeRun | failRun | abortRun -> cleanupRun`

All business mutations must happen through named actions.

## Invariants
- After `completeRun|failRun|abortRun`: `loading=false` and transient progress is cleaned.
- `analysis` is reset on `startRun`.
- `abortRun` must never result in `completeRun`.
- `pendingFiles != null` only when `showMobileModal=true`.
- No duplicated ownership of business fields between local state and store.

## Side Effects Strategy
Centralize persistence side effects in one orchestration layer (`analysisEffects`):
- IndexedDB report writes and resume clear
- periodic resume persistence
- resume clear on terminal states

Do not spread persistence logic across components.

## Migration Plan (Checkpointed)
A. Add store/types/actions; no behavior switch.
B. Switch read path in `AppContainer` to store selectors.
C. Switch write path in `useCsvAnalysisFlow` and `useResumeState` to store actions.
D. Remove legacy duplicated `useState` and prop plumbing.

Rules:
- One field, one owner (store or local) per checkpoint.
- No mixed old/new writes for the same field in a single step.
- Keep rollback boundary at each checkpoint.

## Performance Rules
- Use narrow selectors only.
- Use shallow equality for composite selectors.
- Throttle/batch high-frequency progress updates for UI stability.

## Testing and Verification
Before and during migration:
- Unit tests for state transitions: happy path, fail, abort, mobile simplified.
- Integration tests for orchestration with worker/TMDb mocks.
- Regression checks for resume restore/clear and last report open.

## Done Criteria
- No duplicated business state across local hooks and global store.
- Lifecycle transitions fully traceable in DevTools.
- Terminal states always consistent by invariants.
- Resume/report persistence remains reliable.
- Baseline tests pass for happy/fail/abort/mobile-simplified paths.

## Implementation Boundaries
Do not move to global store:
- `UploadZone` drag state
- local popover/expand toggles
- purely presentational transient UI flags

## Next Step
Use `writing-plans` to produce the execution plan for implementation.
