import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import ByYearChartWidget from './ByYearChartWidget'

test('renders chart mode buttons', () => {
  render(<ByYearChartWidget films={[]} yearsByLoveScore={[]} />)
  expect(screen.getByRole('button', { name: 'ФИЛЬМЫ' })).toBeInTheDocument()
})
