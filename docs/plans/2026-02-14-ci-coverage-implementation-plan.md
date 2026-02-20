# CI Coverage Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Внедрить CI с раздельными coverage-gates для frontend и backend, чтобы каждый PR блокировался при падении тестов/порогов покрытия.

**Architecture:** Добавляем локальные и CI-уровневые coverage проверки отдельно для `frontend` и `backend`. Пороги фиксируются в конфиге Vitest (frontend) и в pytest-cov команде (backend). GitHub Actions запускает два независимых job параллельно и сохраняет coverage-артефакты даже при падении.

**Tech Stack:** GitHub Actions, Node.js/npm, Vitest, Vite, Python, pytest, pytest-cov.

---

### Task 1: Подготовить backend к coverage gate

**Files:**
- Modify: `backend/requirements-dev.txt`

**Step 1: Write the failing test**

Падающая проверка (инфраструктурная): убедиться, что coverage-флаг пока не работает.

```bash
cd backend
python -m pytest --cov=app --cov-fail-under=80 -q
```

Ожидаемо: `FAIL` c ошибкой вида `unrecognized arguments: --cov`.

**Step 2: Run test to verify it fails**

Run: `cd backend && python -m pytest --cov=app --cov-fail-under=80 -q`
Expected: FAIL из-за отсутствия `pytest-cov`.

**Step 3: Write minimal implementation**

Добавить зависимость в `backend/requirements-dev.txt`:

```txt
pytest>=8.3,<9
pytest-cov>=5.0,<6
```

**Step 4: Run test to verify it passes**

Run:
- `cd backend && pip install -r requirements.txt -r requirements-dev.txt`
- `cd backend && python -m pytest --cov=app --cov-report=xml --cov-report=term-missing --cov-fail-under=80 -q`

Expected: PASS (или FAIL только по реальному недостаточному покрытию, что валидирует gate).

**Step 5: Commit**

```bash
git add backend/requirements-dev.txt
git commit -m "test(backend): add pytest-cov and coverage gate support"
```

### Task 2: Включить coverage policy для frontend

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/vite.config.ts`

**Step 1: Write the failing test**

Падающая проверка (инфраструктурная): coverage-команда пока отсутствует/не настроена.

```bash
cd frontend
npm run test:coverage
```

Ожидаемо: `FAIL` (script missing или coverage provider not found).

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:coverage`
Expected: FAIL.

**Step 3: Write minimal implementation**

1) В `frontend/package.json`:
- Добавить script:

```json
"test:coverage": "vitest run --coverage"
```

- Добавить devDependency:

```json
"@vitest/coverage-v8": "^2.1.9"
```

2) В `frontend/vite.config.ts` добавить `test` секцию:

```ts
test: {
  environment: 'node',
  coverage: {
    provider: 'v8',
    reporter: ['text', 'lcov', 'json-summary'],
    reportsDirectory: 'coverage',
    thresholds: {
      lines: 80,
      functions: 80,
      branches: 70,
      statements: 80,
    },
  },
},
```

**Step 4: Run test to verify it passes**

Run:
- `cd frontend && npm ci`
- `cd frontend && npm run test:coverage`

Expected: PASS (или FAIL по недостаточному покрытию, что валидирует gate).

**Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.ts
git commit -m "test(frontend): enforce vitest coverage thresholds"
```

### Task 3: Добавить GitHub Actions workflow с двумя job

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write the failing test**

Падающая проверка: workflow отсутствует.

```bash
Test-Path .github/workflows/ci.yml
```

Expected: `False`.

**Step 2: Run test to verify it fails**

Run: `Test-Path .github/workflows/ci.yml`
Expected: `False`.

**Step 3: Write minimal implementation**

Создать `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

jobs:
  frontend-tests:
    name: Frontend tests + coverage
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: frontend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
          cache-dependency-path: frontend/package-lock.json

      - name: Install dependencies
        run: npm ci

      - name: Lint
        run: npm run lint

      - name: Run tests with coverage gate
        run: npm run test:coverage

      - name: Upload frontend coverage artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: frontend-coverage
          path: |
            frontend/coverage

  backend-tests:
    name: Backend tests + coverage
    runs-on: ubuntu-latest
    timeout-minutes: 15
    defaults:
      run:
        working-directory: backend
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Python
        uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install dependencies
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt -r requirements-dev.txt

      - name: Run tests with coverage gate
        run: python -m pytest --cov=app --cov-report=xml --cov-report=term-missing --cov-fail-under=80

      - name: Upload backend coverage artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: backend-coverage
          path: |
            backend/coverage.xml
```

**Step 4: Run test to verify it passes**

Run:
- `Test-Path .github/workflows/ci.yml`

Expected: `True`.

Дополнительно проверить валидность YAML локально через CI прогон в PR.

**Step 5: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: add frontend and backend coverage workflows"
```

### Task 4: Обновить проектную документацию

**Files:**
- Modify: `README.md`

**Step 1: Write the failing test**

Падающая проверка: в README нет команд coverage для обоих слоев.

```bash
rg "test:coverage|--cov-fail-under" README.md
```

Expected: нет совпадений.

**Step 2: Run test to verify it fails**

Run: `rg "test:coverage|--cov-fail-under" README.md`
Expected: пусто/код возврата без совпадений.

**Step 3: Write minimal implementation**

В разделе Testing добавить coverage-команды:

```md
- **Frontend coverage gate:**
  ```bash
  cd frontend
  npm run test:coverage
  ```
- **Backend coverage gate:**
  ```bash
  cd backend
  python -m pytest --cov=app --cov-report=xml --cov-report=term-missing --cov-fail-under=80
  ```
```

**Step 4: Run test to verify it passes**

Run: `rg "test:coverage|--cov-fail-under" README.md`
Expected: найдены обе команды.

**Step 5: Commit**

```bash
git add README.md
git commit -m "docs: document frontend and backend coverage gates"
```

### Task 5: Финальная верификация перед завершением

**Files:**
- Verify only (no mandatory file changes)

**Step 1: Write the failing test**

Смоук-проверка реальности gate: временно повысить один порог (например frontend lines=99) в рабочем дереве без коммита.

**Step 2: Run test to verify it fails**

Run: `cd frontend && npm run test:coverage`
Expected: FAIL по threshold.

**Step 3: Write minimal implementation**

Вернуть утвержденные пороги (`80/80/70/80`) и сохранить.

**Step 4: Run test to verify it passes**

Run:
- `cd frontend && npm run lint`
- `cd frontend && npm run test:coverage`
- `cd backend && python -m pytest --cov=app --cov-report=xml --cov-report=term-missing --cov-fail-under=80`
- `git status --short`

Expected:
- линтер и тесты проходят,
- coverage gates активны,
- в статусе только ожидаемые изменения.

**Step 5: Commit**

```bash
# если были правки после smoke-check
# git add <files>
# git commit -m "chore: finalize CI coverage verification"
```

## Notes for execution
- Перед каждой задачей применять `@superpowers/test-driven-development`.
- При любом неожиданном падении тестов применять `@superpowers/systematic-debugging` до правок.
- Перед заявлением о готовности обязательно применить `@superpowers/verification-before-completion`.
- Держать задачу в частых коммитах (не объединять все в один).
