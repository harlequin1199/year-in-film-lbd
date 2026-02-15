import { describe, expect, it, vi } from 'vitest'

vi.mock('@sentry/react', () => ({ init: vi.fn() }))

describe('shouldEnableSentry', () => {
  it('returns false when disabled', async () => {
    const mod = await import('./sentry')
    expect(mod.shouldEnableSentry({ VITE_SENTRY_ENABLED: 'false', VITE_SENTRY_DSN: 'x' })).toBe(false)
  })
})
