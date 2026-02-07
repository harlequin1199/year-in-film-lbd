"""
Worker process: stream CSV + two-phase TMDb + analytics.
Writes progress to /tmp/progress_{job_id}.json and report to /tmp/report_{job_id}.json.
Exits when done so the OS reclaims all memory. Only one worker at a time (lock file).
"""
import asyncio
import gc
import heapq
import json
import logging
import os
import sys
from typing import Dict, List, Optional, Set

try:
    import resource
except ImportError:
    resource = None

import cache as cache_module
from analytics import analyze_films
from csv_parse import (
    count_ratings_csv_rows,
    merge_diary_into_films,
    parse_diary_csv,
    stream_ratings_csv,
)
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

# Env: TMDB_CONCURRENCY default 4, TMDB_BATCH_SIZE default 75
TMDB_CONCURRENCY = int(os.getenv("TMDB_CONCURRENCY") or os.getenv("TMDB_MAX_CONCURRENCY") or "4")
TMDB_BATCH_SIZE = int(os.getenv("TMDB_BATCH_SIZE") or "75")

# Phase 2: fetch full (credits+keywords) only for these caps
BEST_FILMS_CAP = 200
HIDDEN_GEMS_CAP = 300
OVERRATED_CAP = 300
DECADE_POSTERS_CAP = 500

# Memory guard (inside worker only): warn 380, reduce 420->2 / 450->1, abort 470
MEMORY_MB_WARN = 380
MEMORY_MB_SLOW_2 = 420
MEMORY_MB_SLOW_1 = 450
MEMORY_MB_ABORT = 470
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


def _minimal_film_from_row(row: Dict, enriched: Dict) -> Dict:
    poster_path = enriched.get("poster_path")
    poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
    poster_url_w342 = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else None
    va = enriched.get("vote_average")
    vc = enriched.get("vote_count") or 0
    return {
        "title": row.get("title"),
        "year": row.get("year"),
        "rating": row.get("rating"),
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


def _select_tmdb_ids_for_phase2(films: List[Dict]) -> Set[int]:
    """Return set of tmdb_ids that need full (credits+keywords) fetch."""
    ids: Set[int] = set()
    # Best by user rating
    best = heapq.nlargest(BEST_FILMS_CAP, films, key=lambda f: (f.get("rating") or 0, f.get("year") or 0))
    for f in best:
        if f.get("tmdb_id"):
            ids.add(f["tmdb_id"])
    # Hidden gems: user - tmdb_stars >= 1.5, user >= 3.5, votes >= 200
    def gem_score(f):
        u = f.get("rating") or 0
        t = f.get("tmdb_stars")
        vc = f.get("tmdb_vote_count") or 0
        if u < 3.5 or vc < 200 or t is None:
            return -999
        return u - t
    gems = heapq.nlargest(HIDDEN_GEMS_CAP, films, key=gem_score)
    for f in gems:
        if gem_score(f) >= 1.5 and f.get("tmdb_id"):
            ids.add(f["tmdb_id"])
    # Overrated: tmdb_stars - user
    def over_score(f):
        t = f.get("tmdb_stars")
        u = f.get("rating") or 0
        if t is None:
            return -999
        return t - u
    over = heapq.nlargest(OVERRATED_CAP, films, key=over_score)
    for f in over:
        if f.get("tmdb_id"):
            ids.add(f["tmdb_id"])
    # Decade posters: top 500 by rating
    decade_top = heapq.nlargest(DECADE_POSTERS_CAP, films, key=lambda f: (f.get("rating") or 0, f.get("year") or 0))
    for f in decade_top:
        if f.get("tmdb_id"):
            ids.add(f["tmdb_id"])
    return ids


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

    # Stream parsing: count first, then process row-by-row
    n_total = count_ratings_csv_rows(ratings_path)
    if n_total == 0:
        update(status="error", message="В CSV нет записей о фильмах")
        logger.warning("Job %s: no rows in CSV.", job_id)
        return

    async with progress_lock:
        update(stage="tmdb_details", total=n_total, done=0, percent=2, message=STAGES["tmdb_details"])

    diary_entries: List[Dict] = []
    if diary_path and os.path.isfile(diary_path):
        try:
            with open(diary_path, "r", encoding="utf-8-sig") as f:
                diary_entries = parse_diary_csv(f.read())
        except Exception:
            pass

    job_search_cache: Dict[tuple, Optional[int]] = {}
    job_movie_cache: Dict[int, Dict] = {}
    current_concurrency = TMDB_CONCURRENCY
    client = TMDbClient(
        api_key=api_key,
        job_search_cache=job_search_cache,
        job_movie_cache=job_movie_cache,
        cache_backend=cache_module,
        max_concurrency=current_concurrency,
    )

    films: List[Dict] = []
    done_so_far = 0
    aborted = False
    batch: List[Dict] = []

    for row in stream_ratings_csv(ratings_path):
        batch.append(row)
        if len(batch) < TMDB_BATCH_SIZE:
            continue

        mem_mb = get_memory_mb()
        if mem_mb is not None:
            if mem_mb > MEMORY_MB_WARN and done_so_far % 500 == 0 and done_so_far > 0:
                logger.warning("[memory] Job %s at %.1f MB (warn %s)", job_id, mem_mb, MEMORY_MB_WARN)
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

        async def process_one(r: Dict):
            if not r.get("title"):
                return None
            try:
                enriched = await client.get_enriched_minimal(r["title"], r.get("year"))
                return _minimal_film_from_row(r, enriched)
            except Exception:
                raise

        batch_results = await asyncio.gather(
            *[process_one(r) for r in batch],
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
        batch = []

        if done_so_far % 200 == 0:
            mem_mb = get_memory_mb()
            if mem_mb is not None:
                logger.info("[memory] Job %s after %s films: %.1f MB", job_id, done_so_far, mem_mb)

    if batch and not aborted:
        async def process_one(r: Dict):
            if not r.get("title"):
                return None
            enriched = await client.get_enriched_minimal(r["title"], r.get("year"))
            return _minimal_film_from_row(r, enriched)
        batch_results = await asyncio.gather(*[process_one(r) for r in batch], return_exceptions=True)
        for r in batch_results:
            if isinstance(r, Exception):
                raise r
            if r is not None:
                films.append(r)
        done_so_far += len(batch)
        async with progress_lock:
            update(done=done_so_far)

    if aborted:
        await client.close()
        return

    # Phase 2: fetch full (credits+keywords) for selected tmdb_ids only
    ids_to_fetch = _select_tmdb_ids_for_phase2(films)
    if ids_to_fetch:
        id_list = list(ids_to_fetch)
        for i in range(0, len(id_list), TMDB_BATCH_SIZE):
            chunk = id_list[i : i + TMDB_BATCH_SIZE]
            await asyncio.gather(
                *[client.get_movie_details(tid) for tid in chunk],
                return_exceptions=True,
            )
        # Merge full data into films
        for f in films:
            tid = f.get("tmdb_id")
            if tid not in ids_to_fetch:
                continue
            full = job_movie_cache.get(tid)
            if not full or not isinstance(full, dict):
                continue
            keywords_data = full.get("keywords") or {}
            credits_data = full.get("credits") or {}
            f["keywords"] = [k.get("name") for k in keywords_data.get("keywords", []) if k.get("name")]
            f["directors"] = [
                c.get("name") for c in credits_data.get("crew", [])
                if c.get("job") == "Director" and c.get("name")
            ]
            f["actors"] = [c.get("name") for c in credits_data.get("cast", []) if c.get("name")][:8]

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
        logger.error("Usage: python -m worker <job_id> <ratings_path> [diary_path]")
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
