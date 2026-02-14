# State Management ADR Package Design

Date: 2026-02-14
Status: Approved
Owner: frontend

## Context
The project already has a state-management migration design and an implementation plan for moving business state into Zustand.
What is still missing is durable decision records (ADR) and concise architecture notes that separate stable architecture decisions from execution details.

## Goal
Create a maintainable ADR package that captures long-lived decisions for state ownership, lifecycle invariants, and persistence boundaries.

## Scope
- Add 3 ADR files in `docs/adr`.
- Add architecture notes in `docs/plans` that connect modules and data flow.
- Align language and constraints with current migration docs.

## ADR Package
1. `ADR-001-analysis-store-boundaries.md`
- Decision: use a single `analysisStore` as source of truth for analysis business state.
- Define split: domain state vs ui-session state.
- Explicitly define what remains local component UI state.

2. `ADR-002-analysis-lifecycle-invariants.md`
- Decision: enforce named lifecycle actions (`startRun`, `setProgress`, `completeRun`, `failRun`, `abortRun`, `cleanupRun`).
- Define legal transitions and terminal-state invariants.
- Define error/abort semantics.

3. `ADR-003-analysis-persistence-strategy.md`
- Decision: IndexedDB is persistence boundary, not runtime source of truth.
- Define side-effect ownership and allowed persistence integration points.
- Define resume/last-report behavior and failure handling.

## Architecture Notes
Add `docs/plans/2026-02-14-state-management-architecture-notes.md` with:
- Module map (`AppContainer`, `useCsvAnalysisFlow`, `useResumeState`, `analysisStore`, selectors, IndexedDB utilities).
- Read-path and write-path rules.
- Migration risks and guardrails.
- Verification checklist.

## Data Flow (Target)
`AppContainer` and feature hooks read via selectors.
`useCsvAnalysisFlow` orchestrates async pipeline and writes via store actions only.
Persistence calls stay in orchestration/effects boundary; store remains deterministic state container.

## Invariants
- `pendingFiles != null` only when `showMobileModal = true`.
- After `completeRun|failRun|abortRun`: `loading=false` and `progress=null`.
- `analysis` resets on `startRun`.
- `AbortError` does not become a generic failure path.

## Testing Guidance
- Store unit tests for action transitions and invariants.
- Selector tests for stable read contracts.
- Flow tests for dispatch order and terminal cleanup.
- Regression checks to prevent duplicated local business state.

## Done Criteria
- ADR package exists and is internally consistent.
- Architecture notes map to current code and migration plan.
- Terminology is aligned across design, implementation plan, and ADR docs.

## Next Step
Use the existing state-management implementation plan to continue execution; update plan tasks only if ADR decisions introduce deltas.
