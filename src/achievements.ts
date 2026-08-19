import { beds, biomes } from './data/model'
import type { CardState } from './learning'
import { isCardDue } from './learning'
import type { PlayerProgress, SessionProgress } from './progression'

export type AchievementCategory = 'daily' | 'combo' | 'biome' | 'session' | 'writing' | 'statistics' | 'recovery' | 'secret'
export type AchievementProgressType = 'boolean' | 'counter' | 'max' | 'streak'

export type AchievementDefinition = {
  id: string
  category: AchievementCategory
  title: string
  description: string
  secret: boolean
  progressType: AchievementProgressType
  target?: number
  badge: { atlas: 'category' | 'biome'; index: number }
}

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

const categoryBadge: Record<AchievementCategory, number> = {
  daily: 0,
  combo: 1,
  biome: 2,
  session: 3,
  writing: 4,
  statistics: 5,
  recovery: 6,
  secret: 7,
}

function definition(
  id: string,
  category: AchievementCategory,
  title: string,
  description: string,
  options: { secret?: boolean; progressType?: AchievementProgressType; target?: number; badge?: AchievementDefinition['badge'] } = {},
): AchievementDefinition {
  return {
    id,
    category,
    title,
    description,
    secret: options.secret ?? false,
    progressType: options.progressType ?? (options.target ? 'counter' : 'boolean'),
    target: options.target,
    badge: options.badge ?? { atlas: 'category', index: categoryBadge[category] },
  }
}

export const BIOME_DETAILS = [
  ['Бамбуковая роща', 'Шёпот бамбука'],
  ['Рисовые террасы', 'Золотая вода'],
  ['Лотосовый пруд', 'Тихий лотос'],
  ['Чайный сад', 'Первая заварка'],
  ['Сад цветения', 'Весенний ветер'],
  ['Пионовый двор', 'Царь цветов'],
  ['Сад хризантем', 'Позднее золото'],
  ['Сосновая роща', 'Вечнозелёный покой'],
  ['Сад хурмы', 'Осенний фонарь'],
  ['Сад орхидей', 'Скрытый аромат'],
  ['Ягодный сад', 'Тёмные ягоды'],
  ['Рапсовое поле', 'Жёлтое море'],
  ['Пшеничное поле', 'Спелый колос'],
  ['Сад глициний', 'Лиловый дождь'],
  ['Сад лекарственных трав', 'Тайны травника'],
] as const

const dailyDefinitions = [
  [3, 'Росток'], [7, 'Привычка'], [14, 'Садовник'], [30, 'Месяц без засухи'],
  [90, 'Сезон'], [180, 'Полгода в поле'], [365, 'Год урожая'],
].map(([target, title]) => definition(`daily_${target}`, 'daily', String(title), `Заниматься ${target}${Number(target) === 3 ? ' дня' : ' дней'} подряд.`, { target: Number(target), progressType: 'streak' }))

const comboDefinitions = [
  [5, 'Твёрдая рука'], [10, 'Не дрогнул'], [20, 'На автомате'], [50, 'Каллиграф'],
  [100, 'Без единой ошибки'], [250, 'Машина'],
].map(([target, title]) => definition(`combo_${target}`, Number(target) === 250 ? 'secret' : 'combo', String(title), `Написать ${target} иероглифов подряд без ошибок.`, {
  target: Number(target), progressType: 'max', secret: Number(target) === 250,
}))

const biomeDefinitions = BIOME_DETAILS.map(([biomeName, title], index) => definition(
  `biome_${String(index + 1).padStart(2, '0')}_complete`, 'biome', title, `Полностью очистить ${biomeName}.`,
  { badge: { atlas: 'biome', index } },
))

