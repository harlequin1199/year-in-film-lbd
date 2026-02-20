# FSD Analytics Refactor Design

**Date:** 2026-02-20  
**Status:** Approved

## Goal

Perform a full frontend review and deep refactor of analytics UI into full FSD structure so the codebase is easier to maintain and understandable for junior engineers, while preserving existing behavior.

## Scope

Primary components in scope:
- `frontend/src/components/ByYearChart.tsx`
- `frontend/src/components/DonutRow.tsx`
- `frontend/src/components/FavoriteDecades.tsx`
- `frontend/src/components/BadgesSection.tsx`

Additional scope:
- shared duplicated UI patterns
- dead/unused code and imports
- frontend documentation and root README clarity

## Architectural Decision

Adopt full FSD format in the analytics domain with layered responsibilities:

- `widgets` for report-level blocks
- `features` for focused interaction logic (mode switch, tooltip behavior)
- `entities` for domain-centric models/libs/ui for films and stats
- `shared` for reusable primitives, generic helpers, and configuration

Target frontend layers overview:
- `src/widgets/analytics-overview/`
- `src/features/chart-mode-switch/`
- `src/features/year-tooltip/`
- `src/entities/film/`
- `src/entities/stats/`
- `src/shared/ui/`
- `src/shared/lib/`
- `src/shared/config/`

## Migration Strategy

1. Extract shared UI/config primitives without behavior changes.
2. Move pure calculations to `entities/*/lib` and cover with unit tests.
3. Refactor `ByYearChart` into widget + feature + entity structure.
4. Refactor `DonutRow`, `FavoriteDecades`, `BadgesSection` into widgets and shared/entity UI parts.
5. Switch imports and remove obsolete files.
6. Update docs for FSD structure and contribution guidance.

## Error and Quality Focus

Mandatory fixes during refactor:
- remove mojibake/corrupted Russian strings in affected files
- reduce complexity hotspots (especially in `ByYearChart` JSX-heavy calculations)
- remove inline styling where reusable UI styles are appropriate
- clean dead code and stale imports

## Testing Strategy

- TDD for extracted libs and refactored behavior boundaries
- keep and adapt existing regression tests
- run frontend lint and test suite as completion gate

Verification gates:
- `npm run lint`
- `npm run test`

## Success Criteria

- analytics components migrated to FSD structure with clear ownership
- behavior parity for chart modes, tooltips, donut legend, decade cards, and badges
- no references to deleted legacy component paths
- docs updated to explain layer conventions and placement rules
- quality checks pass

## Risks and Mitigations

- Risk: regressions during broad file moves
  - Mitigation: incremental migration with tests after each task block
- Risk: import breakage due to path churn
  - Mitigation: temporary barrel exports and staged replacement
- Risk: overengineering in first pass
  - Mitigation: YAGNI and behavior-preserving refactor focus
