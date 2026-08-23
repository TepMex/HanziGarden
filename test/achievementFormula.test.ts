import { expect, test } from 'bun:test'
import { evaluateAchievementFormula, parseAchievementFormula } from '../src/data/achievementFormula'

const context = {
  event: { type: 'kanji.completed', errorCount: 0, strokeCount: 20, combo: 5, earnedXp: 6, completedBiomeIds: ['biome-01'] },
  player: { lifetimeCompletedKanji: 100, bestComboEver: 20, completedBiomeIds: ['biome-01', 'biome-02'] },
  session: { completedBeds: 10, comboRecoveryArmed: true, recoveryPerfectRun: 5 },
  persistence: { currentDailyStreak: 7, perfectBedsToday: { count: 3 } },
  daysSinceLastActive: 30,
}

test('comparison against an event field unlocks only when it holds', () => {
  expect(evaluateAchievementFormula('event.combo >= 5', context)).toBe(true)
  expect(evaluateAchievementFormula('event.combo >= 6', context)).toBe(false)
  expect(evaluateAchievementFormula('event.errorCount == 0 && event.strokeCount >= 15', context)).toBe(true)
})

test('conjunctions and disjunctions keep ordinary precedence', () => {
  expect(evaluateAchievementFormula('event.combo >= 50 || player.bestComboEver >= 20', context)).toBe(true)
  expect(evaluateAchievementFormula('event.errorCount == 0 && event.strokeCount >= 30 || player.bestComboEver >= 20', context)).toBe(true)
  expect(evaluateAchievementFormula('event.errorCount == 0 && (event.strokeCount >= 30 || player.bestComboEver >= 50)', context)).toBe(false)
})

test('player, session, persistence, and day-gap paths are readable', () => {
  expect(evaluateAchievementFormula('player.lifetimeCompletedKanji >= 100', context)).toBe(true)
  expect(evaluateAchievementFormula('session.completedBeds >= 10 && session.comboRecoveryArmed', context)).toBe(true)
  expect(evaluateAchievementFormula('persistence.currentDailyStreak >= 7 && persistence.perfectBedsToday.count >= 3', context)).toBe(true)
  expect(evaluateAchievementFormula('daysSinceLastActive >= 30', context)).toBe(true)
})

test('includes and length inspect lists, and missing paths stay false', () => {
  expect(evaluateAchievementFormula('includes(event.completedBiomeIds, "biome-01")', context)).toBe(true)
  expect(evaluateAchievementFormula('length(player.completedBiomeIds) >= 2', context)).toBe(true)
  expect(evaluateAchievementFormula('includes(event.missingIds, "biome-01")', context)).toBe(false)
  expect(evaluateAchievementFormula('event.perfect', context)).toBe(false)
})

test('rejects unknown identifiers and malformed expressions before they run', () => {
  expect(() => parseAchievementFormula('event.combo >=')).toThrow(/формул/)
  expect(() => parseAchievementFormula('unknownHelper(1)')).toThrow(/формул/)
  expect(() => parseAchievementFormula('player.lifetimeCompletedKanji >= 100;')).toThrow(/формул/)
})
