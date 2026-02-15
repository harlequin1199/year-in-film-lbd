import json
import queue
import sqlite3
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


def test_cache_connection_delegates_to_module_api(monkeypatch):
    calls = []

    monkeypatch.setattr(cache, "get_search", lambda title, year: calls.append(("get_search", title, year)) or 11)
    monkeypatch.setattr(cache, "set_search", lambda title, year, tmdb_id: calls.append(("set_search", title, year, tmdb_id)))
    monkeypatch.setattr(cache, "get_movie", lambda tmdb_id: calls.append(("get_movie", tmdb_id)) or {"id": tmdb_id})
    monkeypatch.setattr(cache, "set_movie", lambda tmdb_id, payload: calls.append(("set_movie", tmdb_id, payload)))

    conn = cache.CacheConnection()

    assert conn.get_search("A", 2001) == 11
    conn.set_search("B", 2002, 22)
    assert conn.get_movie(33) == {"id": 33}
    conn.set_movie(44, {"x": 1})
    conn.flush_pending()
    conn.close()

    assert calls == [
        ("get_search", "A", 2001),
        ("set_search", "B", 2002, 22),
        ("get_movie", 33),
        ("set_movie", 44, {"x": 1}),
    ]


class _FlushConn:
    def __init__(self, begin_failures=0, begin_error_message="database is locked"):
        self.begin_failures = begin_failures
        self.begin_error_message = begin_error_message
        self.begin_attempts = 0
        self.executemany_calls = []
        self.commits = 0
        self.rollbacks = 0
        self.closed = False

    def execute(self, query):
        if query == "BEGIN IMMEDIATE":
            self.begin_attempts += 1
            if self.begin_attempts <= self.begin_failures:
                raise sqlite3.OperationalError(self.begin_error_message)
        return None

    def executemany(self, query, params):
        self.executemany_calls.append((query, list(params)))
        return None

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.closed = True


class _FakeThread:
    def __init__(self, target=None, daemon=None):
        self.target = target
        self.daemon = daemon
        self.started = False
        self.join_timeout = None

    def is_alive(self):
        return self.started

    def start(self):
        self.started = True

    def join(self, timeout=None):
        self.join_timeout = timeout


class _SequenceQueue:
    def __init__(self, items):
        self._items = list(items)
        self.put_calls = []

    def get(self, timeout=None):
        if not self._items:
            raise queue.Empty()
        item = self._items.pop(0)
        if isinstance(item, Exception):
            raise item
        return item

    def put(self, item):
        self.put_calls.append(item)


def test_flush_batch_retries_on_locked_and_commits(monkeypatch):
    conn = _FlushConn(begin_failures=2, begin_error_message="database is locked")
    sleeps = []
    monkeypatch.setattr(cache.time, "sleep", lambda delay: sleeps.append(delay))
    monkeypatch.setattr(cache, "_FLUSH_MAX_RETRIES", 3)
    monkeypatch.setattr(cache, "_FLUSH_RETRY_DELAY_S", 0.01)

    batch = [
        ("search", "interstellar", 2014, 157336),
        ("movie", 157336, json.dumps({"id": 157336})),
        ("credits", 157336, json.dumps({"directors": ["Nolan"], "actors": []})),
        ("keywords", 157336, json.dumps(["space"])),
    ]

    cache._flush_batch(conn, batch)

    assert conn.begin_attempts == 3
    assert conn.rollbacks == 2
    assert conn.commits == 1
    assert sleeps == [0.01, 0.02]
    assert len(conn.executemany_calls) == 4


def test_flush_batch_raises_non_lock_operational_error(monkeypatch):
    conn = _FlushConn(begin_failures=1, begin_error_message="syntax error")
    monkeypatch.setattr(cache, "_FLUSH_MAX_RETRIES", 3)

    try:
        cache._flush_batch(conn, [("movie", 1, json.dumps({"id": 1}))])
        raise AssertionError("expected OperationalError")
    except sqlite3.OperationalError as exc:
        assert "syntax error" in str(exc)

    assert conn.begin_attempts == 1
    assert conn.rollbacks == 1
    assert conn.commits == 0


def test_start_writer_creates_thread_once(monkeypatch):
    created = []

    def fake_thread(target=None, daemon=None):
        t = _FakeThread(target=target, daemon=daemon)
        created.append(t)
        return t

    monkeypatch.setattr(cache.threading, "Thread", fake_thread)
    monkeypatch.setattr(cache, "_WRITER_THREAD", None)
    cache._WRITER_STOP.set()

    cache.start_writer()
    first_thread = cache._WRITER_THREAD
    cache.start_writer()

    assert first_thread is not None
    assert first_thread.started is True
    assert first_thread.daemon is False
    assert cache._WRITER_STOP.is_set() is False
    assert len(created) == 1


def test_stop_writer_enqueues_stop_and_joins(monkeypatch):
    q = _SequenceQueue([])
    thread = _FakeThread()
    thread.started = True

    monkeypatch.setattr(cache, "_WRITE_QUEUE", q)
    monkeypatch.setattr(cache, "_WRITER_THREAD", thread)

    cache.stop_writer()

    assert q.put_calls == ["STOP"]
    assert thread.join_timeout == 15.0
    assert cache._WRITER_THREAD is None


def test_writer_loop_requeues_batch_on_flush_error(monkeypatch):
    conn = _FlushConn()
    q = _SequenceQueue(
        [
            ("movie", 10, json.dumps({"id": 10})),
            "STOP",
        ]
    )

    monkeypatch.setattr(cache, "_connect_writer", lambda: conn)
    monkeypatch.setattr(cache, "_WRITE_QUEUE", q)
    monkeypatch.setattr(cache, "_BATCH_SIZE", 1)
    monkeypatch.setattr(cache, "_BATCH_TIMEOUT_S", 1000.0)
    cache._WRITER_STOP.clear()

    def raise_flush(_conn, _batch):
        raise sqlite3.OperationalError("database is locked")

    monkeypatch.setattr(cache, "_flush_batch", raise_flush)

    cache._writer_loop()

    assert ("movie", 10, json.dumps({"id": 10})) in q.put_calls
    assert conn.closed is True
