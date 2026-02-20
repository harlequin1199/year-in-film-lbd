interface CardSectionHeaderProps {
  title: string
  description: string
}

export function CardSectionHeader({ title, description }: CardSectionHeaderProps) {
  return (
    <div className="card-header">
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  )
}
