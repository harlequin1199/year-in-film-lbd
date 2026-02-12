"""
Batch TMDB movie details, credits, and keywords endpoints.
Handles multiple requests with rate limiting, retry, and caching.
"""
import asyncio
import logging
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
from collections import deque
import time
_request_times: deque = deque()
_rate_lock = asyncio.Lock()


async def _rate_limit() -> None:
    """Wait if needed to respect rate limit (RATE_LIMIT_PER_SECOND)."""
    async with _rate_lock:
        now = time.time()
        while _request_times and _request_times[0] < now - 1.0:
            _request_times.popleft()
        if len(_request_times) >= RATE_LIMIT_PER_SECOND:
            wait_time = 1.0 - (now - _request_times[0])
            if wait_time > 0:
                await asyncio.sleep(wait_time)
                now = time.time()
                while _request_times and _request_times[0] < now - 1.0:
                    _request_times.popleft()
        _request_times.append(time.time())


async def _get_movie_details(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Get movie details. Returns (movie_data, error)."""
    try:
        cached = await asyncio.to_thread(cache_module.get_movie, tmdb_id)
        if cached:
            logger.debug("Cache hit for movie %s", tmdb_id)
            return cached, None
    except Exception as e:
        logger.warning("Cache read error for movie %s: %s", tmdb_id, e)
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                logger.debug("Fetching movie details for TMDB ID %s, attempt %s", tmdb_id, attempt + 1)
                response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                    params={"api_key": api_key},
                    timeout=20.0,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        return None, f"TMDb error {response.status_code}"
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    await asyncio.sleep(delay)
                    continue
                response.raise_for_status()
                movie_data = response.json()
                
                try:
                    await asyncio.to_thread(cache_module.set_movie, tmdb_id, movie_data)
                except Exception as e:
                    logger.warning("Cache write error for movie %s: %s", tmdb_id, e)
                
                return movie_data, None
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                return None, f"HTTP {e.response.status_code}"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                return None, str(e)
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    return None, "Max retries exceeded"


async def _get_movie_credits(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    """Get movie credits. Returns ({directors, actors}, error)."""
    try:
        cached = await asyncio.to_thread(cache_module.get_credits, tmdb_id)
        if cached:
            logger.debug("Cache hit for credits %s", tmdb_id)
            return cached, None
    except Exception:
        pass
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}/credits",
                    params={"api_key": api_key},
                    timeout=20.0,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        return None, f"TMDb error {response.status_code}"
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    await asyncio.sleep(delay)
                    continue
                response.raise_for_status()
                data = response.json()
                directors = [c.get("name") for c in data.get("crew", []) if c.get("job") == "Director" and c.get("name")]
                actors = [c.get("name") for c in data.get("cast", [])[:20] if c.get("name")]
                credits_data = {"directors": directors, "actors": actors}
                
                try:
                    await asyncio.to_thread(cache_module.set_credits, tmdb_id, credits_data)
                except Exception:
                    pass
                
                return credits_data, None
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                return None, f"HTTP {e.response.status_code}"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                return None, str(e)
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    return None, "Max retries exceeded"


async def _get_movie_keywords(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[List[str]], Optional[str]]:
    """Get movie keywords. Returns (keywords_list, error)."""
    try:
        cached = await asyncio.to_thread(cache_module.get_keywords, tmdb_id)
        if cached:
            logger.debug("Cache hit for keywords %s", tmdb_id)
            return cached, None
    except Exception:
        pass
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}/keywords",
                    params={"api_key": api_key},
                    timeout=20.0,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        return None, f"TMDb error {response.status_code}"
                    delay = RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)]
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    await asyncio.sleep(delay)
                    continue
                response.raise_for_status()
                data = response.json()
                keywords = [k.get("name") for k in data.get("keywords", [])[:20] if k.get("name")]
                
                try:
                    await asyncio.to_thread(cache_module.set_keywords, tmdb_id, keywords)
                except Exception:
                    pass
                
                return keywords, None
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                return None, f"HTTP {e.response.status_code}"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                return None, str(e)
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    return None, "Max retries exceeded"


async def movies_batch(
    tmdb_ids: List[int],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Process batch of movie details requests."""
    if not tmdb_ids:
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=30.0),
        trust_env=False,
    ) as client:
        tasks = [
            _get_movie_details(client, api_key, tmdb_id, semaphore)
            for tmdb_id in tmdb_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            formatted_results.append({
                "tmdb_id": tmdb_ids[i],
                "movie": None,
                "error": str(result),
            })
        else:
            movie_data, error = result
            if error:
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "movie": None,
                    "error": error,
                })
            else:
                release_date = movie_data.get("release_date") or "" if movie_data else ""
                release_year = None
                if release_date and len(release_date) >= 4:
                    try:
                        release_year = int(release_date[:4])
                    except ValueError:
                        pass
                
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "movie": {
                        "id": movie_data.get("id") if movie_data else tmdb_ids[i],
                        "poster_path": movie_data.get("poster_path") if movie_data else None,
                        "genres": [g.get("name") for g in movie_data.get("genres", []) if g.get("name")] if movie_data else [],
                        "runtime": movie_data.get("runtime") if movie_data else None,
                        "vote_average": movie_data.get("vote_average") if movie_data else None,
                        "vote_count": movie_data.get("vote_count") or 0 if movie_data else 0,
                        "original_language": movie_data.get("original_language") if movie_data else None,
                        "production_countries": [
                            c.get("name") for c in movie_data.get("production_countries", []) if c.get("name")
                        ] if movie_data else [],
                        "release_date": release_date,
                    },
                    "error": None,
                })
    
    return formatted_results


async def credits_batch(
    tmdb_ids: List[int],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Process batch of credits requests."""
    if not tmdb_ids:
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=30.0),
        trust_env=False,
    ) as client:
        tasks = [
            _get_movie_credits(client, api_key, tmdb_id, semaphore)
            for tmdb_id in tmdb_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            formatted_results.append({
                "tmdb_id": tmdb_ids[i],
                "credits": None,
                "error": str(result),
            })
        else:
            credits_data, error = result
            if error:
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "credits": None,
                    "error": error,
                })
            else:
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "credits": credits_data,
                    "error": None,
                })
    
    return formatted_results


async def keywords_batch(
    tmdb_ids: List[int],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Process batch of keywords requests."""
    if not tmdb_ids:
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=10, keepalive_expiry=30.0),
        trust_env=False,
    ) as client:
        tasks = [
            _get_movie_keywords(client, api_key, tmdb_id, semaphore)
            for tmdb_id in tmdb_ids
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)
    
    formatted_results = []
    for i, result in enumerate(results):
        if isinstance(result, Exception):
            formatted_results.append({
                "tmdb_id": tmdb_ids[i],
                "keywords": None,
                "error": str(result),
            })
        else:
            keywords, error = result
            if error:
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "keywords": None,
                    "error": error,
                })
            else:
                formatted_results.append({
                    "tmdb_id": tmdb_ids[i],
                    "keywords": keywords or [],
                    "error": None,
                })
    
    return formatted_results
