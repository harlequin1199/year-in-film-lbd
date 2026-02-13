/**
 * Fetch wrapper: retry on 429 and 5xx with exponential backoff + jitter.
 * Backoff: 1s, 2s, 4s, 8s, 16s (max 30s). Jitter 0–250ms. Retry up to 5 times.
 */

const MAX_RETRIES = 5
const RETRY_AFTER_DEFAULT = 10
const BACKOFF_MS = [1000, 2000, 4000, 8000, 16000]
const BACKOFF_MAX_MS = 30000
const JITTER_MS = 250

function sleep(ms, signal) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms)
    signal?.addEventListener('abort', () => {
      clearTimeout(t)
      reject(new DOMException('Aborted', 'AbortError'))
    })
  })
}

function jitter() {
  return Math.floor(Math.random() * (JITTER_MS + 1))
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
        const delay = sec * 1000 + jitter()
        if (onRetryMessage) onRetryMessage('Слишком много запросов — ждём и продолжаем…')
        await sleep(delay, signal)
        lastError = new Error('Слишком много запросов. Попробуйте позже.')
        continue
      }

      if (res.status >= 500 && res.status <= 504) {
        const base = BACKOFF_MS[attempt] ?? 16000
        const delay = Math.min(BACKOFF_MAX_MS, base + jitter())
        if (onRetryMessage) onRetryMessage('TMDb временно недоступен — повторяем запрос…')
        await sleep(delay, signal)
        lastError = new Error('TMDb временно недоступен. Попробуйте позже.')
        continue
      }

      const text = await res.text()
      const nonRetryableError = new Error(text || `Ошибка ${res.status}`)
      nonRetryableError.isRetryable = false
      throw nonRetryableError
    } catch (err) {
      if (err?.name === 'AbortError') throw err
      if (err?.isRetryable === false) throw err
      lastError = err
      if (attempt === MAX_RETRIES - 1) break

      const base = BACKOFF_MS[attempt] ?? 16000
      const delay = Math.min(BACKOFF_MAX_MS, base + jitter())
      if (onRetryMessage) onRetryMessage('TMDb временно недоступен — повторяем запрос…')
      await sleep(delay, signal)
    }
  }
  const msg = lastError?.message || 'Не удалось загрузить данные'
  const friendly = /TMDb|запрос|недоступен|подождите/i.test(msg) ? msg : 'Сервис временно недоступен. Попробуйте позже.'
  throw new Error(friendly)
}
