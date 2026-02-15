# Observability Runbook

## Scope
- Frontend incident telemetry: Sentry.
- Backend incident telemetry: Sentry.
- Backend service monitoring: Grafana Cloud (Prometheus metrics from `/metrics`).

## Environment Baseline
- Frontend env:
  - `VITE_SENTRY_ENABLED=true`
  - `VITE_SENTRY_DSN=<dsn>`
  - `VITE_SENTRY_ENVIRONMENT=production`
  - `VITE_SENTRY_RELEASE=<sha-or-version>`
- Backend env:
  - `SENTRY_ENABLED=true`
  - `SENTRY_DSN=<dsn>`
  - `SENTRY_ENVIRONMENT=production`
  - `SENTRY_RELEASE=<sha-or-version>`

## Validation: Frontend Sentry
1. Deploy non-production build with Sentry enabled.
2. Trigger a controlled boundary crash.
3. Verify a new issue appears in Sentry with:
   - stack trace,
   - `boundary_scope` tag,
   - release/environment metadata.
4. Confirm no sensitive headers or tokens are present.

## Validation: Backend Sentry
1. Trigger a controlled backend 500 in staging/dev.
2. Verify Sentry captures the exception with request context.
3. Confirm redaction rules removed auth/cookie/token-like values.
4. Confirm issue grouping is stable across repeated errors.

## Validation: Metrics and Grafana
1. Check `GET /metrics` returns Prometheus text payload.
2. Verify Grafana data source is ingesting series.
3. Validate dashboard panels:
   - request rate,
   - p95 latency,
   - 5xx error rate,
   - health uptime.

## Alert Rules
- High `5xx` rate over threshold.
- High p95 latency over threshold.
- Service down (health endpoint unavailable).

For each alert:
1. Trigger condition in staging where possible.
2. Confirm alert fires.
3. Restore healthy state.
4. Confirm alert resolves.

## Incident Response Checklist
1. Acknowledge alert/incident.
2. Open linked Sentry issues and identify top stack trace.
3. Correlate with Grafana metrics at incident timestamp.
4. Mitigate (rollback/restart/hotfix).
5. Validate recovery via Sentry quieting + metrics normalization.
6. Add post-incident notes and follow-up tasks.
