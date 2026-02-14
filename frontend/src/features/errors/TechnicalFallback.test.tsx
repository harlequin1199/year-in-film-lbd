import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { TechnicalFallback } from './TechnicalFallback'

describe('TechnicalFallback', () => {
  it('shows error id and calls retry handler', async () => {
    const onRetry = vi.fn()
    render(
      <TechnicalFallback
        mode="feature"
        errorId="err-123"
        message="boom"
        onRetry={onRetry}
      />,
    )

    expect(screen.getByText(/err-123/i)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })
})
