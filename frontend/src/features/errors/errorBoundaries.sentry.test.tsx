import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AppErrorBoundary } from './AppErrorBoundary'

const { captureException } = vi.hoisted(() => ({ captureException: vi.fn(() => 'event-id') }))
vi.mock('@sentry/react', () => ({ captureException }))

function Crash() {
  throw new Error('boom')
}

describe('error boundaries sentry integration', () => {
  it('captures crash in sentry', () => {
    expect(() =>
      render(
        <AppErrorBoundary>
          <Crash />
        </AppErrorBoundary>,
      ),
    ).not.toThrow()
    expect(captureException).toHaveBeenCalled()
  })
})
