import { Lock, Sparkles } from 'lucide-react'
import { assetUrl } from '../assetUrl'
import {
  ACHIEVEMENTS,
  achievementById,
  achievementProgress,
  type AchievementCategory,
  type AchievementDefinition,
  type AchievementPersistence,
} from '../achievements'
import type { PlayerProgress, SessionProgress } from '../progression'

function spritePosition(achievement: AchievementDefinition): string {
  const { atlas, index } = achievement.badge
  const columns = atlas === 'biome' ? 5 : 4
  const rows = atlas === 'biome' ? 3 : 2
  const column = index % columns
  const row = Math.floor(index / columns)
  return `${column / (columns - 1) * 100}% ${row / (rows - 1) * 100}%`
}

export function AchievementBadge({ achievement, locked = false, large = false }: { achievement: AchievementDefinition; locked?: boolean; large?: boolean }) {
  const atlas = achievement.badge.atlas
  return (
    <span
      className={`achievement-badge is-${atlas} ${locked ? 'is-locked' : ''} ${large ? 'is-large' : ''}`}
      style={{
        backgroundImage: `url(${JSON.stringify(assetUrl(`assets/achievements/${atlas === 'biome' ? 'biome-badges.png' : 'category-badges.png'}`))})`,
        backgroundPosition: spritePosition(achievement),
      }}
      aria-hidden="true"
    >{locked && <Lock />}</span>
  )
}

export function AchievementPopup({ achievementId, onClose }: { achievementId: string; onClose: () => void }) {
  const achievement = achievementById.get(achievementId)
  if (!achievement) return null
  return (
    <div className="achievement-popup-backdrop" role="presentation">
      <section className="achievement-popup" role="dialog" aria-modal="true" aria-labelledby="achievement-popup-title">
        <div className="achievement-seal">成</div>
        <p className="achievement-popup-eyebrow">Достижение получено</p>
        <AchievementBadge achievement={achievement} large />
        <h2 id="achievement-popup-title">{achievement.title}</h2>
        <p>{achievement.description}</p>
        <button className="primary-button" onClick={onClose}>Продолжить <Sparkles size={17} /></button>
        <i className="achievement-spark spark-1" /><i className="achievement-spark spark-2" /><i className="achievement-spark spark-3" />
      </section>
    </div>
  )
}

const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  daily: 'Ежедневная практика',
  combo: 'Комбо',
  biome: 'Биомы',
  session: 'Сессии',
  writing: 'Письмо',
  statistics: 'Статистика',
  recovery: 'Возвращение',
  secret: 'Тайны сада',
}

export function AchievementCollection({
  persistence,
  player,
  session,
}: {
  persistence: AchievementPersistence
  player: PlayerProgress
  session?: SessionProgress
}) {
  const unlocked = new Map(persistence.unlockedAchievements.map((item) => [item.id, item]))
  const categories = Object.keys(CATEGORY_LABELS) as AchievementCategory[]
  return (
    <div className="achievement-collection">
      <div className="achievement-collection-summary">
        <strong>{unlocked.size} / {ACHIEVEMENTS.length}</strong>
        <span>открыто в коллекции</span>
      </div>
      {categories.map((category) => {
        const items = ACHIEVEMENTS.filter((item) => item.category === category)
        if (items.length === 0) return null
        return (
          <section className="achievement-group" key={category}>
            <h2>{CATEGORY_LABELS[category]}</h2>
            <div className="achievement-grid">
              {items.map((achievement) => {
                const unlock = unlocked.get(achievement.id)
                const locked = !unlock
                const hidden = locked && achievement.secret
                const progress = achievementProgress(achievement, persistence, player, session)
                const isDuration = achievement.id.startsWith('session_')
                return (
                  <article className={`achievement-card ${locked ? 'is-locked' : 'is-unlocked'}`} key={achievement.id}>
                    <AchievementBadge achievement={achievement} locked={locked} />
                    <div>
                      <h3>{hidden ? 'Скрытое достижение' : achievement.title}</h3>
                      <p>{hidden ? 'Условие пока скрыто.' : achievement.description}</p>
                      {!hidden && locked && achievement.target !== undefined && progress !== undefined && (
                        <span className="achievement-counter">
                          {isDuration ? `${Math.floor(Math.min(progress, achievement.target) / 60_000)} / ${achievement.target / 60_000} мин` : `${Math.min(progress, achievement.target)} / ${achievement.target}`}
                        </span>
                      )}
                      {unlock && <time dateTime={unlock.unlockedAt}>{new Date(unlock.unlockedAt).toLocaleDateString('ru-RU')}</time>}
                    </div>
                  </article>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
  )
}
