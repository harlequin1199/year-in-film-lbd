"""
Calculate approximate global year frequency using TMDb API.

For each movie release year, fetches TMDb discover counts and computes:
- total_results (count of movies in TMDb released in that year)
- relative share among all years (normalized %)
"""
import os
import time
from pathlib import Path
from typing import Dict, List, Tuple
from datetime import datetime

import pandas as pd
import requests
from dotenv import load_dotenv

# Load .env from backend dir when running locally; production uses env vars
_env_path = Path(__file__).resolve().parent / ".env"
load_dotenv(dotenv_path=_env_path)
load_dotenv()

TMDB_BASE_URL = "https://api.themoviedb.org/3"
REQUEST_DELAY = 0.25  # 250ms delay between requests

# Year range: from early cinema to current year
# Starting from 1900 to avoid too many requests (very few movies before 1900)
CURRENT_YEAR = datetime.now().year
START_YEAR = 1900
END_YEAR = CURRENT_YEAR


def get_api_key() -> str:
    """Get TMDb API key from environment variable."""
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        raise ValueError("TMDB_API_KEY environment variable is not set")
    return api_key


def fetch_year_count(api_key: str, year: int) -> int:
    """
    Fetch total_results count for a year using discover endpoint.
    
    Args:
        api_key: TMDb API key
        year: Release year
        
    Returns:
        total_results count
    """
    url = f"{TMDB_BASE_URL}/discover/movie"
    params = {
        "api_key": api_key,
        "primary_release_year": year,
        "page": 1,
    }
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    return data.get("total_results", 0)


def calculate_year_frequencies(api_key: str) -> List[Tuple[int, int, float]]:
    """
    Calculate year frequencies for all years in range.
    
    Returns:
        List of tuples: (year, total_results, normalized_share)
    """
    results = []
    total_years = END_YEAR - START_YEAR + 1
    print(f"\nFetching counts for {total_years} years ({START_YEAR}-{END_YEAR})...")
    
    for i, year in enumerate(range(START_YEAR, END_YEAR + 1), 1):
        print(f"  [{i}/{total_years}] Fetching {year}...", end=" ", flush=True)
        try:
            total_results = fetch_year_count(api_key, year)
            print(f"OK {total_results:,} movies")
            results.append((year, total_results))
        except Exception as e:
            print(f"Error: {e}")
        
        # Rate limiting delay
        if i < total_years:
            time.sleep(REQUEST_DELAY)
    
    # Calculate normalized shares
    total_count = sum(count for _, count in results)
    
    final_results = []
    for year, count in results:
        normalized_share = (count / total_count * 100) if total_count > 0 else 0.0
        final_results.append((year, count, normalized_share))
    
    return final_results


def print_table(df: pd.DataFrame) -> None:
    """Print the dataframe as a nicely formatted table."""
    print("\n" + "=" * 80)
    print("YEAR GLOBAL FREQUENCY RESULTS")
    print("=" * 80)
    
    # Format the dataframe for display
    display_df = df.copy()
    display_df["TMDb total_results"] = display_df["TMDb total_results"].apply(lambda x: f"{x:,}")
    display_df["Normalized share (%)"] = display_df["Normalized share (%)"].apply(
        lambda x: f"{x:.4f}%"
    )
    
    print(display_df.to_string(index=False))
    print("=" * 80)
    print(f"\nTotal movies across all years: {df['TMDb total_results'].sum():,}")
    print()


def main():
    """Main function."""
    try:
        api_key = get_api_key()
    except ValueError as e:
        print(f"Error: {e}")
        return
    
    try:
        results = calculate_year_frequencies(api_key)
    except Exception as e:
        print(f"Error calculating year frequencies: {e}")
        return
    
    if not results:
        print("No results to save.")
        return
    
    # Create DataFrame
    df = pd.DataFrame(
        results,
        columns=["Year", "TMDb total_results", "Normalized share (%)"]
    )
    
    # Sort by year ascending
    df = df.sort_values("Year", ascending=True).reset_index(drop=True)
    
    # Print table (show first 20 and last 20 years)
    print_table(df.head(20))
    if len(df) > 40:
        print("\n... (showing first 20 years)")
        print_table(df.tail(20))
    
    # Save to CSV
    output_file = "year_global_frequency.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")
    print(f"\nResults saved to: {output_file}")
    print(f"Total years processed: {len(df)}")


if __name__ == "__main__":
    main()
