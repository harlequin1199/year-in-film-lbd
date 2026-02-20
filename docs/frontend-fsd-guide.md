# Frontend FSD Guide

This guide defines where new frontend analytics code should live.

## Layer map

- `app`: application bootstrap, global providers, root wiring.
- `widgets`: large dashboard blocks composed from lower layers.
- `features`: user interactions and behavior scoped to a use case.
- `entities`: domain models and domain UI around one business concept.
- `shared`: reusable UI primitives, config, and generic helpers.

Dependency direction:
- higher layers can import lower layers.
- lower layers must not import higher layers.

## Analytics placement rules

Use these rules when adding or changing analytics sections:

- Put chart composition and section layout in `widgets/analytics-overview/*`.
- Put toggle controls, tooltips, or interaction helpers in `features/*`.
- Put pure analytics calculations in `entities/stats/lib/*`.
- Put domain-specific visual pieces in `entities/stats/ui/*`.
- Put reusable primitives in `shared/ui/*`.
- Put constants/config used across sections in `shared/config/*`.

## Practical examples

Example: By-year chart
- `widgets/analytics-overview/by-year-chart/ByYearChartWidget.tsx` composes the whole section.
- `features/chart-mode-switch/ui/ChartModeSwitch.tsx` handles mode switching UI.
- `features/year-tooltip/ui/YearTooltip.tsx` handles tooltip rendering.
- `entities/stats/lib/byYearModel.ts` contains aggregation logic.
- `entities/stats/ui/decade-bands/DecadeBands.tsx` contains decade background rendering.

Example: Donut row
- `widgets/analytics-overview/donut-row/DonutRowWidget.tsx` renders section.
- `entities/stats/lib/donutSegments.ts` computes segment geometry.
- `shared/ui/legend-list/LegendList.tsx` renders reusable legend UI.

Example: Badges
- `widgets/analytics-overview/badges/BadgesWidget.tsx` renders section shell.
- `entities/stats/ui/badge-card/BadgeCard.tsx` renders one badge card.

## How to refactor legacy components

- Keep behavior parity first.
- Move pure calculations into `entities/*/lib`.
- Move reusable primitives into `shared/ui`.
- Convert legacy component file into a wrapper export during migration.
- Remove wrapper only after `rg` confirms no imports remain.

## Testing expectations

- New domain logic in `entities/*/lib` must have unit tests.
- Widgets/features must keep regression tests for critical behavior.
- Run at least:
  - `npm run test`
  - `npm run lint`

