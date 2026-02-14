# ADR-001: Analysis Store Boundaries

Date: 2026-02-14
Status: Accepted

## Context
Analysis-related business state is currently being migrated from scattered local React state into a centralized Zustand store. Without explicit ownership boundaries, the codebase risks dual source-of-truth and inconsistent transitions.

## Decision
Adopt a single `analysisStore` as the runtime source of truth for analysis business state.

State is split conceptually into:
- Domain state: analysis result, loading/error/progress, retry metadata, simplified-mode semantics.
- UI-session state: upload-session specific flags tied to analysis flow (for example mobile pending-files/modal coupling).

Local component state remains only for ephemeral presentational UI (dropdown visibility, purely visual toggles, non-business local interactions).

## Consequences
Positive:
- Predictable ownership: one field has one owner.
- Easier debugability through store inspection and action history.
- Reduced regressions from prop drilling and mirrored state.

Trade-offs:
- Store contract discipline is required; ad-hoc local state additions become riskier.
- More explicit selector design is needed to avoid broad rerenders.

## Guardrails
- No direct local mirrors of store business fields in `AppContainer` or feature hooks.
- Read-path should prefer typed selectors over direct object spreading.
- Migration keeps behavior parity before introducing optional optimizations.

## Alternatives Considered
- Keep mixed local+global ownership during migration: rejected due to drift risk.
- Move all UI state to store: rejected as unnecessary for ephemeral view state.

## Implementation Notes
- `frontend/src/store/analysisStore.ts` is the runtime store contract.
- `frontend/src/store/analysisSelectors.ts` is the default read-path for business state in container components.
