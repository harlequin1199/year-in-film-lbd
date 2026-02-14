# CI + Coverage Design

Date: 2026-02-14
Status: approved
Owner: Ale

## Goal
Introduce CI with separate coverage gates for frontend and backend, at a senior-level baseline: reliable, enforceable, and easy to evolve.

## Scope
- Add CI workflow for pull requests and pushes to `main`.
- Run frontend and backend checks in parallel jobs.
- Enforce separate coverage thresholds per layer.
- Upload coverage reports as CI artifacts for debugging.

Out of scope:
- Monorepo-aggregated single coverage metric.
- External coverage SaaS (Codecov/Coveralls) at initial rollout.

## Chosen Approach
Selected approach: **Option 2 strategy with split gates**, implemented first as **strict native CI gates**.

Why:
- Clear ownership by layer (`frontend` and `backend`).
- Faster failure diagnosis.
- Lower operational complexity than aggregated metrics.
- Easy migration path to external coverage services later.

## Alternatives Considered
1. Frontend-only gate.
- Rejected: leaves backend quality unguarded.

2. Split gates (selected).
- Pros: ownership clarity, simpler troubleshooting, independent threshold evolution.
- Cons: no built-in trend dashboards.

3. Aggregated global coverage gate.
- Rejected for phase 1: higher implementation and maintenance complexity with weaker signal by layer.

## CI Architecture
Workflow: `.github/workflows/ci.yml`

Triggers:
- `pull_request`
- `push` to `main`

Jobs:
1. `frontend-tests`
- Setup Node.
- Install deps in `frontend` via `npm ci`.
- Run lint.
- Run tests with coverage.
- Enforce frontend coverage thresholds.
- Upload reports/artifacts.

2. `backend-tests`
- Setup Python.
- Install deps in `backend` (`requirements.txt` + `requirements-dev.txt`).
- Run tests with coverage.
- Enforce backend coverage threshold.
- Upload reports/artifacts.

Branch protection:
- Mark both jobs as required checks.

## Coverage Policy
Initial thresholds:
- Frontend:
  - `lines >= 80%`
  - `functions >= 80%`
  - `branches >= 70%`
- Backend:
  - global coverage `>= 80%`

Governance:
- Do not lower thresholds without explicit technical decision.
- Raise thresholds incrementally every 2-4 weeks (+2-5%) as test suite quality improves.

## Data Flow
1. PR/push event triggers workflow.
2. `frontend-tests` and `backend-tests` run in parallel.
3. Each job installs dependencies and executes tests with coverage.
4. Gates enforce thresholds and fail the job if unmet.
5. Coverage artifacts are uploaded (including on failure).
6. Merge is blocked if any required job fails.

## Error Handling and Reliability
- Configure job timeouts to prevent hangs.
- Use explicit step names for fast root-cause identification.
- Upload artifacts with `if: always()` so diagnostics remain available on failures.

## Verification Strategy
Local pre-push checks:
- Frontend: `cd frontend && npm run test -- --coverage`
- Backend: `cd backend && python -m pytest --cov`

PR verification:
- Both required checks must pass.
- Coverage reports are available as artifacts for investigation.

Gate smoke-check:
- In a temporary branch, intentionally raise a threshold to validate blocking behavior.

## Rollout Plan
1. Enable CI with agreed thresholds (`frontend 80/80/70`, `backend 80`).
2. Observe failures for 1-2 weeks and close obvious test gaps.
3. Raise thresholds iteratively.
4. Optionally add external coverage service later for trend and PR annotations.

## Risks and Mitigations
- Risk: threshold friction during early rollout.
- Mitigation: keep realistic baseline and improve tests incrementally.

- Risk: flaky tests reduce trust in CI.
- Mitigation: prioritize deterministic tests and address flakes immediately.

## Success Criteria
- Every PR gets both jobs executed automatically.
- Merge blocked when any gate fails.
- Coverage artifacts accessible from CI runs.
- Team can increase thresholds without major CI redesign.
