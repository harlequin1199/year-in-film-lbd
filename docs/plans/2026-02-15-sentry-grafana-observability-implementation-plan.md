# Sentry + Grafana Observability Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace custom client error ingestion with Sentry end-to-end and add free-tier operational monitoring with Grafana-compatible backend metrics.

**Architecture:** Frontend and backend report incidents directly to Sentry with strict redaction and controlled sampling. Backend exposes Prometheus metrics for Grafana Cloud dashboards and alerts. Legacy `/api/client-errors` flow and storage are removed completely.

**Tech Stack:** React 19 + TypeScript + Vitest, FastAPI + pytest, sentry-sdk, @sentry/react, prometheus-fastapi-instrumentator, Grafana Cloud Free.

---

References for execution discipline:
- `@superpowers/test-driven-development`
- `@superpowers/verification-before-completion`

### Task 1: Add dependency and environment scaffolding

**Files:**
- Modify: `frontend/package.json`
- Modify: `backend/requirements.txt`
- Modify: `README.md`
- Modify: `frontend/README.md`

**Step 1: Write the failing test**

```ts
// frontend/src/features/errors/sentryBootstrap.contract.test.ts
import { readFileSync } from 'node:fs'

describe('sentry deps/env docs contract', () => {
  it('declares @sentry/react and sentry env vars in docs', () => {
    const pkg = readFileSync('package.json', 'utf-8')
    const readme = readFileSync('../README.md', 'utf-8')
    expect(pkg).toMatch(/@sentry\/react/)
    expect(readme).toMatch(/SENTRY_DSN/)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/sentryBootstrap.contract.test.ts`
Expected: FAIL (`@sentry/react` and/or env docs missing).

**Step 3: Write minimal implementation**

- Add `@sentry/react` dependency in `frontend/package.json`.
- Add `sentry-sdk` and `prometheus-fastapi-instrumentator` to `backend/requirements.txt`.
- Add env placeholders to docs:
  - `SENTRY_DSN`, `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE`, `SENTRY_ENABLED`
  - `VITE_SENTRY_DSN`, `VITE_SENTRY_ENVIRONMENT`, `VITE_SENTRY_RELEASE`, `VITE_SENTRY_ENABLED`

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/sentryBootstrap.contract.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/package.json backend/requirements.txt README.md frontend/README.md frontend/package-lock.json
git commit -m "chore: add sentry and metrics dependencies with env docs"
```

### Task 2: Add frontend Sentry bootstrap module

**Files:**
- Create: `frontend/src/observability/sentry.ts`
- Create: `frontend/src/observability/sentry.test.ts`
- Modify: `frontend/src/main.tsx`

**Step 1: Write the failing test**

```ts
// frontend/src/observability/sentry.test.ts
import { describe, it, expect, vi } from 'vitest'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

