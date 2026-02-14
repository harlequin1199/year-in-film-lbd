# Senior Portfolio Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Bring the project to a senior-level product engineering baseline with enforced quality gates, architecture convergence, and production-grade reliability evidence.

**Architecture:** Start with CI and measurable quality gates, then converge state ownership to a single store contract, then add error isolation and observability. Keep changes incremental and test-first to avoid regressions in upload/analysis flows.

**Tech Stack:** React 19, TypeScript, Vitest, ESLint, FastAPI, pytest, pytest-cov, GitHub Actions, IndexedDB.

---

### Task 1: Repository hygiene for runtime artifacts

**Files:**
- Modify: `.gitignore`

**Definition of Done:**
- Runtime artifacts (`cache.db-shm`, `cache.db-wal`, `__pycache__`, `*.pyc`) are ignored and do not appear in normal `git status` after local runs.

**Step 1: Write the failing check**

```bash
git status --short
```

**Step 2: Run check to verify it fails**

Run: `git status --short`
Expected: runtime artifacts still appear.

**Step 3: Write minimal implementation**

Add ignore patterns:

```gitignore
backend/app/cache.db
backend/app/cache.db-shm
backend/app/cache.db-wal
backend/app/__pycache__/
```

**Step 4: Run check to verify it passes**

Run:
- `git status --short`
Expected: runtime artifacts are no longer reported.

**Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: ignore backend runtime cache artifacts"
```

### Task 2: Frontend coverage gate

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json`
- Modify: `frontend/vite.config.ts`

**Definition of Done:**
- `npm run test:coverage` exists and fails when thresholds are violated.

**Step 1: Write the failing check**

```bash
cd frontend
npm run test:coverage
```

**Step 2: Run check to verify it fails**

Run: `cd frontend && npm run test:coverage`
Expected: FAIL (missing script/provider).

**Step 3: Write minimal implementation**

- Add script `"test:coverage": "vitest run --coverage"`.
- Add dev dependency `@vitest/coverage-v8`.
- Add `test.coverage.thresholds` in `frontend/vite.config.ts`:

```ts
thresholds: {
  lines: 80,
  functions: 80,
  branches: 70,
  statements: 80,
}
```

**Step 4: Run check to verify it passes**

Run:
- `cd frontend && npm ci`
- `cd frontend && npm run test:coverage`
Expected: PASS or threshold FAIL (which confirms gate works).

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts
git commit -m "test(frontend): add vitest coverage gate"
```

### Task 3: Backend coverage gate bootstrap

**Files:**
- Modify: `backend/requirements-dev.txt`

**Definition of Done:**
- `pytest --cov` works locally.

**Step 1: Write the failing check**

```bash
cd backend
python -m pytest --cov=app --cov-fail-under=20 -q
```

**Step 2: Run check to verify it fails**

Run: `cd backend && python -m pytest --cov=app --cov-fail-under=20 -q`
Expected: FAIL if `pytest-cov` is absent.

**Step 3: Write minimal implementation**

Add:

```txt
pytest-cov>=5.0,<6
```

**Step 4: Run check to verify it passes**

Run:
- `cd backend && pip install -r requirements.txt -r requirements-dev.txt`
- `cd backend && python -m pytest --cov=app --cov-fail-under=20 -q`
Expected: PASS at bootstrap threshold.

**Step 5: Commit**

```bash
git add backend/requirements-dev.txt
git commit -m "test(backend): enable pytest coverage"
```

### Task 4: CI workflow with enforced gates

**Files:**
- Create: `.github/workflows/ci.yml`

**Definition of Done:**
- Frontend and backend jobs run on push/PR and fail on lint/test/coverage regressions.

**Step 1: Write the failing check**

```bash
Test-Path .github/workflows/ci.yml
```

**Step 2: Run check to verify it fails**

Run: `Test-Path .github/workflows/ci.yml`
Expected: `False`.

**Step 3: Write minimal implementation**

Create workflow with:
- Job `frontend`: `npm ci`, `npm run lint`, `npm run test:coverage`
- Job `backend`: `pip install ...`, `pytest --cov=app --cov-fail-under=20`
- Upload coverage artifacts in both jobs.

**Step 4: Run check to verify it passes**

Run: `Test-Path .github/workflows/ci.yml`
Expected: `True`.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add frontend and backend quality gates"
```

