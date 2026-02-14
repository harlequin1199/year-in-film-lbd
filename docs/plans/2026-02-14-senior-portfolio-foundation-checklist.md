# Senior Portfolio Foundation Checklist

- [ ] `cd frontend && npm run lint`
- [ ] `cd frontend && npm run test`
- [ ] `cd frontend && npm run test:coverage`
- [ ] `cd backend && python -m pytest -q`
- [ ] `cd backend && python -m pytest --cov=app --cov-report=term-missing --cov-fail-under=15`
- [ ] `git status --short` contains only expected tracked changes

## Smoke verification

- [ ] Upload valid `ratings.csv` and complete full analysis
- [ ] Abort an in-progress run and confirm abort message is shown
- [ ] Trigger a controlled render crash and verify fallback with error ID
- [ ] POST `/api/client-errors` accepts valid payload with status `201`
