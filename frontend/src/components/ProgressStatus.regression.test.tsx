import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import ProgressStatus from './ProgressStatus'
import type { Progress } from '../types'

describe('ProgressStatus regression', () => {
  it('uses canonical stage label for known stage even if incoming message is garbled', () => {
    const progress: Progress = {
      stage: 'tmdb_search',
      message: '����� ������� � TMDb',
      done: 10,
      total: 100,
      percent: 10,
    }

    render(<ProgressStatus progress={progress} />)

    expect(screen.getByText('Поиск фильмов в TMDb', { selector: '.progress-title' })).toBeInTheDocument()
  })
})