### Task 5: Analysis store contract and lifecycle scaffolding

**Files:**
- Create: `frontend/src/store/analysisStore.ts`
- Create: `frontend/src/store/analysisStore.test.ts`
- Create: `frontend/src/store/analysisSelectors.ts`
- Create: `frontend/src/store/analysisSelectors.test.ts`

**Definition of Done:**
- Store exposes lifecycle actions from ADR-002 and selector-based reads are test-covered.

**Step 1: Write the failing test**

```bash
cd frontend
npm run test -- src/store/analysisStore.test.ts src/store/analysisSelectors.test.ts
```

**Step 2: Run test to verify it fails**

Run: same command.
Expected: FAIL (modules missing).

**Step 3: Write minimal implementation**

Implement actions:
- `startRun`, `setProgress`, `completeRun`, `failRun`, `abortRun`, `cleanupRun`

Implement selectors:
- `selectAnalysisSummary`
- `selectProgressView`

**Step 4: Run test to verify it passes**

Run: same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/store/analysisStore.ts frontend/src/store/analysisStore.test.ts frontend/src/store/analysisSelectors.ts frontend/src/store/analysisSelectors.test.ts
git commit -m "feat(frontend): add analysis store lifecycle and selectors"
```

### Task 6: Migrate AppContainer read-path to selectors

**Files:**
- Modify: `frontend/src/app/AppContainer.tsx`
- Create: `frontend/src/app/AppContainer.store-read.test.tsx`

**Definition of Done:**
- `AppContainer` reads business state via store selectors, not duplicated local business `useState` mirrors.

**Step 1: Write the failing test**

```bash
cd frontend
npm run test -- src/app/AppContainer.store-read.test.tsx
```

**Step 2: Run test to verify it fails**

Run: same command.
Expected: FAIL before read-path migration.

**Step 3: Write minimal implementation**

- Replace direct business-state reads with store selector reads.
- Keep only ephemeral UI local state (dropdown/open flags).

**Step 4: Run test to verify it passes**

Run:
- `cd frontend && npm run test -- src/app/AppContainer.store-read.test.tsx`
- `cd frontend && npm run test`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/app/AppContainer.tsx frontend/src/app/AppContainer.store-read.test.tsx
git commit -m "refactor(frontend): migrate app read path to analysis store"
```

### Task 7: Migrate write-path in upload flow

**Files:**
- Modify: `frontend/src/features/upload/useCsvAnalysisFlow.ts`
- Create: `frontend/src/features/upload/useCsvAnalysisFlow.store-write.test.ts`

**Definition of Done:**
- Upload pipeline writes only via store lifecycle actions.

**Step 1: Write the failing test**

```bash
cd frontend
npm run test -- src/features/upload/useCsvAnalysisFlow.store-write.test.ts
```

**Step 2: Run test to verify it fails**

Run: same command.
Expected: FAIL before migration.

**Step 3: Write minimal implementation**

Route writes through:
- `startRun`
- `setProgress`
- `completeRun`
- `failRun`
- `abortRun`
- `cleanupRun`

**Step 4: Run test to verify it passes**

Run:
- `cd frontend && npm run test -- src/features/upload/useCsvAnalysisFlow.store-write.test.ts`
- `cd frontend && npm run test`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/upload/useCsvAnalysisFlow.ts frontend/src/features/upload/useCsvAnalysisFlow.store-write.test.ts
git commit -m "refactor(frontend): route upload writes through analysis store"
```

### Task 8: Error boundaries and technical fallback UX

**Files:**
- Create: `frontend/src/features/errors/AppErrorBoundary.tsx`
- Create: `frontend/src/features/errors/FeatureErrorBoundary.tsx`
- Create: `frontend/src/features/errors/TechnicalFallback.tsx`
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/app/AppView.tsx`
- Test: `frontend/src/features/errors/*.test.tsx`
- Test: `frontend/src/app/AppView.error-boundaries.integration.test.tsx`

