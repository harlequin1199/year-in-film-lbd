from fastapi.testclient import TestClient
from app.main import app


def test_post_client_error_returns_201():
    payload = {
        'errorId': 'e-1',
        'message': 'boom',
        'stack': 'stack',
        'componentStack': 'component',
        'boundaryScope': 'global',
        'featureName': None,
        'route': '/',
        'userAgent': 'ua',
        'timestamp': '2026-02-14T00:00:00.000Z',
    }

    with TestClient(app) as client:
        response = client.post('/api/client-errors', json=payload)

    assert response.status_code == 201
    assert response.json()['errorId'] == 'e-1'
