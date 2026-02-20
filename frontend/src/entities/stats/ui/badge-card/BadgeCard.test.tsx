import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import { BadgeCard } from './BadgeCard'

test('formats numeric badge value', () => {
  render(<BadgeCard badge={{ title: 'A', value: 1200, subtitle: '', iconKey: 'film', tone: 'gold' } as any} />)
  expect(screen.getByText('1 200')).toBeInTheDocument()
})
