import sys
import types
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import main


@pytest.fixture(autouse=True)
def mock_cache(monkeypatch):
    monkeypatch.setattr('app.cache.init_cache_db', lambda: None)
    monkeypatch.setattr('app.cache.start_writer', lambda: None)
    monkeypatch.setattr('app.cache.stop_writer', lambda: None)


def test_health_endpoint_returns_ok():
    with TestClient(main.app) as client:
        response = client.get('/health')

    assert response.status_code == 200
    assert response.json() == {'status': 'ok'}


@pytest.mark.parametrize(
    ('path', 'payload', 'module_name', 'func_name', 'expected_arg_key'),
    [
        ('/tmdb/search/batch', {'items': [{'title': 'Interstellar', 'year': 2014}]}, 'tmdb_batch', 'search_batch', 'items'),
        ('/tmdb/movies/batch', {'tmdb_ids': [1, 2]}, 'tmdb_batch_movies', 'movies_batch', 'tmdb_ids'),
        ('/tmdb/movies/credits/batch', {'tmdb_ids': [1, 2]}, 'tmdb_batch_movies', 'credits_batch', 'tmdb_ids'),
        ('/tmdb/movies/keywords/batch', {'tmdb_ids': [1, 2]}, 'tmdb_batch_movies', 'keywords_batch', 'tmdb_ids'),
        ('/tmdb/movies/full/batch', {'tmdb_ids': [1, 2]}, 'tmdb_batch_movies', 'full_batch', 'tmdb_ids'),
    ],
)
def test_tmdb_endpoints_return_200_with_stubbed_modules(monkeypatch, path, payload, module_name, func_name, expected_arg_key):
    monkeypatch.setenv('TMDB_API_KEY', 'test-key')

    captured = {}

    async def fake_batch(arg, api_key):
        captured['arg'] = arg
        captured['api_key'] = api_key
        return [{'id': 1, 'ok': True}]

    if module_name == 'tmdb_batch':
        monkeypatch.setattr(main, 'tmdb_batch', types.SimpleNamespace(search_batch=fake_batch), raising=False)
        monkeypatch.setitem(sys.modules, 'app.tmdb_batch', types.SimpleNamespace(search_batch=fake_batch))
    else:
        stub = types.SimpleNamespace(
            movies_batch=fake_batch,
            credits_batch=fake_batch,
            keywords_batch=fake_batch,
            full_batch=fake_batch,
        )
        monkeypatch.setitem(sys.modules, 'app.tmdb_batch_movies', stub)

    with TestClient(main.app) as client:
        response = client.post(path, json=payload)

    assert response.status_code == 200
    assert response.json() == {'results': [{'id': 1, 'ok': True}]}
    assert captured['api_key'] == 'test-key'
    assert captured['arg'] == payload[expected_arg_key]


@pytest.mark.parametrize(
    ('path', 'payload'),
    [
        ('/tmdb/search/batch', {'items': [{'title': f'Movie {i}'} for i in range(501)]}),
        ('/tmdb/movies/batch', {'tmdb_ids': list(range(501))}),
        ('/tmdb/movies/credits/batch', {'tmdb_ids': list(range(501))}),
        ('/tmdb/movies/keywords/batch', {'tmdb_ids': list(range(501))}),
        ('/tmdb/movies/full/batch', {'tmdb_ids': list(range(501))}),
    ],
)
def test_tmdb_endpoints_enforce_500_item_limit(monkeypatch, path, payload):
    monkeypatch.setenv('TMDB_API_KEY', 'test-key')

    with TestClient(main.app) as client:
        response = client.post(path, json=payload)

    assert response.status_code == 400
    assert response.json()['detail'] == 'Too many items. Maximum 500 items per batch.'


@pytest.mark.parametrize(
    ('path', 'payload'),
    [
        ('/tmdb/search/batch', {'items': [{'title': 'A'}]}),
        ('/tmdb/movies/batch', {'tmdb_ids': [1]}),
    ],
)
def test_tmdb_endpoints_return_500_without_api_key(monkeypatch, path, payload):
    monkeypatch.delenv('TMDB_API_KEY', raising=False)

    with TestClient(main.app) as client:
        response = client.post(path, json=payload)

    assert response.status_code == 500
    assert response.json()['detail'] == 'TMDB_API_KEY is not set'


@pytest.mark.parametrize(
    ('path', 'payload'),
    [
        ('/tmdb/search/batch', {'items': [{}]}),
        ('/tmdb/movies/batch', {'tmdb_ids': ['x']}),
    ],
)
def test_tmdb_endpoints_return_422_for_invalid_payload(monkeypatch, path, payload):
    monkeypatch.setenv('TMDB_API_KEY', 'test-key')

    with TestClient(main.app) as client:
        response = client.post(path, json=payload)

    assert response.status_code == 422
