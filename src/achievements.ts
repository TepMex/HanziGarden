import { openContentDocument, type AchievementCatalogEntry } from './contentEditor/document'
import rawAchievementCatalog from './data/achievements.json'
import { evaluateAchievementFormula } from './data/achievementFormula'
import { beds, biomes } from './data/model'
import type { CardState } from './learning'
import { isCardDue } from './learning'
import type { PlayerProgress, SessionProgress } from './progression'

export type AchievementCategory = AchievementCatalogEntry['category']
export type AchievementProgressType = AchievementCatalogEntry['progressType']
export type AchievementDefinition = AchievementCatalogEntry

export type AchievementUnlock = { id: string; unlockedAt: string }

export type AchievementPersistence = {
  unlockedAchievements: AchievementUnlock[]
  currentDailyStreak: number
  bestDailyStreak: number
  lastActiveDate?: string
  perfectBedsToday: { date?: string; count: number }
}

export type AchievementEvent =
  | {
      type: 'kanji.completed'
      timestamp: number
      strokeCount: number
      errorCount: number
      earnedXp: number
      kanjiXp: number
      previousCombo: number
      combo: number
      finalStrokeError: boolean
    }
  | {
      type: 'gardenBed.completed'
      timestamp: number
      perfect: boolean
      earnedXp: number
      biomeId: string
      completedBiomeIds: string[]
    }
  | { type: 'session.activeTime'; timestamp: number; activeMs: number }
  | { type: 'player.migrated'; timestamp: number }

export const PERFECT_DAY_BED_TARGET = 3
export const SESSION_IDLE_TIMEOUT_MS = 150_000

export const initialAchievementPersistence: AchievementPersistence = {
  unlockedAchievements: [],
  currentDailyStreak: 0,
  bestDailyStreak: 0,
  perfectBedsToday: { count: 0 },
}

const catalog = openContentDocument('achievements.json', JSON.stringify(rawAchievementCatalog))
if (catalog.kind !== 'achievement-catalog') throw new Error('Achievement catalog must be a hanzi-garden.achievements document')
export const ACHIEVEMENTS: AchievementDefinition[] = catalog.achievements

export const achievementById = new Map(ACHIEVEMENTS.map((item) => [item.id, item]))

export function localDateKey(timestamp: number): string {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

function calendarDayDifference(earlier: string, later: string): number {
  const [ey, em, ed] = earlier.split('-').map(Number)
  const [ly, lm, ld] = later.split('-').map(Number)
  return Math.round((Date.UTC(ly!, lm! - 1, ld!) - Date.UTC(ey!, em! - 1, ed!)) / 86_400_000)
}

function unlock(state: AchievementPersistence, ids: readonly string[], timestamp: number): { state: AchievementPersistence; unlocked: string[] } {
  const already = new Set(state.unlockedAchievements.map((item) => item.id))
  const unique = [...new Set(ids)].filter((id) => achievementById.has(id) && !already.has(id))
  if (unique.length === 0) return { state, unlocked: [] }
  const unlockedAt = new Date(timestamp).toISOString()
  return {
    state: { ...state, unlockedAchievements: [...state.unlockedAchievements, ...unique.map((id) => ({ id, unlockedAt }))] },
    unlocked: unique,
  }
}

export function processAchievementEvents(
  initial: AchievementPersistence,
  player: PlayerProgress,
  session: SessionProgress,
  events: readonly AchievementEvent[],
): { state: AchievementPersistence; unlocked: string[] } {
  let state = structuredClone(initial)
  const allUnlocked: string[] = []

  for (const event of events) {
    let daysSinceLastActive = 0
    if (event.type === 'kanji.completed') {
      const today = localDateKey(event.timestamp)
      const priorDate = state.lastActiveDate
      if (priorDate !== today) {
        daysSinceLastActive = priorDate ? calendarDayDifference(priorDate, today) : 0
        state.currentDailyStreak = priorDate && daysSinceLastActive === 1 ? state.currentDailyStreak + 1 : 1
        state.bestDailyStreak = Math.max(state.bestDailyStreak, state.currentDailyStreak)
        state.lastActiveDate = today
      }
    } else if (event.type === 'gardenBed.completed') {
      const today = localDateKey(event.timestamp)
      if (state.perfectBedsToday.date !== today) state.perfectBedsToday = { date: today, count: 0 }
      if (event.perfect) state.perfectBedsToday.count += 1
    }

    const context = {
      event: event as unknown as Record<string, unknown>,
      player: player as unknown as Record<string, unknown>,
      session: session as unknown as Record<string, unknown>,
      persistence: state as unknown as Record<string, unknown>,
      daysSinceLastActive,
    }
    const candidates = ACHIEVEMENTS
      .filter((achievement) => achievement.formula.on.includes(event.type) && evaluateAchievementFormula(achievement.formula.when, context))
      .map((achievement) => achievement.id)

    const result = unlock(state, candidates, event.timestamp)
    state = result.state
    allUnlocked.push(...result.unlocked)
  }

  return { state, unlocked: allUnlocked }
}

export function completedBiomeIds(cards: Record<string, CardState>): string[] {
  return biomes.filter((biome) => beds
    .filter((bed) => bed.biomeId === biome.id)
    .every((bed) => bed.characters.every((character) => !isCardDue(cards[character.id]))))
    .map((biome) => biome.id)
}

export function achievementProgress(
  achievement: AchievementDefinition,
  persistence: AchievementPersistence,
  player: PlayerProgress,
  session?: SessionProgress,
): number | undefined {
  if (!achievement.target) return undefined
  if (achievement.id.startsWith('daily_')) return persistence.bestDailyStreak
  if (achievement.id.startsWith('combo_')) return player.bestComboEver
  if (achievement.id.startsWith('biomes_')) return player.completedBiomeIds.length
  if (achievement.id.startsWith('session_')) return session?.activeMs ?? 0
  if (achievement.id === 'perfect_10_complex_kanji') return player.perfectComplexKanjiCount
  if (achievement.id.startsWith('completed_kanji_')) return player.lifetimeCompletedKanji
  if (achievement.id.startsWith('correct_strokes_')) return player.lifetimeCorrectStrokes
  if (achievement.id === 'perfect_day') return persistence.perfectBedsToday.count
  if (achievement.id === 'ten_beds_session') return session?.completedBeds ?? 0
  return undefined
}
