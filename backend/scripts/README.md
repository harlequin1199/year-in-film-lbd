# backend/scripts

Каталог с утилитами для подготовки справочных частотных таблиц на основе TMDb.

## Что здесь есть

- `genre_global_frequency.py` - частоты по жанрам.
- `country_global_frequency.py` - частоты по странам.
- `year_global_frequency.py` - частоты по годам.

## Зачем это нужно

Эти данные используются как справочные baseline-распределения для аналитики и нормализации метрик.

## Требования

- Установлены зависимости из `backend/requirements.txt`.
- Задан `TMDB_API_KEY` (например, через `backend/.env`).

## Запуск

Из корня репозитория:

```bash
cd backend
python scripts/genre_global_frequency.py
python scripts/country_global_frequency.py
python scripts/year_global_frequency.py
```

## Результаты

Каждый скрипт сохраняет CSV в текущую рабочую директорию (`backend/`):

- `genre_global_frequency.csv`
- `country_global_frequency.csv`
- `year_global_frequency.csv`

## Примечания

- Скрипты делают запросы к TMDb и содержат задержку между запросами для снижения риска rate-limit.
- Для актуальных метрик рекомендуется периодически пересчитывать файлы.
