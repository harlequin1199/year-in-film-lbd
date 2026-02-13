"""
Calculate approximate global genre frequency using TMDb API.

For each movie genre, fetches TMDb discover counts and computes:
- total_results (count of movies in TMDb with that genre)
- relative share among the listed genres (normalized %)
"""
import os
import time
from pathlib import Path
from typing import Dict, List, Tuple

import pandas as pd
import requests
from dotenv import load_dotenv

# Load .env from backend dir when running locally; production uses env vars
_env_path = Path(__file__).resolve().parent.parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()

TMDB_BASE_URL = "https://api.themoviedb.org/3"
REQUEST_DELAY = 0.25  # 250ms delay between requests

# Genre mapping: English -> Russian
GENRE_MAPPING = {
    "Action": "Боевик",
    "Adventure": "Приключения",
    "Animation": "Мультфильм",
    "Comedy": "Комедия",
    "Crime": "Криминал",
    "Documentary": "Документальный",
    "Drama": "Драма",
    "Family": "Семейный",
    "Fantasy": "Фэнтези",
    "History": "История",
    "Horror": "Ужасы",
    "Music": "Музыка",
    "Mystery": "Детектив",
    "Romance": "Мелодрама",
    "Science Fiction": "Научная фантастика",
    "TV Movie": "Телефильм",
    "Thriller": "Триллер",
    "War": "Военный",
    "Western": "Вестерн",
}

# Predefined genre list (English names)
GENRES = [
    "Action",
    "Adventure",
    "Animation",
    "Comedy",
    "Crime",
    "Documentary",
    "Drama",
    "Family",
    "Fantasy",
    "History",
    "Horror",
    "Music",
    "Mystery",
    "Romance",
    "Science Fiction",
    "TV Movie",
    "Thriller",
    "War",
    "Western",
]


def get_api_key() -> str:
    """Get TMDb API key from environment variable."""
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        raise ValueError("TMDB_API_KEY environment variable is not set")
    return api_key


def fetch_genre_list(api_key: str) -> Dict[str, int]:
    """
    Fetch genre list from TMDb API.
    
    Returns:
        Dictionary mapping genre name (EN) to genre ID
    """
    url = f"{TMDB_BASE_URL}/genre/movie/list"
    params = {"api_key": api_key}
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    genre_dict = {}
    for genre in data.get("genres", []):
        genre_dict[genre["name"]] = genre["id"]
    
    return genre_dict


def fetch_genre_count(api_key: str, genre_id: int) -> int:
    """
    Fetch total_results count for a genre using discover endpoint.
    
    Args:
        api_key: TMDb API key
        genre_id: Genre ID
        
    Returns:
        total_results count
    """
    url = f"{TMDB_BASE_URL}/discover/movie"
    params = {
        "api_key": api_key,
        "with_genres": genre_id,
        "page": 1,
    }
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    return data.get("total_results", 0)


def calculate_genre_frequencies(api_key: str) -> List[Tuple[str, str, int, float]]:
    """
    Calculate genre frequencies for all predefined genres.
    
    Returns:
        List of tuples: (genre_en, genre_ru, total_results, normalized_share)
    """
    print("Fetching genre list from TMDb...")
    genre_dict = fetch_genre_list(api_key)
    time.sleep(REQUEST_DELAY)
    
    results = []
    print(f"\nFetching counts for {len(GENRES)} genres...")
    
    for i, genre_en in enumerate(GENRES, 1):
        if genre_en not in genre_dict:
            print(f"  [{i}/{len(GENRES)}] Warning: Genre '{genre_en}' not found in TMDb")
            continue
        
        genre_id = genre_dict[genre_en]
        genre_ru = GENRE_MAPPING.get(genre_en, genre_en)
        
        print(f"  [{i}/{len(GENRES)}] Fetching {genre_en}...", end=" ", flush=True)
        try:
            total_results = fetch_genre_count(api_key, genre_id)
            print(f"✓ {total_results:,} movies")
            results.append((genre_en, genre_ru, total_results))
        except Exception as e:
            print(f"✗ Error: {e}")
        
        # Rate limiting delay
        if i < len(GENRES):
            time.sleep(REQUEST_DELAY)
    
    # Calculate normalized shares
    total_count = sum(count for _, _, count in results)
    
    final_results = []
    for genre_en, genre_ru, count in results:
        normalized_share = (count / total_count * 100) if total_count > 0 else 0.0
        final_results.append((genre_en, genre_ru, count, normalized_share))
    
    return final_results


def print_table(df: pd.DataFrame) -> None:
    """Print the dataframe as a nicely formatted table."""
    print("\n" + "=" * 80)
    print("GENRE GLOBAL FREQUENCY RESULTS")
    print("=" * 80)
    
    # Format the dataframe for display
    display_df = df.copy()
    display_df["TMDb total_results"] = display_df["TMDb total_results"].apply(lambda x: f"{x:,}")
    display_df["Normalized share (%)"] = display_df["Normalized share (%)"].apply(
        lambda x: f"{x:.2f}%"
    )
    
    print(display_df.to_string(index=False))
    print("=" * 80)
    print(f"\nTotal movies across all genres: {df['TMDb total_results'].sum():,}")
    print()


def main():
    """Main function."""
    try:
        api_key = get_api_key()
    except ValueError as e:
        print(f"Error: {e}")
        return
    
    try:
        results = calculate_genre_frequencies(api_key)
    except Exception as e:
        print(f"Error calculating genre frequencies: {e}")
        return
    
    if not results:
        print("No results to save.")
        return
    
    # Create DataFrame
    df = pd.DataFrame(
        results,
        columns=["Genre (EN)", "Genre (RU)", "TMDb total_results", "Normalized share (%)"]
    )
    
    # Sort by total_results descending
    df = df.sort_values("TMDb total_results", ascending=False).reset_index(drop=True)
    
    # Print table
    print_table(df)
    
    # Save to CSV
    output_file = "genre_global_frequency.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")
    print(f"Results saved to: {output_file}")


if __name__ == "__main__":
    main()
