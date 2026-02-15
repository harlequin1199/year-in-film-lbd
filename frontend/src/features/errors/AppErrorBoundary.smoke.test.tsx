import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Crasher() {
  throw new Error('boom')
}

describe('AppErrorBoundary smoke', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    vi.spyOn(crypto, 'randomUUID').mockReturnValue('smoke-id')
  })

  it('shows fallback with error id on controlled crash', () => {
    render(
      <AppErrorBoundary>
        <Crasher />
      </AppErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toBeInTheDocument()
    expect(screen.getByText('Error ID: smoke-id')).toBeInTheDocument()
    expect(screen.getByText('boom')).toBeInTheDocument()
  })
})
