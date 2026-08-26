export type PlayerProgress = {
  totalXp: number
  lifetimeCorrectStrokes: number
  lifetimeErrors: number
  lifetimeCompletedKanji: number
  lifetimeCompletedBeds: number
  bestComboEver: number
  perfectComplexKanjiCount: number
  completedBiomeIds: string[]
}

export type SessionProgress = {
  combo: number
  bestComboThisSession: number
  correctStrokeCount: number
  errorCount: number
  earnedXp: number
  comboBonusXp: number
  activeMs: number
  completedBeds: number
  consecutiveBadKanji: number
  recoveryPerfectRun: number
  badRunRecoveryArmed: boolean
  comboRecoveryArmed: boolean
}

export type KanjiReward = {
  kanjiXp: number
  comboBonusXp: number
  earnedXp: number
  previousCombo: number
  combo: number
  levelsGained: number[]
}

export type LevelProgress = {
  level: number
  xpAtLevelStart: number
  xpAtNextLevel: number
  xpInsideLevel: number
  xpNeededInsideLevel: number
}

export const initialPlayerProgress: PlayerProgress = {
  totalXp: 0,
  lifetimeCorrectStrokes: 0,
  lifetimeErrors: 0,
  lifetimeCompletedKanji: 0,
  lifetimeCompletedBeds: 0,
  bestComboEver: 0,
  perfectComplexKanjiCount: 0,
  completedBiomeIds: [],
}

export const initialSessionProgress: SessionProgress = {
  combo: 0,
  bestComboThisSession: 0,
  correctStrokeCount: 0,
  errorCount: 0,
  earnedXp: 0,
  comboBonusXp: 0,
  activeMs: 0,
  completedBeds: 0,
  consecutiveBadKanji: 0,
  recoveryPerfectRun: 0,
  badRunRecoveryArmed: false,
  comboRecoveryArmed: false,
}

export function xpForCompletedKanji(correctStrokeCount: number, errorCount: number): number {
  return Math.max(1, Math.max(0, Math.trunc(correctStrokeCount)) - Math.max(0, Math.trunc(errorCount)))
}

export function comboMilestoneBonus(previousCombo: number, nextCombo: number): number {
  if (nextCombo <= previousCombo) return 0
  const fixed = new Map([[3, 1], [5, 2], [10, 3], [20, 5], [50, 8], [100, 12]])
  if (fixed.has(nextCombo)) return fixed.get(nextCombo)!
  return nextCombo > 100 && nextCombo % 50 === 0 ? 10 : 0
}

export function xpForNextLevel(level: number): number {
  return 100 + 20 * (Math.max(1, Math.trunc(level)) - 1)
}

export function totalXpForLevel(level: number): number {
  const n = Math.max(0, Math.trunc(level) - 1)
  return 10 * n * n + 90 * n
}

export function levelForTotalXp(totalXp: number): number {
  const xp = Math.max(0, Math.floor(totalXp))
  // Positive root of 10n² + 90n <= xp, adjusted to avoid floating-point edges.
  let level = Math.floor((-90 + Math.sqrt(8100 + 40 * xp)) / 20) + 1
  while (totalXpForLevel(level + 1) <= xp) level += 1
  while (totalXpForLevel(level) > xp) level -= 1
  return Math.max(1, level)
}

export function getLevelProgress(totalXp: number): LevelProgress {
  const xp = Math.max(0, Math.floor(totalXp))
  const level = levelForTotalXp(xp)
  const xpAtLevelStart = totalXpForLevel(level)
  const xpAtNextLevel = totalXpForLevel(level + 1)
  return {
    level,
    xpAtLevelStart,
    xpAtNextLevel,
    xpInsideLevel: xp - xpAtLevelStart,
    xpNeededInsideLevel: xpAtNextLevel - xpAtLevelStart,
  }
}

export function crossedLevels(previousTotalXp: number, nextTotalXp: number): number[] {
  const previousLevel = levelForTotalXp(previousTotalXp)
  const nextLevel = levelForTotalXp(nextTotalXp)
  return Array.from({ length: Math.max(0, nextLevel - previousLevel) }, (_, index) => previousLevel + index + 1)
}

