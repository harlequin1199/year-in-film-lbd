from collections import defaultdict
from datetime import datetime
from typing import Dict, List, Optional, Tuple


def _parse_month(date_str: Optional[str]) -> Optional[str]:
    if not date_str:
        return None
    try:
        dt = datetime.fromisoformat(date_str)
        return dt.strftime("%Y-%m")
    except ValueError:
        return None


def _parse_date(date_str: Optional[str]) -> Optional[datetime]:
    if not date_str:
        return None
    try:
        return datetime.fromisoformat(date_str)
    except ValueError:
        return None


def _rating_bucket(value: float) -> float:
    return round(value * 2) / 2


def _build_ranked_stats(items: defaultdict) -> List[Dict]:
    ranked = []
    for name, stats in items.items():
        avg = stats["sum_rating"] / stats["count"] if stats["count"] else 0
        avg = round(avg, 2)
        share_45 = round(stats["high_45"] / stats["count"], 2) if stats["count"] else 0
        ranked.append(
            {
                "name": name,
                "count": stats["count"],
                "avg_rating": avg,
                "high_45": stats["high_45"],
                "share_45": share_45,
            }
        )
    ranked.sort(key=lambda g: (g["count"], g["avg_rating"], g["high_45"]), reverse=True)
    return ranked


def _build_ranked_avg(items: Dict[str, Dict], min_count: int) -> List[Dict]:
    ranked = []
    for name, stats in items.items():
        if stats["count"] < min_count:
            continue
        avg = stats["sum_rating"] / stats["count"] if stats["count"] else 0
        avg = round(avg, 2)
        ranked.append(
            {
                "name": name,
                "count": stats["count"],
                "avg_rating": avg,
                "high_45": stats["high_45"],
            }
        )
    ranked.sort(key=lambda g: (g["avg_rating"], g["count"]), reverse=True)
    return ranked


