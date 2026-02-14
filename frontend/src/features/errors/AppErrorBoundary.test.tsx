import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AppErrorBoundary } from './AppErrorBoundary'

function Broken() {
  throw new Error('render crash')
}

describe('AppErrorBoundary', () => {
  it('renders global fallback on render crash', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <AppErrorBoundary>
        <Broken />
      </AppErrorBoundary>,
    )
    expect(screen.getByText(/error id/i)).toBeInTheDocument()
  })
})
