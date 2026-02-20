import { BadgeCard } from '../../../entities/stats/ui/badge-card/BadgeCard'
import { CardSectionHeader } from '../../../shared/ui/card-section-header'
import type { Badge } from '../../../types/stats.types'

interface BadgesWidgetProps {
  badges: Badge[]
}

function BadgesWidget({ badges }: BadgesWidgetProps) {
  const items = badges || []

  return (
    <section className="card badges-widget">
      <CardSectionHeader title="Бейджи" description="Прогресс по небольшим целям" />
      <div className="badge-grid">
        {items.map((badge) => (
          <BadgeCard badge={badge} key={badge.title} />
        ))}
      </div>
    </section>
  )
}

export default BadgesWidget
