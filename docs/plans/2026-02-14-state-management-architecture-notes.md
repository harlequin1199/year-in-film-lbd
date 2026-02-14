# State Management Architecture Notes

Date: 2026-02-14
Status: Active Reference
Owner: frontend

## Purpose
Capture practical architecture notes that connect ADR decisions to the current code layout and migration checkpoints.

## Module Map
- `frontend/src/app/AppContainer.tsx`
  - Composition layer for app-level wiring.
  - Should avoid owning long-lived business analysis state.
- `frontend/src/features/upload/useCsvAnalysisFlow.ts`
  - Upload and analysis orchestration.
  - Writes business transitions through store actions.
- `frontend/src/features/resume/useResumeState.ts`
  - Resume UX coordination and recovery wiring.
  - Should not duplicate business fields already owned by store.
- `frontend/src/store/analysisStore.ts`
  - Single source of truth for analysis business state.
- `frontend/src/store/analysisSelectors.ts`
  - Stable read contracts for UI and hooks.
- `frontend/src/utils/indexedDbCache.ts`
  - Persistence boundary for resume/report snapshots.

## Data Flow Rules
Read path:
- UI and feature hooks read store via selectors/accessors.
- Avoid wide subscriptions when narrow selectors are sufficient.

Write path:
- Analysis pipeline writes via named lifecycle actions only.
- Local UI handlers can mutate ephemeral local state only.

Persistence path:
- Save/load/clear happen in orchestration/effects boundary.
- Hydration back to runtime goes through store actions.

## Lifecycle Contract
Nominal flow:
`startRun -> setProgress* -> completeRun | failRun | abortRun -> cleanupRun`

Key invariants:
- `analysis` reset on `startRun`.
- terminal state cleanup (`loading=false`, `progress=null`).
- mobile pending-files/modal coupling is preserved.

## Risk Register
- Risk: dual ownership reintroduced during incremental refactors.
  - Mitigation: selector-first reads + regression tests on terminal states.
- Risk: persistence side effects leaking into store reducers.
  - Mitigation: keep store deterministic and move IO into effects/hook orchestration.
- Risk: aborted flows surfaced as generic errors.
  - Mitigation: explicit abort path and dedicated assertions.

## Verification Checklist
- [ ] No duplicated business state between local hooks and store.
- [ ] Lifecycle terminal invariants hold in store tests.
- [ ] Selector tests validate stable read contract.
- [ ] Resume and last-report flows still restore expected state.
- [ ] Lint and test suites pass for frontend.
