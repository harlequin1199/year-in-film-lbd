import asyncio
import sys
from pathlib import Path

import httpx

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import tmdb_batch


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
            raise AssertionError("No more fake responses configured")
        return self.responses.pop(0)


def test_search_single_returns_cached_movie_without_http(monkeypatch):
    async def no_rate_limit():
        return None

    monkeypatch.setattr(tmdb_batch, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch.cache_module, "get_search", lambda _title, _year: 10)
    monkeypatch.setattr(tmdb_batch.cache_module, "get_movie", lambda _id: {"id": 10, "title": "Cached"})

    client = _FakeClient([])
    result = asyncio.run(
        tmdb_batch._search_single(client, "k", "Interstellar", 2014, asyncio.Semaphore(1))
    )

    assert result == (10, {"id": 10, "title": "Cached"}, None)
    assert client.calls == []


def test_search_single_retries_with_retry_after_and_caches_negative(monkeypatch):
    delays = []
    set_search_calls = []

    async def no_rate_limit():
        return None

    async def fake_sleep(delay):
        delays.append(delay)

    monkeypatch.setattr(tmdb_batch, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(tmdb_batch, "MAX_RETRIES", 1)
    monkeypatch.setattr(tmdb_batch, "RETRY_DELAYS", (0.0,))
    monkeypatch.setattr(tmdb_batch.cache_module, "get_search", lambda _title, _year: None)
    monkeypatch.setattr(tmdb_batch.cache_module, "get_movie", lambda _id: None)
    monkeypatch.setattr(
        tmdb_batch.cache_module,
        "set_search",
        lambda title, year, tmdb_id: set_search_calls.append((title, year, tmdb_id)),
    )
    monkeypatch.setattr(tmdb_batch.cache_module, "set_movie", lambda _id, _payload: None)

    client = _FakeClient(
        [
            _FakeResponse(429, headers={"Retry-After": "0.0"}),
            _FakeResponse(200, payload={"results": []}),
        ]
    )

    result = asyncio.run(
        tmdb_batch._search_single(client, "k", "No Match", 2000, asyncio.Semaphore(1))
    )

    assert result == (None, None, None)
    assert delays == [0.0]
    assert set_search_calls == [("no match", 2000, None)]


def test_search_single_returns_tmdb_error_for_movie_details_after_retries(monkeypatch):
    async def no_rate_limit():
        return None

    async def fake_sleep(_delay):
        return None

    monkeypatch.setattr(tmdb_batch, "_rate_limit", no_rate_limit)
    monkeypatch.setattr(tmdb_batch.asyncio, "sleep", fake_sleep)
    monkeypatch.setattr(tmdb_batch, "MAX_RETRIES", 1)
    monkeypatch.setattr(tmdb_batch, "RETRY_DELAYS", (0.0,))
    monkeypatch.setattr(tmdb_batch.cache_module, "get_search", lambda _title, _year: None)
    monkeypatch.setattr(tmdb_batch.cache_module, "get_movie", lambda _id: None)
    monkeypatch.setattr(tmdb_batch.cache_module, "set_search", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(tmdb_batch.cache_module, "set_movie", lambda *_args, **_kwargs: None)

    client = _FakeClient(
        [
            _FakeResponse(200, payload={"results": [{"id": 55}]}),
            _FakeResponse(500),
            _FakeResponse(500),
        ]
    )

    result = asyncio.run(
        tmdb_batch._search_single(client, "k", "Broken", 1999, asyncio.Semaphore(1))
    )

    assert result == (55, None, "TMDb error 500")
