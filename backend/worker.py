"""
Worker process: runs CSV parsing + TMDb enrichment + analytics.
Writes progress to /tmp/progress_{job_id}.json and report to /tmp/report_{job_id}.json.
Exits when done so the OS reclaims all memory. Only one worker runs at a time (lock file).
"""
import asyncio
import gc
import json
import logging
import os
import sys
from typing import Dict, List, Optional

try:
    import resource
except ImportError:
    resource = None

# Run with cwd=backend so imports resolve (python -m worker)

import cache as cache_module
from analytics import analyze_films
from csv_parse import merge_diary_into_films, parse_diary_csv, parse_ratings_csv_fast
from tmdb_client import TMDbClient

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

REPORT_DIR = "/tmp"
PROGRESS_DIR = "/tmp"
WORKER_LOCK_PATH = "/tmp/worker.lock"

STAGES = {
    "parsing": "Читаю CSV…",
    "tmdb_search": "Ищу фильмы в TMDb…",
    "tmdb_details": "Загружаю данные TMDb…",
    "analytics": "Считаю статистику…",
    "finalizing": "Готовлю результат…",
}
BATCH_SIZE = 25
MEMORY_MB_SLOW_2 = 420
MEMORY_MB_SLOW_1 = 460
MEMORY_MB_ABORT = 490
ABORT_MESSAGE = (
    "Файл слишком большой для текущего сервера. Попробуйте меньший объём или повторите позже."
)


def get_memory_mb() -> Optional[float]:
    if resource is None:
        return None
    try:
        rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return rss_kb / 1024.0
    except (OSError, AttributeError):
        return None


def _write_progress(job_id: str, data: Dict) -> None:
    path = os.path.join(PROGRESS_DIR, f"progress_{job_id}.json")
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)


