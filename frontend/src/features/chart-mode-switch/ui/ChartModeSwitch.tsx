import LoveScoreInfo from '../../../components/LoveScoreInfo'

export type ChartMode = 'count' | 'rating' | 'loveScore'

interface ChartModeSwitchProps {
  mode: ChartMode
  onChange: (mode: ChartMode) => void
}

export function ChartModeSwitch({ mode, onChange }: ChartModeSwitchProps) {
  return (
    <div className="byyear-tabs">
      <button
        type="button"
        className={`byyear-tab ${mode === 'count' ? 'active' : ''}`}
        onClick={() => onChange('count')}
      >
        ФИЛЬМЫ
      </button>
      <button
        type="button"
        className={`byyear-tab ${mode === 'rating' ? 'active' : ''}`}
        onClick={() => onChange('rating')}
      >
        ОЦЕНКИ
      </button>
      <button
        type="button"
        className={`byyear-tab ${mode === 'loveScore' ? 'active' : ''}`}
        onClick={() => onChange('loveScore')}
      >
        LOVE SCORE
      </button>
      <LoveScoreInfo variant="icon-only" className="byyear-love-score-info" />
    </div>
  )
}