def analyze_films(films: List[Dict], has_diary: bool = False) -> Dict:
    ratings = [f["rating"] for f in films if f.get("rating") is not None]
    years = [f["year"] for f in films if f.get("year")]

    total_films = len(films)
    avg_rating = round(sum(ratings) / len(ratings), 2) if ratings else 0
    count_45 = sum(1 for r in ratings if r >= 4.5)
    oldest_year = min(years) if years else None
    newest_year = max(years) if years else None

    histogram_counts = defaultdict(int)
    for r in ratings:
        bucket = _rating_bucket(r)
        histogram_counts[bucket] += 1

    histogram = []
    for i in range(1, 11):
        rating = i * 0.5
        histogram.append({"rating": rating, "count": histogram_counts.get(rating, 0)})

    genre_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})
    tag_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})
    director_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})
    actor_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})
    country_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})
    available_years = set()

    for film in films:
        rating = film.get("rating") or 0
        for genre in film.get("genres", []):
            stats = genre_stats[genre]
            stats["count"] += 1
            stats["sum_rating"] += rating
            if rating >= 4.5:
                stats["high_45"] += 1
        for tag in film.get("keywords", []):
            stats = tag_stats[tag]
            stats["count"] += 1
            stats["sum_rating"] += rating
            if rating >= 4.5:
                stats["high_45"] += 1
        for director in film.get("directors", []):
            stats = director_stats[director]
            stats["count"] += 1
            stats["sum_rating"] += rating
            if rating >= 4.5:
                stats["high_45"] += 1
        for actor in film.get("actors", []):
            stats = actor_stats[actor]
            stats["count"] += 1
            stats["sum_rating"] += rating
            if rating >= 4.5:
                stats["high_45"] += 1
        for country in film.get("countries", []):
            stats = country_stats[country]
            stats["count"] += 1
            stats["sum_rating"] += rating
            if rating >= 4.5:
                stats["high_45"] += 1
        rating_date = _parse_date(film.get("date"))
        if rating_date:
            available_years.add(rating_date.year)

    top_genres = _build_ranked_stats(genre_stats)

    top_tags = []
    for name, stats in tag_stats.items():
        avg = stats["sum_rating"] / stats["count"] if stats["count"] else 0
        avg = round(avg, 2)
        love_score = round(stats["high_45"] * avg, 2)
        top_tags.append(
            {
                "name": name,
                "count": stats["count"],
                "avg_rating": avg,
                "high_45": stats["high_45"],
                "loveScore": love_score,
            }
        )
    top_tags.sort(key=lambda t: (t["loveScore"], t["count"]), reverse=True)
    top_directors = _build_ranked_stats(director_stats)
    top_countries = _build_ranked_stats(country_stats)

    top_directors_by_count = top_directors[:10]
    top_directors_by_avg = _build_ranked_avg(director_stats, 3)[:10]
    top_actors_by_count = _build_ranked_stats(actor_stats)[:15]
    top_actors_by_avg = _build_ranked_avg(actor_stats, 3)[:15]
    top_countries_by_count = top_countries[:10]
    top_countries_by_avg = _build_ranked_avg(country_stats, 5)[:10]

    total_countries_count = len(country_stats)
    total_languages_count = 0

    language_map = {
        "en": "English",
        "ru": "Русский",
        "fr": "Français",
        "es": "Español",
        "it": "Italiano",
        "de": "Deutsch",
        "ja": "日本語",
        "ko": "한국어",
        "zh": "中文",
        "pt": "Português",
        "sv": "Svenska",
        "da": "Dansk",
        "no": "Norsk",
        "nl": "Nederlands",
        "pl": "Polski",
        "tr": "Türkçe",
        "hi": "हिन्दी",
        "ar": "العربية",
    }
    language_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "high_45": 0})

    runtime_values = []
    total_runtime = 0

    watches_by_month = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "rated": 0})
    watches_by_weekday = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "rated": 0})
    weekday_names = [
        "Понедельник",
        "Вторник",
        "Среда",
        "Четверг",
        "Пятница",
        "Суббота",
        "Воскресенье",
    ]

    dated_films: List[Tuple[datetime, Dict]] = []
    five_star_count = 0

    for film in films:
        rating = film.get("rating")
        if rating == 5:
            five_star_count += 1
        language = film.get("original_language")
        if language:
            stats = language_stats[language]
            stats["count"] += 1
            if rating is not None:
                stats["sum_rating"] += rating
            if rating is not None and rating >= 4.5:
                stats["high_45"] += 1

        runtime = film.get("runtime")
        if runtime:
            runtime_values.append(runtime)
            total_runtime += runtime

        film_date = _parse_date(film.get("watchedDate") if has_diary else film.get("date"))
        if film_date and has_diary:
            dated_films.append((film_date, film))
            month_key = film_date.strftime("%Y-%m")
            month_stats = watches_by_month[month_key]
            month_stats["count"] += 1
            if rating is not None:
                month_stats["sum_rating"] += rating
                month_stats["rated"] += 1

            weekday = film_date.weekday()
            weekday_stats = watches_by_weekday[weekday]
            weekday_stats["count"] += 1
            if rating is not None:
                weekday_stats["sum_rating"] += rating
                weekday_stats["rated"] += 1

    total_languages_count = len(language_stats)
    top_languages_by_count = []
    for code, stats in language_stats.items():
        avg = stats["sum_rating"] / stats["count"] if stats["count"] else 0
        top_languages_by_count.append(
            {
                "language": code,
                "name": language_map.get(code, code),
                "count": stats["count"],
                "avg_rating": round(avg, 2),
                "high_45": stats["high_45"],
            }
        )
    top_languages_by_count.sort(key=lambda l: (l["count"], l["avg_rating"]), reverse=True)
    top_languages_by_count = top_languages_by_count[:10]

    watches_by_month_list = []
    for month, stats in sorted(watches_by_month.items()):
        avg = stats["sum_rating"] / stats["rated"] if stats["rated"] else 0
        watches_by_month_list.append(
            {"month": month, "count": stats["count"], "avg_rating": round(avg, 2)}
        )

    watches_by_weekday_list = []
    for weekday in range(7):
        stats = watches_by_weekday.get(weekday, {"count": 0, "sum_rating": 0.0, "rated": 0})
        avg = stats["sum_rating"] / stats["rated"] if stats["rated"] else 0
        watches_by_weekday_list.append(
            {
                "weekday": weekday,
                "nameRu": weekday_names[weekday],
                "count": stats["count"],
                "avg_rating": round(avg, 2),
            }
        )

    most_active_month = None
    if watches_by_month_list:
        most_active_month = max(watches_by_month_list, key=lambda m: m["count"]).get("month")

    most_active_weekday = None
    if watches_by_weekday_list:
        most_active_weekday = max(watches_by_weekday_list, key=lambda d: d["count"]).get("weekday")

    dated_films.sort(key=lambda entry: entry[0])
    milestone_indices = [25, 50, 100, 250, 500]
    milestones = {}
    for index in milestone_indices:
        if len(dated_films) >= index:
            _, film = dated_films[index - 1]
            milestones[f"milestone{index}"] = {
                "index": index,
                "title": film.get("title"),
                "year": film.get("year"),
                "rating": film.get("rating"),
                "poster_url": film.get("poster_url"),
                "letterboxd_url": film.get("letterboxd_url"),
            }
        else:
            milestones[f"milestone{index}"] = None

    count_pre_1970 = sum(1 for year in years if year and year < 1970)
    count_pre_1950 = sum(1 for year in years if year and year < 1950)
    count_modern = sum(1 for year in years if year and year >= 2000)
    progress_badges = [
        {
            "title": "Классика до 1970",
            "value": count_pre_1970,
            "subtitle": "Фильмы до 1970 года",
        },
        {
            "title": "Классика до 1950",
            "value": count_pre_1950,
            "subtitle": "Фильмы до 1950 года",
        },
        {
            "title": "Современное кино",
            "value": count_modern,
            "subtitle": "Фильмы с 2000 года",
        },
    ]

    insights = []
    if most_active_month:
        insights.append(f"Ты чаще всего смотрел фильмы в {most_active_month}.")
    if top_countries:
        insights.append(f"Твоя самая любимая страна: {top_countries[0]['name']}.")
    insights.append(f"Ты поставил 5★ {five_star_count} фильмам.")
    if most_active_weekday is not None:
        insights.append(f"Самый активный день недели: {weekday_names[most_active_weekday]}.")
    if top_genres:
        insights.append(f"Твой главный жанр года: {top_genres[0]['name']}.")
    insights = insights[:5]

    decade_stats = defaultdict(lambda: {"count": 0, "sum_rating": 0.0, "rated": 0})
    for film in films:
        year = film.get("year")
        if not year:
            continue
        decade = (year // 10) * 10
        stats = decade_stats[decade]
        stats["count"] += 1
        rating = film.get("rating")
        if rating is not None:
            stats["sum_rating"] += rating
            stats["rated"] += 1

    most_watched_decade = None
    most_loved_decade = None
    if decade_stats:
        most_watched_decade = max(decade_stats.items(), key=lambda d: d[1]["count"])[0]
        loved_candidates = [
            (decade, stats)
            for decade, stats in decade_stats.items()
            if stats["count"] >= 5 and stats["rated"]
        ]
        if loved_candidates:
            most_loved_decade = max(
                loved_candidates,
                key=lambda d: (d[1]["sum_rating"] / d[1]["rated"], d[1]["count"]),
            )[0]

    top_genres_by_avg = _build_ranked_avg(genre_stats, 5)
    top_countries_by_avg = _build_ranked_avg(country_stats, 5)
    top_directors_by_avg = _build_ranked_avg(director_stats, 3)
    top_tags_by_avg = _build_ranked_avg(tag_stats, 8)

    longest_film = None
    shortest_film = None
    for film in films:
        runtime = film.get("runtime")
        if not runtime:
            continue
        if not longest_film or runtime > longest_film["runtime"]:
            longest_film = {"title": film.get("title"), "runtime": runtime}
        if not shortest_film or runtime < shortest_film["runtime"]:
            shortest_film = {"title": film.get("title"), "runtime": runtime}

    badges = []

    def add_badge(title: str, value, subtitle: str, icon_key: str, tone: str, is_rating: bool = False):
        if value is None:
            return
        badges.append(
            {
                "title": title,
                "value": value,
                "subtitle": subtitle,
                "iconKey": icon_key,
                "tone": tone,
                "isRating": is_rating,
            }
        )

    add_badge("Фильмов за год", total_films, "Всего фильмов", "film", "gold")
    add_badge("Средняя оценка", avg_rating, "Средняя по всем фильмам", "star", "gold", True)
    add_badge("Пятёрки", five_star_count, "Оценки 5★", "star", "purple")
    add_badge("Оценки 4.5–5★", count_45, "Очень высокие оценки", "star", "purple")
    if top_genres:
        add_badge(
            "Самый частый жанр",
            top_genres[0]["count"],
            f"Жанр: {top_genres[0]['name']}",
            "tag",
            "green",
        )
    if top_genres_by_avg:
        add_badge(
            "Самый любимый жанр",
            top_genres_by_avg[0]["avg_rating"],
            f"Жанр: {top_genres_by_avg[0]['name']}",
            "heart",
            "green",
            True,
        )
    if top_countries_by_count:
        add_badge(
            "Самая частая страна",
            top_countries_by_count[0]["count"],
            f"Страна: {top_countries_by_count[0]['name']}",
            "globe",
            "blue",
        )
    if top_countries_by_avg:
        add_badge(
            "Самая любимая страна",
            top_countries_by_avg[0]["avg_rating"],
            f"Страна: {top_countries_by_avg[0]['name']}",
            "heart",
            "blue",
            True,
        )
    if top_directors_by_count:
        add_badge(
            "Самый частый режиссёр",
            top_directors_by_count[0]["count"],
            f"Режиссёр: {top_directors_by_count[0]['name']}",
            "trophy",
            "purple",
        )
    if top_directors_by_avg:
        add_badge(
            "Самый любимый режиссёр",
            top_directors_by_avg[0]["avg_rating"],
            f"Режиссёр: {top_directors_by_avg[0]['name']}",
            "heart",
            "purple",
            True,
        )
    if most_watched_decade:
        add_badge(
            "Самое частое десятилетие",
            f"{most_watched_decade}-е",
            "Чаще всего",
            "calendar",
            "gold",
        )
    if most_loved_decade:
        loved_stats = decade_stats[most_loved_decade]
        avg = loved_stats["sum_rating"] / loved_stats["rated"] if loved_stats["rated"] else 0
        add_badge(
            "Самое любимое десятилетие",
            round(avg, 2),
            f"{most_loved_decade}-е",
            "heart",
            "gold",
            True,
        )
    add_badge("Самый ранний год", str(oldest_year) if oldest_year else None, "Год старейшего фильма", "calendar", "green")
    add_badge("Самый новый год", str(newest_year) if newest_year else None, "Год новейшего фильма", "calendar", "green")
    add_badge("Всего стран", total_countries_count, "Стран в подборке", "globe", "blue")
    add_badge("Всего языков", total_languages_count, "Языков в подборке", "globe", "blue")
    if total_runtime:
        add_badge("Часы просмотра", round(total_runtime / 60), "Суммарно за год", "clock", "gold")
    if longest_film:
        add_badge(
            "Самый длинный фильм",
            longest_film["runtime"],
            longest_film["title"] or "Неизвестно",
            "clock",
            "purple",
        )
    if shortest_film:
        add_badge(
            "Самый короткий фильм",
            shortest_film["runtime"],
            shortest_film["title"] or "Неизвестно",
            "clock",
            "purple",
        )
    if top_tags:
        add_badge(
            "Самая частая тема",
            top_tags[0]["count"],
            f"Тема: {top_tags[0]['name']}",
            "tag",
            "green",
        )
    if top_tags_by_avg:
        add_badge(
            "Самая любимая тема",
            top_tags_by_avg[0]["avg_rating"],
            f"Тема: {top_tags_by_avg[0]['name']}",
            "heart",
            "green",
            True,
        )

    if len(badges) < 10:
        add_badge("Всего жанров", len(genre_stats), "Уникальные жанры", "tag", "blue")
        add_badge("Всего тем", len(tag_stats), "Уникальные темы", "tag", "blue")

    badges = badges[:12] if len(badges) > 12 else badges

    top_rated = sorted(
        films, key=lambda f: ((f.get("rating") or 0), (f.get("year") or 0)), reverse=True
    )[:12]
    top_rated_films = [
        {
            "title": f.get("title"),
            "year": f.get("year"),
            "rating": f.get("rating"),
            "poster_url": f.get("poster_url"),
            "letterboxd_url": f.get("letterboxd_url"),
            "poster_path": f.get("poster_path"),
            "tmdb_id": f.get("tmdb_id"),
            "runtime": f.get("runtime"),
            "original_language": f.get("original_language"),
        }
        for f in top_rated
    ]

    films_lite = []
    for f in films:
        va = f.get("tmdb_vote_average")
        vc = f.get("tmdb_vote_count") or 0
        entry = {
            "title": f.get("title"),
            "year": f.get("year"),
            "rating": f.get("rating"),
            "poster_url": f.get("poster_url_w342") or f.get("poster_url"),
            "letterboxd_url": f.get("letterboxd_url"),
            "tmdb_id": f.get("tmdb_id"),
            "tmdb_vote_average": va,
            "tmdb_vote_count": vc,
            "tmdb_stars": (va / 2.0) if va is not None else None,
            "runtime": f.get("runtime"),
            "original_language": f.get("original_language"),
            "countries": f.get("countries", []),
            "directors": f.get("directors", []),
            "actors": f.get("actors", []),
            "date": f.get("date"),
            "watchedDate": f.get("watchedDate"),
            "genres": f.get("genres", []),
            "keywords": f.get("keywords", []),
        }
        films_lite.append(entry)

    timeline_counts = defaultdict(int)
    if has_diary:
        for film in films:
            month = _parse_month(film.get("watchedDate"))
            if month:
                timeline_counts[month] += 1

    timeline = [{"month": month, "count": count} for month, count in sorted(timeline_counts.items())]

    return {
        "stats": {
            "totalFilms": total_films,
            "avgRating": avg_rating,
            "count45": count_45,
            "oldestYear": oldest_year,
            "newestYear": newest_year,
        },
        "ratingHistogram": histogram,
        "topGenres": top_genres,
        "topTags": top_tags,
        "topDirectors": top_directors,
        "topCountries": top_countries,
        "topDirectorsByCount": top_directors_by_count,
        "topDirectorsByAvgRating": top_directors_by_avg,
        "topActorsByCount": top_actors_by_count,
        "topActorsByAvgRating": top_actors_by_avg,
        "topCountriesByCount": top_countries_by_count,
        "topCountriesByAvgRating": top_countries_by_avg,
        "totalCountriesCount": total_countries_count,
        "totalLanguagesCount": total_languages_count,
        "topLanguagesByCount": top_languages_by_count,
        "topRatedFilms": top_rated_films,
        "timeline": timeline,
        "filmsLite": films_lite,
        "filmsLiteAll": films_lite,
        "availableYears": sorted(available_years),
        "watchTime": {
            "totalRuntimeMinutes": total_runtime,
            "totalRuntimeHours": round(total_runtime / 60) if total_runtime else 0,
            "avgRuntimeMinutes": round(sum(runtime_values) / len(runtime_values), 2) if runtime_values else 0,
        },
        "watchesByMonth": watches_by_month_list,
        "watchesByWeekday": watches_by_weekday_list,
        "mostActiveMonth": most_active_month,
        "mostActiveWeekday": most_active_weekday,
        "milestones": milestones,
        "progressBadges": progress_badges,
        "insights": insights,
        "badges": badges,
    }
