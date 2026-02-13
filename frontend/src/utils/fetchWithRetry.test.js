import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

import { fetchWithRetry } from './fetchWithRetry'

describe('fetchWithRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Math, 'random').mockReturnValue(0)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('retries on 429 using Retry-After and succeeds', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(new Response('rate limited', { status: 429, headers: { 'Retry-After': '2' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }))

    const onRetryMessage = vi.fn()
    const promise = fetchWithRetry('https://example.com', {}, { onRetryMessage })
    await vi.advanceTimersByTimeAsync(2000)
    const res = await promise

    expect(res.status).toBe(200)
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(onRetryMessage).toHaveBeenCalledWith('Слишком много запросов — ждём и продолжаем…')
  })

  it('retries on 5xx and then throws deterministic friendly error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad gateway', { status: 502 }))

    const onRetryMessage = vi.fn()
    const promise = fetchWithRetry('https://example.com', {}, { onRetryMessage })
    const assertion = expect(promise).rejects.toThrow('TMDb временно недоступен. Попробуйте позже.')
    await vi.advanceTimersByTimeAsync(31000)

    await assertion
    expect(onRetryMessage).toHaveBeenCalled()
  })

  it('retries network errors and throws friendly fallback after max retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'))

    const promise = fetchWithRetry('https://example.com')
    const assertion = expect(promise).rejects.toThrow('Сервис временно недоступен. Попробуйте позже.')
    await vi.advanceTimersByTimeAsync(31000)

    await assertion
  })

  it('propagates AbortError without wrapping', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(fetchWithRetry('https://example.com')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
