import { describe, expect, it, vi } from 'vitest'
import { postClientErrorEvent } from './clientErrorApi'

describe('postClientErrorEvent', () => {
  it('posts payload to /api/client-errors', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true })
    vi.stubGlobal('fetch', fetchMock)

    await postClientErrorEvent({
      errorId: 'e1',
      message: 'boom',
      stack: 'stack',
      componentStack: 'component',
      boundaryScope: 'global',
      featureName: null,
      route: '/',
      userAgent: 'ua',
      timestamp: '2026-02-14T00:00:00.000Z',
    })

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/client-errors',
      expect.objectContaining({
        method: 'POST',
      }),
    )
  })
})
