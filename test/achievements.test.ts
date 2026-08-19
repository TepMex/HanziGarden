import { expect, test } from 'bun:test'
import {
  ACHIEVEMENTS,
  initialAchievementPersistence,
  processAchievementEvents,
  type AchievementEvent,
} from '../src/achievements'
import { initialPlayerProgress, initialSessionProgress } from '../src/progression'

function kanji(overrides: Partial<Extract<AchievementEvent, { type: 'kanji.completed' }>> = {}): Extract<AchievementEvent, { type: 'kanji.completed' }> {
  return { type: 'kanji.completed', timestamp: new Date(2026, 7, 20, 12).getTime(), strokeCount: 6, errorCount: 0, earnedXp: 6, kanjiXp: 6, previousCombo: 0, combo: 1, finalStrokeError: false, ...overrides }
}

test('catalog stays unique and within the intended collection size', () => {
  expect(new Set(ACHIEVEMENTS.map((item) => item.id)).size).toBe(ACHIEVEMENTS.length)
  expect(ACHIEVEMENTS.length).toBeGreaterThanOrEqual(55)
  expect(ACHIEVEMENTS.length).toBeLessThanOrEqual(70)
})

test('daily streak increments once per local calendar day and resets after a skipped day', () => {
  const day1 = processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [kanji()]).state
  const sameDay = processAchievementEvents(day1, initialPlayerProgress, initialSessionProgress, [kanji({ timestamp: new Date(2026, 7, 20, 20).getTime() })]).state
  expect(sameDay.currentDailyStreak).toBe(1)
  const day2 = processAchievementEvents(sameDay, initialPlayerProgress, initialSessionProgress, [kanji({ timestamp: new Date(2026, 7, 21, 9).getTime() })]).state
  expect(day2.currentDailyStreak).toBe(2)
  const skipped = processAchievementEvents(day2, initialPlayerProgress, initialSessionProgress, [kanji({ timestamp: new Date(2026, 7, 23, 9).getTime() })]).state
  expect(skipped.currentDailyStreak).toBe(1)
})

test('return achievement unlocks after 30 absent calendar days', () => {
  const state = { ...initialAchievementPersistence, lastActiveDate: '2026-07-01', currentDailyStreak: 4, bestDailyStreak: 4 }
  const result = processAchievementEvents(state, initialPlayerProgress, initialSessionProgress, [kanji({ timestamp: new Date(2026, 7, 1, 9).getTime() })])
  expect(result.unlocked).toContain('return_after_30_days')
})

test.each([5, 10, 20, 50, 100, 250])('combo %i unlocks at its shared progression threshold', (combo) => {
  const result = processAchievementEvents(initialAchievementPersistence, { ...initialPlayerProgress, bestComboEver: combo }, { ...initialSessionProgress, combo }, [kanji({ combo, previousCombo: combo - 1 })])
  expect(result.unlocked).toContain(`combo_${combo}`)
})

test('one error makes a bed non-perfect and exact XP is exact', () => {
  const event = (perfect: boolean, earnedXp: number): AchievementEvent => ({ type: 'gardenBed.completed', timestamp: Date.now(), perfect, earnedXp, biomeId: 'biome-01', completedBiomeIds: [] })
  expect(processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [event(false, 100)]).unlocked).not.toContain('perfect_bed')
  expect(processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [event(true, 99)]).unlocked).not.toContain('exact_100_xp_bed')
  expect(processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [event(true, 100)]).unlocked).toContain('exact_100_xp_bed')
  expect(processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [event(true, 101)]).unlocked).not.toContain('exact_100_xp_bed')
})

test('session achievements use active milliseconds', () => {
  const event: AchievementEvent = { type: 'session.activeTime', timestamp: Date.now(), activeMs: 15 * 60_000 }
  expect(processAchievementEvents(initialAchievementPersistence, initialPlayerProgress, initialSessionProgress, [event]).unlocked).toContain('session_15m')
})

test('complex and error achievements use exact completion facts', () => {
  const complex = processAchievementEvents(initialAchievementPersistence, { ...initialPlayerProgress, perfectComplexKanjiCount: 1 }, initialSessionProgress, [kanji({ strokeCount: 20 })])
  expect(complex.unlocked).toEqual(expect.arrayContaining(['perfect_15_stroke_kanji', 'perfect_20_stroke_kanji']))
  const errors = processAchievementEvents(initialAchievementPersistence, { ...initialPlayerProgress, lifetimeErrors: 10 }, initialSessionProgress, [kanji({ errorCount: 10, earnedXp: 1, kanjiXp: 1, finalStrokeError: true })])
  expect(errors.unlocked).toEqual(expect.arrayContaining(['finish_after_10_errors', 'five_errors_one_kanji', 'error_on_final_stroke', 'one_xp_kanji']))
})

test('unlock is idempotent and does not change unlockedAt', () => {
  const first = processAchievementEvents(initialAchievementPersistence, { ...initialPlayerProgress, bestComboEver: 5 }, { ...initialSessionProgress, combo: 5 }, [kanji({ combo: 5, previousCombo: 4 })])
  const timestamp = first.state.unlockedAchievements.find((item) => item.id === 'combo_5')?.unlockedAt
  const second = processAchievementEvents(first.state, { ...initialPlayerProgress, bestComboEver: 6 }, { ...initialSessionProgress, combo: 6 }, [kanji({ combo: 6, previousCombo: 5 })])
  expect(second.unlocked).not.toContain('combo_5')
  expect(second.state.unlockedAchievements.find((item) => item.id === 'combo_5')?.unlockedAt).toBe(timestamp)
})

test('migration grants only achievements proven by persistent counters', () => {
  const player = { ...initialPlayerProgress, lifetimeCompletedKanji: 500, lifetimeCorrectStrokes: 1_000, bestComboEver: 20 }
  const result = processAchievementEvents(initialAchievementPersistence, player, initialSessionProgress, [{ type: 'player.migrated', timestamp: Date.now() }])
  expect(result.unlocked).toEqual(expect.arrayContaining(['completed_kanji_100', 'completed_kanji_500', 'correct_strokes_1000', 'combo_20']))
  expect(result.unlocked).not.toContain('exact_100_xp_bed')
  expect(result.unlocked).not.toContain('error_on_final_stroke')
})
