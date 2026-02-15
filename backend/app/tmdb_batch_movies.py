"""
Batch TMDB movie details, credits, and keywords endpoints.
Handles multiple requests with rate limiting, retry, and caching.
"""
import asyncio
import logging
from typing import Any, Dict, List, Optional, Tuple

import httpx

from . import cache as cache_module

logger = logging.getLogger(__name__)

import platform

TMDB_BASE_URL = "https://api.themoviedb.org/3"
# TMDb docs: no strict limit, upper bound ~40 req/s. Using 40 for maximum speed.
# Reduced concurrency on Windows to avoid file descriptor limit in select()
MAX_CONCURRENCY = 4 if platform.system() == 'Windows' else 8
RATE_LIMIT_PER_SECOND = 40.0
MAX_RETRIES = 3
RETRY_DELAYS = (0.5, 1.0, 2.0)

# Rate limiter: track request timestamps
from collections import deque
import time
_request_times: deque = deque()
_rate_lock = asyncio.Lock()

def _named_values(items: Any) -> List[str]:
    """Extract non-empty `name` fields from a list of dict-like items."""
    if not isinstance(items, list):
        return []
    values: List[str] = []
    for item in items:
        if isinstance(item, dict):
            name = item.get("name")
            if name:
                values.append(name)
    return values


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
    include_credits_keywords: bool = False,
) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """Get movie details. Returns (movie_data, error, cache_status).
    
    If include_credits_keywords is True, uses append_to_response to get credits and keywords in one request.
    """
    cache_start = time.time()
    try:
        cached = await asyncio.to_thread(cache_module.get_movie, tmdb_id)
        cache_duration = (time.time() - cache_start) * 1000
        if cached:
            logger.debug("Movie %s: cached (%.2f ms)", tmdb_id, cache_duration)
            return cached, None, "cached"
    except Exception as e:
        cache_duration = (time.time() - cache_start) * 1000
        logger.warning("Cache read error for movie %s: %s (%.2f ms)", tmdb_id, e, cache_duration)
    
    api_start = time.time()
    params = {"api_key": api_key}
    if include_credits_keywords:
        params["append_to_response"] = "credits,keywords"
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                logger.debug("Fetching movie details for TMDB ID %s, attempt %s", tmdb_id, attempt + 1)
                response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                    params=params,
                    timeout=20.0,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        api_duration = (time.time() - api_start) * 1000
                        logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                        return None, f"TMDb error {response.status_code}", "api_error"
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
                api_duration = (time.time() - api_start) * 1000
                
                try:
                    await asyncio.to_thread(cache_module.set_movie, tmdb_id, movie_data)
                except Exception as e:
                    logger.warning("Cache write error for movie %s: %s", tmdb_id, e)
                
                logger.debug("Movie %s: api (%.2f ms)", tmdb_id, api_duration)
                return movie_data, None, "api"
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, f"HTTP {e.response.status_code}", "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, str(e), "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    api_duration = (time.time() - api_start) * 1000
    logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
    return None, "Max retries exceeded", "api_error"