describe('initSentry', () => {
  it('does not init when disabled', async () => {
    const mod = await import('./sentry')
    expect(mod.shouldEnableSentry({ VITE_SENTRY_ENABLED: 'false', VITE_SENTRY_DSN: 'x' })).toBe(false)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/observability/sentry.test.ts`
Expected: FAIL (module/functions absent).

**Step 3: Write minimal implementation**

```ts
// frontend/src/observability/sentry.ts
import * as Sentry from '@sentry/react'

type EnvLike = {
  VITE_SENTRY_ENABLED?: string
  VITE_SENTRY_DSN?: string
  VITE_SENTRY_ENVIRONMENT?: string
  VITE_SENTRY_RELEASE?: string
}

export function shouldEnableSentry(env: EnvLike): boolean {
  return env.VITE_SENTRY_ENABLED === 'true' && Boolean(env.VITE_SENTRY_DSN)
}

export function initSentry(env: EnvLike = import.meta.env): void {
  if (!shouldEnableSentry(env)) return

  Sentry.init({
    dsn: env.VITE_SENTRY_DSN,
    environment: env.VITE_SENTRY_ENVIRONMENT || 'development',
    release: env.VITE_SENTRY_RELEASE,
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0.01,
    beforeSend(event) {
      if (event.request?.headers) {
        delete event.request.headers.Authorization
        delete event.request.headers.authorization
      }
      return event
    },
  })
}
```

- Call `initSentry()` in `frontend/src/main.tsx` before `createRoot`.

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/observability/sentry.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/observability/sentry.ts frontend/src/observability/sentry.test.ts frontend/src/main.tsx
git commit -m "feat(frontend): add sentry bootstrap module"
```

### Task 3: Wire frontend error boundaries to Sentry

**Files:**
- Modify: `frontend/src/features/errors/AppErrorBoundary.tsx`
- Modify: `frontend/src/features/errors/FeatureErrorBoundary.tsx`
- Create: `frontend/src/features/errors/errorBoundaries.sentry.test.tsx`

**Step 1: Write the failing test**

```tsx
// frontend/src/features/errors/errorBoundaries.sentry.test.tsx
import { render } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import * as Sentry from '@sentry/react'
import { AppErrorBoundary } from './AppErrorBoundary'

vi.spyOn(Sentry, 'captureException').mockImplementation(() => 'event-id')

function Crash() {
  throw new Error('boom')
}

describe('error boundaries sentry integration', () => {
  it('captures crash in sentry', () => {
    expect(() => render(<AppErrorBoundary><Crash /></AppErrorBoundary>)).not.toThrow()
    expect(Sentry.captureException).toHaveBeenCalled()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/errorBoundaries.sentry.test.tsx`
Expected: FAIL (`captureException` not called).

**Step 3: Write minimal implementation**

- In `componentDidCatch` call `Sentry.captureException(error, { tags, extra })`.
- Tags:
  - App boundary: `boundary_scope=global`
  - Feature boundary: `boundary_scope=feature`, `feature_name=<prop>`
- Extra:
  - `componentStack: info.componentStack`

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/errorBoundaries.sentry.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors/AppErrorBoundary.tsx frontend/src/features/errors/FeatureErrorBoundary.tsx frontend/src/features/errors/errorBoundaries.sentry.test.tsx
git commit -m "feat(frontend): report boundary crashes to sentry"
```

### Task 4: Remove frontend legacy client error API

**Files:**
- Delete: `frontend/src/features/errors/clientErrorApi.ts`
- Delete: `frontend/src/features/errors/clientErrorApi.test.ts`
- Delete: `frontend/src/features/errors/clientError.types.ts`
- Modify: `frontend/README.md`

**Step 1: Write the failing test**

```ts
// frontend/src/features/errors/legacyClientErrors.removal.test.ts
import { existsSync } from 'node:fs'
import { expect, it } from 'vitest'

it('legacy client error api files are removed', () => {
  expect(existsSync('src/features/errors/clientErrorApi.ts')).toBe(false)
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/legacyClientErrors.removal.test.ts`
Expected: FAIL (file still exists).

**Step 3: Write minimal implementation**

- Remove legacy files.
- Remove `VITE_CLIENT_ERRORS_PATH` from docs and env guidance.

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/legacyClientErrors.removal.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors frontend/README.md
git commit -m "refactor(frontend): remove legacy client error intake api"
```

### Task 5: Add backend Sentry initialization

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_sentry_init.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_sentry_init.py
from app.main import _should_enable_sentry

def test_should_enable_sentry_true_when_flag_and_dsn_present():
    assert _should_enable_sentry({"SENTRY_ENABLED": "true", "SENTRY_DSN": "x"}) is True
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_sentry_init.py`
Expected: FAIL (`_should_enable_sentry` missing).

**Step 3: Write minimal implementation**

```python
# in backend/app/main.py
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration


def _should_enable_sentry(env: dict[str, str]) -> bool:
    return env.get("SENTRY_ENABLED") == "true" and bool(env.get("SENTRY_DSN"))


def _init_sentry_from_env() -> None:
    env = {
        "SENTRY_ENABLED": os.getenv("SENTRY_ENABLED", "false"),
        "SENTRY_DSN": os.getenv("SENTRY_DSN", ""),
        "SENTRY_ENVIRONMENT": os.getenv("SENTRY_ENVIRONMENT", "development"),
        "SENTRY_RELEASE": os.getenv("SENTRY_RELEASE", ""),
    }
    if not _should_enable_sentry(env):
        return
    sentry_sdk.init(
        dsn=env["SENTRY_DSN"],
        environment=env["SENTRY_ENVIRONMENT"],
        release=env["SENTRY_RELEASE"] or None,
        traces_sample_rate=0.1,
        integrations=[FastApiIntegration()],
    )
```

- Call `_init_sentry_from_env()` before app startup logic.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_sentry_init.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_sentry_init.py backend/requirements.txt
git commit -m "feat(backend): initialize sentry via environment settings"
```

### Task 6: Add backend Sentry redaction hook

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_sentry_redaction.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_sentry_redaction.py
from app.main import _redact_sentry_event

def test_redact_auth_headers_and_cookies():
    event = {
        "request": {"headers": {"authorization": "secret", "cookie": "session=abc"}, "url": "https://x/?token=abc"}
    }
    out = _redact_sentry_event(event, None)
    assert out["request"]["headers"].get("authorization") is None
    assert out["request"]["headers"].get("cookie") is None
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_sentry_redaction.py`
Expected: FAIL (`_redact_sentry_event` missing).

**Step 3: Write minimal implementation**

- Implement `_redact_sentry_event(event, hint)`.
- Remove/blank sensitive request headers (`authorization`, `cookie`, `x-api-key`).
- Strip token-like query params from request URL.
- Pass `before_send=_redact_sentry_event` into `sentry_sdk.init`.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_sentry_redaction.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_sentry_redaction.py
git commit -m "feat(backend): add sentry event redaction hook"
```

### Task 7: Remove backend legacy client error endpoint and repository

**Files:**
- Modify: `backend/app/main.py`
- Delete: `backend/app/client_errors.py`
- Delete: `backend/app/client_errors_repository.py`
- Delete: `backend/tests/test_client_errors_endpoint.py`
- Delete: `backend/tests/test_client_errors_repository.py`
- Modify: `README.md`

**Step 1: Write the failing test**

```python
# backend/tests/test_legacy_client_errors_removed.py
from fastapi.testclient import TestClient
from app.main import app


def test_client_errors_endpoint_removed():
    with TestClient(app) as client:
        response = client.post('/api/client-errors', json={})
    assert response.status_code == 404
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_legacy_client_errors_removed.py`
Expected: FAIL (endpoint still exists).

**Step 3: Write minimal implementation**

- Remove import and route declaration for `/api/client-errors`.
- Delete model/repository modules and old tests.
- Update API docs in root README to remove `/api/client-errors`.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_legacy_client_errors_removed.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/app/client_errors.py backend/app/client_errors_repository.py backend/tests/test_legacy_client_errors_removed.py backend/tests/test_client_errors_endpoint.py backend/tests/test_client_errors_repository.py README.md
git commit -m "refactor(backend): remove legacy client error intake endpoint"
```

### Task 8: Add backend Prometheus metrics endpoint

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/tests/test_metrics_endpoint.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_metrics_endpoint.py
from fastapi.testclient import TestClient
from app.main import app


def test_metrics_endpoint_exposes_prometheus_format():
    with TestClient(app) as client:
        response = client.get('/metrics')
    assert response.status_code == 200
    assert 'text/plain' in response.headers.get('content-type', '')
    assert 'http' in response.text.lower()
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_metrics_endpoint.py`
Expected: FAIL (`/metrics` missing).

**Step 3: Write minimal implementation**

```python
from prometheus_fastapi_instrumentator import Instrumentator

instrumentator = Instrumentator(
    should_group_status_codes=True,
    should_ignore_untemplated=True,
)
instrumentator.instrument(app).expose(app, endpoint="/metrics", include_in_schema=False)
```

- Add a lightweight guard strategy for production (tokenized path or header check) if feasible for Render.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_metrics_endpoint.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/tests/test_metrics_endpoint.py backend/requirements.txt
git commit -m "feat(backend): add prometheus metrics endpoint"
```

### Task 9: Remove legacy migration for client error storage

**Files:**
- Delete: `backend/migrations/2026_02_14_create_client_error_events.sql`
- Create: `backend/tests/test_legacy_migration_removed.py`

**Step 1: Write the failing test**

```python
# backend/tests/test_legacy_migration_removed.py
from pathlib import Path

def test_legacy_client_error_migration_removed():
    path = Path('migrations/2026_02_14_create_client_error_events.sql')
    assert not path.exists()
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_legacy_migration_removed.py`
Expected: FAIL (file still exists).

**Step 3: Write minimal implementation**

- Remove legacy SQL migration file.
- If migration history must remain immutable, replace this task with a new drop migration and adjust test accordingly.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_legacy_migration_removed.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/migrations/2026_02_14_create_client_error_events.sql backend/tests/test_legacy_migration_removed.py
git commit -m "chore(db): remove legacy client error events migration"
```

### Task 10: Update architecture decision records and runbook

**Files:**
- Create: `docs/adr/ADR-004-observability-sentry-grafana.md`
- Create: `docs/ops/observability-runbook.md`
- Modify: `README.md`
- Modify: `frontend/README.md`

**Step 1: Write the failing test**

```python
# backend/tests/test_docs_observability_contract.py
from pathlib import Path


def test_observability_docs_exist():
    assert Path('../docs/adr/ADR-004-observability-sentry-grafana.md').exists()
    assert Path('../docs/ops/observability-runbook.md').exists()
```

**Step 2: Run test to verify it fails**

Run: `cd backend; python -m pytest -q tests/test_docs_observability_contract.py`
Expected: FAIL (docs missing).

**Step 3: Write minimal implementation**

- ADR content:
  - decision summary,
  - alternatives considered,
  - consequences,
  - migration notes.
- Runbook content:
  - FE crash validation,
  - BE 500 validation,
  - Grafana dashboard/alert checks,
  - incident response checklist.
- Update both READMEs to reference new docs.

**Step 4: Run test to verify it passes**

Run: `cd backend; python -m pytest -q tests/test_docs_observability_contract.py`
Expected: PASS.

**Step 5: Commit**

```bash
git add docs/adr/ADR-004-observability-sentry-grafana.md docs/ops/observability-runbook.md README.md frontend/README.md backend/tests/test_docs_observability_contract.py
git commit -m "docs: add observability adr and operational runbook"
```

### Task 11: Full verification gate

**Files:**
- Modify: none (verification only)

**Step 1: Run frontend targeted tests**

Run: `cd frontend; npm run test -- src/observability/sentry.test.ts src/features/errors/errorBoundaries.sentry.test.tsx`
Expected: PASS.

**Step 2: Run backend targeted tests**

Run: `cd backend; python -m pytest -q tests/test_sentry_init.py tests/test_sentry_redaction.py tests/test_metrics_endpoint.py tests/test_legacy_client_errors_removed.py`
Expected: PASS.

**Step 3: Run backend and frontend baseline suites**

Run: `cd frontend; npm run test`
Expected: PASS.

Run: `cd backend; python -m pytest -q`
Expected: PASS.

**Step 4: Manual smoke checks**

Run backend locally and verify:
- `GET /health` returns 200.
- `GET /metrics` returns Prometheus output.
- Trigger controlled 500 path and confirm Sentry event.

Expected: all checks pass.

**Step 5: Commit verification snapshot (optional)**

```bash
git status
# ensure clean tree before final integration
```

### Task 12: Final cleanup and integration summary

**Files:**
- Modify: `README.md` (if command examples need correction after real verification)

**Step 1: Validate removed API references**

Run: `rg -n "client-errors|VITE_CLIENT_ERRORS_PATH|client_error_events" README.md frontend backend docs`
Expected: no stale references except historical notes.

**Step 2: Validate observability references**

Run: `rg -n "SENTRY_|Grafana|/metrics|runbook|ADR-004" README.md frontend/README.md docs`
Expected: required docs and setup references present.

**Step 3: Produce release notes snippet**

```md
- Migrated FE/BE error reporting to Sentry.
- Removed legacy client error ingestion endpoint and persistence artifacts.
- Added backend Prometheus metrics endpoint for Grafana Cloud.
- Added observability ADR and runbook.
```

**Step 4: Final commit (if any doc adjustments remain)**

```bash
git add README.md frontend/README.md docs
 git commit -m "docs: finalize observability migration notes"
```

**Step 5: Prepare PR checklist**

- Attach Sentry screenshot (FE + BE events).
- Attach Grafana dashboard screenshot.
- Include alert test evidence.

---

Plan complete and saved to `docs/plans/2026-02-15-sentry-grafana-observability-implementation-plan.md`. Two execution options:

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

Which approach?
