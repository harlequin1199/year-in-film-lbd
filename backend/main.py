import logging
import os
from pathlib import Path
from typing import Dict, Optional, Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional

# Load .env from backend dir when running locally; production uses env vars (e.g. Render)
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

app = FastAPI()

# CORS: FRONTEND_ORIGIN for production (e.g. Vercel URL); else allow all
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
    import cache
    cache.init_cache_db()
    cache.start_writer()
    logger.info("Backend started; TMDB_API_KEY is set.")


@app.on_event("shutdown")
def _shutdown():
    import cache
    cache.stop_writer()
    logger.info("Backend shutting down; cache writer stopped.")


@app.get("/health")
def health() -> Dict[str, str]:
    return {"status": "ok"}


class BatchSearchItem(BaseModel):
    title: str
    year: Optional[int] = None


class BatchSearchRequest(BaseModel):
    items: List[BatchSearchItem]


class BatchMoviesRequest(BaseModel):
    tmdb_ids: List[int]


@app.post("/tmdb/search/batch")
async def tmdb_search_batch(request: BatchSearchRequest = Body(...)) -> Dict[str, List[Dict[str, Any]]]:
    """
    Batch search endpoint for TMDB.
    Processes multiple search requests with rate limiting, retry, and caching.
    """
    try:
        logger.info("Batch search request received: %s items", len(request.items))
        api_key = (os.getenv("TMDB_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(
                status_code=500,
                detail="TMDB_API_KEY is not set",
            )
        
        if not request.items:
            return {"results": []}
        
        if len(request.items) > 500:
            raise HTTPException(
                status_code=400,
                detail="Too many items. Maximum 500 items per batch.",
            )
        
        import tmdb_batch
        
        items_dict = [{"title": item.title, "year": item.year} for item in request.items]
        logger.info("Processing batch search for %s items", len(items_dict))
        results = await tmdb_batch.search_batch(items_dict, api_key)
        logger.info("Batch search completed: %s results", len(results))
        
        return {"results": results}
    except Exception as e:
        logger.exception("Error in batch search endpoint: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/tmdb/movies/batch")
async def tmdb_movies_batch(request: BatchMoviesRequest = Body(...)) -> Dict[str, List[Dict[str, Any]]]:
    """Batch movie details endpoint."""
    try:
        logger.info("Batch movies request received: %s items", len(request.tmdb_ids))
        api_key = (os.getenv("TMDB_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="TMDB_API_KEY is not set")
        
        if not request.tmdb_ids:
            return {"results": []}
        
        if len(request.tmdb_ids) > 500:
            raise HTTPException(status_code=400, detail="Too many items. Maximum 500 items per batch.")
        
        import tmdb_batch_movies
        results = await tmdb_batch_movies.movies_batch(request.tmdb_ids, api_key)
        logger.info("Batch movies completed: %s results", len(results))
        
        return {"results": results}
    except Exception as e:
        logger.exception("Error in batch movies endpoint: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/tmdb/movies/credits/batch")
async def tmdb_credits_batch(request: BatchMoviesRequest = Body(...)) -> Dict[str, List[Dict[str, Any]]]:
    """Batch credits endpoint."""
    try:
        logger.info("Batch credits request received: %s items", len(request.tmdb_ids))
        api_key = (os.getenv("TMDB_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="TMDB_API_KEY is not set")
        
        if not request.tmdb_ids:
            return {"results": []}
        
        if len(request.tmdb_ids) > 500:
            raise HTTPException(status_code=400, detail="Too many items. Maximum 500 items per batch.")
        
        import tmdb_batch_movies
        results = await tmdb_batch_movies.credits_batch(request.tmdb_ids, api_key)
        logger.info("Batch credits completed: %s results", len(results))
        
        return {"results": results}
    except Exception as e:
        logger.exception("Error in batch credits endpoint: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


@app.post("/tmdb/movies/keywords/batch")
async def tmdb_keywords_batch(request: BatchMoviesRequest = Body(...)) -> Dict[str, List[Dict[str, Any]]]:
    """Batch keywords endpoint."""
    try:
        logger.info("Batch keywords request received: %s items", len(request.tmdb_ids))
        api_key = (os.getenv("TMDB_API_KEY") or "").strip()
        if not api_key:
            raise HTTPException(status_code=500, detail="TMDB_API_KEY is not set")
        
        if not request.tmdb_ids:
            return {"results": []}
        
        if len(request.tmdb_ids) > 500:
            raise HTTPException(status_code=400, detail="Too many items. Maximum 500 items per batch.")
        
        import tmdb_batch_movies
        results = await tmdb_batch_movies.keywords_batch(request.tmdb_ids, api_key)
        logger.info("Batch keywords completed: %s results", len(results))
        
        return {"results": results}
    except Exception as e:
        logger.exception("Error in batch keywords endpoint: %s", e)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