async def _get_movie_details_with_credits_keywords(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]], Optional[List[str]], Optional[str], Optional[str]]:
    """Get movie details with credits and keywords in one request using append_to_response.
    Returns (movie_data, credits_data, keywords_data, error, cache_status).
    """
    cache_start = time.time()
    # Check cache for all three types
    cached_movie = None
    cached_credits = None
    cached_keywords = None
    try:
        cached_movie = await asyncio.to_thread(cache_module.get_movie, tmdb_id)
        cached_credits = await asyncio.to_thread(cache_module.get_credits, tmdb_id)
        cached_keywords = await asyncio.to_thread(cache_module.get_keywords, tmdb_id)
        cache_duration = (time.time() - cache_start) * 1000
        if cached_movie and cached_credits and cached_keywords:
            logger.debug("Movie %s: all cached (%.2f ms)", tmdb_id, cache_duration)
            # Format credits and keywords to match API response format
            credits_data = cached_credits if isinstance(cached_credits, dict) else None
            keywords_data = cached_keywords if isinstance(cached_keywords, list) else None
            return cached_movie, credits_data, keywords_data, None, "cached"
    except Exception as e:
        cache_duration = (time.time() - cache_start) * 1000
        logger.warning("Cache read error for movie %s: %s (%.2f ms)", tmdb_id, e, cache_duration)
    
    # If any data is missing, fetch all via append_to_response
    api_start = time.time()
    params = {"api_key": api_key, "append_to_response": "credits,keywords"}
    
    for attempt in range(MAX_RETRIES + 1):
        try:
            await _rate_limit()
            async with semaphore:
                logger.debug("Fetching movie details with credits/keywords for TMDB ID %s, attempt %s", tmdb_id, attempt + 1)
                response = await client.get(
                    f"{TMDB_BASE_URL}/movie/{tmdb_id}",
                    params=params,
                    timeout=20.0,
                )
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        api_duration = (time.time() - api_start) * 1000
                        logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                        return None, None, None, f"TMDb error {response.status_code}", "api_error"
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
                api_duration = (time.time() - api_start) * 1000
                
                # Extract movie data (main response)
                movie_data = {k: v for k, v in data.items() if k not in ["credits", "keywords"]}
                
                # Extract credits data
                credits_raw = data.get("credits")
                credits_data = None
                if credits_raw:
                    directors = [c.get("name") for c in credits_raw.get("crew", []) if c.get("job") == "Director" and c.get("name")]
                    actors = [c.get("name") for c in credits_raw.get("cast", [])[:20] if c.get("name")]
                    credits_data = {"directors": directors, "actors": actors}
                
                # Extract keywords data
                keywords_raw = data.get("keywords")
                keywords_data = None
                if keywords_raw and isinstance(keywords_raw, dict):
                    keywords_data = [kw.get("name") for kw in keywords_raw.get("keywords", []) if kw.get("name")]
                elif isinstance(keywords_raw, list):
                    keywords_data = [kw.get("name") if isinstance(kw, dict) else kw for kw in keywords_raw if kw]
                
                # Cache all three types
                try:
                    await asyncio.to_thread(cache_module.set_movie, tmdb_id, movie_data)
                    if credits_data:
                        await asyncio.to_thread(cache_module.set_credits, tmdb_id, credits_data)
                    if keywords_data:
                        await asyncio.to_thread(cache_module.set_keywords, tmdb_id, keywords_data)
                except Exception as e:
                    logger.warning("Cache write error for movie %s: %s", tmdb_id, e)
                
                logger.debug("Movie %s: api with credits/keywords (%.2f ms)", tmdb_id, api_duration)
                return movie_data, credits_data, keywords_data, None, "api"
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, None, None, f"HTTP {e.response.status_code}", "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, None, None, str(e), "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    api_duration = (time.time() - api_start) * 1000
    logger.debug("Movie %s: api error (%.2f ms)", tmdb_id, api_duration)
    return None, None, None, "Max retries exceeded", "api_error"


async def _get_movie_credits(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[Dict[str, Any]], Optional[str], Optional[str]]:
    """Get movie credits. Returns ({directors, actors}, error, cache_status)."""
    cache_start = time.time()
    try:
        cached = await asyncio.to_thread(cache_module.get_credits, tmdb_id)
        cache_duration = (time.time() - cache_start) * 1000
        if cached:
            logger.debug("Credits %s: cached (%.2f ms)", tmdb_id, cache_duration)
            return cached, None, "cached"
    except Exception:
        cache_duration = (time.time() - cache_start) * 1000
        pass
    
    api_start = time.time()
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
                        api_duration = (time.time() - api_start) * 1000
                        logger.debug("Credits %s: api error (%.2f ms)", tmdb_id, api_duration)
                        return None, f"TMDb error {response.status_code}", "api_error"
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
                api_duration = (time.time() - api_start) * 1000
                
                try:
                    await asyncio.to_thread(cache_module.set_credits, tmdb_id, credits_data)
                except Exception:
                    pass
                
                logger.debug("Credits %s: api (%.2f ms)", tmdb_id, api_duration)
                return credits_data, None, "api"
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Credits %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, f"HTTP {e.response.status_code}", "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Credits %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, str(e), "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    api_duration = (time.time() - api_start) * 1000
    logger.debug("Credits %s: api error (%.2f ms)", tmdb_id, api_duration)
    return None, "Max retries exceeded", "api_error"


