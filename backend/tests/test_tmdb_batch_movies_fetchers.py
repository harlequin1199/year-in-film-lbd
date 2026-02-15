import asyncio
import sys
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import tmdb_batch_movies


class _FakeResponse:
    def __init__(self, status_code, payload=None, headers=None):
        self.status_code = status_code
        self._payload = payload or {}
        self.headers = headers or {}

    def json(self):
        return self._payload

    def raise_for_status(self):
        if self.status_code >= 400:
            request = httpx.Request("GET", "https://example.test")
            response = httpx.Response(self.status_code, request=request)
            raise httpx.HTTPStatusError("boom", request=request, response=response)


class _FakeClient:
    def __init__(self, responses):
        self.responses = list(responses)
        self.calls = []

    async def get(self, url, params=None, timeout=None):
        self.calls.append((url, params, timeout))
        if not self.responses:
            raise AssertionError("No fake responses configured")
        result = self.responses.pop(0)
        if isinstance(result, Exception):
            raise result
        return result


def test_get_movie_credits_returns_cached_without_http(monkeypatch):
    async def no_rate_limit():
        return None

    monkeypatch.setattr(tmdb_batch_movies, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(
        tmdb_batch_movies.cache_module,
        "get_credits",
        lambda _tmdb_id: {"directors": ["A"], "actors": ["B"]},
    )

    client = _FakeClient([])
    result = asyncio.run(
        tmdb_batch_movies._get_movie_credits(client, "k", 10, asyncio.Semaphore(1))
    )

    assert result == ({"directors": ["A"], "actors": ["B"]}, None, "cached")
    assert client.calls == []


def test_get_movie_credits_retries_429_and_parses_payload(monkeypatch):
    delays = []
    set_calls = []

    async def no_rate_limit():
        return None

    async def fake_sleep(delay):
        delays.append(delay)

    monkeypatch.setattr(tmdb_batch_movies, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch_movies.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(tmdb_batch_movies, "MAX_RETRIES", 1)
    monkeypatch.setattr(tmdb_batch_movies, "RETRY_DELAYS", (0.0,))
    monkeypatch.setattr(tmdb_batch_movies.cache_module, "get_credits", lambda _id: None)
    monkeypatch.setattr(
        tmdb_batch_movies.cache_module,
        "set_credits",
        lambda tmdb_id, payload: set_calls.append((tmdb_id, payload)),
    )

    cast = [{"name": f"Actor {i}"} for i in range(30)]
    client = _FakeClient(
        [
            _FakeResponse(429, headers={"Retry-After": "0.0"}),
            _FakeResponse(
                200,
                payload={
                    "crew": [{"job": "Director", "name": "Dir 1"}, {"job": "Writer", "name": "W"}],
                    "cast": cast,
                },
            ),
        ]
    )

    credits, error, status = asyncio.run(
        tmdb_batch_movies._get_movie_credits(client, "k", 12, asyncio.Semaphore(1))
    )

    assert error is None
    assert status == "api"
    assert credits["directors"] == ["Dir 1"]
    assert len(credits["actors"]) == 20
    assert delays == [0.0]
    assert set_calls == [(12, credits)]


def test_get_movie_keywords_returns_api_error_on_request_failures(monkeypatch):
    async def no_rate_limit():
        return None

    async def fake_sleep(_delay):
        return None

    monkeypatch.setattr(tmdb_batch_movies, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch_movies.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(tmdb_batch_movies, "MAX_RETRIES", 1)
    monkeypatch.setattr(tmdb_batch_movies, "RETRY_DELAYS", (0.0,))
    monkeypatch.setattr(tmdb_batch_movies.cache_module, "get_keywords", lambda _id: None)

    request = httpx.Request("GET", "https://example.test")
    client = _FakeClient(
        [
            httpx.RequestError("net down", request=request),
            httpx.RequestError("still down", request=request),
        ]
    )

    keywords, error, status = asyncio.run(
        tmdb_batch_movies._get_movie_keywords(client, "k", 99, asyncio.Semaphore(1))
    )

    assert keywords is None
    assert status == "api_error"
    assert "still down" in error


def test_get_movie_details_with_credits_keywords_extracts_and_caches(monkeypatch):
    async def no_rate_limit():
        return None

    monkeypatch.setattr(tmdb_batch_movies, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, "get_movie", lambda _id: None)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, "get_credits", lambda _id: None)
    monkeypatch.setattr(tmdb_batch_movies.cache_module, "get_keywords", lambda _id: None)

    writes = []
    monkeypatch.setattr(
        tmdb_batch_movies.cache_module,
        "set_movie",
        lambda tmdb_id, payload: writes.append(("movie", tmdb_id, payload)),
    )
    monkeypatch.setattr(
        tmdb_batch_movies.cache_module,
        "set_credits",
        lambda tmdb_id, payload: writes.append(("credits", tmdb_id, payload)),
    )
    monkeypatch.setattr(
        tmdb_batch_movies.cache_module,
        "set_keywords",
        lambda tmdb_id, payload: writes.append(("keywords", tmdb_id, payload)),
    )

    client = _FakeClient(
        [
            _FakeResponse(
                200,
                payload={
                    "id": 7,
                    "title": "Seven",
                    "release_date": "1995-09-22",
                    "credits": {
                        "crew": [{"job": "Director", "name": "Fincher"}],
                        "cast": [{"name": "Pitt"}],
                    },
                    "keywords": {"keywords": [{"name": "serial killer"}, {"x": 1}]},
                },
            )
        ]
    )

    movie, credits, keywords, error, status = asyncio.run(
        tmdb_batch_movies._get_movie_details_with_credits_keywords(
            client, "k", 7, asyncio.Semaphore(1)
        )
    )

    assert error is None
    assert status == "api"
    assert movie["id"] == 7
    assert "credits" not in movie
    assert "keywords" not in movie
    assert credits == {"directors": ["Fincher"], "actors": ["Pitt"]}
    assert keywords == ["serial killer"]
    assert [w[0] for w in writes] == ["movie", "credits", "keywords"]
