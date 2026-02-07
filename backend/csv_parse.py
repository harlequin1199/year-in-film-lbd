"""
Shared CSV parsing and diary merge for ratings/diary.
Used by FastAPI (for validation) and by the worker process.
Stream parsing: never load full CSV into memory.
"""
import csv
import io
import re
from typing import Dict, Iterator, List, Optional, Tuple


def _parse_int(value: Optional[str]) -> Optional[int]:
    try:
        return int(value) if value else None
    except ValueError:
        return None


def _parse_float(value: Optional[str]) -> Optional[float]:
    try:
        return float(value) if value else None
    except ValueError:
        return None


def _normalize_header(name: str) -> str:
    return name.strip().lower() if name else ""


def _find_column(fieldnames: List[str], *candidates: str) -> Optional[str]:
    normalized = [_normalize_header(h) for h in fieldnames]
    for c in candidates:
        cnorm = c.lower().strip()
        for i, n in enumerate(normalized):
            if cnorm in n or n in cnorm:
                return fieldnames[i]
    return None


def parse_ratings_csv_fast(text: str) -> List[Dict]:
    """Lightweight parse: only needed columns (loads into list). Use stream for large files."""
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    if not fieldnames:
        return []

    name_col = _find_column(fieldnames, "Name", "name", "Title")
    year_col = _find_column(fieldnames, "Year", "year")
    rating_col = _find_column(fieldnames, "Rating", "rating")
    date_col = _find_column(fieldnames, "Date", "date")
    uri_col = _find_column(fieldnames, "Letterboxd URI", "URI", "letterboxd")

    if not name_col:
        return []

    rows = []
    for row in reader:
        title = (row.get(name_col) or "").strip()
        if not title:
            continue
        rows.append({
            "title": title,
            "year": _parse_int(row.get(year_col)) if year_col else None,
            "rating": _parse_float(row.get(rating_col)) if rating_col else None,
            "date": (row.get(date_col) or "").strip() if date_col else None,
            "letterboxd_url": (row.get(uri_col) or "").strip() or None,
        })
    return rows


def count_ratings_csv_rows(filepath: str) -> int:
    """Count data rows in ratings CSV (row-by-row, no full load)."""
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        if not reader.fieldnames:
            return 0
        name_col = _find_column(list(reader.fieldnames), "Name", "name", "Title")
        if not name_col:
            return 0
        return sum(1 for row in reader if (row.get(name_col) or "").strip())


def stream_ratings_csv(filepath: str) -> Iterator[Dict]:
    """Yield ratings rows one-by-one; never load full CSV into memory."""
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        fieldnames = list(reader.fieldnames or [])
        if not fieldnames:
            return
        name_col = _find_column(fieldnames, "Name", "name", "Title")
        year_col = _find_column(fieldnames, "Year", "year")
        rating_col = _find_column(fieldnames, "Rating", "rating")
        date_col = _find_column(fieldnames, "Date", "date")
        uri_col = _find_column(fieldnames, "Letterboxd URI", "URI", "letterboxd")
        if not name_col:
            return
        for row in reader:
            title = (row.get(name_col) or "").strip()
            if not title:
                continue
            yield {
                "title": title,
                "year": _parse_int(row.get(year_col)) if year_col else None,
                "rating": _parse_float(row.get(rating_col)) if rating_col else None,
                "date": (row.get(date_col) or "").strip() if date_col else None,
                "letterboxd_url": (row.get(uri_col) or "").strip() or None,
            }


def parse_diary_csv(text: str) -> List[Dict]:
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = list(reader.fieldnames or [])
    if not fieldnames:
        return []

    date_col = _find_column(fieldnames, "Date", "date")
    name_col = _find_column(fieldnames, "Name", "name", "Title")
    year_col = _find_column(fieldnames, "Year", "year")
    uri_col = _find_column(fieldnames, "Letterboxd URI", "URI", "letterboxd")

    if not date_col or not name_col:
        return []

    out = []
    for row in reader:
        date_val = (row.get(date_col) or "").strip()
        name_val = (row.get(name_col) or "").strip()
        if not date_val or not name_val:
            continue
        year_val = _parse_int(row.get(year_col)) if year_col else None
        uri_val = (row.get(uri_col) or "").strip() if uri_col else None
        out.append({
            "date": date_val,
            "name": name_val,
            "year": year_val,
            "letterboxd_uri": uri_val or None,
        })
    return out


def _normalize_date(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    date_str = date_str.strip()
    if re.match(r"^\d{4}-\d{2}-\d{2}", date_str):
        return date_str[:10]
    try:
        from datetime import datetime
        dt = datetime.fromisoformat(date_str.replace(" ", "T"))
        return dt.strftime("%Y-%m-%d")
    except (ValueError, TypeError):
        return None


def merge_diary_into_films(films: List[Dict], diary_entries: List[Dict]) -> None:
    by_uri: Dict[str, str] = {}
    by_key: Dict[Tuple[str, int], str] = {}
    for e in diary_entries:
        d = _normalize_date(e.get("date"))
        if not d:
            continue
        uri = (e.get("letterboxd_uri") or "").strip()
        name = (e.get("name") or "").strip().lower()
        year = e.get("year") if e.get("year") is not None else 0
        if uri:
            by_uri[uri] = max(by_uri.get(uri, d), d)
        by_key[(name, year)] = max(by_key.get((name, year), d), d)

    for film in films:
        watched = None
        uri = (film.get("letterboxd_url") or "").strip()
        if uri and uri in by_uri:
            watched = by_uri[uri]
        else:
            name = (film.get("title") or "").strip().lower()
            year = film.get("year") if film.get("year") is not None else 0
            watched = by_key.get((name, year))
        film["watchedDate"] = watched
