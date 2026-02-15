# Design: Full Migration of Error Events to Sentry + Free Monitoring

Date: 2026-02-15
Status: Approved
Owner: Codex + Ale

## 1. Goals
- Fully replace custom client error intake (`POST /api/client-errors`) with Sentry.
- Introduce production-grade, fully free-tier monitoring suitable for senior-level portfolio presentation.
- Keep observability split by responsibility: incident diagnostics vs operational metrics.
- Update project documentation and operational runbooks accordingly.

## 2. Constraints and Inputs
- Backend deploy: Render Free tier.
- Frontend deploy: Vercel.
- Budget: free-tier only (managed preferred).
- Migration choice: full removal of current backend client error intake and related storage.

## 3. Selected Architecture
Recommended stack:
- Sentry Cloud (free tier) for frontend and backend errors, traces, release correlation.
- Grafana Cloud Free for backend metrics, dashboards, and alerts.

Why this choice:
- Strong senior-level architecture signal (clear observability boundaries).
- Zero self-hosted infra required for baseline setup.
- Practical with current hosting model (Vercel + Render).

## 4. Target Observability Boundaries
Sentry responsibilities:
- Frontend unhandled exceptions and error-boundary captures.
- Backend unhandled exceptions and 5xx diagnostics.
- Trace-level context for incident investigation.

Grafana responsibilities:
- Backend operational metrics (RPS, latency, 5xx ratio, uptime).
- Time-series dashboards and alerting.
- SLI-like service health monitoring.

Out of scope for this migration:
- Rebuilding custom event storage for client errors.
- Complex self-hosted observability stack.

## 5. Component and Data Flow
Frontend (React/Vercel):
- Initialize Sentry in app bootstrap.
- Capture boundary crashes in `AppErrorBoundary` and `FeatureErrorBoundary` via `captureException`.
- Remove custom API calls to `/api/client-errors`.

Backend (FastAPI/Render):
- Initialize `sentry-sdk` with FastAPI integration at startup.
- Add `before_send` sanitization for sensitive fields.
- Expose `/metrics` in Prometheus format for Grafana ingestion.

Monitoring path:
- Backend `/metrics` -> Grafana Cloud Prometheus pipeline.
- Dashboard panels: RPS, p95 latency, 5xx rate, health uptime.
- Alerts: high 5xx, latency degradation, service down.

## 6. Privacy, Noise Control, and Sampling
Privacy:
- Never send CSV contents or user-sensitive payloads to Sentry.
- Redact auth headers, cookies, token-like query params, and free-text blobs in `beforeSend`/`before_send`.

Signal quality:
- Route expected user errors as warnings/messages (or local UX-only), not exceptions.
- Keep issue stream focused on actionable failures.

Sampling (free-tier safe defaults):
- Frontend traces: low sample (e.g., 0.05).
- Backend traces: low sample (e.g., 0.1 or lower).
- Session replay: disabled or minimal error-only sampling.
- Optionally raise sample for high-risk backend routes.

## 7. Migration Plan (No-Downtime)
1. Foundation:
- Add Sentry SDKs and env configuration for FE/BE.
- Add feature toggle `SENTRY_ENABLED` for controlled rollout.
- Add backend metrics endpoint and base metric instrumentation.

2. Frontend cutover:
- Wire Sentry bootstrap.
- Update error boundaries to report to Sentry.
- Remove `clientErrorApi` and `/api/client-errors` client usage.
- Update frontend env/docs (remove `VITE_CLIENT_ERRORS_PATH`).

3. Backend cutover:
- Wire Sentry SDK initialization.
- Remove `/api/client-errors` endpoint and related models/repository/tests.
- Enforce redaction in event pipeline.

4. Schema cleanup:
- Remove legacy migration artifact usage for `client_error_events` (or add drop migration per migration policy).
- Remove backend config guidance tied to legacy client error persistence.

5. Monitoring rollout:
- Connect Grafana Cloud ingestion.
- Build dashboard and alert rules.

6. Verification:
- Trigger FE test crash and verify Sentry issue.
- Trigger BE test 500 and verify Sentry + metrics + alert behavior.
- Validate alert fire/recover lifecycle.

## 8. Documentation Deliverables (Required)
- Update root `README.md`:
  - Remove custom client error intake flow.
  - Add Sentry + Grafana architecture and env setup.
- Update `frontend/README.md`:
  - Remove `VITE_CLIENT_ERRORS_PATH`.
  - Add Sentry env/sampling guidance.
- Update backend docs:
  - Add `SENTRY_*`, `/metrics`, and metrics endpoint safety notes.
- Add new ADR for observability strategy:
  - Why Sentry + Grafana.
  - Why custom intake was removed.
- Add runbook in `docs/`:
  - How to validate FE/BE incident telemetry.
  - How to validate dashboards/alerts.
  - How to respond to alert triggers.

## 9. Risks and Mitigations
Risk: free-tier quotas exceeded.
- Mitigation: conservative sampling and warning-vs-error hygiene.

Risk: metrics endpoint exposure.
- Mitigation: restrict access (token/IP/path strategy) and avoid public indexing.

Risk: alert fatigue.
- Mitigation: threshold tuning and distinct severity routing.

## 10. Success Criteria
- No runtime path sends client errors to `/api/client-errors`.
- FE and BE exceptions are visible in Sentry with useful context.
- Grafana dashboard shows stable backend metrics.
- Alert rules fire and recover in controlled tests.
- Documentation and ADR accurately describe the new observability model.
