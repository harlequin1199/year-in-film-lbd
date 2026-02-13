# Инструкция по генерации demo_report_1000.json

## Вариант 1: Использование фронтенда (рекомендуется)

1. Запустите фронтенд и бекенд
2. Нажмите кнопку "Загрузить демо-отчёт" на фронтенде
3. Дождитесь завершения обработки (может занять несколько минут для 1000 фильмов)
4. После завершения откройте консоль браузера (F12)
5. Выполните команду для сохранения отчёта из IndexedDB:

**Способ 1: Простой (если отчёт уже загружен на странице)**

```javascript
// В консоли браузера - используем данные из React state
// Сначала нужно получить доступ к React компоненту или использовать альтернативный способ
```

**Способ 2: Через IndexedDB напрямую (рекомендуется)**

```javascript
// В консоли браузера после загрузки отчёта
(async () => {
  const DB_NAME = 'year-in-film-cache';
  const DB_VERSION = 2;
  
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onsuccess = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('lastReport')) {
        console.error('lastReport store не найден');
        reject(new Error('lastReport store не найден'));
        return;
      }
      
      const tx = db.transaction('lastReport', 'readonly');
      const store = tx.objectStore('lastReport');
      const getReq = store.get('report');
      
      getReq.onsuccess = () => {
        const report = getReq.result;
        if (report) {
          const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = 'demo_report_1000.json';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('✅ Файл demo_report_1000.json загружен!');
          console.log(`📊 Фильмов в отчёте: ${report.filmsLite?.length || report.filmsLiteAll?.length || 0}`);
          resolve(report);
        } else {
          console.error('❌ Отчёт не найден в IndexedDB. Убедитесь, что обработка завершена.');
          reject(new Error('Отчёт не найден'));
        }
      };
      
      getReq.onerror = () => {
        console.error('❌ Ошибка чтения из IndexedDB:', getReq.error);
        reject(getReq.error);
      };
    };
    
    req.onerror = () => {
      console.error('❌ Ошибка открытия IndexedDB:', req.error);
      reject(req.error);
    };
    
    req.onupgradeneeded = () => {
      // Если нужна миграция, она произойдёт автоматически
    };
  });
})();
```

6. Сохраните загруженный файл `demo_report_1000.json` в директорию `backend/data/`

## Вариант 2: Использование скрипта (требует настройки)

Можно создать Python скрипт, который обработает CSV через TMDb API и создаст JSON файл.
Это требует реализации логики обработки, аналогичной фронтенду.

## Текущий статус

- ✅ `demo_ratings_1000.csv` - создан (1000 фильмов)
- ⏳ `demo_report_1000.json` - нужно сгенерировать

После создания `demo_report_1000.json` оба варианта загрузки демо-отчёта будут работать.
