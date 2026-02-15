# ADR-004: Observability Strategy (Sentry + Grafana)

Date: 2026-02-15
Status: Accepted

## Context
The project previously sent frontend crash events to a custom backend endpoint (`POST /api/client-errors`) with dedicated persistence. This duplicated platform-level observability concerns and did not provide end-to-end incident tooling (grouping, releases, traces, alert context).

The deployment model is:
- Frontend on Vercel.
- Backend on Render Free tier.

The target is a free-tier, senior-level observability setup with clear ownership boundaries.

## Decision
Adopt:
- Sentry Cloud for frontend and backend error/exception observability.
- Grafana Cloud Free for backend operational metrics and alerting.

Remove custom client error intake implementation:
- Remove `/api/client-errors`.
- Remove backend modules and migration dedicated to `client_error_events`.

## Rationale
- Sentry is optimized for exception diagnostics, stack traces, release correlation, and issue triage.
- Grafana is optimized for time-series monitoring, dashboards, and alert rules (latency, 5xx, uptime).
- Managed free-tier services reduce operational burden compared to self-hosted stacks.

## Consequences
Positive:
- Clear separation between incident diagnostics and service health monitoring.
- Less custom code and schema maintenance.
- Better production-readiness signal for portfolio quality.

Trade-offs:
- Must control telemetry volume with sampling to stay within free quotas.
- Requires strict redaction controls to avoid leaking sensitive data.

## Guardrails
- Do not send CSV payload contents to Sentry.
- Redact auth and token-like values in `beforeSend`/`before_send`.
- Keep low sampling defaults; raise selectively only for high-value routes.
- Treat expected user/domain errors as warnings or local UX errors, not hard exceptions.

## Alternatives Considered
- Sentry-only: rejected due to weaker operational metrics/alert story.
- Full self-hosted stack: rejected for added ops cost and complexity.

## Implementation Notes
- Frontend reports boundary crashes through `@sentry/react`.
- Backend initializes `sentry-sdk` with FastAPI integration and redaction hook.
- Backend exposes `/metrics` in Prometheus format for Grafana ingestion.