async def _run_job(job_id: str, ratings_path: str, diary_path: str, api_key: str) -> None:
    progress: Dict = {
        "status": "processing",
        "stage": "parsing",
        "total": 0,
        "done": 0,
        "percent": 1,
        "message": STAGES["parsing"],
    }
    progress_lock = asyncio.Lock()

    def update(**kwargs):
        for k, v in kwargs.items():
            if v is not None:
                progress[k] = v
        if "stage" in kwargs and kwargs["stage"] is not None:
            progress["message"] = STAGES.get(kwargs["stage"], progress.get("message", ""))
        if "total" in kwargs or "done" in kwargs:
            t, d = progress.get("total"), progress.get("done")
            if t and d is not None and t > 0:
                progress["percent"] = min(100, round(100 * d / t))
        if "percent" in kwargs and kwargs["percent"] is not None:
            progress["percent"] = min(100, max(0, kwargs["percent"]))
        _write_progress(job_id, progress)

    with open(ratings_path, "r", encoding="utf-8-sig") as f:
        text = f.read()
    rows = parse_ratings_csv_fast(text)
    diary_entries: List[Dict] = []
    if diary_path and os.path.isfile(diary_path):
        try:
            with open(diary_path, "r", encoding="utf-8-sig") as f:
                diary_entries = parse_diary_csv(f.read())
        except Exception:
            pass

    n_total = len(rows)
    if n_total == 0:
        update(status="error", message="В CSV нет записей о фильмах")
        logger.warning("Job %s: no rows in CSV.", job_id)
        return

    async with progress_lock:
        update(stage="tmdb_details", total=n_total, done=0, percent=2, message=STAGES["tmdb_details"])

    job_search_cache: Dict[tuple, Optional[int]] = {}
    job_movie_cache: Dict[int, Dict] = {}
    default_concurrency = int(os.getenv("TMDB_CONCURRENCY") or os.getenv("TMDB_MAX_CONCURRENCY") or "4")
    current_concurrency = default_concurrency
    client = TMDbClient(
        api_key=api_key,
        job_search_cache=job_search_cache,
        job_movie_cache=job_movie_cache,
        cache_backend=cache_module,
        max_concurrency=current_concurrency,
    )

    async def process_row(row: Dict) -> Optional[Dict]:
        title = row.get("title")
        year = row.get("year")
        rating = row.get("rating")
        if not title:
            return None
        enriched = await client.get_enriched(title, year)
        poster_path = enriched.get("poster_path")
        poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
        poster_url_w342 = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else None
        va = enriched.get("vote_average")
        vc = enriched.get("vote_count") or 0
        return {
            "title": title,
            "year": year,
            "rating": rating,
            "date": row.get("date"),
            "letterboxd_url": row.get("letterboxd_url"),
            "tmdb_id": enriched.get("tmdb_id"),
            "poster_path": poster_path,
            "poster_url": poster_url,
            "poster_url_w342": poster_url_w342,
            "tmdb_vote_average": va,
            "tmdb_vote_count": vc,
            "tmdb_stars": (va / 2.0) if va is not None else None,
            "genres": enriched.get("genres", []),
            "keywords": enriched.get("keywords", []),
            "directors": enriched.get("directors", []),
            "actors": enriched.get("actors", []),
            "countries": enriched.get("countries", []),
            "runtime": enriched.get("runtime"),
            "original_language": enriched.get("original_language"),
        }

    films: List[Dict] = []
    done_so_far = 0
    aborted = False

    for i in range(0, n_total, BATCH_SIZE):
        if done_so_far > 0 and done_so_far % 200 == 0:
            mem_mb = get_memory_mb()
            if mem_mb is not None:
                logger.info("[memory] Job %s after %s films: %.1f MB", job_id, done_so_far, mem_mb)

        mem_mb = get_memory_mb()
        if mem_mb is not None:
            if mem_mb > MEMORY_MB_ABORT:
                logger.warning("[memory] Job %s abort: %.1f MB > %s MB", job_id, mem_mb, MEMORY_MB_ABORT)
                update(status="error", message=ABORT_MESSAGE)
                aborted = True
                break
            if mem_mb > MEMORY_MB_SLOW_1 and current_concurrency > 1:
                await client.close()
                current_concurrency = 1
                client = TMDbClient(
                    api_key=api_key,
                    job_search_cache=job_search_cache,
                    job_movie_cache=job_movie_cache,
                    cache_backend=cache_module,
                    max_concurrency=1,
                )
                logger.info("[memory] Job %s concurrency reduced to 1 (%.1f MB)", job_id, mem_mb)
            elif mem_mb > MEMORY_MB_SLOW_2 and current_concurrency > 2:
                await client.close()
                current_concurrency = 2
                client = TMDbClient(
                    api_key=api_key,
                    job_search_cache=job_search_cache,
                    job_movie_cache=job_movie_cache,
                    cache_backend=cache_module,
                    max_concurrency=2,
                )
                logger.info("[memory] Job %s concurrency reduced to 2 (%.1f MB)", job_id, mem_mb)

        batch = rows[i : i + BATCH_SIZE]
        batch_results = await asyncio.gather(
            *[process_row(r) for r in batch],
            return_exceptions=True,
        )
        for r in batch_results:
            if isinstance(r, Exception):
                raise r
            if r is not None:
                films.append(r)
        done_so_far += len(batch)
        async with progress_lock:
            update(done=done_so_far)

    await client.close()
    if aborted:
        return

    async with progress_lock:
        update(stage="analytics", message=STAGES["analytics"])
    has_diary = bool(diary_entries)
    if has_diary:
        merge_diary_into_films(films, diary_entries)

    result_payload = await asyncio.to_thread(analyze_films, films, has_diary)
    result_payload["hasDiary"] = has_diary
    result_payload["dataSource"] = "both" if has_diary else "ratings"

    async with progress_lock:
        update(stage="finalizing", message=STAGES["finalizing"])

    report_path = os.path.join(REPORT_DIR, f"report_{job_id}.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(result_payload, f, ensure_ascii=False)

    del result_payload
    gc.collect()

    update(status="done", percent=100, message="Готово", report_path=report_path)
    logger.info("Job %s completed (%s films).", job_id, len(films))


def main() -> int:
    if len(sys.argv) < 3:
        logger.error("Usage: python -m backend.worker <job_id> <ratings_path> [diary_path]")
        return 1
    job_id = sys.argv[1]
    ratings_path = sys.argv[2]
    diary_path = sys.argv[3] if len(sys.argv) > 3 else ""
    api_key = (os.getenv("TMDB_API_KEY") or "").strip()
    if not api_key:
        logger.error("TMDB_API_KEY not set")
        return 1
    if not os.path.isfile(ratings_path):
        logger.error("Ratings file not found: %s", ratings_path)
        return 1

    # Take over lock file (created by FastAPI before spawn); write our PID
    try:
        with open(WORKER_LOCK_PATH, "r+") as lf:
            lf.write(str(os.getpid()))
            lf.flush()
    except FileNotFoundError:
        logger.error("Lock file not found; another request may have won the race.")
        return 1

    try:
        cache_module.init_cache_db()
        cache_module.start_writer()
        try:
            asyncio.run(_run_job(job_id, ratings_path, diary_path, api_key))
        finally:
            cache_module.stop_writer()
    finally:
        try:
            os.unlink(WORKER_LOCK_PATH)
        except OSError:
            pass
        for p in (ratings_path, diary_path):
            if p and os.path.isfile(p):
                try:
                    os.unlink(p)
                except OSError:
                    pass
    return 0


if __name__ == "__main__":
    sys.exit(main())