export const ACHIEVEMENTS: AchievementDefinition[] = [
  ...dailyDefinitions,
  definition('return_after_30_days', 'recovery', 'Возвращение', 'Вернуться в Сад после перерыва не менее 30 дней.'),
  ...comboDefinitions,
  definition('perfect_bed', 'writing', 'С чистого листа', 'Полностью очистить грядку, не допустив ни одной ошибки.'),
  ...biomeDefinitions,
  definition('biomes_1', 'biome', 'Земледелец', 'Полностью очистить первый биом.', { target: 1 }),
  definition('biomes_5', 'biome', 'Путешественник', 'Полностью очистить 5 биомов.', { target: 5 }),
  definition('biomes_10', 'biome', 'За горизонтом', 'Полностью очистить 10 биомов.', { target: 10 }),
  definition('biomes_15', 'biome', 'Хозяин земли', 'Полностью очистить все 15 биомов.', { target: 15 }),
  ...[[15, 'Размялся'], [30, 'Вошёл в ритм'], [60, 'Час в поле'], [90, 'Не разгибая спины'], [120, 'Сегодня всё поле моё']]
    .map(([minutes, title]) => definition(`session_${minutes}m`, 'session', String(title), `Провести ${minutes} минут активной практики за одну сессию.`, { target: Number(minutes) * 60_000, progressType: 'max' })),
  definition('perfect_15_stroke_kanji', 'writing', 'Сложный характер', 'Идеально написать иероглиф минимум из 15 штрихов.'),
  definition('perfect_20_stroke_kanji', 'writing', 'Тяжёлая артиллерия', 'Идеально написать иероглиф минимум из 20 штрихов.'),
  definition('perfect_10_complex_kanji', 'writing', 'Хирургическая точность', 'Идеально написать 10 иероглифов минимум из 15 штрихов.', { target: 10 }),
  ...[[100, 'Первые всходы'], [500, 'Работа кипит'], [1_000, 'Опытный садовник'], [5_000, 'Хранитель сада'], [10_000, 'Сад без конца']]
    .map(([target, title]) => definition(`completed_kanji_${target}`, 'statistics', String(title), `Уничтожить ${Number(target).toLocaleString('ru-RU')} сорняков.`, { target: Number(target) })),
  ...[[1_000, 'Тысяча штрихов'], [10_000, 'Десять тысяч движений'], [100_000, 'Сто тысяч штрихов']]
    .map(([target, title]) => definition(`correct_strokes_${target}`, 'statistics', String(title), `Выполнить ${Number(target).toLocaleString('ru-RU')} правильных штрихов.`, { target: Number(target) })),
  definition('finish_after_10_errors', 'secret', 'Упрямее сорняка', 'Завершить один иероглиф, допустив не менее 10 ошибок.', { secret: true }),
  definition('first_error', 'secret', 'Это была разминка', 'Допустить первую ошибку.', { secret: true }),
  definition('five_errors_one_kanji', 'recovery', 'Методом исключения', 'Допустить минимум 5 ошибок на одном иероглифе и всё-таки завершить его.'),
  definition('recover_after_combo_20', 'recovery', 'Не сегодня', 'После потери большого Combo снова набрать 10 безошибочных иероглифов.'),
  definition('recover_after_bad_run', 'recovery', 'Второе дыхание', 'После трёх неудачных иероглифов написать 5 идеально.'),
  definition('error_on_final_stroke', 'secret', 'На последнем штрихе', 'Ошибиться на последнем требуемом штрихе.', { secret: true }),
  definition('break_combo_49', 'secret', 'Ну почти', 'Потерять Combo на значении 49.', { secret: true }),
  definition('perfect_day', 'session', 'Идеальный день', `Идеально очистить ${PERFECT_DAY_BED_TARGET} грядки за один день.`, { target: PERFECT_DAY_BED_TARGET }),
  definition('exact_100_xp_bed', 'secret', 'Ровно в цель', 'Закончить грядку, заработав ровно 100 XP.', { secret: true }),
  definition('one_xp_kanji', 'secret', 'Один XP', 'Завершить иероглиф, получив минимально возможный +1 XP.', { secret: true }),
  definition('ten_beds_session', 'session', 'Комбайн', 'Очистить 10 грядок за одну игровую сессию.', { target: 10 }),
]

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

