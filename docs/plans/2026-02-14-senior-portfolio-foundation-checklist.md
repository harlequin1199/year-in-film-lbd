# Senior Portfolio Foundation Checklist

- [x] `cd frontend && npm run lint`
- [x] `cd frontend && npm run test`
- [x] `cd frontend && npm run test:coverage`
- [x] `cd backend && python -m pytest -q`
- [x] `cd backend && python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=15`
- [ ] `git status --short` contains only expected tracked changes

## Smoke verification

- [x] Upload valid `ratings.csv` and complete full analysis (`frontend/src/features/upload/useCsvAnalysisFlow.smoke.test.tsx`)
- [x] Abort an in-progress run and confirm abort message is shown (`frontend/src/features/upload/useCsvAnalysisFlow.smoke.test.tsx`)
- [x] Trigger a controlled render crash and verify fallback with error ID (`frontend/src/features/errors/AppErrorBoundary.smoke.test.tsx`)
- [x] POST `/api/client-errors` accepts valid payload with status `201` (`backend/tests/test_client_errors_endpoint.py`)
