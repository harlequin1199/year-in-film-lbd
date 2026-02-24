# README Senior Positioning Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Переписать `README.md` в формате «pitch + technical appendix» для mixed-аудитории (HR + senior reviewer), сохранив полноту инженерной документации.

**Architecture:** Обновление ограничивается документацией: единый source-of-truth в корневом `README.md` с двухслойной подачей. Сначала краткий value и навигация, затем архитектурная глубина (trade-offs, сложные решения, AI usage policy) и операционные инструкции.

**Tech Stack:** Markdown, Git, existing project docs (`docs/adr/*`, `docs/ops/*`, `docs/demo-report.md`).

---

### Task 1: Подготовить фактический контекст

**Files:**
- Modify: `README.md`
- Read: `docs/adr/ADR-001-analysis-store-boundaries.md`
- Read: `docs/adr/ADR-002-analysis-lifecycle-invariants.md`
- Read: `docs/adr/ADR-003-analysis-persistence-strategy.md`
- Read: `docs/adr/ADR-004-observability-sentry-grafana.md`

**Step 1: Проверить факты перед переписыванием**

Run: `Get-Content README.md`
Expected: текущий README доступен для редактирования.

**Step 2: Зафиксировать ссылки на подтверждающие документы**

Run: `Get-ChildItem docs/adr -Name`
Expected: список ADR-файлов для ссылок в новом тексте.

**Step 3: Commit checkpoint**

```bash
git status --short
```

Expected: рабочее дерево чистое или изменения понятны.

### Task 2: Переписать README в senior-формат

**Files:**
- Modify: `README.md`

**Step 1: Написать новый верхний экран**

Добавить:
- value proposition,
- Live Demo: `https://year-in-film-lbd.vercel.app/`,
- Repository link placeholder/actual link,
- стек в коротком формате.

**Step 2: Добавить инженерную секцию с trade-offs**

Добавить:
- data-flow,
- таблицу `Решение | Почему | Компромисс`,
- ссылки на ADR.

**Step 3: Добавить блоки senior-сигналов**

Добавить:
- «Что было самым сложным»,
- «Как использовался AI (осознанно)».

**Step 4: Сохранить операционные инструкции**

Убедиться, что остались:
- quick start,
- env variables,
- testing,
- endpoints,
- docs links.

**Step 5: Commit checkpoint**

```bash
git add README.md
git commit -m "docs: rewrite README for senior mixed audience"
```

(Выполнять только при явном запросе на commit.)

### Task 3: Верифицировать итог

**Files:**
- Modify: `README.md` (при необходимости финальных правок)

**Step 1: Проверить структуру документа**

Run: `rg "^## " README.md`
Expected: присутствуют все целевые секции.

**Step 2: Проверить обязательные ссылки**

Run: `rg "year-in-film-lbd.vercel.app|github.com" README.md`
Expected: есть live demo и repository.

**Step 3: Проверить финальный diff**

Run: `git diff -- README.md`
Expected: изменения ограничены README и соответствуют цели.
