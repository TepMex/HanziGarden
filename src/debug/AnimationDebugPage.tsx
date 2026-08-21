import { useRef, useState } from 'react'
import { Sparkles, Trophy } from 'lucide-react'
import { ACHIEVEMENTS } from '../achievements'
import { AchievementPopup } from '../achievements/AchievementUi'
import { assetUrl } from '../assetUrl'
import { battleArtworkForBiome } from '../data/battleBiomeArt'
import { biomes } from '../data/mapLayout'
import { XpToast } from '../XpToast'

type XpPreview = {
  amount: 1 | 3 | 5
  sequence: number
}

const xpAmounts = [1, 3, 5] as const
const debugBackdrop = battleArtworkForBiome(biomes[0]!.id).backgrounds.fullDirty

function randomAchievementId(): string {
  return ACHIEVEMENTS[Math.floor(Math.random() * ACHIEVEMENTS.length)]!.id
}

export function AnimationDebugPage() {
  const xpSequence = useRef(0)
  const [achievementId, setAchievementId] = useState<string | null>(null)
  const [xpPreview, setXpPreview] = useState<XpPreview | null>(null)

  const showXp = (amount: XpPreview['amount']) => {
    xpSequence.current += 1
    setXpPreview({ amount, sequence: xpSequence.current })
  }

  return (
    <main className="battle-screen animation-debug-screen">
      <div
        className="battle-backdrop"
        style={{ backgroundImage: `url(${JSON.stringify(assetUrl(debugBackdrop))})` }}
        aria-hidden="true"
      />

      <header className="prompt-scroll animation-debug-prompt">
        <span>Инструмент разработчика</span>
        <strong>АНИМАЦИИ НАГРАД</strong>
      </header>

      <div className="writing-circle animation-debug-writing-circle" aria-hidden="true">
        <span>田</span>
      </div>

      {xpPreview && (
        <XpToast earnedXp={xpPreview.amount} key={xpPreview.sequence} />
      )}

      <section className="animation-debug-controls" aria-label="Запуск анимаций наград">
        <button
          type="button"
          className="primary-button animation-debug-achievement"
          onClick={() => setAchievementId(randomAchievementId())}
        >
          <Trophy size={17} /> Случайное достижение
        </button>
        <div className="animation-debug-xp" role="group" aria-label="Выпадение очков опыта">
          <span><Sparkles size={15} /> XP</span>
          {xpAmounts.map((amount) => (
            <button type="button" onClick={() => showXp(amount)} key={amount}>+{amount}</button>
          ))}
        </div>
      </section>

      {achievementId && (
        <AchievementPopup achievementId={achievementId} onClose={() => setAchievementId(null)} />
      )}
    </main>
  )
}
