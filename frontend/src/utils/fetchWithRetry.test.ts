import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchWithRetry } from './fetchWithRetry'

const RU_TOO_MANY_REQUESTS_WAIT = '\u0421\u043b\u0438\u0448\u043a\u043e\u043c \u043c\u043d\u043e\u0433\u043e \u0437\u0430\u043f\u0440\u043e\u0441\u043e\u0432 \u2014 \u0436\u0434\u0451\u043c \u0438 \u043f\u0440\u043e\u0434\u043e\u043b\u0436\u0430\u0435\u043c\u2026'
const RU_TMDB_UNAVAILABLE = 'TMDb \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.'
const RU_SERVICE_UNAVAILABLE = '\u0421\u0435\u0440\u0432\u0438\u0441 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d. \u041f\u043e\u043f\u0440\u043e\u0431\u0443\u0439\u0442\u0435 \u043f\u043e\u0437\u0436\u0435.'

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
    expect(onRetryMessage).toHaveBeenCalledWith(RU_TOO_MANY_REQUESTS_WAIT)
  })

  it('retries on 5xx and then throws deterministic friendly error', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('bad gateway', { status: 502 }))

    const onRetryMessage = vi.fn()
    const promise = fetchWithRetry('https://example.com', {}, { onRetryMessage })
    const assertion = expect(promise).rejects.toThrow(RU_TMDB_UNAVAILABLE)
    await vi.advanceTimersByTimeAsync(31000)

    await assertion
    expect(onRetryMessage).toHaveBeenCalled()
  })

  it('retries network errors and throws friendly fallback after max retries', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new TypeError('Network down'))

    const promise = fetchWithRetry('https://example.com')
    const assertion = expect(promise).rejects.toThrow(RU_SERVICE_UNAVAILABLE)
    await vi.advanceTimersByTimeAsync(31000)

    await assertion
  })

  it('propagates AbortError without wrapping', async () => {
    vi.spyOn(globalThis, 'fetch').mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    await expect(fetchWithRetry('https://example.com')).rejects.toMatchObject({ name: 'AbortError' })
  })
})
