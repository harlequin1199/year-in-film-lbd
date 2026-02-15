from pathlib import Path


def test_observability_docs_exist():
    assert Path("../docs/adr/ADR-004-observability-sentry-grafana.md").exists()
    assert Path("../docs/ops/observability-runbook.md").exists()
