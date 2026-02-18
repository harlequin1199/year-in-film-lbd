import { describe, expect, it, vi } from 'vitest'
import * as Sentry from '@sentry/react'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

describe('shouldEnableSentry', () => {
  it('returns false when disabled', async () => {
    const mod = await import('./sentry')
    expect(mod.shouldEnableSentry({ VITE_SENTRY_ENABLED: 'false', VITE_SENTRY_DSN: 'x' })).toBe(false)
  })

  it('uses vercel commit sha as release fallback', async () => {
    const mod = await import('./sentry')
    mod.initSentry({
      VITE_SENTRY_ENABLED: 'true',
      VITE_SENTRY_DSN: 'https://example@sentry.io/1',
      VITE_SENTRY_ENVIRONMENT: 'production',
      VERCEL_GIT_COMMIT_SHA: 'abc1234',
    })

    expect(Sentry.init).toHaveBeenCalledWith(
      expect.objectContaining({
        release: 'abc1234',
      }),
    )
  })
})
