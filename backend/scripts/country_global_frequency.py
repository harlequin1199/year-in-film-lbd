"""
Calculate approximate global country frequency using TMDb API.

For each movie production country, fetches TMDb discover counts and computes:
- total_results (count of movies in TMDb from that country)
- relative share among all countries (normalized %)
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

# List of countries to check (English names as they appear in TMDb production_countries)
# Based on countriesRu.js and common countries in TMDb
COUNTRIES = [
    "United States of America",
    "United Kingdom",
    "France",
    "Germany",
    "Japan",
    "South Korea",
    "India",
    "Italy",
    "Spain",
    "China",
    "Hong Kong",
    "Canada",
    "Australia",
    "Russia",
    "Brazil",
    "Mexico",
    "Sweden",
    "Denmark",
    "Norway",
    "Finland",
    "Poland",
    "Czech Republic",
    "Hungary",
    "Romania",
    "Greece",
    "Turkey",
    "Iran",
    "Israel",
    "Egypt",
    "South Africa",
    "Argentina",
    "Chile",
    "Colombia",
    "Belgium",
    "Netherlands",
    "Austria",
    "Switzerland",
    "Ireland",
    "New Zealand",
    "Thailand",
    "Indonesia",
    "Vietnam",
    "Philippines",
    "Malaysia",
    "Singapore",
    "Taiwan",
    "Ukraine",
    "Kazakhstan",
    "Georgia",
    "Armenia",
    "Azerbaijan",
    "Belarus",
    "Portugal",
    "Croatia",
    "Serbia",
    "Bulgaria",
    "Slovakia",
    "Slovenia",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Iceland",
    "Luxembourg",
    "Morocco",
    "Algeria",
    "Tunisia",
    "Nigeria",
    "Kenya",
    "Pakistan",
    "Bangladesh",
    "Sri Lanka",
    "Nepal",
    "Afghanistan",
    "Iraq",
    "Lebanon",
    "Syria",
    "Jordan",
    "Saudi Arabia",
    "United Arab Emirates",
    "Qatar",
    "Kuwait",
    "Cuba",
    "Venezuela",
    "Peru",
    "Ecuador",
    "Uruguay",
    "Bolivia",
    "Paraguay",
    "Puerto Rico",
    "Dominican Republic",
    "Jamaica",
    "Trinidad and Tobago",
]


def get_api_key() -> str:
    """Get TMDb API key from environment variable."""
    api_key = os.getenv("TMDB_API_KEY")
    if not api_key:
        raise ValueError("TMDB_API_KEY environment variable is not set")
    return api_key


def fetch_country_list(api_key: str) -> Dict[str, str]:
    """
    Fetch country list from TMDb API.
    
    Returns:
        Dictionary mapping country name (EN) to ISO 3166-1 code
    """
    url = f"{TMDB_BASE_URL}/configuration/countries"
    params = {"api_key": api_key}
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    country_dict = {}
    for country in data:
        country_dict[country.get("english_name")] = country.get("iso_3166_1")
    
    return country_dict


def fetch_country_count(api_key: str, country_code: str) -> int:
    """
    Fetch total_results count for a country using discover endpoint.
    
    Args:
        api_key: TMDb API key
        country_code: ISO 3166-1 country code (e.g., "US", "GB", "FR")
        
    Returns:
        total_results count
    """
    url = f"{TMDB_BASE_URL}/discover/movie"
    params = {
        "api_key": api_key,
        "with_origin_country": country_code,
        "page": 1,
    }
    
    response = requests.get(url, params=params)
    response.raise_for_status()
    
    data = response.json()
    return data.get("total_results", 0)


def calculate_country_frequencies(api_key: str) -> List[Tuple[str, str, int, float]]:
    """
    Calculate country frequencies for all predefined countries.
    
    Returns:
        List of tuples: (country_en, country_code, total_results, normalized_share)
    """
    print("Fetching country list from TMDb...")
    country_dict = fetch_country_list(api_key)
    time.sleep(REQUEST_DELAY)
    
    results = []
    print(f"\nFetching counts for {len(COUNTRIES)} countries...")
    
    for i, country_en in enumerate(COUNTRIES, 1):
        # Try to find country code
        country_code = country_dict.get(country_en)
        if not country_code:
            # Try alternative names
            if country_en == "United States of America":
                country_code = country_dict.get("United States")
            elif country_en == "Czech Republic":
                country_code = country_dict.get("Czechia")
            elif country_en == "Russia":
                country_code = country_dict.get("Russian Federation")
            
            if not country_code:
                print(f"  [{i}/{len(COUNTRIES)}] Warning: Country '{country_en}' not found in TMDb")
                continue
        
        print(f"  [{i}/{len(COUNTRIES)}] Fetching {country_en} ({country_code})...", end=" ", flush=True)
        try:
            total_results = fetch_country_count(api_key, country_code)
            print(f"OK {total_results:,} movies")
            results.append((country_en, country_code, total_results))
        except Exception as e:
            print(f"Error: {e}")
        
        # Rate limiting delay
        if i < len(COUNTRIES):
            time.sleep(REQUEST_DELAY)
    
    # Calculate normalized shares
    total_count = sum(count for _, _, count in results)
    
    final_results = []
    for country_en, country_code, count in results:
        normalized_share = (count / total_count * 100) if total_count > 0 else 0.0
        final_results.append((country_en, country_code, count, normalized_share))
    
    return final_results


def print_table(df: pd.DataFrame) -> None:
    """Print the dataframe as a nicely formatted table."""
    print("\n" + "=" * 80)
    print("COUNTRY GLOBAL FREQUENCY RESULTS")
    print("=" * 80)
    
    # Format the dataframe for display
    display_df = df.copy()
    display_df["TMDb total_results"] = display_df["TMDb total_results"].apply(lambda x: f"{x:,}")
    display_df["Normalized share (%)"] = display_df["Normalized share (%)"].apply(
        lambda x: f"{x:.4f}%"
    )
    
    print(display_df.to_string(index=False))
    print("=" * 80)
    print(f"\nTotal movies across all countries: {df['TMDb total_results'].sum():,}")
    print()


def main():
    """Main function."""
    try:
        api_key = get_api_key()
    except ValueError as e:
        print(f"Error: {e}")
        return
    
    try:
        results = calculate_country_frequencies(api_key)
    except Exception as e:
        print(f"Error calculating country frequencies: {e}")
        return
    
    if not results:
        print("No results to save.")
        return
    
    # Create DataFrame
    df = pd.DataFrame(
        results,
        columns=["Country (EN)", "Country Code", "TMDb total_results", "Normalized share (%)"]
    )
    
    # Sort by total_results descending
    df = df.sort_values("TMDb total_results", ascending=False).reset_index(drop=True)
    
    # Print table
    print_table(df)
    
    # Save to CSV
    output_file = "country_global_frequency.csv"
    df.to_csv(output_file, index=False, encoding="utf-8-sig")
    print(f"Results saved to: {output_file}")


if __name__ == "__main__":
    main()
