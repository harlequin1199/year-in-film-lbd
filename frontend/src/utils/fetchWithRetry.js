/**
 * Fetch wrapper: retry on 429 (Retry-After) and 5xx (exponential backoff).
 * Calls onRetryMessage(msg) for UI updates. Throws with friendly Russian message after max retries.
 */

const MAX_RETRIES = 5
const RETRY_AFTER_DEFAULT = 10

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

export async function fetchWithRetry(url, options = {}, { onRetryMessage } = {}) {
  const { signal } = options
  let lastError
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(url, { ...options, signal })
      if (res.ok) return res

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('Retry-After'), 10) || RETRY_AFTER_DEFAULT
        const sec = Math.min(60, Math.max(1, retryAfter))
        if (onRetryMessage) onRetryMessage('Слишком много запросов — ждём и продолжаем…')
        await sleep(sec * 1000, signal)
        lastError = new Error('Слишком много запросов. Попробуйте позже.')
        continue
      }

      if (res.status >= 500 && res.status <= 504) {
        const delay = Math.min(16000, 1000 * 2 ** attempt)
        if (onRetryMessage) onRetryMessage('TMDb временно недоступен — повторяем запрос…')
        await sleep(delay, signal)
        lastError = new Error('TMDb временно недоступен. Попробуйте позже.')
        continue
      }

      const text = await res.text()
      throw new Error(text || `Ошибка ${res.status}`)
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      lastError = err
      if (attempt === MAX_RETRIES - 1) break
      throw err
    }
  }
  const msg = lastError?.message || 'Не удалось загрузить данные'
  const friendly = /TMDb|запрос|недоступен|подождите/i.test(msg) ? msg : 'Сервис временно недоступен. Попробуйте позже.'
  throw new Error(friendly)
}
