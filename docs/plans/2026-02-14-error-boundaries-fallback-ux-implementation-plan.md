# Error Boundaries And Fallback UX Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement global and feature-level React error boundaries with technical fallback UX and backend crash intake persisted in PostgreSQL.

**Architecture:** Add a root `AppErrorBoundary` in frontend bootstrap and scoped `FeatureErrorBoundary` wrappers around upload and report zones. Implement a shared `TechnicalFallback` and a client logger that posts structured crash events to backend. Extend FastAPI with `POST /api/client-errors` and persist validated events in a dedicated PostgreSQL table.

**Tech Stack:** React 19 + TypeScript + Vitest (frontend), FastAPI + Pydantic + pytest (backend), PostgreSQL.

---

### Task 1: Add frontend crash event contract and API client

**Files:**
- Create: `frontend/src/features/errors/clientError.types.ts`
- Create: `frontend/src/features/errors/clientErrorApi.ts`
- Test: `frontend/src/features/errors/clientErrorApi.test.ts`

**Step 1: Write the failing test**

```ts
import { describe, expect, it, vi } from 'vitest'
import { postClientErrorEvent } from './clientErrorApi'

describe('postClientErrorEvent', () => {
  it('posts payload to /api/client-errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await postClientErrorEvent({
      errorId: 'e1',
      message: 'boom',
      stack: 'stack',
      componentStack: 'component',
      boundaryScope: 'global',
      featureName: null,
      route: '/',
      userAgent: 'ua',
      timestamp: '2026-02-14T00:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith('/api/client-errors', expect.objectContaining({
      method: 'POST',
    }))
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/clientErrorApi.test.ts`
Expected: FAIL because `postClientErrorEvent` module does not exist.

**Step 3: Write minimal implementation**

```ts
import type { ClientErrorEventInput } from './clientError.types'

export async function postClientErrorEvent(payload: ClientErrorEventInput): Promise<void> {
  try {
    await fetch('/api/client-errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      keepalive: true,
    })
  } catch {
    // Fire-and-forget: logging failure must not crash UI.
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/clientErrorApi.test.ts`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors/clientError.types.ts frontend/src/features/errors/clientErrorApi.ts frontend/src/features/errors/clientErrorApi.test.ts
git commit -m "feat(frontend): add client error event api contract"
```

### Task 2: Implement shared TechnicalFallback component

**Files:**
- Create: `frontend/src/features/errors/TechnicalFallback.tsx`
- Test: `frontend/src/features/errors/TechnicalFallback.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TechnicalFallback } from './TechnicalFallback'