**Definition of Done:**
- Global and scoped crashes are isolated with actionable fallback UI.

**Step 1: Write the failing test**

```bash
cd frontend
npm run test -- src/features/errors/AppErrorBoundary.test.tsx src/features/errors/FeatureErrorBoundary.test.tsx src/app/AppView.error-boundaries.integration.test.tsx
```

**Step 2: Run test to verify it fails**

Run: same command.
Expected: FAIL before components exist.

**Step 3: Write minimal implementation**

- Add root boundary in `main.tsx`.
- Wrap upload/report zones with feature boundaries in `AppView.tsx`.
- Render `TechnicalFallback` with `errorId`, retry/reload actions.

**Step 4: Run test to verify it passes**

Run: same command.
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors frontend/src/main.tsx frontend/src/app/AppView.tsx frontend/src/app/AppView.error-boundaries.integration.test.tsx
git commit -m "feat(frontend): add global and feature error boundaries"
```

### Task 9: Backend client error intake + lifespan migration

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/client_errors.py`
- Create: `backend/tests/test_client_errors_endpoint.py`

**Definition of Done:**
- `POST /api/client-errors` validates payload and backend startup/shutdown uses lifespan instead of deprecated events.

**Step 1: Write the failing test**

```bash
cd backend
python -m pytest tests/test_client_errors_endpoint.py -q
```

**Step 2: Run test to verify it fails**

Run: same command.
Expected: FAIL before endpoint exists.

**Step 3: Write minimal implementation**

- Add validated request model for client errors.
- Implement `/api/client-errors` endpoint (status `201`).
- Replace `@app.on_event` handlers with lifespan context manager.

**Step 4: Run test to verify it passes**

Run:
- `cd backend && python -m pytest tests/test_client_errors_endpoint.py -q`
- `cd backend && python -m pytest -q`
Expected: PASS and deprecation warnings removed.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/app/client_errors.py backend/tests/test_client_errors_endpoint.py
git commit -m "feat(backend): add client error intake and lifespan startup"
```

### Task 10: Portfolio evidence and final verification

**Files:**
- Modify: `README.md`
- Modify: `frontend/.env.example`
- Modify: `docs/adr/ADR-001-analysis-store-boundaries.md`
- Modify: `docs/adr/ADR-002-analysis-lifecycle-invariants.md`
- Modify: `docs/adr/ADR-003-analysis-persistence-strategy.md`
- Create: `docs/plans/2026-02-14-senior-portfolio-foundation-checklist.md`

**Definition of Done:**
- README clearly shows architecture decisions, quality gates, and how to verify engineering quality in <5 minutes.

**Step 1: Write the failing check**

```bash
rg "test:coverage|--cov-fail-under|ADR-001|ADR-002|ADR-003" README.md
```

**Step 2: Run check to verify it fails**

Run: same command.
Expected: missing/partial evidence references.

**Step 3: Write minimal implementation**

- Add CI/coverage commands and badge section.
- Add ADR references and reliability notes.
- Add final checklist doc with verification commands.

**Step 4: Run check to verify it passes**

Run:
- `cd frontend && npm run lint && npm run test && npm run test:coverage`
- `cd backend && python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=20`
- `git status --short`
Expected: all checks pass, only intended files changed.

**Step 5: Commit**

```bash
git add README.md frontend/.env.example docs/adr/ADR-001-analysis-store-boundaries.md docs/adr/ADR-002-analysis-lifecycle-invariants.md docs/adr/ADR-003-analysis-persistence-strategy.md docs/plans/2026-02-14-senior-portfolio-foundation-checklist.md
git commit -m "docs: package senior portfolio engineering evidence"
```

## Notes for execution
- Before each task, apply `@superpowers/test-driven-development`.
- If any unexpected failure appears, apply `@superpowers/systematic-debugging` before patching.
- Before claiming completion, apply `@superpowers/verification-before-completion`.
- Keep one task per commit for rollback clarity.
