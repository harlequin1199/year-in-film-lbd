import logging
import os
from pathlib import Path
from typing import Dict, Optional, Any, List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from pydantic import BaseModel
from typing import List, Optional
import httpx
import json

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


@app.get("/tmdb/image/{size}/{path:path}")
async def tmdb_image_proxy(size: str, path: str):
    """
    Proxy endpoint for TMDB images.
    Proxies requests to https://image.tmdb.org/t/p/{size}/{path}
    """
    try:
        # Validate size parameter (common TMDB image sizes)
        valid_sizes = ['w45', 'w92', 'w154', 'w185', 'w300', 'w342', 'w500', 'w780', 'original']
        if size not in valid_sizes:
            raise HTTPException(status_code=400, detail=f"Invalid size. Valid sizes: {', '.join(valid_sizes)}")
        
        # Construct TMDB image URL
        tmdb_image_url = f"https://image.tmdb.org/t/p/{size}/{path}"
        
        # Use httpx to fetch the image with streaming
        async with httpx.AsyncClient(timeout=30.0) as client:
            try:
                response = await client.get(tmdb_image_url, follow_redirects=True)
                response.raise_for_status()
                
                # Determine content type from response headers or default to image/jpeg
                content_type = response.headers.get("content-type", "image/jpeg")
                
                # Stream the image data
                async def generate():
                    async for chunk in response.aiter_bytes():
                        yield chunk
                
                return StreamingResponse(
                    generate(),
                    media_type=content_type,
                    headers={
                        "Cache-Control": "public, max-age=31536000",  # Cache for 1 year
                    }
                )
            except httpx.HTTPStatusError as e:
                logger.warning(f"Failed to fetch TMDB image {tmdb_image_url}: {e.response.status_code}")
                raise HTTPException(status_code=e.response.status_code, detail="Failed to fetch image from TMDB")
            except httpx.RequestError as e:
                logger.error(f"Error requesting TMDB image {tmdb_image_url}: {e}")
                raise HTTPException(status_code=502, detail="Failed to connect to TMDB image server")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Unexpected error in image proxy: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")


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


# Cache for demo report to avoid loading from disk on every request
_demo_report_cache: Optional[Dict[str, Any]] = None


@app.get("/api/demo-report")
async def get_demo_report():
    """
    Get the pre-generated demo report (1000 films).
    Returns JSON with filmsLite, filmsLiteAll, and availableYears.
    """
    global _demo_report_cache
    
    try:
        if _demo_report_cache is None:
            demo_file = Path(__file__).resolve().parent / "demo_report_1000.json"
            if not demo_file.exists():
                raise HTTPException(
                    status_code=404,
                    detail="Demo report file not found. Please generate demo_report_1000.json first."
                )
            
            with open(demo_file, "r", encoding="utf-8") as f:
                _demo_report_cache = json.load(f)
            
            # Log memory usage estimate
            import sys
            cache_size_mb = sys.getsizeof(json.dumps(_demo_report_cache)) / (1024 * 1024)
            logger.info(f"Demo report loaded into cache. Estimated size: {cache_size_mb:.2f} MB")
        
        return _demo_report_cache
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error loading demo report: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to load demo report: {str(e)}")


@app.get("/api/demo-csv")
async def get_demo_csv():
    """
    Get the demo CSV file (1000 films).
    Returns CSV file that can be processed through the full analysis pipeline.
    """
    try:
        csv_file = Path(__file__).resolve().parent / "demo_ratings_1000.csv"
        if not csv_file.exists():
            raise HTTPException(
                status_code=404,
                detail="Demo CSV file not found. Please generate demo_ratings_1000.csv first."
            )
        
        return FileResponse(
            csv_file,
            media_type="text/csv",
            filename="demo_ratings_1000.csv",
            headers={"Content-Disposition": "attachment; filename=demo_ratings_1000.csv"}
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("Error loading demo CSV: %s", e)
        raise HTTPException(status_code=500, detail=f"Failed to load demo CSV: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "10000"))
    uvicorn.run(app, host="0.0.0.0", port=port)