async def _get_movie_keywords(
    client: httpx.AsyncClient,
    api_key: str,
    tmdb_id: int,
    semaphore: asyncio.Semaphore,
) -> Tuple[Optional[List[str]], Optional[str], Optional[str]]:
    """Get movie keywords. Returns (keywords_list, error, cache_status)."""
    cache_start = time.time()
    try:
        cached = await asyncio.to_thread(cache_module.get_keywords, tmdb_id)
        cache_duration = (time.time() - cache_start) * 1000
        if cached:
            logger.debug("Keywords %s: cached (%.2f ms)", tmdb_id, cache_duration)
            return cached, None, "cached"
    except Exception:
        cache_duration = (time.time() - cache_start) * 1000
        pass
    
    api_start = time.time()
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
                        api_duration = (time.time() - api_start) * 1000
                        logger.debug("Keywords %s: api error (%.2f ms)", tmdb_id, api_duration)
                        return None, f"TMDb error {response.status_code}", "api_error"
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
                api_duration = (time.time() - api_start) * 1000
                
                try:
                    await asyncio.to_thread(cache_module.set_keywords, tmdb_id, keywords)
                except Exception:
                    pass
                
                logger.debug("Keywords %s: api (%.2f ms)", tmdb_id, api_duration)
                return keywords, None, "api"
        except httpx.HTTPStatusError as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Keywords %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, f"HTTP {e.response.status_code}", "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
        except (httpx.RequestError, httpx.HTTPError) as e:
            if attempt >= MAX_RETRIES:
                api_duration = (time.time() - api_start) * 1000
                logger.debug("Keywords %s: api error (%.2f ms)", tmdb_id, api_duration)
                return None, str(e), "api_error"
            await asyncio.sleep(RETRY_DELAYS[min(attempt, len(RETRY_DELAYS) - 1)])
    
    api_duration = (time.time() - api_start) * 1000
    logger.debug("Keywords %s: api error (%.2f ms)", tmdb_id, api_duration)
    return None, "Max retries exceeded", "api_error"


