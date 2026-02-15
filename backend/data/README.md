# backend/data

Данные для demo-сценариев backend.

## Содержимое

- `demo/demo_report_1000.json` — предсобранный демо-отчет.
- `demo/demo_ratings_1000.csv` — демо CSV (1000 записей).

## Где используется

- `GET /api/demo-report` отдает `demo_report_1000.json`.
- `GET /api/demo-csv` отдает `demo_ratings_1000.csv`.

Эти файлы используются для локальной разработки, smoke-проверок и демонстрации без реальной загрузки пользовательского CSV.
