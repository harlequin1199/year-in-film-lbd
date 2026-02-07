import json
import logging
import os
import subprocess
import sys
import time
from pathlib import Path
from typing import Dict, Optional
from uuid import uuid4

TMP_CLEANUP_AGE_SEC = 2 * 60 * 60  # 2 hours

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

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

WORKER_LOCK_PATH = "/tmp/worker.lock"
PROGRESS_DIR = "/tmp"
BUSY_MESSAGE = "Сервер занят обработкой другого отчёта. Попробуйте позже."


def _cleanup_old_tmp_files() -> None:
    """Remove progress/report/ratings/diary files in /tmp older than 2 hours."""
    try:
        names = os.listdir(PROGRESS_DIR)
    except OSError:
        return
    now = time.time()
    for name in names:
        if not (name.startswith("progress_") or name.startswith("report_") or name.startswith("ratings_") or name.startswith("diary_")):
            continue
        path = os.path.join(PROGRESS_DIR, name)
        try:
            if os.path.isfile(path) and (now - os.path.getmtime(path)) > TMP_CLEANUP_AGE_SEC:
                os.unlink(path)
                logger.info("Cleaned old tmp file: %s", name)
        except OSError:
            pass


@app.on_event("startup")
def _startup():
    api_key = (os.getenv("TMDB_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError(
            "TMDB_API_KEY is not set. Set it in the environment (e.g. Render dashboard or backend/.env)."
        )
    _cleanup_old_tmp_files()
    logger.info("Backend started; TMDB_API_KEY is set (worker runs analysis in separate process).")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


def _worker_lock_try_acquire() -> bool:
    """Return True if we created the lock file (slot acquired). False if another worker is running."""
    if os.path.isfile(WORKER_LOCK_PATH):
        try:
            with open(WORKER_LOCK_PATH, "r") as f:
                pid_str = f.read().strip()
            if pid_str.isdigit():
                pid = int(pid_str)
                try:
                    os.kill(pid, 0)
                    return False
                except OSError:
                    pass
        except OSError:
            pass
        try:
            os.unlink(WORKER_LOCK_PATH)
        except OSError:
            pass
    try:
        with open(WORKER_LOCK_PATH, "x"):
            pass
        return True
    except FileExistsError:
        return False


@app.post("/api/analyze")
async def analyze(
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

    if not _worker_lock_try_acquire():
        raise HTTPException(status_code=429, detail=BUSY_MESSAGE)

    _cleanup_old_tmp_files()

    job_id = str(uuid4())
    ratings_path = os.path.join(PROGRESS_DIR, f"ratings_{job_id}.csv")
    diary_path = os.path.join(PROGRESS_DIR, f"diary_{job_id}.csv")
    try:
        with open(ratings_path, "wb") as f:
            f.write(raw)
        if diary_raw:
            with open(diary_path, "wb") as f:
                f.write(diary_raw)
    except OSError as e:
        try:
            os.unlink(WORKER_LOCK_PATH)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Failed to write input files")

    backend_dir = Path(__file__).resolve().parent
    env = {**os.environ, "TMDB_API_KEY": api_key}
    initial_progress = {
        "status": "processing",
        "stage": "parsing",
        "total": 0,
        "done": 0,
        "percent": 1,
        "message": "Читаю CSV…",
    }
    progress_path = os.path.join(PROGRESS_DIR, f"progress_{job_id}.json")
    try:
        with open(progress_path, "w", encoding="utf-8") as f:
            json.dump(initial_progress, f, ensure_ascii=False)
    except OSError:
        pass

    try:
        subprocess.Popen(
            [sys.executable, "-m", "worker", job_id, ratings_path, diary_path],
            cwd=str(backend_dir),
            env=env,
            start_new_session=True,
        )
    except Exception as e:
        logger.exception("Failed to start worker: %s", e)
        try:
            os.unlink(WORKER_LOCK_PATH)
            os.unlink(ratings_path)
            if os.path.isfile(diary_path):
                os.unlink(diary_path)
            if os.path.isfile(progress_path):
                os.unlink(progress_path)
        except OSError:
            pass
        raise HTTPException(status_code=500, detail="Failed to start worker")

    return {"job_id": job_id}


@app.get("/api/progress/{job_id}")
async def progress(job_id: str) -> Dict:
    path = os.path.join(PROGRESS_DIR, f"progress_{job_id}.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except (OSError, json.JSONDecodeError) as e:
        logger.warning("Failed to read progress %s: %s", job_id, e)
        raise HTTPException(status_code=500, detail="Failed to read progress")


@app.get("/api/result/{job_id}")
async def result(job_id: str):
    path = os.path.join(PROGRESS_DIR, f"progress_{job_id}.json")
    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Job not found")
    try:
        with open(path, "r", encoding="utf-8") as f:
            progress_data = json.load(f)
    except (OSError, json.JSONDecodeError):
        raise HTTPException(status_code=500, detail="Failed to read progress")
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
