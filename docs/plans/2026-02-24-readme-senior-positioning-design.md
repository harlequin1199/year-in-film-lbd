# README Senior Positioning Design

**Date:** 2026-02-24  
**Status:** Approved

## 1. Goal
Усилить `README.md` как портфолио-артефакт senior-уровня для смешанной аудитории:
- hiring manager (быстрый value/context),
- senior engineer/reviewer (архитектура, компромиссы, инженерная дисциплина).

## 2. Audience and Positioning
- Primary mode: mixed format (HR + engineer).
- Language: Russian only.
- Public links:
  - Live Demo: `https://year-in-film-lbd.vercel.app/`
  - Repository: GitHub project link (добавить в README отдельным пунктом).

## 3. Chosen Structure (Pitch + Technical Appendix)
1. Hero section:
   - название,
   - краткое описание ценности,
   - stack badges,
   - live demo + repository.
2. «Для кого и зачем» (product value).
3. Архитектура и ключевые решения:
   - data-flow схема в тексте,
   - таблица `Решение | Причина | Компромисс`,
   - ссылки на ADR.
4. Технологический стек по слоям.
5. «Что было самым сложным» (problem -> options -> chosen solution -> result).
6. «Как использовался AI (осознанно)»:
   - где AI применялся,
   - где не применялся,
   - как валидировались результаты.
7. Быстрый запуск, env, тесты, полезные endpoints (сохранить и уплотнить).

## 4. Constraints
- Не удалять существующую практическую информацию по запуску/переменным/тестам.
- Не искажать факты о текущей архитектуре.
- Не заявлять несуществующие метрики/результаты.

## 5. Success Criteria
- README читается за 1-2 минуты на верхнем уровне без погружения.
- Reviewer видит обоснованные инженерные решения и trade-offs.
- Есть явный блок про AI usage как controlled инструмент, а не «магия».
- Есть live demo ссылка и repository ссылка в верхней части.
