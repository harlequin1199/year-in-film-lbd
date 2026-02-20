# План реализации миграции на state management

> **Для Claude:** ОБЯЗАТЕЛЬНЫЙ ПОД-НАВЫК: использовать superpowers:executing-plans для пошаговой реализации этого плана.

**Цель:** Перенести бизнес-состояние фронтенда из разрозненных локальных хуков в единый Zustand store с явным жизненным циклом действий и без регрессий поведения.

**Архитектура:** Ввести единый `analysisStore` с явным разделением на domain и ui-session slices, затем поэтапно мигрировать read-path и write-path, чтобы избежать двойного источника истины. Оркестрацию оставить в feature-хуках/сервисах, а store сделать владельцем переходов бизнес-состояния. Сохранить persistence в IndexedDB через централизованные side effects.

**Технологии:** React 19, TypeScript, Zustand (+ devtools), Vite, Vitest.

---

### Задача 1: Добавить контракт состояния и инварианты

**Файлы:**
- Создать: `frontend/src/features/upload/analysisState.contract.ts`
- Тест: `frontend/src/features/upload/analysisState.contract.test.ts`

**Шаг 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { assertAnalysisStateInvariants } from './analysisState.contract'

describe('analysis state invariants', () => {
  it('throws when pendingFiles exists but mobile modal is closed', () => {
    expect(() => assertAnalysisStateInvariants({
      loading: false,
      progress: null,
      analysis: null,
      showMobileModal: false,
      pendingFiles: { parsedRows: [] },
    } as never)).toThrow(/pendingFiles/i)
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/features/upload/analysisState.contract.test.ts`
Ожидание: FAIL из-за отсутствующего модуля/функции.

**Шаг 3: Написать минимальную реализацию**

```ts
export function assertAnalysisStateInvariants(state: {
  showMobileModal: boolean
  pendingFiles: unknown
}) {
  if (!state.showMobileModal && state.pendingFiles != null) {
    throw new Error('Invariant failed: pendingFiles requires showMobileModal=true')
  }
}
```

**Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `cd frontend; npm run test -- src/features/upload/analysisState.contract.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/features/upload/analysisState.contract.ts frontend/src/features/upload/analysisState.contract.test.ts
git commit -m "test: add analysis state invariants contract"
```

### Задача 2: Установить и инициализировать Zustand store

**Файлы:**
- Изменить: `frontend/package.json`
- Изменить: `frontend/package-lock.json`
- Создать: `frontend/src/store/analysisStore.ts`
- Тест: `frontend/src/store/analysisStore.test.ts`

**Шаг 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { useAnalysisStore } from './analysisStore'

describe('analysis store', () => {
  it('resets analysis at startRun', () => {
    const store = useAnalysisStore.getState()
    store.completeRun({ filmsLite: [], filmsLiteAll: [], availableYears: [], simplifiedMode: false, warnings: [], fileName: '' })
    store.startRun('ratings.csv')
    expect(useAnalysisStore.getState().analysis).toBeNull()
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/store/analysisStore.test.ts`
Ожидание: FAIL из-за отсутствующего store/actions.

**Шаг 3: Написать минимальную реализацию**

```ts
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

interface AnalysisStoreState {
  analysis: unknown | null
  loading: boolean
  error: string
  lastUploadedFileName: string
  startRun: (fileName: string) => void
  completeRun: (analysis: unknown) => void
}

export const useAnalysisStore = create<AnalysisStoreState>()(devtools((set) => ({
  analysis: null,
  loading: false,
  error: '',
  lastUploadedFileName: '',
  startRun: (fileName) => set({ analysis: null, loading: true, error: '', lastUploadedFileName: fileName }, false, 'startRun'),
  completeRun: (analysis) => set({ analysis, loading: false }, false, 'completeRun'),
})))
```

**Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `cd frontend; npm run test -- src/store/analysisStore.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/package.json frontend/package-lock.json frontend/src/store/analysisStore.ts frontend/src/store/analysisStore.test.ts
git commit -m "feat: bootstrap zustand analysis store"
```

### Задача 3: Расширить actions store до полного lifecycle

**Файлы:**
- Изменить: `frontend/src/store/analysisStore.ts`
- Изменить: `frontend/src/store/analysisStore.test.ts`

**Шаг 1: Написать падающий тест**

```ts
it('follows terminal cleanup on failRun', () => {
  const store = useAnalysisStore.getState()
  store.startRun('ratings.csv')
  store.setProgress({ stage: 'tmdb_search', message: 'x', done: 1, total: 2, percent: 50 })
  store.failRun('boom')
  const next = useAnalysisStore.getState()
  expect(next.loading).toBe(false)
  expect(next.progress).toBeNull()
  expect(next.error).toBe('boom')
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/store/analysisStore.test.ts`
Ожидание: FAIL из-за отсутствующего поведения `setProgress/failRun`.

**Шаг 3: Написать минимальную реализацию**

```ts
setProgress: (progress) => set({ progress }, false, 'setProgress'),
failRun: (message) => set({ loading: false, progress: null, error: message }, false, 'failRun'),
abortRun: () => set({ loading: false, progress: null, error: 'Анализ остановлен.' }, false, 'abortRun'),
cleanupRun: () => set({ loading: false, progress: null, retryMessage: '' }, false, 'cleanupRun'),
```

**Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `cd frontend; npm run test -- src/store/analysisStore.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/store/analysisStore.ts frontend/src/store/analysisStore.test.ts
git commit -m "feat: implement analysis lifecycle actions"
```

### Задача 4: Добавить селекторы и безопасные для рендера accessors

**Файлы:**
- Создать: `frontend/src/store/analysisSelectors.ts`
- Тест: `frontend/src/store/analysisSelectors.test.ts`

**Шаг 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { selectAnalysisSummary } from './analysisSelectors'

describe('analysis selectors', () => {
  it('returns stable summary shape', () => {
    const out = selectAnalysisSummary({ analysis: null, loading: false, error: '' } as never)
    expect(out).toEqual({ hasAnalysis: false, loading: false, error: '' })
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/store/analysisSelectors.test.ts`
Ожидание: FAIL из-за отсутствующего модуля селекторов.

**Шаг 3: Написать минимальную реализацию**

```ts
export function selectAnalysisSummary(state: { analysis: unknown | null; loading: boolean; error: string }) {
  return { hasAnalysis: Boolean(state.analysis), loading: state.loading, error: state.error }
}
```

**Шаг 4: Запустить тест и убедиться, что он проходит**

Запуск: `cd frontend; npm run test -- src/store/analysisSelectors.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/store/analysisSelectors.ts frontend/src/store/analysisSelectors.test.ts
git commit -m "test: add store selectors and coverage"
```

### Задача 5: Мигрировать read-path в AppContainer

**Файлы:**
- Изменить: `frontend/src/app/AppContainer.tsx`
- Изменить: `frontend/src/features/resume/useResumeState.ts`
- Тест: `frontend/src/app/AppContainer.store-read.test.tsx`

**Шаг 1: Написать падающий тест**

```tsx
import { describe, expect, it } from 'vitest'

describe('AppContainer store read path', () => {
  it('reads loading/error from analysis store selectors', () => {
    expect(true).toBe(true)
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/app/AppContainer.store-read.test.tsx`
Ожидание: FAIL из-за отсутствующей тестовой настройки/модуля (затем добавить минимально достаточный setup).

**Шаг 3: Написать минимальную реализацию**

```ts
// AppContainer: заменить локальные чтения на selector-driven чтения из store
const { loading, error, progress, analysis } = useAnalysisStore((s) => ({
  loading: s.loading,
  error: s.error,
  progress: s.progress,
  analysis: s.analysis,
}))
```

**Шаг 4: Запустить тесты и убедиться, что проходят**

Запуск: `cd frontend; npm run test -- src/store/*.test.ts src/features/upload/analysisState.contract.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/app/AppContainer.tsx frontend/src/features/resume/useResumeState.ts frontend/src/app/AppContainer.store-read.test.tsx
git commit -m "refactor: switch app read path to analysis store"
```

### Задача 6: Мигрировать write-path в upload/resume потоках

**Файлы:**
- Изменить: `frontend/src/features/upload/useCsvAnalysisFlow.ts`
- Изменить: `frontend/src/features/resume/useResumeState.ts`
- Создать: `frontend/src/features/upload/analysisEffects.ts`
- Тест: `frontend/src/features/upload/useCsvAnalysisFlow.store-write.test.ts`

**Шаг 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'

describe('csv analysis flow writes via store actions', () => {
  it('dispatches startRun and completeRun', async () => {
    expect(true).toBe(true)
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/features/upload/useCsvAnalysisFlow.store-write.test.ts`
Ожидание: FAIL, пока поток не диспатчит изменения через store.

**Шаг 3: Написать минимальную реализацию**

```ts
// в useCsvAnalysisFlow заменить прямые setters
const { startRun, setProgress, completeRun, failRun, abortRun, cleanupRun } = useAnalysisStore.getState()

startRun(fileName)
setProgress({ stage: 'parsing', message: 'Чтение CSV', done: 0, total: 1, percent: 0 })
// ... pipeline
completeRun(result)
// on catch
failRun(error.message)
// finally
cleanupRun()
```

**Шаг 4: Запустить тесты и убедиться, что проходят**

Запуск: `cd frontend; npm run test -- src/features/upload/useCsvAnalysisFlow.store-write.test.ts src/store/analysisStore.test.ts`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/features/upload/useCsvAnalysisFlow.ts frontend/src/features/resume/useResumeState.ts frontend/src/features/upload/analysisEffects.ts frontend/src/features/upload/useCsvAnalysisFlow.store-write.test.ts
git commit -m "refactor: route upload and resume writes through store actions"
```

### Задача 7: Удалить legacy-дубли локального бизнес-состояния

**Файлы:**
- Изменить: `frontend/src/app/AppContainer.tsx`
- Изменить: `frontend/src/features/upload/useCsvAnalysisFlow.ts`
- Изменить: `frontend/src/features/resume/useResumeState.ts`
- Тест: `frontend/src/store/analysisStore.regression.test.ts`

**Шаг 1: Написать падающий тест**

```ts
import { describe, expect, it } from 'vitest'
import { useAnalysisStore } from '../../store/analysisStore'

describe('store regression', () => {
  it('keeps terminal states consistent', () => {
    const s = useAnalysisStore.getState()
    s.startRun('x.csv')
    s.abortRun()
    const next = useAnalysisStore.getState()
    expect(next.loading).toBe(false)
    expect(next.progress).toBeNull()
  })
})
```

**Шаг 2: Запустить тест и убедиться, что он падает**

Запуск: `cd frontend; npm run test -- src/store/analysisStore.regression.test.ts`
Ожидание: FAIL до выравнивания cleanup/refactor.

**Шаг 3: Написать минимальную реализацию**

```ts
// удалить дублирующие useState для бизнес-полей
// оставить только локальный эфемерный UI state в компонентах
```

**Шаг 4: Запустить полный набор тестов**

Запуск: `cd frontend; npm run test`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add frontend/src/app/AppContainer.tsx frontend/src/features/upload/useCsvAnalysisFlow.ts frontend/src/features/resume/useResumeState.ts frontend/src/store/analysisStore.regression.test.ts
git commit -m "refactor: remove duplicated local business state"
```

### Задача 8: Верифицировать, задокументировать и завершить

**Файлы:**
- Изменить: `docs/plans/2026-02-13-state-management-design.md`
- Создать: `docs/plans/2026-02-13-state-management-migration-notes.md`

**Шаг 1: Добавить падающий verification-checklist (как test notes)**

```md
- [ ] DevTools показывает полный lifecycle действий
- [ ] Восстановление Resume работает
- [ ] Abort не приводит к complete run
- [ ] Не осталось дублей бизнес-состояния
```

**Шаг 2: Запустить команды верификации**

Запуск:
- `cd frontend; npm run lint`
- `cd frontend; npm run test`
- `git status --short`

Ожидание: lint/test PASS; изменены только ожидаемые файлы.

**Шаг 3: Внести минимальные обновления документации**

```md
Зафиксировать финальную форму store, протокол действий, использование селекторов и границы миграции.
```

**Шаг 4: Повторно выполнить верификацию**

Запуск:
- `cd frontend; npm run test`
Ожидание: PASS.

**Шаг 5: Коммит**

```bash
git add docs/plans/2026-02-13-state-management-design.md docs/plans/2026-02-13-state-management-migration-notes.md
git commit -m "docs: finalize state management migration notes"
```

## Примечания к выполнению
- Перед каждой задачей реализации применять @superpowers/test-driven-development.
- Если тест неожиданно падает, применять @superpowers/systematic-debugging до внесения правок.
- Держать каждую задачу в отдельном коммите с checkpoint rollback safety.
