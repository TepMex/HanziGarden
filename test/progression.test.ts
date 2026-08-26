import { describe, expect, test } from 'bun:test'
import {
  comboMilestoneBonus,
  completeInitialTrace,
  completeKanji,
  crossedLevels,
  getLevelProgress,
  initialPlayerProgress,
  initialSessionProgress,
  levelForTotalXp,
  totalXpForLevel,
  xpForCompletedKanji,
} from '../src/progression'

describe('XP', () => {
  test.each([[6, 0, 6], [6, 3, 3], [6, 20, 1]])('%i correct and %i errors gives %i XP', (correct, errors, xp) => {
    expect(xpForCompletedKanji(correct, errors)).toBe(xp)
  })

  test('initial tracing always grants exactly 1 XP without changing combo or review statistics', () => {
    const player = { ...initialPlayerProgress, totalXp: 99, lifetimeCorrectStrokes: 12, lifetimeCompletedKanji: 3 }
    const session = { ...initialSessionProgress, combo: 4, earnedXp: 20 }
    const traced = completeInitialTrace(player, session)

    expect(traced.reward).toMatchObject({ kanjiXp: 1, comboBonusXp: 0, earnedXp: 1, previousCombo: 4, combo: 4 })
    expect(traced.player).toMatchObject({ totalXp: 100, lifetimeCorrectStrokes: 12, lifetimeCompletedKanji: 3 })
    expect(traced.session).toMatchObject({ combo: 4, earnedXp: 21 })
    expect(traced.reward.levelsGained).toEqual([2])
  })
})

describe('combo', () => {
  test('perfect kanji increments combo and an error resets it', () => {
    const perfect = completeKanji(initialPlayerProgress, initialSessionProgress, { correctStrokeCount: 6, errorCount: 0, strokeCount: 6 })
    expect(perfect.session.combo).toBe(1)
    const failed = completeKanji(perfect.player, perfect.session, { correctStrokeCount: 6, errorCount: 1, strokeCount: 6 })
    expect(failed.session.combo).toBe(0)
  })

  test.each([[2, 3, 1], [4, 5, 2], [9, 10, 3], [19, 20, 5], [49, 50, 8], [99, 100, 12], [149, 150, 10]])(
    '%i → %i gives %i bonus XP', (from, to, bonus) => expect(comboMilestoneBonus(from, to)).toBe(bonus),
  )

  test('milestones do not pay repeatedly', () => {
    expect(comboMilestoneBonus(10, 10)).toBe(0)
    expect(comboMilestoneBonus(10, 11)).toBe(0)
  })
})

describe('levels', () => {
  test.each([[0, 1], [99, 1], [100, 2], [219, 2], [220, 3], [520, 5], [28_420, 50]])(
    '%i XP is level %i', (xp, level) => expect(levelForTotalXp(xp)).toBe(level),
  )

  test('threshold formula remains deterministic', () => {
    expect(totalXpForLevel(100)).toBe(106_920)
    expect(getLevelProgress(241)).toEqual({ level: 3, xpAtLevelStart: 220, xpAtNextLevel: 360, xpInsideLevel: 21, xpNeededInsideLevel: 140 })
  })

  test('one reward can cross several levels in order', () => {
    expect(crossedLevels(440, 750)).toEqual([5, 6])
  })
})
