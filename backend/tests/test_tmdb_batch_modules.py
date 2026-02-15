import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import tmdb_batch_movies


class _FakeAsyncClient:
    async def __aenter__(self):
        return self

    async def __aexit__(self, exc_type, exc, tb):
        return False


def test_full_batch_survives_cache_batch_errors(monkeypatch):
    monkeypatch.setattr(tmdb_batch_movies.httpx, 'AsyncClient', lambda *args, **kwargs: _FakeAsyncClient())

    def _raise_cache_error(_ids):
        raise RuntimeError('cache unavailable')

    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_movie_batch', _raise_cache_error)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_credits_batch', _raise_cache_error)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_keywords_batch', _raise_cache_error)

    async def fake_unified(_client, _api_key, tmdb_id, _semaphore):
        return ({'id': tmdb_id, 'release_date': '2020-01-01'}, {'directors': [], 'actors': []}, ['tag'], None, 'api')

    monkeypatch.setattr(tmdb_batch_movies, '_get_movie_details_with_credits_keywords', fake_unified)

    result = asyncio.run(tmdb_batch_movies.full_batch([42], 'k'))

    assert len(result) == 1
    assert result[0]['tmdb_id'] == 42
    assert result[0]['error'] is None
    assert result[0]['movie']['id'] == 42


def test_full_batch_normalizes_invalid_cache_shapes(monkeypatch):
    monkeypatch.setattr(tmdb_batch_movies.httpx, 'AsyncClient', lambda *args, **kwargs: _FakeAsyncClient())
    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_movie_batch', lambda _ids: None)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_credits_batch', lambda _ids: [])
    monkeypatch.setattr(tmdb_batch_movies.cache_module, 'get_keywords_batch', lambda _ids: 'oops')

    async def fake_unified(_client, _api_key, tmdb_id, _semaphore):
        return ({'id': tmdb_id, 'release_date': ''}, {'directors': [], 'actors': []}, [], None, 'api')

    monkeypatch.setattr(tmdb_batch_movies, '_get_movie_details_with_credits_keywords', fake_unified)

    result = asyncio.run(tmdb_batch_movies.full_batch([7], 'k'))

    assert result[0]['tmdb_id'] == 7
    assert result[0]['error'] is None
