import sys
from pathlib import Path

from fastapi.testclient import TestClient
import pytest

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app


def test_metrics_endpoint_exposes_prometheus_format():
    with TestClient(app) as client:
        response = client.get("/metrics")
    assert response.status_code == 200
    assert "text/plain" in response.headers.get("content-type", "")
    assert "http" in response.text.lower()


@pytest.mark.parametrize("auth_header", [None, "Bearer wrong-token"])
def test_metrics_endpoint_requires_bearer_token_when_configured(monkeypatch, auth_header):
    monkeypatch.setenv("METRICS_BEARER_TOKEN", "secret-token")
    headers = {}
    if auth_header is not None:
        headers["Authorization"] = auth_header

    with TestClient(app) as client:
        response = client.get("/metrics", headers=headers)

    assert response.status_code == 401


def test_metrics_endpoint_allows_request_with_correct_bearer_token(monkeypatch):
    monkeypatch.setenv("METRICS_BEARER_TOKEN", "secret-token")

    with TestClient(app) as client:
        response = client.get("/metrics", headers={"Authorization": "Bearer secret-token"})

    assert response.status_code == 200