export function completeKanji(
  player: PlayerProgress,
  session: SessionProgress,
  input: { correctStrokeCount: number; errorCount: number; strokeCount: number },
): { player: PlayerProgress; session: SessionProgress; reward: KanjiReward } {
  const correctStrokeCount = Math.max(0, Math.trunc(input.correctStrokeCount))
  const errorCount = Math.max(0, Math.trunc(input.errorCount))
  const previousCombo = session.combo
  const combo = errorCount === 0 ? previousCombo + 1 : 0
  const kanjiXp = xpForCompletedKanji(correctStrokeCount, errorCount)
  const comboBonusXp = comboMilestoneBonus(previousCombo, combo)
  const earnedXp = kanjiXp + comboBonusXp
  const nextTotalXp = player.totalXp + earnedXp
  const badRunRecoveryArmed = session.badRunRecoveryArmed || (errorCount > 0 && session.consecutiveBadKanji + 1 >= 3)
  const consecutiveBadKanji = errorCount > 0 ? session.consecutiveBadKanji + 1 : 0
  const recoveryPerfectRun = errorCount === 0 && badRunRecoveryArmed ? session.recoveryPerfectRun + 1 : 0

  return {
    player: {
      ...player,
      totalXp: nextTotalXp,
      lifetimeCorrectStrokes: player.lifetimeCorrectStrokes + correctStrokeCount,
      lifetimeErrors: player.lifetimeErrors + errorCount,
      lifetimeCompletedKanji: player.lifetimeCompletedKanji + 1,
      bestComboEver: Math.max(player.bestComboEver, combo),
      perfectComplexKanjiCount: player.perfectComplexKanjiCount + (errorCount === 0 && input.strokeCount >= 15 ? 1 : 0),
    },
    session: {
      ...session,
      combo,
      bestComboThisSession: Math.max(session.bestComboThisSession, combo),
      correctStrokeCount: session.correctStrokeCount + correctStrokeCount,
      errorCount: session.errorCount + errorCount,
      earnedXp: session.earnedXp + earnedXp,
      comboBonusXp: session.comboBonusXp + comboBonusXp,
      consecutiveBadKanji,
      recoveryPerfectRun,
      badRunRecoveryArmed,
      comboRecoveryArmed: session.comboRecoveryArmed || (errorCount > 0 && previousCombo >= 20),
    },
    reward: {
      kanjiXp,
      comboBonusXp,
      earnedXp,
      previousCombo,
      combo,
      levelsGained: crossedLevels(player.totalXp, nextTotalXp),
    },
  }
}

/**
 * The guided first trace is a teaching beat, not a completed memory review.
 * It grants its fixed reward without changing combo or lifetime handwriting
 * counters; the immediately following recall attempt owns those statistics.
 */
export function completeInitialTrace(
  player: PlayerProgress,
  session: SessionProgress,
): { player: PlayerProgress; session: SessionProgress; reward: KanjiReward } {
  const earnedXp = 1
  const nextTotalXp = player.totalXp + earnedXp
  return {
    player: { ...player, totalXp: nextTotalXp },
    session: { ...session, earnedXp: session.earnedXp + earnedXp },
    reward: {
      kanjiXp: earnedXp,
      comboBonusXp: 0,
      earnedXp,
      previousCombo: session.combo,
      combo: session.combo,
      levelsGained: crossedLevels(player.totalXp, nextTotalXp),
    },
  }
}

export function completeBed(
  player: PlayerProgress,
  session: SessionProgress,
  completedBiomeIds: readonly string[],
): { player: PlayerProgress; session: SessionProgress } {
  return {
    player: {
      ...player,
      lifetimeCompletedBeds: player.lifetimeCompletedBeds + 1,
      completedBiomeIds: [...new Set([...player.completedBiomeIds, ...completedBiomeIds])],
    },
    session: { ...session, completedBeds: session.completedBeds + 1 },
  }
}

export function advanceActiveSession(session: SessionProgress, elapsedMs: number): SessionProgress {
  return { ...session, activeMs: session.activeMs + Math.max(0, elapsedMs) }
}