function thresholdIds(prefix: string, thresholds: readonly number[], value: number): string[] {
  return thresholds.filter((target) => value >= target).map((target) => `${prefix}${target}`)
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
    const candidates: string[] = []
    if (event.type === 'kanji.completed') {
      const today = localDateKey(event.timestamp)
      const priorDate = state.lastActiveDate
      if (priorDate !== today) {
        const difference = priorDate ? calendarDayDifference(priorDate, today) : 0
        if (priorDate && difference >= 30) candidates.push('return_after_30_days')
        state.currentDailyStreak = priorDate && difference === 1 ? state.currentDailyStreak + 1 : 1
        state.bestDailyStreak = Math.max(state.bestDailyStreak, state.currentDailyStreak)
        state.lastActiveDate = today
      }
      candidates.push(...thresholdIds('daily_', [3, 7, 14, 30, 90, 180, 365], state.currentDailyStreak))
      candidates.push(...thresholdIds('combo_', [5, 10, 20, 50, 100, 250], event.combo))
      candidates.push(...thresholdIds('completed_kanji_', [100, 500, 1_000, 5_000, 10_000], player.lifetimeCompletedKanji))
      candidates.push(...thresholdIds('correct_strokes_', [1_000, 10_000, 100_000], player.lifetimeCorrectStrokes))
      if (event.errorCount === 0 && event.strokeCount >= 15) candidates.push('perfect_15_stroke_kanji')
      if (event.errorCount === 0 && event.strokeCount >= 20) candidates.push('perfect_20_stroke_kanji')
      if (player.perfectComplexKanjiCount >= 10) candidates.push('perfect_10_complex_kanji')
      if (event.errorCount >= 10) candidates.push('finish_after_10_errors')
      if (player.lifetimeErrors > 0) candidates.push('first_error')
      if (event.errorCount >= 5) candidates.push('five_errors_one_kanji')
      if (session.comboRecoveryArmed && event.combo >= 10) candidates.push('recover_after_combo_20')
      if (session.badRunRecoveryArmed && session.recoveryPerfectRun >= 5) candidates.push('recover_after_bad_run')
      if (event.finalStrokeError) candidates.push('error_on_final_stroke')
      if (event.errorCount > 0 && event.previousCombo === 49) candidates.push('break_combo_49')
      if (event.earnedXp === 1) candidates.push('one_xp_kanji')
    } else if (event.type === 'gardenBed.completed') {
      const today = localDateKey(event.timestamp)
      if (state.perfectBedsToday.date !== today) state.perfectBedsToday = { date: today, count: 0 }
      if (event.perfect) {
        state.perfectBedsToday.count += 1
        candidates.push('perfect_bed')
      }
      for (const biomeId of event.completedBiomeIds) {
        const index = biomes.findIndex((biome) => biome.id === biomeId)
        if (index >= 0) candidates.push(`biome_${String(index + 1).padStart(2, '0')}_complete`)
      }
      candidates.push(...thresholdIds('biomes_', [1, 5, 10, 15], player.completedBiomeIds.length))
      if (state.perfectBedsToday.count >= PERFECT_DAY_BED_TARGET) candidates.push('perfect_day')
      if (event.earnedXp === 100) candidates.push('exact_100_xp_bed')
      if (session.completedBeds >= 10) candidates.push('ten_beds_session')
    } else if (event.type === 'session.activeTime') {
      for (const minutes of [15, 30, 60, 90, 120]) {
        if (event.activeMs >= minutes * 60_000) candidates.push(`session_${minutes}m`)
      }
    } else {
      candidates.push(...thresholdIds('combo_', [5, 10, 20, 50, 100, 250], player.bestComboEver))
      candidates.push(...thresholdIds('completed_kanji_', [100, 500, 1_000, 5_000, 10_000], player.lifetimeCompletedKanji))
      candidates.push(...thresholdIds('correct_strokes_', [1_000, 10_000, 100_000], player.lifetimeCorrectStrokes))
      candidates.push(...thresholdIds('biomes_', [1, 5, 10, 15], player.completedBiomeIds.length))
      for (const biomeId of player.completedBiomeIds) {
        const index = biomes.findIndex((biome) => biome.id === biomeId)
        if (index >= 0) candidates.push(`biome_${String(index + 1).padStart(2, '0')}_complete`)
      }
      if (player.perfectComplexKanjiCount >= 1) candidates.push('perfect_15_stroke_kanji')
      if (player.perfectComplexKanjiCount >= 10) candidates.push('perfect_10_complex_kanji')
      if (player.lifetimeErrors > 0) candidates.push('first_error')
    }

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
