# ADR-003: Persistence Strategy for Analysis State

Date: 2026-02-14
Status: Accepted

## Context
The app supports last-report restore and resume flows via IndexedDB. If persistence is treated as runtime state authority, behavior can diverge from in-memory lifecycle and create race conditions.

## Decision
Treat IndexedDB as a persistence boundary, not runtime source of truth.

Rules:
- Runtime truth is in `analysisStore`.
- Persistence effects (save/load/clear) are coordinated in orchestration/effects layers.
- Store remains a deterministic state container and does not own async IO side effects directly.
- Resume/last-report loads are explicit user or flow-triggered events that hydrate store via lifecycle-safe actions.

## Consequences
Positive:
- Cleaner separation of concerns between state transitions and IO.
- Better testability (pure store behavior vs mockable persistence effects).
- Lower risk of hidden state mutations from persistence callbacks.

Trade-offs:
- Requires explicit wiring between flow hooks and persistence utilities.
- Additional error-handling paths around storage failures.

## Guardrails
- Persistence failures must surface as controlled user-facing errors, not silent no-ops.
- Hydration paths should avoid bypassing invariant checks.
- Resume clear/save policies must remain aligned with terminal lifecycle semantics.

## Alternatives Considered
- Store-managed direct persistence middleware for all fields: rejected for over-coupling and harder flow control.
- IndexedDB-first rendering model: rejected due to stale data and complexity.

## Implementation Notes
- Persistence remains in utilities/effects (`frontend/src/utils/indexedDbCache.ts`) and is invoked by flow orchestration.
- Store state is hydrated and transitioned through explicit actions instead of direct persistence callbacks.