describe('TechnicalFallback', () => {
  it('shows error id and calls retry handler', async () => {
    const onRetry = vi.fn()
    render(
      <TechnicalFallback
        mode="feature"
        errorId="err-123"
        message="boom"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText(/err-123/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/TechnicalFallback.test.tsx`
Expected: FAIL because component does not exist.

**Step 3: Write minimal implementation**

```tsx
type TechnicalFallbackProps = {
  mode: 'global' | 'feature'
  errorId: string
  message: string
  onRetry: () => void
  onGoHome?: () => void
}

export function TechnicalFallback(props: TechnicalFallbackProps) {
  return (
    <section role="alert">
      <p>Error ID: {props.errorId}</p>
      <p>{props.message}</p>
      <button onClick={props.onRetry}>Retry</button>
      <button onClick={() => window.location.reload()}>Reload</button>
      <button onClick={props.onGoHome}>Go Home</button>
    </section>
  )
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/TechnicalFallback.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors/TechnicalFallback.tsx frontend/src/features/errors/TechnicalFallback.test.tsx
git commit -m "feat(frontend): add technical fallback component"
```

### Task 3: Add global and feature error boundary components

**Files:**
- Create: `frontend/src/features/errors/AppErrorBoundary.tsx`
- Create: `frontend/src/features/errors/FeatureErrorBoundary.tsx`
- Test: `frontend/src/features/errors/AppErrorBoundary.test.tsx`
- Test: `frontend/src/features/errors/FeatureErrorBoundary.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Broken() {
  throw new Error('render crash')
}

describe('AppErrorBoundary', () => {
  it('renders global fallback on render crash', () => {
    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    )
    expect(screen.getByText(/error id/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/features/errors/AppErrorBoundary.test.tsx src/features/errors/FeatureErrorBoundary.test.tsx`
Expected: FAIL because boundaries do not exist.

**Step 3: Write minimal implementation**

```tsx
type BoundaryState = { hasError: boolean; errorId: string; message: string }

export class AppErrorBoundary extends React.Component<React.PropsWithChildren, BoundaryState> {
  state: BoundaryState = { hasError: false, errorId: '', message: '' }

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { hasError: true, errorId: crypto.randomUUID(), message: error.message || 'Unexpected error' }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // call postClientErrorEvent(...)
  }

  private reset = () => this.setState({ hasError: false, errorId: '', message: '' })

  render() {
    if (this.state.hasError) {
      return <TechnicalFallback mode="global" errorId={this.state.errorId} message={this.state.message} onRetry={this.reset} />
    }
    return this.props.children
  }
}
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/features/errors/AppErrorBoundary.test.tsx src/features/errors/FeatureErrorBoundary.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/features/errors/AppErrorBoundary.tsx frontend/src/features/errors/FeatureErrorBoundary.tsx frontend/src/features/errors/AppErrorBoundary.test.tsx frontend/src/features/errors/FeatureErrorBoundary.test.tsx
git commit -m "feat(frontend): add global and feature error boundaries"
```

### Task 4: Integrate boundaries into app bootstrap and feature zones

**Files:**
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/app/AppView.tsx`
- Test: `frontend/src/app/AppView.error-boundaries.integration.test.tsx`

**Step 1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import AppView from './AppView'

describe('AppView feature boundaries', () => {
  it('keeps upload controls visible when report section crashes', () => {
    render(<AppView /* props with crashing report section mock */ />)
    expect(screen.getByText(/upload/i)).toBeInTheDocument()
  })
})
```

**Step 2: Run test to verify it fails**

Run: `cd frontend; npm run test -- src/app/AppView.error-boundaries.integration.test.tsx`
Expected: FAIL due missing wrappers/injection points.

**Step 3: Write minimal implementation**

```tsx
// main.tsx
createRoot(rootElement).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
      <Analytics />
    </AppErrorBoundary>
  </StrictMode>,
)
```

```tsx
// AppView.tsx
<FeatureErrorBoundary featureName="upload">
  {/* upload zone and controls */}
</FeatureErrorBoundary>
<FeatureErrorBoundary featureName="report">
  {/* computed report sections */}
</FeatureErrorBoundary>
```

**Step 4: Run test to verify it passes**

Run: `cd frontend; npm run test -- src/app/AppView.error-boundaries.integration.test.tsx`
Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/src/main.tsx frontend/src/app/AppView.tsx frontend/src/app/AppView.error-boundaries.integration.test.tsx
git commit -m "feat(frontend): wire error boundaries into app and feature sections"
```

### Task 5: Add backend client error endpoint and validation schema

**Files:**
- Modify: `backend/app/main.py`
- Create: `backend/app/client_errors.py`
- Test: `backend/tests/test_client_errors_endpoint.py`

**Step 1: Write the failing test**

```py
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_post_client_error_returns_201():
  payload = {
    "errorId": "e-1",
    "message": "boom",
    "stack": "stack",
    "componentStack": "component",
    "boundaryScope": "global",
    "featureName": None,
    "route": "/",
    "userAgent": "ua",
    "timestamp": "2026-02-14T00:00:00.000Z",
  }
  response = client.post("/api/client-errors", json=payload)
  assert response.status_code == 201
```

**Step 2: Run test to verify it fails**

Run: `cd backend; pytest tests/test_client_errors_endpoint.py -v`
Expected: FAIL because route does not exist.

**Step 3: Write minimal implementation**

```py
class ClientErrorEventIn(BaseModel):
  errorId: str
  message: str
  stack: str | None = None
  componentStack: str | None = None
  boundaryScope: Literal["global", "feature"]
  featureName: str | None = None
  route: str | None = None
  userAgent: str | None = None
  timestamp: datetime

@app.post("/api/client-errors", status_code=201)
def post_client_errors(payload: ClientErrorEventIn):
  # service call will be added in next task
  return {"errorId": payload.errorId}
```

**Step 4: Run test to verify it passes**

Run: `cd backend; pytest tests/test_client_errors_endpoint.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/main.py backend/app/client_errors.py backend/tests/test_client_errors_endpoint.py
git commit -m "feat(backend): add client error intake endpoint"
```

### Task 6: Persist client errors in PostgreSQL

**Files:**
- Create: `backend/app/client_errors_repository.py`
- Modify: `backend/app/client_errors.py`
- Create: `backend/tests/test_client_errors_repository.py`
- Create: `backend/migrations/2026_02_14_create_client_error_events.sql`

**Step 1: Write the failing test**

```py
def test_trim_long_stack_before_insert(repository):
  long_stack = "x" * 20000
  event_id = repository.insert_event({
    "errorId": "e1",
    "message": "boom",
    "stack": long_stack,
    "componentStack": long_stack,
    "boundaryScope": "global",
  })
  saved = repository.get_by_error_id("e1")
  assert len(saved["stack"]) <= 16384
  assert len(saved["component_stack"]) <= 16384
```

**Step 2: Run test to verify it fails**

Run: `cd backend; pytest tests/test_client_errors_repository.py -v`
Expected: FAIL because repository and migration do not exist.

**Step 3: Write minimal implementation**

```py
MAX_STACK_LEN = 16384

def _trim(value: str | None) -> str | None:
  if value is None:
    return None
  return value[:MAX_STACK_LEN]
```

Add SQL table:

```sql
CREATE TABLE IF NOT EXISTS client_error_events (
  id UUID PRIMARY KEY,
  error_id VARCHAR(120) NOT NULL UNIQUE,
  message TEXT NOT NULL,
  stack TEXT,
  component_stack TEXT,
  scope VARCHAR(16) NOT NULL,
  feature_name VARCHAR(120),
  route TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_client_error_events_created_at ON client_error_events(created_at DESC);
```

**Step 4: Run test to verify it passes**

Run: `cd backend; pytest tests/test_client_errors_repository.py -v`
Expected: PASS.

**Step 5: Commit**

```bash
git add backend/app/client_errors_repository.py backend/app/client_errors.py backend/tests/test_client_errors_repository.py backend/migrations/2026_02_14_create_client_error_events.sql
git commit -m "feat(backend): persist client error events in postgres"
```

### Task 7: Verify end-to-end behavior and update docs

**Files:**
- Modify: `frontend/.env.example`
- Modify: `README.md`
- Modify: `docs/plans/2026-02-14-error-boundaries-fallback-ux-design.md`

**Step 1: Write verification checklist (failing by default)**

```md
- [ ] Global boundary shows fullscreen technical fallback.
- [ ] Feature boundary crash does not unmount unrelated section.
- [ ] Fallback shows Error ID and Retry/Reload/Go Home actions.
- [ ] Backend stores crash event in client_error_events.
```

**Step 2: Run verification commands**

Run:
- `cd frontend; npm run test -- src/features/errors/*.test.tsx src/app/AppView.error-boundaries.integration.test.tsx`
- `cd backend; pytest tests/test_client_errors_endpoint.py tests/test_client_errors_repository.py -v`
- `git status --short`

Expected:
- Frontend tests PASS.
- Backend tests PASS.
- Only expected files changed.

**Step 3: Write minimal doc updates**

```md
- Add `VITE_BACKEND_URL` and backend DB env requirements.
- Add crash endpoint contract example for `POST /api/client-errors`.
- Add operational note on stack trimming and Error ID correlation.
```

**Step 4: Re-run verification**

Run:
- `cd frontend; npm run test -- src/features/errors/*.test.tsx`
- `cd backend; pytest tests/test_client_errors_endpoint.py -v`

Expected: PASS.

**Step 5: Commit**

```bash
git add frontend/.env.example README.md docs/plans/2026-02-14-error-boundaries-fallback-ux-design.md
git commit -m "docs: document client error boundaries and logging flow"
```

## Implementation Notes
- Before each task, apply `@superpowers/test-driven-development`.
- If any unexpected test failure appears, apply `@superpowers/systematic-debugging` before patching.
- Keep one task per commit for rollback safety and review clarity.
- Do not broaden scope to alerting, deduplication, or admin UI in this phase (YAGNI).
