"""
Batch TMDB search endpoint implementation.
Handles multiple search requests with rate limiting, retry, and caching.
"""
import asyncio
import logging
import os
import time
from collections import deque
from typing import Any, Dict, List, Optional, Tuple

import httpx

import cache as cache_module

logger = logging.getLogger(__name__)

TMDB_BASE_URL = "https://api.themoviedb.org/3"
# TMDb docs: no strict limit, upper bound ~40 req/s. Using 40 for maximum speed.
MAX_CONCURRENCY = 8
RATE_LIMIT_PER_SECOND = 40.0
MAX_RETRIES = 3
RETRY_DELAYS = (0.5, 1.0, 2.0)

# Rate limiter: track request timestamps
_request_times: deque = deque()
_rate_lock = asyncio.Lock()


async def _rate_limit() -> None:
    """Wait if needed to respect rate limit (RATE_LIMIT_PER_SECOND)."""
    async with _rate_lock:
        now = time.time()
        # Remove timestamps older than 1 second
        while _request_times and _request_times[0] < now - 1.0:
            _request_times.popleft()
        # If we have 6+ requests in the last second, wait
        if len(_request_times) >= RATE_LIMIT_PER_SECOND:
            wait_time = 1.0 - (now - _request_times[0])
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                # Clean up again after wait
                now = time.time()
                while _request_times and _request_times[0] < now - 1.0:
                    _request_times.popleft()
        _request_times.append(time.time())


def _normalize_title(title: str) -> str:
    """Normalize title for cache key."""
    return title.strip().lower()


async def _search_single(
    client: httpx.AsyncClient,
    api_key: str,
    title: str,
    year: Optional[int],
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[int], Optional[Dict[str, Any]], Optional[str]]:
    """
    Search for a single movie. Returns (tmdb_id, movie_data, error).
    Uses cache first, then TMDB API with retry/backoff.
    """
    title_norm = _normalize_title(title)
    year_val = year or 0
    
    # Check cache first
    try:
        tmdb_id = await asyncio.to_thread(cache_module.get_search, title_norm, year)
        if tmdb_id is not None:
            movie_data = await asyncio.to_thread(cache_module.get_movie, tmdb_id)
            if movie_data:
                logger.debug("Cache hit for %s (%s)", title, year)
                return tmdb_id, movie_data, None
    except Exception as e:
        logger.warning("Cache read error for %s: %s", title, e)
    
    # Not in cache, fetch from TMDB
    params = {"api_key": api_key, "query": title}
    if year:
        params["year"] = year
    
    tmdb_id = None
    movie_data = None
    
    # Search for movie
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                logger.debug("Searching TMDB for %s (%s), attempt %s", title, year, attempt + 1)
                response = await client.get(
                    f"{TMDB_BASE_URL}/search/movie",
                    params=params,
                    timeout=20.0,
                )
                
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        return None, None, f"TMDb error {response.status_code}"
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    logger.warning(
                        "TMDb rate-limit/error %s for %s, retry %s/%s in %.1fs",
                        response.status_code,
                        title,
                        attempt + 1,
                        MAX_RETRIES,
                        delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                
                response.raise_for_status()
                data = response.json()
                results = data.get("results") or []
                
                if not results:
                    tmdb_id = None
                    break
                else:
                    first = results[0]
                    tmdb_id = first.get("id")
                    break
                    
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                return None, None, f"HTTP {e.response.status_code}"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                return None, None, str(e)
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    if tmdb_id is None:
        # Cache negative result
        try:
            await asyncio.to_thread(cache_module.set_search, title_norm, year, None)
        except Exception:
            pass
        return None, None, None
    
    # Fetch movie details
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                logger.debug("Fetching movie details for TMDB ID %s, attempt %s", tmdb_id, attempt + 1)
                movie_response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                    params={"api_key": api_key},
                    timeout=20.0,
                )
                if movie_response.status_code == 429 or movie_response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        return tmdb_id, None, f"TMDb error {movie_response.status_code}"
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    retry_after = movie_response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    await asyncio.sleep(delay)
                    continue
                movie_response.raise_for_status()
                movie_data = movie_response.json()
                break
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                return tmdb_id, None, f"HTTP {e.response.status_code}"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                return tmdb_id, None, str(e)
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    # Cache results
    try:
        await asyncio.to_thread(cache_module.set_search, title_norm, year, tmdb_id)
        if movie_data:
            await asyncio.to_thread(cache_module.set_movie, tmdb_id, movie_data)
    except Exception as e:
        logger.warning("Cache write error for %s: %s", title, e)
    
    return tmdb_id, movie_data, None


def _format_result(
    title: str,
    year: Optional[int],
    tmdb_id: Optional[int],
    movie_data: Optional[Dict[str, Any]],
    error: Optional[str],
) -> Dict[str, Any]:
    """Format result in the expected format."""
    if error:
        return {
            "title": title,
            "year": year,
            "tmdb": None,
            "error": error,
        }
    
    if not tmdb_id or not movie_data:
        return {
            "title": title,
            "year": year,
            "tmdb": None,
            "error": None,
        }
    
    # Extract relevant fields
    release_date = movie_data.get("release_date") or ""
    release_year = None
    if release_date and len(release_date) >= 4:
        try:
            release_year = int(release_date[:4])
        except ValueError:
            pass
    
    tmdb_result = {
        "tmdb_id": tmdb_id,
        "title": movie_data.get("title"),
        "year": release_year,
        "poster_path": movie_data.get("poster_path"),
        "vote_average": movie_data.get("vote_average"),
        "vote_count": movie_data.get("vote_count") or 0,
        "genres": [g.get("name") for g in movie_data.get("genres", []) if g.get("name")],
        "runtime": movie_data.get("runtime"),
        "production_countries": [
            c.get("name") for c in movie_data.get("production_countries", []) if c.get("name")
        ],
        "original_language": movie_data.get("original_language"),
        "release_date": release_date,
    }
    
    return {
        "title": title,
        "year": year,
        "tmdb": tmdb_result,
        "error": None,
    }


async def search_batch(
    items: List[Dict[str, Any]],
    api_key: str,
) -> List[Dict[str, Any]]:
    """
    Process batch of search requests.
    
    Args:
        items: List of {title: str, year: int|None}
        api_key: TMDB API key
    
    Returns:
        List of {title, year, tmdb: {...}, error: str|None}
    """
    if not items:
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=30.0),
        trust_env=False,
    ) as client:
        tasks = [
            _search_single(client, api_key, item["title"], item.get("year"), semaphore)
            for item in items
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            formatted_results.append({
                "title": items[i]["title"],
                "year": items[i].get("year"),
                "tmdb": None,
                "error": str(result),
            })
        else:
            tmdb_id, movie_data, error = result
            formatted_results.append(
                _format_result(
                    items[i]["title"],
                    items[i].get("year"),
                    tmdb_id,
                    movie_data,
                    error,
                )
            )
    
    return formatted_results
