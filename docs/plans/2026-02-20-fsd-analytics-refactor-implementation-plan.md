# FSD Analytics Refactor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Migrate analytics UI to full FSD structure, remove dead/duplicated code, and keep behavior parity with stronger tests and clearer documentation.

**Architecture:** Refactor legacy `src/components` analytics blocks into FSD layers (`widgets/features/entities/shared`) with explicit boundaries: domain calculations in `entities/*/lib`, reusable UI in `shared/ui`, interaction logic in `features`, and composition in `widgets`. Preserve runtime behavior and existing contracts while reducing component complexity.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, Testing Library, ESLint.

---

### Task 1: Create FSD Skeleton and Shared Primitives

**Files:**
- Create: `frontend/src/shared/ui/card-section-header/CardSectionHeader.tsx`
- Create: `frontend/src/shared/ui/card-section-header/index.ts`
- Create: `frontend/src/shared/ui/legend-list/LegendList.tsx`
- Create: `frontend/src/shared/ui/legend-list/index.ts`
- Create: `frontend/src/shared/config/chart.ts`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/shared/ui/card-section-header/CardSectionHeader.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { CardSectionHeader } from './CardSectionHeader'

test('renders title and description', () => {
  render(<CardSectionHeader title="Æàíðû" description="Äîëÿ æàíðîâ" />)
  expect(screen.getByRole('heading', { name: 'Æàíðû' })).toBeInTheDocument()
  expect(screen.getByText('Äîëÿ æàíðîâ')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/shared/ui/card-section-header/CardSectionHeader.test.tsx`
Expected: FAIL with module/file not found.

**Step 3: Write minimal implementation**

```tsx
export function CardSectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/shared/ui/card-section-header/CardSectionHeader.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/shared/ui frontend/src/shared/config frontend/src/styles.css
git commit -m "feat(frontend): add shared ui primitives for analytics cards"
```

### Task 2: Extract ByYear Domain Calculations to Entities

**Files:**
- Create: `frontend/src/entities/stats/lib/byYearModel.ts`
- Create: `frontend/src/entities/stats/lib/byYearModel.test.ts`
- Modify: `frontend/src/components/ByYearChart.regression.test.tsx`

**Step 1: Write the failing test**

```ts
import { buildByYearModel } from './byYearModel'

test('builds continuous year range and aggregates counts', () => {
  const model = buildByYearModel([
    { year: 2000, rating: 4 },
    { year: 2002, rating: 2 },
  ] as any, [])

  expect(model?.minYear).toBe(2000)
  expect(model?.maxYear).toBe(2002)
  expect(model?.yearEntries.find((x) => x.year === 2001)?.count).toBe(0)
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/entities/stats/lib/byYearModel.test.ts`
Expected: FAIL with missing export.

**Step 3: Write minimal implementation**

```ts
export function buildByYearModel(films: Film[], yearsByLoveScore: YearStats[]) {
  // move aggregation logic from ByYearChart unchanged
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/entities/stats/lib/byYearModel.test.ts src/components/ByYearChart.regression.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/entities/stats/lib frontend/src/components/ByYearChart.regression.test.tsx
git commit -m "refactor(frontend): extract by-year aggregation model to entities"
```

### Task 3: Split ByYearChart into Widget + Features + Entity UI

**Files:**
- Create: `frontend/src/features/chart-mode-switch/ui/ChartModeSwitch.tsx`
- Create: `frontend/src/features/year-tooltip/ui/YearTooltip.tsx`
- Create: `frontend/src/entities/stats/ui/decade-labels/DecadeLabels.tsx`
- Create: `frontend/src/entities/stats/ui/decade-bands/DecadeBands.tsx`
- Create: `frontend/src/widgets/analytics-overview/by-year-chart/ByYearChartWidget.tsx`
- Create: `frontend/src/widgets/analytics-overview/by-year-chart/index.ts`
- Modify: `frontend/src/components/ByYearChart.tsx`
- Test: `frontend/src/widgets/analytics-overview/by-year-chart/ByYearChartWidget.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import ByYearChartWidget from './ByYearChartWidget'

test('renders chart mode buttons', () => {
  render(<ByYearChartWidget films={[]} yearsByLoveScore={[]} />)
  expect(screen.getByRole('button', { name: 'ÔÈËÜÌÛ' })).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/widgets/analytics-overview/by-year-chart/ByYearChartWidget.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

```tsx
// move existing ByYearChart logic into ByYearChartWidget
// keep component contract: films + yearsByLoveScore props
// make legacy file re-export for compatibility
export { default } from '../../widgets/analytics-overview/by-year-chart'
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/widgets/analytics-overview/by-year-chart/ByYearChartWidget.test.tsx src/components/ByYearChart.regression.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features frontend/src/entities/stats/ui frontend/src/widgets/analytics-overview/by-year-chart frontend/src/components/ByYearChart.tsx
git commit -m "refactor(frontend): migrate by-year chart to fsd widget/feature/entity layers"
```

### Task 4: Migrate DonutRow and FavoriteDecades to Widgets + Shared UI

**Files:**
- Create: `frontend/src/entities/stats/lib/donutSegments.ts`
- Create: `frontend/src/entities/stats/lib/donutSegments.test.ts`
- Create: `frontend/src/widgets/analytics-overview/donut-row/DonutRowWidget.tsx`
- Create: `frontend/src/widgets/analytics-overview/favorite-decades/FavoriteDecadesWidget.tsx`
- Create: `frontend/src/widgets/analytics-overview/donut-row/index.ts`
- Create: `frontend/src/widgets/analytics-overview/favorite-decades/index.ts`
- Modify: `frontend/src/components/DonutRow.tsx`
- Modify: `frontend/src/components/FavoriteDecades.tsx`

**Step 1: Write the failing test**

```ts
import { buildDonutSegments } from './donutSegments'

test('normalizes segment dash lengths to total circumference', () => {
  const segments = buildDonutSegments([{ name: 'Drama', count: 2 }], 52)
  expect(segments[0]?.dash).toBeGreaterThan(0)
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/entities/stats/lib/donutSegments.test.ts`
Expected: FAIL.

**Step 3: Write minimal implementation**

```ts
export function buildDonutSegments(top: RankedEntity[], radius = 52) {
  // extract existing DonutRow reduce algorithm
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/entities/stats/lib/donutSegments.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/entities/stats/lib frontend/src/widgets/analytics-overview/donut-row frontend/src/widgets/analytics-overview/favorite-decades frontend/src/components/DonutRow.tsx frontend/src/components/FavoriteDecades.tsx
git commit -m "refactor(frontend): migrate donut and favorite decades widgets to fsd"
```

### Task 5: Migrate BadgesSection and Remove Duplicate Inline Logic

**Files:**
- Create: `frontend/src/entities/stats/ui/badge-card/BadgeCard.tsx`
- Create: `frontend/src/widgets/analytics-overview/badges/BadgesWidget.tsx`
- Create: `frontend/src/widgets/analytics-overview/badges/index.ts`
- Modify: `frontend/src/components/BadgesSection.tsx`
- Modify: `frontend/src/styles.css`
- Test: `frontend/src/entities/stats/ui/badge-card/BadgeCard.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { BadgeCard } from './BadgeCard'

test('formats numeric badge value', () => {
  render(<BadgeCard badge={{ title: 'A', value: 1200, subtitle: '', iconKey: 'film', tone: 'gold' } as any} />)
  expect(screen.getByText('1 200')).toBeInTheDocument()
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/entities/stats/ui/badge-card/BadgeCard.test.tsx`
Expected: FAIL.

**Step 3: Write minimal implementation**

```tsx
export function BadgeCard({ badge }: { badge: Badge }) {
  // move icon + AutoFitValue + formatting from old component
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/entities/stats/ui/badge-card/BadgeCard.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/entities/stats/ui/badge-card frontend/src/widgets/analytics-overview/badges frontend/src/components/BadgesSection.tsx frontend/src/styles.css
git commit -m "refactor(frontend): migrate badges section to fsd widget and entity ui"
```

### Task 6: Remove Dead Code and Switch Imports to New Public APIs

**Files:**
- Modify: `frontend/src/app/AppView.tsx`
- Modify: `frontend/src/components/*.tsx` (legacy wrappers or removals)
- Modify: `frontend/src/widgets/analytics-overview/index.ts`
- Delete: obsolete legacy component files no longer imported
- Test: `frontend/src/app/AppView.error-boundaries.integration.test.tsx`

**Step 1: Write the failing test**

```tsx
// add assertion that AppView still renders analytics sections using current visible text
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/app/AppView.error-boundaries.integration.test.tsx`
Expected: FAIL if imports are broken.

**Step 3: Write minimal implementation**

```ts
// rewire imports to widget entrypoints
// remove files only after `rg` confirms no references
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/app/AppView.error-boundaries.integration.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/app frontend/src/widgets frontend/src/components
git commit -m "chore(frontend): remove dead analytics components and switch to fsd exports"
```

### Task 7: Documentation Refresh and Final Verification

**Files:**
- Modify: `README.md`
- Create: `docs/frontend-fsd-guide.md`
- Modify: `frontend/README.md`

**Step 1: Write the failing test**

```bash
cd backend
python -m pytest -q tests/test_docs_observability_contract.py
```

Expected: If docs contract includes changed sections, it may fail and reveal required updates.

**Step 2: Run targeted frontend checks**

Run: `cd frontend; npm run lint`
Expected: initial FAIL until final cleanup done.

**Step 3: Write minimal implementation**

```md
- add FSD layer map
- add placement rules and examples for junior developers
- fix mojibake text in README sections touched by this refactor
```

**Step 4: Run full verification**

Run: `cd frontend; npm run test`
Expected: PASS.

Run: `cd frontend; npm run lint`
Expected: PASS.

**Step 5: Commit**

```bash
git add README.md frontend/README.md docs/frontend-fsd-guide.md
git commit -m "docs: add frontend fsd guide and refresh project readmes"
```

### Task 8: Final Project Validation

**Files:**
- Modify: none expected (verification-only)

**Step 1: Run repo status check**

Run: `git status --short`
Expected: clean working tree.

**Step 2: Run focused regression suite**

Run: `cd frontend; npm run test -- src/components/ByYearChart.regression.test.tsx src/components/ProgressStatus.regression.test.tsx`
Expected: PASS.

**Step 3: Manual smoke checklist**

- upload CSV and verify analytics dashboard renders
- switch by-year modes and inspect tooltip
- confirm badges, donut legend, decades posters still render

**Step 4: Prepare branch for review**

```bash
git log --oneline -n 10
```

Expected: clear commit sequence matching plan tasks.

**Step 5: Commit (if final polish needed)**

```bash
git add -A
git commit -m "chore: final polish after fsd analytics migration"
```

Only run if there are intentional final touch-ups.
