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

    async def __aexit__(self, *_):
        return False


def test_movies_batch_returns_empty_for_empty_ids():
    result = asyncio.run(tmdb_batch_movies.movies_batch([], "k"))
    assert result == []


def test_movies_batch_survives_malformed_movie_named_lists(monkeypatch):
    async def fake_get_movie_details(_client, _api_key, tmdb_id, _semaphore, include_credits_keywords=False):
        if tmdb_id == 1:
            raise RuntimeError("boom")
        return (
            {
                "id": tmdb_id,
                "release_date": "2020-01-01",
                "genres": [{"name": "Drama"}, "bad", None, {"x": 1}],
                "production_countries": [{"name": "US"}, 10, {"name": ""}],
            },
            None,
            "api",
        )

    monkeypatch.setattr(tmdb_batch_movies, "_get_movie_details", fake_get_movie_details)
    monkeypatch.setattr(tmdb_batch_movies.httpx, "AsyncClient", lambda *_args, **_kwargs: _FakeAsyncClient())

    result = asyncio.run(tmdb_batch_movies.movies_batch([1, 2], "k"))

    assert result[0]["tmdb_id"] == 1
    assert "boom" in result[0]["error"]
    assert result[0]["movie"] is None
    assert result[1]["tmdb_id"] == 2
    assert result[1]["error"] is None
    assert result[1]["movie"]["genres"] == ["Drama"]
    assert result[1]["movie"]["production_countries"] == ["US"]


def test_keywords_batch_maps_error_and_empty_keywords(monkeypatch):
    async def fake_get_movie_keywords(_client, _api_key, tmdb_id, _semaphore):
        if tmdb_id == 1:
            return None, "TMDb error 500", "api_error"
        return [], None, "api"

    monkeypatch.setattr(tmdb_batch_movies, "_get_movie_keywords", fake_get_movie_keywords)
    monkeypatch.setattr(tmdb_batch_movies.httpx, "AsyncClient", lambda *_args, **_kwargs: _FakeAsyncClient())

    result = asyncio.run(tmdb_batch_movies.keywords_batch([1, 2], "k"))

    assert result == [
        {"tmdb_id": 1, "keywords": None, "error": "TMDb error 500"},
        {"tmdb_id": 2, "keywords": [], "error": None},
    ]
