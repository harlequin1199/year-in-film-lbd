import asyncio
import csv
import gc
import io
import json
import logging
import os
import re
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from uuid import uuid4

try:
    import resource
except ImportError:
    resource = None  # Windows has no resource

from dotenv import load_dotenv
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

from analytics import analyze_films
import cache as cache_module
from tmdb_client import TMDbClient

# Load .env from backend dir when running locally; production uses env vars (e.g. Render)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS: FRONTEND_ORIGIN for production (e.g. Cloudflare Pages URL); else allow all
_frontend_origin = (os.getenv("FRONTEND_ORIGIN") or "").strip()
_cors_origins = ["http://localhost:5173", "http://localhost:3000"] if _frontend_origin else ["*"]
if _frontend_origin:
    _cors_origins.append(_frontend_origin)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def _startup():
    api_key = (os.getenv("TMDB_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError(
            "TMDB_API_KEY is not set. Set it in the environment (e.g. Render dashboard or backend/.env)."
        )
    cache_module.init_cache_db()
    cache_module.start_writer()
    logger.info("Backend started; TMDB_API_KEY is set; cache writer started.")


@app.on_event("shutdown")
def _shutdown():
    cache_module.stop_writer()
    logger.info("Cache writer stopped.")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


JOB_PROGRESS: Dict[str, Dict] = {}
REPORT_DIR = "/tmp"

# Progress stages and messages (Russian)
STAGES = {
    "parsing": "Читаю CSV…",
    "tmdb_search": "Ищу фильмы в TMDb…",
    "tmdb_details": "Загружаю данные TMDb…",
    "analytics": "Считаю статистику…",
    "finalizing": "Готовлю результат…",
}

BATCH_SIZE = 25

# Memory guard (Linux: ru_maxrss is KB → MB = / 1024)
MEMORY_MB_SLOW_2 = 420  # reduce concurrency to 2
MEMORY_MB_SLOW_1 = 460  # reduce concurrency to 1
MEMORY_MB_ABORT = 490   # abort job gracefully
ABORT_MESSAGE = (
    "Файл слишком большой для текущего сервера. Попробуйте меньший объём или повторите позже."
)


def get_memory_mb() -> Optional[float]:
    """Return current process RSS in MB (Linux); None if unavailable (e.g. Windows)."""
    if resource is None:
        return None
    try:
        # Linux: ru_maxrss is in KB
        rss_kb = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
        return rss_kb / 1024.0
    except (OSError, AttributeError):
        return None


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def _parse_float(value: Optional[str]) -> Optional[float]:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _normalize_header(name: str) -> str:
    return name.strip().lower() if name else ""


def _find_column(fieldnames: List[str], *candidates: str) -> Optional[str]:
    normalized = [_normalize_header(h) for h in fieldnames]
    for c in candidates:
        cnorm = c.lower().strip()
        for i, n in enumerate(normalized):
            if cnorm in n or n in cnorm:
                return fieldnames[i]
    return None


def _parse_ratings_csv_fast(text: str) -> List[Dict]:
    """Lightweight parse: only needed columns. No heavy cleaning."""
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    if not fieldnames:
        return []

    name_col = _find_column(fieldnames, "Name", "name", "Title")
    year_col = _find_column(fieldnames, "Year", "year")
    rating_col = _find_column(fieldnames, "Rating", "rating")
    date_col = _find_column(fieldnames, "Date", "date")
    uri_col = _find_column(fieldnames, "Letterboxd URI", "URI", "letterboxd")

    if not name_col:
        return []

    rows = []
    for row in reader:
        title = (row.get(name_col) or "").strip()
        if not title:
            continue
        rows.append({
            "title": title,
            "year": _parse_int(row.get(year_col)) if year_col else None,
            "rating": _parse_float(row.get(rating_col)) if rating_col else None,
            "date": (row.get(date_col) or "").strip() if date_col else None,
            "letterboxd_url": (row.get(uri_col) or "").strip() or None,
        })
    return rows


def _parse_diary_csv(text: str) -> List[Dict]:
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    if not fieldnames:
        return []

    date_col = _find_column(fieldnames, "Date", "date")
    name_col = _find_column(fieldnames, "Name", "name", "Title")
    year_col = _find_column(fieldnames, "Year", "year")
    uri_col = _find_column(fieldnames, "Letterboxd URI", "URI", "letterboxd")

    if not date_col or not name_col:
        return []

    out = []
    for row in reader:
        date_val = (row.get(date_col) or "").strip()
        name_val = (row.get(name_col) or "").strip()
        if not date_val or not name_val:
            continue
        year_val = _parse_int(row.get(year_col)) if year_col else None
        uri_val = (row.get(uri_col) or "").strip() if uri_col else None
        out.append({
            "date": date_val,
            "name": name_val,
            "year": year_val,
            "letterboxd_uri": uri_val or None,
        })
    return out


def _normalize_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    date_str = date_str.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", date_str):
        return date_str[:10]
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(date_str.replace(" ", "T"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def _merge_diary_into_films(films: List[Dict], diary_entries: List[Dict]) -> None:
    by_uri: Dict[str, str] = {}
    by_key: Dict[Tuple[str, int], str] = {}
    for e in diary_entries:
        d = _normalize_date(e.get("date"))
        if not d:
            continue
        uri = (e.get("letterboxd_uri") or "").strip()
        name = (e.get("name") or "").strip().lower()
        year = e.get("year") if e.get("year") is not None else 0
        if uri:
            by_uri[uri] = max(by_uri.get(uri, d), d)
        by_key[(name, year)] = max(by_key.get((name, year), d), d)

    for film in films:
        watched = None
        uri = (film.get("letterboxd_url") or "").strip()
        if uri and uri in by_uri:
            watched = by_uri[uri]
        else:
            name = (film.get("title") or "").strip().lower()
            year = film.get("year") if film.get("year") is not None else 0
            watched = by_key.get((name, year))
        film["watchedDate"] = watched


def _update_progress(
    job_id: str,
    *,
    stage: Optional[str] = None,
    total: Optional[int] = None,
    done: Optional[int] = None,
    percent: Optional[int] = None,
    message: Optional[str] = None,
    status: Optional[str] = None,
    report_path: Optional[str] = None,
) -> None:
    p = JOB_PROGRESS.get(job_id)
    if not p:
        return
    if stage is not None:
        p["stage"] = stage
        p["message"] = STAGES.get(stage, p.get("message", ""))
    if total is not None:
        p["total"] = total
    if done is not None:
        p["done"] = done
    if percent is not None:
        p["percent"] = min(100, max(0, percent))
    elif p.get("total") and p.get("done") is not None and p["total"] > 0:
        p["percent"] = min(100, round(100 * p["done"] / p["total"]))
    if message is not None:
        p["message"] = message
    if status is not None:
        p["status"] = status
    if report_path is not None:
        p["report_path"] = report_path


def _init_progress(job_id: str) -> None:
    JOB_PROGRESS[job_id] = {
        "status": "processing",
        "stage": "parsing",
        "total": 0,
        "done": 0,
        "percent": 1,
        "message": STAGES["parsing"],
    }


async def _process_job(
    job_id: str,
    ratings_raw: bytes,
    api_key: str,
    diary_raw: Optional[bytes] = None,
) -> None:
    progress_lock = asyncio.Lock()

    def update(**kwargs):
        _update_progress(job_id, **kwargs)

    # Stage: parsing (run in thread to avoid blocking)
    def do_parse():
        text = ratings_raw.decode("utf-8-sig")
        rows = _parse_ratings_csv_fast(text)
        diary_entries: List[Dict] = []
        if diary_raw:
            try:
                diary_text = diary_raw.decode("utf-8-sig")
                diary_entries = _parse_diary_csv(diary_text)
            except Exception:
                pass
        return rows, diary_entries

    logger.info("Job %s started.", job_id)
    try:
        rows, diary_entries = await asyncio.to_thread(do_parse)
        n_total = len(rows)
        if n_total == 0:
            update(status="error", message="В CSV нет записей о фильмах")
            logger.warning("Job %s: no rows in CSV.", job_id)
            return

        async with progress_lock:
            update(stage="tmdb_details", total=n_total, done=0, percent=2, message=STAGES["tmdb_details"])

        # Per-job in-memory caches; persistent cache uses module-level (one connection per call, thread-safe)
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
            try:
                enriched = await client.get_enriched(title, year)
            except Exception:
                raise
            poster_path = enriched.get("poster_path")
            poster_url = f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None
            poster_url_w342 = f"https://image.tmdb.org/t/p/w342{poster_path}" if poster_path else None
            va = enriched.get("vote_average")
            vc = enriched.get("vote_count") or 0
            film = {
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
            return film

        films: List[Dict] = []
        done_so_far = 0
        aborted = False

        for i in range(0, n_total, BATCH_SIZE):
            # Memory guard: log every 200 films, reduce concurrency, or abort
            if done_so_far > 0 and done_so_far % 200 == 0:
                mem_mb = get_memory_mb()
                if mem_mb is not None:
                    logger.info("[memory] Job %s after %s films: %.1f MB", job_id, done_so_far, mem_mb)

            mem_mb = get_memory_mb()
            if mem_mb is not None:
                if mem_mb > MEMORY_MB_ABORT:
                    logger.warning("[memory] Job %s abort: %.1f MB > %s MB", job_id, mem_mb, MEMORY_MB_ABORT)
                    async with progress_lock:
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

        # Stage: analytics
        async with progress_lock:
            update(stage="analytics", message=STAGES["analytics"])
        has_diary = bool(diary_entries)
        if has_diary:
            _merge_diary_into_films(films, diary_entries)

        if resource:
            rss_before_build = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            logger.info("[OOM debug] Memory before building report (ru_maxrss): %s kB", rss_before_build)
        result_payload = await asyncio.to_thread(analyze_films, films, has_diary)
        result_payload["hasDiary"] = has_diary
        result_payload["dataSource"] = "both" if has_diary else "ratings"

        if resource:
            rss_after_build = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            logger.info("[OOM debug] Memory after building report (ru_maxrss): %s kB", rss_after_build)

        async with progress_lock:
            update(stage="finalizing", message=STAGES["finalizing"])

        report_path = os.path.join(REPORT_DIR, f"year_in_film_report_{job_id}.json")
        with open(report_path, "w", encoding="utf-8") as f:
            json.dump(result_payload, f, ensure_ascii=False)

        if resource:
            rss_after_write = resource.getrusage(resource.RUSAGE_SELF).ru_maxrss
            logger.info("[OOM debug] Memory after writing report (ru_maxrss): %s kB", rss_after_write)
        try:
            file_size = os.path.getsize(report_path)
            logger.info("[OOM debug] Report file size: %s bytes", file_size)
        except OSError:
            pass

        del result_payload
        gc.collect()

        _update_progress(job_id, status="done", percent=100, message="Готово", report_path=report_path)
        logger.info("Job %s completed (%s films).", job_id, len(films))
    except Exception as exc:
        logger.exception("Job %s failed: %s", job_id, exc)
        _update_progress(job_id, status="error", message=str(exc))


@app.post("/api/analyze")
async def analyze(
    background_tasks: BackgroundTasks,
    ratings_file: UploadFile = File(..., description="ratings.csv"),
    diary_file: Optional[UploadFile] = File(None, description="diary.csv (optional)"),
) -> Dict:
    if not ratings_file.filename or not ratings_file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Please upload a ratings.csv file")

    raw = await ratings_file.read()
    diary_raw: Optional[bytes] = None
    if diary_file and diary_file.filename and "diary" in diary_file.filename.lower():
        diary_raw = await diary_file.read()

    api_key = os.getenv("TMDB_API_KEY", "").strip()
    if not api_key:
        raise HTTPException(
            status_code=500,
            detail="TMDB_API_KEY is not set. Set it in the environment (e.g. in Render dashboard or in a .env file).",
        )

    job_id = str(uuid4())
    _init_progress(job_id)
    background_tasks.add_task(_process_job, job_id, raw, api_key, diary_raw)
    return {"job_id": job_id}


@app.get("/api/progress/{job_id}")
async def progress(job_id: str) -> Dict:
    if job_id not in JOB_PROGRESS:
        raise HTTPException(status_code=404, detail="Job not found")
    return JOB_PROGRESS[job_id]


@app.get("/api/result/{job_id}")
async def result(job_id: str):
    progress_data = JOB_PROGRESS.get(job_id)
    if not progress_data:
        raise HTTPException(status_code=404, detail="Job not found")
    if progress_data.get("status") == "error":
        raise HTTPException(status_code=400, detail=progress_data.get("message") or "Job failed")
    if progress_data.get("status") != "done":
        raise HTTPException(status_code=400, detail="Job is still processing")
    report_path = progress_data.get("report_path")
    if not report_path or not os.path.isfile(report_path):
        raise HTTPException(status_code=500, detail="Report file not found")
    return FileResponse(report_path, media_type="application/json")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
