# ADR-002: Analysis Lifecycle and Invariants

Date: 2026-02-14
Status: Accepted

## Context
The upload/analysis pipeline has multiple terminal and non-terminal states. Inconsistent transition handling causes stale UI, incorrect progress state, and error ambiguity.

## Decision
Use an explicit action protocol for lifecycle transitions:
- `startRun`
- `setProgress`
- `completeRun`
- `failRun`
- `abortRun`
- `cleanupRun`

Define and enforce invariants:
- `analysis` is reset at `startRun`.
- Terminal actions (`completeRun`, `failRun`, `abortRun`) must produce `loading=false` and `progress=null`.
- `pendingFiles != null` is valid only when `showMobileModal=true`.
- Abort semantics are distinct from generic failure (`AbortError` is not treated as ordinary pipeline failure).

## Consequences
Positive:
- Deterministic transition model for testability and maintenance.
- Clear split between business failure and user-initiated cancellation.
- Fewer stale-state edge cases after terminal events.

Trade-offs:
- Actions must remain cohesive; scattered writes bypassing protocol become architectural violations.
- More tests are required to protect lifecycle invariants.

## Guardrails
- Feature orchestration writes only through lifecycle actions.
- `cleanupRun` must not erase already committed terminal error meaning.
- New lifecycle states require explicit test coverage before adoption.

## Alternatives Considered
- Implicit lifecycle through direct `setState` in hooks/components: rejected due to weak guarantees.
- Single generic `setState` action: rejected due to poor traceability and invariant drift.

## Implementation Notes
- Lifecycle actions are implemented in `frontend/src/store/analysisStore.ts`.
- Upload orchestration dispatches lifecycle transitions via `frontend/src/features/upload/useCsvAnalysisFlow.ts`.