async def movies_batch(
    tmdb_ids: List[int],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Process batch of movie details requests."""
    if not tmdb_ids:
        return []
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    # Reduce keepalive connections on Windows to avoid file descriptor limit
    max_keepalive = 5 if platform.system() == 'Windows' else 10
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=max_keepalive, keepalive_expiry=30.0, max_connections=100),
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
            movie_data, error, cache_status = result
            
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
                            "genres": _named_values(movie_data.get("genres", [])) if movie_data else [],
                            "runtime": movie_data.get("runtime") if movie_data else None,
                            "vote_average": movie_data.get("vote_average") if movie_data else None,
                            "vote_count": movie_data.get("vote_count") or 0 if movie_data else 0,
                            "original_language": movie_data.get("original_language") if movie_data else None,
                            "production_countries": _named_values(movie_data.get("production_countries", [])) if movie_data else [],
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
    
    # Reduce keepalive connections on Windows to avoid file descriptor limit
    max_keepalive = 5 if platform.system() == 'Windows' else 10
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=max_keepalive, keepalive_expiry=30.0, max_connections=100),
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
            credits_data, error, cache_status = result
            
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
    
    # Reduce keepalive connections on Windows to avoid file descriptor limit
    max_keepalive = 5 if platform.system() == 'Windows' else 10
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=max_keepalive, keepalive_expiry=30.0, max_connections=100),
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
            keywords, error, cache_status = result
            
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


async def full_batch(
    tmdb_ids: List[int],
    api_key: str,
) -> List[Dict[str, Any]]:
    """Process batch of full movie metadata (details + credits + keywords) in parallel."""
    if not tmdb_ids:
        return []
    
    # Batch cache read is an optimization. If it fails, continue with API path.
    try:
        cached_movies = await asyncio.to_thread(cache_module.get_movie_batch, tmdb_ids)
        cached_credits = await asyncio.to_thread(cache_module.get_credits_batch, tmdb_ids)
        cached_keywords = await asyncio.to_thread(cache_module.get_keywords_batch, tmdb_ids)
    except Exception as exc:
        logger.warning("Batch cache read failed in full_batch: %s", exc)
        cached_movies = {}
        cached_credits = {}
        cached_keywords = {}

    if not isinstance(cached_movies, dict):
        cached_movies = {}
    if not isinstance(cached_credits, dict):
        cached_credits = {}
    if not isinstance(cached_keywords, dict):
        cached_keywords = {}
    
    # Determine which IDs need API calls
    # Use unified approach: if ANY data is missing, fetch all via append_to_response
    ids_needing_api = set()
    for tid in tmdb_ids:
        if (cached_movies.get(tid) is None or 
            cached_credits.get(tid) is None or 
            cached_keywords.get(tid) is None):
            ids_needing_api.add(tid)
    
    ids_for_api = list(ids_needing_api)
    
    semaphore = asyncio.Semaphore(MAX_CONCURRENCY)
    
    # Reduce keepalive connections on Windows to avoid file descriptor limit
    max_keepalive = 5 if platform.system() == 'Windows' else 10
    
    async with httpx.AsyncClient(
        base_url=TMDB_BASE_URL,
        timeout=30.0,
        limits=httpx.Limits(max_keepalive_connections=max_keepalive, keepalive_expiry=30.0, max_connections=100),
        trust_env=False,
    ) as client:
        # Create tasks using append_to_response to get movie + credits + keywords in one request
        unified_tasks = [
            _get_movie_details_with_credits_keywords(client, api_key, tmdb_id, semaphore)
            for tmdb_id in ids_for_api
        ]
        
        # Execute all unified API calls in parallel
        unified_results = await asyncio.gather(*unified_tasks, return_exceptions=True) if unified_tasks else []
    
    # Build result maps from API calls
    api_movies = {}
    api_credits = {}
    api_keywords = {}
    
    for i, result in enumerate(unified_results):
        if not isinstance(result, Exception):
            movie_data, credits_data, keywords_data, error, cache_status = result
            tmdb_id = ids_for_api[i]
            if not error:
                if movie_data:
                    api_movies[tmdb_id] = movie_data
                if credits_data:
                    api_credits[tmdb_id] = credits_data
                if keywords_data:
                    api_keywords[tmdb_id] = keywords_data
    
    # Merge cached and API results
    all_movies = {**cached_movies, **api_movies}
    all_credits = {**cached_credits, **api_credits}
    all_keywords = {**cached_keywords, **api_keywords}
    
    # Format results
    formatted_results = []
    for tmdb_id in tmdb_ids:
        movie_data = all_movies.get(tmdb_id)
        credits_data = all_credits.get(tmdb_id)
        keywords_data = all_keywords.get(tmdb_id)
        
        result = {
            "tmdb_id": tmdb_id,
            "movie": None,
            "credits": None,
            "keywords": None,
            "error": None,
        }
        
        if movie_data:
            release_date = movie_data.get("release_date") or ""
            result["movie"] = {
                "id": movie_data.get("id") if movie_data else tmdb_id,
                "poster_path": movie_data.get("poster_path") if movie_data else None,
                "genres": _named_values(movie_data.get("genres", [])) if movie_data else [],
                "runtime": movie_data.get("runtime") if movie_data else None,
                "vote_average": movie_data.get("vote_average") if movie_data else None,
                "vote_count": movie_data.get("vote_count") or 0 if movie_data else 0,
                "original_language": movie_data.get("original_language") if movie_data else None,
                "production_countries": _named_values(movie_data.get("production_countries", [])) if movie_data else [],
                "release_date": release_date,
            }
        
        if credits_data:
            result["credits"] = credits_data
        
        if keywords_data:
            result["keywords"] = keywords_data if isinstance(keywords_data, list) else []
        
        formatted_results.append(result)
    
    return formatted_results
