import { useMemo, useState } from 'react'
import { ArrowLeft, Leaf } from 'lucide-react'
import { characters, type CharacterDefinition } from '../data/model'
import type { SaveGame } from '../db'
import { getSrsStage, SRS_STAGES } from './srsStages'
import { AchievementCollection } from '../achievements/AchievementUi'
import type { SessionProgress } from '../progression'

function reviewDate(character: CharacterDefinition, save: SaveGame): string {
  const card = save.cards[character.id]
  if (!card) return 'ещё не назначено'
  const due = new Date(card.due)
  return Number.isNaN(due.getTime()) ? 'неизвестно' : due.toLocaleString('ru-RU', { dateStyle: 'medium', timeStyle: 'short' })
}

export function StatisticsScreen({ save, session, onBack }: { save: SaveGame; session?: SessionProgress; onBack: () => void }) {
  const [selected, setSelected] = useState<CharacterDefinition | null>(null)
  const [tab, setTab] = useState<'memory' | 'achievements'>('memory')
  const characterStages = useMemo(
    () => characters.map((character) => ({ character, stage: getSrsStage(save.cards[character.id]) })),
    [save.cards],
  )
  const stageCounts = useMemo(() => {
    const counts = new Map(SRS_STAGES.map((stage) => [stage.id, 0]))
    characterStages.forEach(({ stage }) => counts.set(stage.id, (counts.get(stage.id) ?? 0) + 1))
    return counts
  }, [characterStages])
  const studied = save.seenCharacterIds.length
  const rooted = characterStages.filter(({ stage }) => stage.index >= 6).length

  return (
    <main className="statistics-screen">
      <header className="statistics-header">
        <button className="stats-back" onClick={onBack}><ArrowLeft size={18} /> К карте</button>
        <div className="brand-mark"><Leaf size={18} /><span>Сад иероглифов</span></div>
      </header>

      <section className="statistics-content" aria-labelledby="statistics-title">
        <p className="eyebrow">Летопись сада</p>
        <h1 id="statistics-title">{tab === 'memory' ? 'Стена иероглифов' : 'Достижения'}</h1>
        <div className="statistics-tabs" role="tablist" aria-label="Раздел статистики">
          <button role="tab" aria-selected={tab === 'memory'} onClick={() => setTab('memory')}>Память</button>
          <button role="tab" aria-selected={tab === 'achievements'} onClick={() => setTab('achievements')}>Достижения</button>
        </div>
        {tab === 'memory' ? (
          <>
            <div className="statistics-totals">
              <span>Изучено: <strong>{studied} / {characters.length}</strong></span>
              <span>Закреплено: <strong>{rooted}</strong></span>
            </div>
            <div className="srs-legend" aria-label="Легенда стадий SRS">
              {SRS_STAGES.map((stage) => (
                <span className="srs-legend-item" key={stage.id}>
                  <i style={{ backgroundColor: stage.color }} /> {stage.label} <b>{stageCounts.get(stage.id)}</b>
                </span>
              ))}
            </div>
            {selected && (
              <aside className="character-detail" aria-live="polite">
                <strong>{selected.hanzi}</strong>
                <span>{selected.keyword.ru} · кадр {selected.frame}</span>
                <span>{getSrsStage(save.cards[selected.id]).label} · повтор: {reviewDate(selected, save)}</span>
              </aside>
            )}
            <div className="character-wall" aria-label="Все иероглифы в порядке кадров RTH">
              {characterStages.map(({ character, stage }) => {
                const label = `${character.hanzi}: ${character.keyword.ru}, кадр ${character.frame}, стадия ${stage.label}, повтор ${reviewDate(character, save)}`
                return (
                  <button className="character-tile" key={character.id} style={{ backgroundColor: stage.color }} onClick={() => setSelected(character)} onFocus={() => setSelected(character)} title={label} aria-label={label}>
                    {character.hanzi}
                  </button>
                )
              })}
            </div>
          </>
        ) : (
          <AchievementCollection persistence={save.achievements} player={save.playerProgress} session={session} />
        )}
      </section>
    </main>
  )
}
