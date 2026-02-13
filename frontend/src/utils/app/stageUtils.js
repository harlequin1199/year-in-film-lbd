export function buildDemoStages(filmsCount) {
  return [
    { stage: 'parsing', message: 'Чтение CSV', percent: 4, delay: 300 },
    { stage: 'stage1', message: 'Базовая статистика', percent: 8, delay: 400 },
    { stage: 'tmdb_search', message: 'Поиск фильмов в TMDb', percent: 60, delay: 600 },
    { stage: 'tmdb_details', message: 'Загрузка данных TMDb', percent: 95, delay: 800 },
    { stage: 'finalizing', message: 'Финализация отчёта', percent: 100, delay: 300 },
  ].map((item) => ({ ...item, total: filmsCount, done: Math.round((item.percent / 100) * filmsCount) }))
}

export function buildDemoReportStages(filmsCount) {
  return [
    { stage: 'parsing', message: 'Загрузка демо-отчёта', percent: 30, delay: 300 },
    { stage: 'tmdb_search', message: 'Подготовка данных', percent: 60, delay: 400 },
    { stage: 'finalizing', message: 'Финализация отчёта', percent: 100, delay: 300 },
  ].map((item) => ({ ...item, total: filmsCount, done: Math.round((item.percent / 100) * filmsCount) }))
}

export async function playStageProgress(stages, setProgress, isAborted) {
  for (const stageInfo of stages) {
    if (isAborted()) return false
    setProgress({
      stage: stageInfo.stage,
      message: stageInfo.message,
      total: stageInfo.total,
      done: stageInfo.done,
      percent: stageInfo.percent,
    })
    await new Promise((resolve) => setTimeout(resolve, stageInfo.delay))
  }
  return true
}
