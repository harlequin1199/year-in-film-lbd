# backend/data

Данные для demo-сценариев backend.

## Статус данных

Эти файлы являются fixture/demo-данными для локальной разработки, smoke-проверок и демонстрации.
Они не являются production source of truth.

## Содержимое

- `demo/demo_report_1000.json` - предсобранный демо-отчёт.
- `demo/demo_ratings_1000.csv` - демо CSV (1000 записей).

## Где используется

- `GET /api/demo-report` отдаёт `demo_report_1000.json`.
- `GET /api/demo-csv` отдаёт `demo_ratings_1000.csv`.

## Когда обновлять

Обновляйте файлы, если меняется формат демо-ответа, структура CSV или демо-сценарии UI/API.
