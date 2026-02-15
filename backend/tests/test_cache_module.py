import json
import sys
from datetime import datetime, timedelta
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app import cache


class _FakeCursor:
    def __init__(self, one=None, many=None):
        self._one = one
        self._many = many or []

    def fetchone(self):
        return self._one

    def fetchall(self):
        return self._many


class _FakeConn:
    def __init__(self, one=None, many=None):
        self._one = one
        self._many = many or []
        self.calls = []

    def execute(self, query, params):
        self.calls.append((query, params))
        return _FakeCursor(one=self._one, many=self._many)


def _iso_now(delta_days=0):
    return (datetime.utcnow() + timedelta(days=delta_days)).isoformat() + "Z"


def test_is_expired_handles_invalid_dates():
    assert cache._is_expired("not-a-date") is True
    assert cache._is_expired(None) is True


def test_is_expired_respects_ttl_window():
    assert cache._is_expired(_iso_now(delta_days=-1)) is False
    assert cache._is_expired(_iso_now(delta_days=-(cache.TTL_DAYS + 1))) is True


def test_get_search_normalizes_title_and_year(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", False)
    conn = _FakeConn(one={"tmdb_id": 42, "updated_at": _iso_now(delta_days=-1)})
    monkeypatch.setattr(cache, "_get_read_conn", lambda: conn)

    result = cache.get_search("  Interstellar  ", None)

    assert result == 42
    assert conn.calls[0][1] == ("interstellar", 0)


def test_get_search_returns_none_when_disabled(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", True)

    assert cache.get_search("Any", 1999) is None


def test_get_search_returns_none_for_expired_row(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", False)
    conn = _FakeConn(one={"tmdb_id": 42, "updated_at": _iso_now(delta_days=-(cache.TTL_DAYS + 2))})
    monkeypatch.setattr(cache, "_get_read_conn", lambda: conn)

    assert cache.get_search("Any", 1999) is None


def test_get_movie_batch_includes_missing_and_skips_expired(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", False)
    rows = [
        {
            "tmdb_id": 1,
            "payload_json": json.dumps({"id": 1, "title": "One"}),
            "updated_at": _iso_now(delta_days=-1),
        },
        {
            "tmdb_id": 2,
            "payload_json": json.dumps({"id": 2, "title": "Two"}),
            "updated_at": _iso_now(delta_days=-(cache.TTL_DAYS + 2)),
        },
    ]
    conn = _FakeConn(many=rows)
    monkeypatch.setattr(cache, "_get_read_conn", lambda: conn)

    result = cache.get_movie_batch([1, 2, 3])

    assert result[1]["title"] == "One"
    assert result[2] is None
    assert result[3] is None


def test_get_keywords_batch_returns_empty_for_empty_ids(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", False)

    assert cache.get_keywords_batch([]) == {}


def test_get_keywords_batch_disabled_cache_returns_none_values(monkeypatch):
    monkeypatch.setattr(cache, "DISABLE_CACHE", True)

    assert cache.get_keywords_batch([7, 8]) == {7: None, 8: None}
