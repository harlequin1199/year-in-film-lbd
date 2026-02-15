import asyncio
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import tmdb_batch


def test_normalize_title_strips_and_lowercases():
    assert tmdb_batch._normalize_title("  InterStellar  ") == "interstellar"


def test_format_result_returns_error_payload():
    result = tmdb_batch._format_result("Movie", 2020, 1, {"title": "M"}, "boom")

    assert result == {
        "title": "Movie",
        "year": 2020,
        "tmdb": None,
        "error": "boom",
    }


def test_format_result_returns_no_match_when_movie_missing():
    result = tmdb_batch._format_result("Movie", 2020, None, None, None)

    assert result == {
        "title": "Movie",
        "year": 2020,
        "tmdb": None,
        "error": None,
    }


def test_format_result_ignores_malformed_named_items():
    movie = {
        "title": "Interstellar",
        "release_date": "2014-11-05",
        "poster_path": "/p.jpg",
        "vote_average": 8.7,
        "vote_count": 1000,
        "genres": [{"name": "Sci-Fi"}, "bad", {"x": "ignored"}, None],
        "runtime": 169,
        "production_countries": [{"name": "United States"}, 42, {"name": ""}],
        "original_language": "en",
    }

    result = tmdb_batch._format_result("Interstellar", 2014, 157336, movie, None)

    assert result["error"] is None
    assert result["tmdb"]["genres"] == ["Sci-Fi"]
    assert result["tmdb"]["production_countries"] == ["United States"]
    assert result["tmdb"]["year"] == 2014


def test_search_batch_collects_task_exceptions(monkeypatch):
    async def fake_search_single(_client, _api_key, title, year, _semaphore):
        if title == "A":
            raise RuntimeError("boom")
        return (42, {"title": "B", "release_date": "2020-01-01"}, None)

    class _FakeAsyncClient:
        async def __aenter__(self):
            return self

        async def __aexit__(self, exc_type, exc, tb):
            return False

    monkeypatch.setattr(tmdb_batch, "_search_single", fake_search_single)
    monkeypatch.setattr(tmdb_batch.httpx, "AsyncClient", lambda *args, **kwargs: _FakeAsyncClient())

    result = asyncio.run(
        tmdb_batch.search_batch(
            [{"title": "A", "year": 2000}, {"title": "B", "year": 2020}],
            "k",
        )
    )

    assert result[0]["title"] == "A"
    assert result[0]["tmdb"] is None
    assert "boom" in result[0]["error"]
    assert result[1]["title"] == "B"
    assert result[1]["tmdb"]["tmdb_id"] == 42
