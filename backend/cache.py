"""
Persistent SQLite cache for TMDb search and movie details.
TTL = 30 days.

Concurrency model (writer queue):
- DB is initialized ONCE per process on FastAPI startup (init_cache_db).
- All WRITES go through a single writer thread with one dedicated connection;
  set_search/set_movie enqueue and return immediately; batches commit every 50
  writes or 1 second. Writer uses PRAGMA busy_timeout and retries on lock/busy.
- READS use thread-local connections; many threads can read concurrently (WAL).
  Only one writer runs at a time, so no write/write or read/write lock storms.
"""
import json
import logging
import os
import queue
import sqlite3
import threading
import time
from datetime import datetime, timedelta
from typing import Any, List, Optional, Tuple

logger = logging.getLogger(__name__)

_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.path.join(_DIR, "cache.db")
TTL_DAYS = 30

# Writer: one thread, one connection, processes this queue (item = ("search", title, year, tmdb_id) | ("movie", tmdb_id, payload))
# Bounded queue for backpressure: producers (set_search/set_movie via to_thread) block when full
_WRITE_QUEUE_MAXSIZE = 2000
_WRITE_QUEUE: queue.Queue = queue.Queue(maxsize=_WRITE_QUEUE_MAXSIZE)
_WRITER_THREAD: Optional[threading.Thread] = None
_WRITER_STOP = threading.Event()
_BATCH_SIZE = 50
_BATCH_TIMEOUT_S = 1.0
_FLUSH_MAX_RETRIES = 5
_FLUSH_RETRY_DELAY_S = 0.05
_WRITER_BUSY_TIMEOUT_MS = 15_000

# Thread-local read connections (no init_db, no writes)
_read_local = threading.local()


def _connect(timeout: float = 15.0) -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH, timeout=timeout)
    conn.row_factory = sqlite3.Row
    return conn


