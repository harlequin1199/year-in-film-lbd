import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { CardSectionHeader } from './CardSectionHeader'

test('renders title and description', () => {
  render(<CardSectionHeader title="Жанры" description="Доля жанров" />)
  expect(screen.getByRole('heading', { name: 'Жанры' })).toBeInTheDocument()
  expect(screen.getByText('Доля жанров')).toBeInTheDocument()
})
