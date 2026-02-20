import { render, screen } from '@testing-library/react'
import { expect, test } from 'vitest'
import type { Badge } from '../../../../types/stats.types'
import { BadgeCard } from './BadgeCard'

test('formats numeric badge value', () => {
  const badge: Badge = { title: 'A', value: 1200, subtitle: '', iconKey: 'film', tone: 'gold' }
  render(<BadgeCard badge={badge} />)
  expect(screen.getByText('1 200')).toBeInTheDocument()
})