def _connect_writer() -> sqlite3.Connection:
    """Dedicated connection for the single writer thread; WAL + long busy_timeout."""
    conn = sqlite3.connect(DB_PATH, timeout=float(_WRITER_BUSY_TIMEOUT_MS) / 1000.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute(f"PRAGMA busy_timeout={_WRITER_BUSY_TIMEOUT_MS}")
    conn.execute("PRAGMA synchronous=NORMAL")
    return conn


def init_cache_db(db_path: Optional[str] = None) -> None:
    """
    Run ONCE per process (e.g. FastAPI startup). Creates DB/tables and sets
    PRAGMAs. Do not call from get_search/get_movie or per-request.
    """
    path = db_path or DB_PATH
    conn = sqlite3.connect(path, timeout=15.0)
    try:
        conn.executescript("""
            PRAGMA journal_mode=WAL;
            PRAGMA synchronous=NORMAL;
            PRAGMA busy_timeout=10000;
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
    finally:
        conn.close()


def _get_read_conn() -> sqlite3.Connection:
    """Thread-local read-only connection; no PRAGMA or CREATE TABLE."""
    if not hasattr(_read_local, "conn") or _read_local.conn is None:
        conn = _connect()
        # Only set busy_timeout so reads wait for writer instead of failing
        conn.execute("PRAGMA busy_timeout=10000")
        _read_local.conn = conn
    return _read_local.conn


def _is_expired(updated_at: str) -> bool:
    try:
        dt = datetime.fromisoformat(updated_at.replace("Z", "+00:00"))
        return datetime.utcnow() - dt.replace(tzinfo=None) > timedelta(days=TTL_DAYS)
    except (ValueError, TypeError):
        return True


# --- Writer thread: single connection, batch commits, retry on lock ---

def _flush_batch(conn: sqlite3.Connection, batch: List[Tuple]) -> None:
    if not batch:
        return
    now = datetime.utcnow().isoformat() + "Z"
    search_items: List[Tuple] = []
    movie_items: List[Tuple] = []
    for x in batch:
        if x[0] == "search":
            _, t, y, tid = x
            search_items.append((t, y, tid, now))
        else:
            _, tid, p = x
            movie_items.append((tid, p, now))

    last_err: Optional[Exception] = None
    for attempt in range(_FLUSH_MAX_RETRIES):
        try:
            conn.execute("BEGIN IMMEDIATE")
            if search_items:
                conn.executemany(
                    "INSERT OR REPLACE INTO search_cache (title, year, tmdb_id, updated_at) VALUES (?, ?, ?, ?)",
                    search_items,
                )
            if movie_items:
                conn.executemany(
                    "INSERT OR REPLACE INTO movie_cache (tmdb_id, payload_json, updated_at) VALUES (?, ?, ?)",
                    movie_items,
                )
            conn.commit()
            return
        except sqlite3.OperationalError as e:
            last_err = e
            try:
                conn.rollback()
            except Exception:
                pass
            err_msg = str(e).upper()
            if "LOCKED" in err_msg or "BUSY" in err_msg:
                if attempt < _FLUSH_MAX_RETRIES - 1:
                    time.sleep(_FLUSH_RETRY_DELAY_S * (attempt + 1))
                    continue
            raise
    if last_err is not None:
        raise last_err


def _writer_loop() -> None:
    conn = _connect_writer()
    batch: List[Tuple[str, Any, ...]] = []
    deadline = time.monotonic() + _BATCH_TIMEOUT_S
    try:
        while not _WRITER_STOP.is_set():
            try:
                item = _WRITE_QUEUE.get(timeout=0.25)
            except queue.Empty:
                item = None
            if item is None:
                if batch and (len(batch) >= _BATCH_SIZE or time.monotonic() >= deadline):
                    try:
                        _flush_batch(conn, batch)
                    except sqlite3.OperationalError as e:
                        logger.warning("Cache writer flush failed (will retry later): %s", e)
                        # Re-queue batch so we don't lose writes (optional: could drop or retry in place)
                        for b in batch:
                            try:
                                _WRITE_QUEUE.put(b)
                            except queue.Full:
                                pass
                    batch = []
                    deadline = time.monotonic() + _BATCH_TIMEOUT_S
                continue
            if item == "STOP":
                break
            batch.append(item)
            if len(batch) >= _BATCH_SIZE or time.monotonic() >= deadline:
                try:
                    _flush_batch(conn, batch)
                except sqlite3.OperationalError as e:
                    logger.warning("Cache writer flush failed (will retry later): %s", e)
                    for b in batch:
                        try:
                            _WRITE_QUEUE.put(b)
                        except queue.Full:
                            pass
                batch = []
                deadline = time.monotonic() + _BATCH_TIMEOUT_S
        if batch:
            try:
                _flush_batch(conn, batch)
            except sqlite3.OperationalError as e:
                logger.warning("Cache writer final flush failed: %s", e)
    finally:
        try:
            conn.close()
        except Exception:
            pass


def start_writer() -> None:
    """Start the single writer thread. Call on FastAPI startup."""
    global _WRITER_THREAD
    if _WRITER_THREAD is not None and _WRITER_THREAD.is_alive():
        return
    _WRITER_STOP.clear()
    _WRITER_THREAD = threading.Thread(target=_writer_loop, daemon=False)
    _WRITER_THREAD.start()


def stop_writer() -> None:
    """Signal writer to stop, flush queue, close connection. Call on FastAPI shutdown."""
    global _WRITER_THREAD
    _WRITE_QUEUE.put("STOP")
    if _WRITER_THREAD is not None:
        _WRITER_THREAD.join(timeout=15.0)
        _WRITER_THREAD = None


# --- Public API: reads use thread-local conn; writes enqueue ---

def get_search(title: str, year: Optional[int]) -> Optional[int]:
    year_val = year if year is not None else 0
    title_n = title.strip().lower()
    conn = _get_read_conn()
    row = conn.execute(
        "SELECT tmdb_id, updated_at FROM search_cache WHERE title = ? AND year = ?",
        (title_n, year_val),
    ).fetchone()
    if not row:
        return None
    if _is_expired(row["updated_at"]):
        return None
    return row["tmdb_id"]


def set_search(title: str, year: Optional[int], tmdb_id: Optional[int]) -> None:
    title_n = title.strip().lower()
    year_val = year if year is not None else 0
    _WRITE_QUEUE.put(("search", title_n, year_val, tmdb_id))


def get_movie(tmdb_id: int) -> Optional[Any]:
    conn = _get_read_conn()
    row = conn.execute(
        "SELECT payload_json, updated_at FROM movie_cache WHERE tmdb_id = ?",
        (tmdb_id,),
    ).fetchone()
    if not row:
        return None
    if _is_expired(row["updated_at"]):
        return None
    return json.loads(row["payload_json"])


def set_movie(tmdb_id: int, payload: Any) -> None:
    payload_json = json.dumps(payload)
    _WRITE_QUEUE.put(("movie", tmdb_id, payload_json))


# --- Legacy CacheConnection: keep for compatibility but route to module API ---

class CacheConnection:
    """
    Thin wrapper: uses module-level get/set so all writes go through the
    single writer queue. Kept for any code that might instantiate it.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()

    def get_search(self, title: str, year: Optional[int]) -> Optional[int]:
        with self._lock:
            return get_search(title, year)

    def set_search(self, title: str, year: Optional[int], tmdb_id: Optional[int]) -> None:
        set_search(title, year, tmdb_id)

    def get_movie(self, tmdb_id: int) -> Optional[Any]:
        with self._lock:
            return get_movie(tmdb_id)

    def set_movie(self, tmdb_id: int, payload: Any) -> None:
        set_movie(tmdb_id, payload)

    def flush_pending(self) -> None:
        pass

    def close(self) -> None:
        pass
