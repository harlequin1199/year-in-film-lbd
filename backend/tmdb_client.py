"""
Async TMDb client with:
- Single request per movie via append_to_response=keywords,credits
- Concurrency limit (semaphore)
- Retry with exponential backoff on 429/5xx
- Optional in-memory (per-job) and persistent (SQLite) caching
"""
import asyncio
import logging
import os
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)

import cache as cache_module

TMDB_BASE_URL = "https://api.themoviedb.org/3"
DEFAULT_CONCURRENCY = 10
RETRY_DELAYS = (0.5, 1.0, 2.0, 4.0, 8.0)
MAX_RETRIES = 5


class TMDbClient:
    def __init__(
        self,
        api_key: Optional[str] = None,
        *,
        job_search_cache: Optional[Dict[Tuple[str, int], Optional[int]]] = None,
        job_movie_cache: Optional[Dict[int, Dict]] = None,
        cache_backend: Any = None,
        max_concurrency: int = DEFAULT_CONCURRENCY,
    ) -> None:
        self.api_key = api_key or os.getenv("TMDB_API_KEY")
        if not self.api_key:
            raise ValueError("TMDB_API_KEY is not set")
        self._job_search = job_search_cache if job_search_cache is not None else {}
        self._job_movie = job_movie_cache if job_movie_cache is not None else {}
        self._cache = cache_backend if cache_backend is not None else cache_module
        self._semaphore = asyncio.Semaphore(max_concurrency)
        self._client: Optional[httpx.AsyncClient] = None

    async def _get_client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                base_url=TMDB_BASE_URL,
                timeout=20.0,
                limits=httpx.Limits(max_keepalive_connections=20, keepalive_expiry=30.0),
                trust_env=False,
            )
        return self._client

    async def _get(
        self,
        path: str,
        params: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        client = await self._get_client()
        params = dict(params or {})
        params["api_key"] = self.api_key

        for attempt in range(MAX_RETRIES + 1):
            try:
                response = await client.get(path, params=params)
                if response.status_code == 429 or response.status_code >= 500:
                    if attempt >= MAX_RETRIES:
                        response.raise_for_status()
                    delay = RETRY_DELAYS[attempt]
                    retry_after = response.headers.get("Retry-After")
                    if retry_after:
                        try:
                            delay = float(retry_after)
                        except ValueError:
                            pass
                    logger.warning(
                        "TMDb rate-limit/error %s for %s, retry %s/%s in %.1fs",
                        response.status_code, path, attempt + 1, MAX_RETRIES, delay,
                    )
                    await asyncio.sleep(delay)
                    continue
                response.raise_for_status()
                return response.json()
            except httpx.HTTPStatusError:
                raise
            except (httpx.RequestError, httpx.HTTPError) as e:
                if attempt >= MAX_RETRIES:
                    raise
                await asyncio.sleep(RETRY_DELAYS[attempt])

        raise httpx.HTTPError("Max retries exceeded")

    async def search_movie(self, title: str, year: Optional[int]) -> Optional[int]:
        cache_key = (title.strip().lower(), year or 0)
        if cache_key in self._job_search:
            return self._job_search[cache_key]

        tmdb_id = await asyncio.to_thread(
            self._cache.get_search,
            title,
            year,
        )
        if tmdb_id is not None:
            self._job_search[cache_key] = tmdb_id
            return tmdb_id

        async with self._semaphore:
            params = {"query": title}
            if year:
                params["year"] = year
            data = await self._get("search/movie", params=params)
        results = data.get("results") or []
        if not results:
            tmdb_id = None
        else:
            tmdb_id = results[0].get("id")

        self._job_search[cache_key] = tmdb_id
        await asyncio.to_thread(
            self._cache.set_search,
            title,
            year,
            tmdb_id,
        )
        return tmdb_id

    async def get_movie_details(self, tmdb_id: int) -> Dict[str, Any]:
        if tmdb_id in self._job_movie:
            return self._job_movie[tmdb_id]

        payload = await asyncio.to_thread(self._cache.get_movie, tmdb_id)
        if payload is not None:
            self._job_movie[tmdb_id] = payload
            return payload

        async with self._semaphore:
            payload = await self._get(
                f"movie/{tmdb_id}",
                params={"append_to_response": "keywords,credits"},
            )

        self._job_movie[tmdb_id] = payload
        await asyncio.to_thread(self._cache.set_movie, tmdb_id, payload)
        return payload

    def _enriched_from_payload(self, tmdb_id: int, movie: Dict[str, Any]) -> Dict:
        keywords_data = movie.get("keywords") or {}
        credits_data = movie.get("credits") or {}
        keywords = [
            k.get("name")
            for k in keywords_data.get("keywords", [])
            if k.get("name")
        ]
        genres = [g.get("name") for g in movie.get("genres", []) if g.get("name")]
        directors = [
            c.get("name")
            for c in credits_data.get("crew", [])
            if c.get("job") == "Director" and c.get("name")
        ]
        actors = [
            c.get("name")
            for c in credits_data.get("cast", [])
            if c.get("name")
        ][:8]
        countries = [
            c.get("name")
            for c in movie.get("production_countries", [])
            if c.get("name")
        ]
        vote_average = movie.get("vote_average")
        vote_count = movie.get("vote_count") or 0
        return {
            "tmdb_id": tmdb_id,
            "poster_path": movie.get("poster_path"),
            "vote_average": vote_average,
            "vote_count": vote_count,
            "genres": genres,
            "keywords": keywords,
            "directors": directors,
            "actors": actors,
            "countries": countries,
            "runtime": movie.get("runtime"),
            "original_language": movie.get("original_language"),
        }

    async def get_enriched(self, title: str, year: Optional[int]) -> Dict:
        tmdb_id = await self.search_movie(title, year)
        if tmdb_id is None:
            return {
                "tmdb_id": None,
                "poster_path": None,
                "vote_average": None,
                "vote_count": 0,
                "genres": [],
                "keywords": [],
                "directors": [],
                "actors": [],
                "countries": [],
                "runtime": None,
                "original_language": None,
            }

        movie = await self.get_movie_details(tmdb_id)
        return self._enriched_from_payload(tmdb_id, movie)

    async def close(self) -> None:
        if self._client and not self._client.is_closed:
            await self._client.aclose()
            self._client = None
