import Stars from '../../../components/Stars'
import { CardSectionHeader } from '../../../shared/ui/card-section-header'
import { formatRating, formatYear, formatLoveScore } from '../../../utils/format'
import { getLetterboxdDecadeUrl } from '../../../utils/letterboxdUrl'
import type { Film } from '../../../types/film.types'
import type { DecadeStats } from '../../../types/stats.types'

interface FavoriteDecadesWidgetProps {
  films: Film[]
  decades: DecadeStats[]
}

function FavoriteDecadesWidget({ films, decades }: FavoriteDecadesWidgetProps) {
  if (!films) return null

  const decadesList = (decades || []).slice(0, 3)

  const getPostersForDecade = (decadeNum: number): (string | null)[] => {
    return films
      .filter((film) => film.year != null && Math.floor(film.year / 10) * 10 === decadeNum)
      .map((film) => film.poster_url || null)
      .slice(0, 12)
  }

  return (
    <section className="card">
      <CardSectionHeader title="Любимые десятилетия" description="Самые сильные эпохи в вашей истории просмотров" />
      {decadesList.length === 0 && (
        <div className="decade-empty">
          Недостаточно данных для расчета десятилетий.
        </div>
      )}
      <div className="decade-list">
        {decadesList.map((decade, index) => {
          const rank = index + 1
          const rankClass = rank === 1 ? 'rank-1' : rank === 2 ? 'rank-2' : rank === 3 ? 'rank-3' : ''
          const posters = getPostersForDecade(decade.decade)
          return (
            <div className={`decade-row ${rankClass}`} key={decade.decade}>
              <div className="decade-info">
                <span className="decade-title">
                  <a
                    href={getLetterboxdDecadeUrl(decade.decade)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'inherit', textDecoration: 'none' }}
                  >
                    {formatYear(decade.decade)}-е
                  </a>
                </span>
                <div className="decade-rating">
                  <span>★ Средняя {formatRating(decade.avgRating)}</span>
                  <Stars rating={decade.avgRating} />
                  {decade.loveScore != null && (
                    <span className="decade-love-score">Love Score: {formatLoveScore(decade.loveScore)}</span>
                  )}
                </div>
              </div>
              <div className="decade-posters">
                {posters.map((poster, posterIndex) => (
                  <div className="decade-poster" key={`${decade.decade}-${posterIndex}`}>
                    {poster ? (
                      <img src={poster} alt="" loading="lazy" />
                    ) : (
                      <div className="decade-poster-fallback" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default FavoriteDecadesWidget
