import os
from typing import Dict, Optional, Tuple

import httpx


TMDB_BASE_URL = "https://api.themoviedb.org/3"


class TMDbClient:
    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.getenv("TMDB_API_KEY")
        if not self.api_key:
            raise ValueError("TMDB_API_KEY is not set")
        self._client = httpx.Client(base_url=TMDB_BASE_URL, timeout=20.0)
        self._cache: Dict[Tuple[str, int], Dict] = {}

    def _get(self, path: str, params: Optional[Dict] = None) -> Dict:
        params = params or {}
        params["api_key"] = self.api_key
        response = self._client.get(path, params=params)
        response.raise_for_status()
        return response.json()

    def search_movie(self, title: str, year: Optional[int]) -> Optional[int]:
        params = {"query": title}
        if year:
            params["year"] = year
        data = self._get("/search/movie", params=params)
        results = data.get("results") or []
        if not results:
            return None
        return results[0].get("id")

    def get_movie(self, tmdb_id: int) -> Dict:
        return self._get(f"/movie/{tmdb_id}")

    def get_keywords(self, tmdb_id: int) -> Dict:
        return self._get(f"/movie/{tmdb_id}/keywords")

    def get_credits(self, tmdb_id: int) -> Dict:
        return self._get(f"/movie/{tmdb_id}/credits")

    def get_enriched(self, title: str, year: Optional[int]) -> Dict:
        cache_key = (title.lower().strip(), year or 0)
        if cache_key in self._cache:
            return self._cache[cache_key]

        tmdb_id = self.search_movie(title, year)
        if not tmdb_id:
            enriched = {
                "tmdb_id": None,
                "poster_path": None,
                "genres": [],
                "keywords": [],
                "directors": [],
                "actors": [],
                "countries": [],
                "runtime": None,
                "original_language": None,
            }
            self._cache[cache_key] = enriched
            return enriched

        movie = self.get_movie(tmdb_id)
        keywords_data = self.get_keywords(tmdb_id)
        credits_data = self.get_credits(tmdb_id)
        keywords = [k.get("name") for k in keywords_data.get("keywords", []) if k.get("name")]
        genres = [g.get("name") for g in movie.get("genres", []) if g.get("name")]
        directors = [
            crew.get("name")
            for crew in credits_data.get("crew", [])
            if crew.get("job") == "Director" and crew.get("name")
        ]
        actors = [
            cast.get("name")
            for cast in credits_data.get("cast", [])
            if cast.get("name")
        ][:8]
        countries = [
            country.get("name")
            for country in movie.get("production_countries", [])
            if country.get("name")
        ]

        enriched = {
            "tmdb_id": tmdb_id,
            "poster_path": movie.get("poster_path"),
            "genres": genres,
            "keywords": keywords,
            "directors": directors,
            "actors": actors,
            "countries": countries,
            "runtime": movie.get("runtime"),
            "original_language": movie.get("original_language"),
        }
        self._cache[cache_key] = enriched
        return enriched

    def close(self) -> None:
        self._client.close()
