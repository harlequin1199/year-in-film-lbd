"""
Persistent SQLite cache for TMDb search and movie details.
TTL = 30 days. Single connection per job, WAL mode, batch writes.
"""
import json
import os
import sqlite3
import threading
from datetime import datetime, timedelta
from typing import Any, List, Optional, Tuple

_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_DIR, "cache.db")
TTL_DAYS = 30


def _connect() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=15.0)
    conn.row_factory = sqlite3.Row
    return conn


def _init_db(conn: sqlite3.Connection) -> None:
    conn.executescript("""
        PRAGMA journal_mode=WAL;
        PRAGMA synchronous=NORMAL;
        CREATE TABLE IF NOT EXISTS search_cache (
            title TEXT NOT NULL,
            year INTEGER NOT NULL,
            tmdb_id INTEGER,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (title, year)
        );
        CREATE INDEX IF NOT EXISTS ix_search_updated ON search_cache(updated_at);

        CREATE TABLE IF NOT EXISTS movie_cache (
            tmdb_id INTEGER PRIMARY KEY,
            payload_json TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_movie_updated ON movie_cache(updated_at);
    """)
    conn.commit()


def _is_expired(updated_at: str) -> bool:
    try:
        dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        return datetime.utcnow() - dt.replace(tzinfo=None) > timedelta(days=TTL_DAYS)
    except (ValueError, TypeError):
        return True


# --- Module-level API (one connection per call, for backward compatibility) ---

def get_search(title: str, year: Optional[int]) -> Optional[int]:
    year_val = year if year is not None else 0
    title_n = title.strip().lower()
    conn = _connect()
    try:
        _init_db(conn)
        row = conn.execute(
            "SELECT tmdb_id, updated_at FROM search_cache WHERE title = ? AND year = ?",
            (title_n, year_val),
        ).fetchone()
        if not row:
            return None
        if _is_expired(row["updated_at"]):
            return None
        return row["tmdb_id"]
    finally:
        conn.close()


def set_search(title: str, year: Optional[int], tmdb_id: Optional[int]) -> None:
    now = datetime.utcnow().isoformat() + "Z"
    title_n = title.strip().lower()
    year_val = year if year is not None else 0
    conn = _connect()
    try:
        _init_db(conn)
        conn.execute(
            "INSERT OR REPLACE INTO search_cache (title, year, tmdb_id, updated_at) VALUES (?, ?, ?, ?)",
            (title_n, year_val, tmdb_id, now),
        )
        conn.commit()
    finally:
        conn.close()


def get_movie(tmdb_id: int) -> Optional[Any]:
    conn = _connect()
    try:
        _init_db(conn)
        row = conn.execute(
            "SELECT payload_json, updated_at FROM movie_cache WHERE tmdb_id = ?",
            (tmdb_id,),
        ).fetchone()
        if not row:
            return None
        if _is_expired(row["updated_at"]):
            return None
        return json.loads(row["payload_json"])
    finally:
        conn.close()


def set_movie(tmdb_id: int, payload: Any) -> None:
    now = datetime.utcnow().isoformat() + "Z"
    payload_json = json.dumps(payload)
    conn = _connect()
    try:
        _init_db(conn)
        conn.execute(
            "INSERT OR REPLACE INTO movie_cache (tmdb_id, payload_json, updated_at) VALUES (?, ?, ?)",
            (tmdb_id, payload_json, now),
        )
        conn.commit()
    finally:
        conn.close()


# --- Per-job connection with batch writes ---

class CacheConnection:
    """Single connection per job. Thread-safe for use from asyncio.to_thread."""

    def __init__(self) -> None:
        self._conn = _connect()
        _init_db(self._conn)
        self._lock = threading.Lock()
        self._pending_search: List[Tuple[str, int, Optional[int]]] = []
        self._pending_movie: List[Tuple[int, Any]] = []

    def get_search(self, title: str, year: Optional[int]) -> Optional[int]:
        with self._lock:
            return self._get_search_locked(title, year)

    def _get_search_locked(self, title: str, year: Optional[int]) -> Optional[int]:
        title_n = title.strip().lower()
        year_val = year if year is not None else 0
        for t, y, tid in reversed(self._pending_search):
            if (t, y) == (title_n, year_val):
                return tid
        if not self._conn:
            return None
        row = self._conn.execute(
            "SELECT tmdb_id, updated_at FROM search_cache WHERE title = ? AND year = ?",
            (title_n, year_val),
        ).fetchone()
        if not row:
            return None
        if _is_expired(row["updated_at"]):
            return None
        return row["tmdb_id"]

    def set_search(self, title: str, year: Optional[int], tmdb_id: Optional[int]) -> None:
        with self._lock:
            title_n = title.strip().lower()
            year_val = year if year is not None else 0
            self._pending_search.append((title_n, year_val, tmdb_id))

    def get_movie(self, tmdb_id: int) -> Optional[Any]:
        with self._lock:
            return self._get_movie_locked(tmdb_id)

    def _get_movie_locked(self, tmdb_id: int) -> Optional[Any]:
        for tid, payload in reversed(self._pending_movie):
            if tid == tmdb_id:
                return payload
        if not self._conn:
            return None
        row = self._conn.execute(
            "SELECT payload_json, updated_at FROM movie_cache WHERE tmdb_id = ?",
            (tmdb_id,),
        ).fetchone()
        if not row:
            return None
        if _is_expired(row["updated_at"]):
            return None
        return json.loads(row["payload_json"])

    def set_movie(self, tmdb_id: int, payload: Any) -> None:
        with self._lock:
            self._pending_movie.append((tmdb_id, payload))

    def flush_pending(self) -> None:
        with self._lock:
            self._flush_pending_locked()

    def _flush_pending_locked(self) -> None:
        now = datetime.utcnow().isoformat() + "Z"
        if self._pending_search:
            self._conn.executemany(
                "INSERT OR REPLACE INTO search_cache (title, year, tmdb_id, updated_at) VALUES (?, ?, ?, ?)",
                [(t, y, tid, now) for t, y, tid in self._pending_search],
            )
            self._pending_search.clear()
        if self._pending_movie:
            self._conn.executemany(
                "INSERT OR REPLACE INTO movie_cache (tmdb_id, payload_json, updated_at) VALUES (?, ?, ?)",
                [(tid, json.dumps(p), now) for tid, p in self._pending_movie],
            )
            self._pending_movie.clear()
        if self._conn:
            self._conn.commit()

    def close(self) -> None:
        with self._lock:
            self._flush_pending_locked()
            if self._conn:
                self._conn.close()
                self._conn = None
