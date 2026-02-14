import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { FeatureErrorBoundary } from './FeatureErrorBoundary'

function Broken() {
  throw new Error('feature crash')
}

describe('FeatureErrorBoundary', () => {
  it('renders feature fallback on render crash', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    render(
      <FeatureErrorBoundary featureName="report">
        <Broken />
      </FeatureErrorBoundary>,
    )
    expect(screen.getByText(/error id/i)).toBeInTheDocument()
  })
})
