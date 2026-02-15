import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.main import app


def test_client_errors_endpoint_removed():
    with TestClient(app) as client:
        response = client.post("/api/client-errors", json={})
    assert response.status_code == 404
