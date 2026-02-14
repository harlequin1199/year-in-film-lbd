import sys
from pathlib import Path

from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

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
