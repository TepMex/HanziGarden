import type HanziWriter from 'hanzi-writer'
import { loadSave, restoreSave, type SaveGame } from './db'
import type { CardState, ReviewEvent } from './learning'

export type SaveDumpFormat = 'json' | 'object'

export type HanziGardenCheats = {
  drawCorrectStroke(): Promise<void>
  drawWrongStroke(): Promise<void>
  dumpDb(): Promise<string>
  dumpDb(format: 'json'): Promise<string>
  dumpDb(format: 'object'): Promise<SaveGame>
  loadDb(dump: string | SaveGame): Promise<void>
}

export type BattleCheatDriver = {
  drawCorrectStroke(): Promise<void>
  drawWrongStroke(): Promise<void>
}

type SaveCheatDriver = {
  applyLoadedSave(save: SaveGame): void
}

declare global {
  interface Window {
    hanziGardenCheats: HanziGardenCheats
  }
}

let activeBattleDriver: BattleCheatDriver | null = null

function dumpError(path: string, expected: string): never {
  throw new Error(`Некорректный дамп БД: ${path} должен быть ${expected}`)
}

function recordAt(value: unknown, path: string): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return dumpError(path, 'объектом')
  }
  return value as Record<string, unknown>
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== 'string') return dumpError(path, 'строкой')
  return value
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return dumpError(path, 'конечным числом')
  }
  return value
}

function integerAt(value: unknown, path: string): number {
  const number = numberAt(value, path)
  if (!Number.isInteger(number)) return dumpError(path, 'целым числом')
  return number
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== 'boolean') return dumpError(path, 'логическим значением')
  return value
}

function stringArrayAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value)) return dumpError(path, 'массивом строк')
  return value.map((item, index) => stringAt(item, `${path}[${index}]`))
}

function dateAt(value: unknown, path: string): Date {
  if (!(value instanceof Date) && typeof value !== 'string' && typeof value !== 'number') {
    return dumpError(path, 'датой, timestamp или ISO-строкой')
  }
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return dumpError(path, 'валидной датой')
  return date
}

function cardAt(value: unknown, path: string): CardState {
  const card = recordAt(value, path)
  const state = integerAt(card.state, `${path}.state`)
  if (state < 0 || state > 3) return dumpError(`${path}.state`, 'числом от 0 до 3')

  const restored: CardState = {
    due: dateAt(card.due, `${path}.due`),
    stability: numberAt(card.stability, `${path}.stability`),
    difficulty: numberAt(card.difficulty, `${path}.difficulty`),
    elapsed_days: numberAt(card.elapsed_days, `${path}.elapsed_days`),
    scheduled_days: numberAt(card.scheduled_days, `${path}.scheduled_days`),
    learning_steps: numberAt(card.learning_steps, `${path}.learning_steps`),
    reps: integerAt(card.reps, `${path}.reps`),
    lapses: integerAt(card.lapses, `${path}.lapses`),
    state,
  }
  if (card.last_review !== undefined && card.last_review !== null) {
    restored.last_review = dateAt(card.last_review, `${path}.last_review`)
  }
  return restored
}

function reviewEventAt(value: unknown, path: string): ReviewEvent {
  const event = recordAt(value, path)
  const rating = stringAt(event.rating, `${path}.rating`)
  if (rating !== 'again' && rating !== 'good') {
    return dumpError(`${path}.rating`, '"again" или "good"')
  }
  const inputDevice = stringAt(event.inputDevice, `${path}.inputDevice`)
  if (inputDevice !== 'mouse' && inputDevice !== 'touch' && inputDevice !== 'pen') {
    return dumpError(`${path}.inputDevice`, '"mouse", "touch" или "pen"')
  }
  return {
    id: stringAt(event.id, `${path}.id`),
    characterId: stringAt(event.characterId, `${path}.characterId`),
    timestamp: numberAt(event.timestamp, `${path}.timestamp`),
    rating,
    totalMistakes: integerAt(event.totalMistakes, `${path}.totalMistakes`),
    hintUsed: booleanAt(event.hintUsed, `${path}.hintUsed`),
    durationMs: numberAt(event.durationMs, `${path}.durationMs`),
    inputDevice,
  }
}

function stringRecordAt(value: unknown, path: string): Record<string, string> {
  const record = recordAt(value, path)
  return Object.fromEntries(
    Object.entries(record).map(([id, text]) => [id, stringAt(text, `${path}.${id}`)]),
  )
}

/** Parse a current save while deliberately leaving cross-property/domain consistency unchecked. */
export function parseSaveDump(dump: string | SaveGame): SaveGame {
  let value: unknown = dump
  if (typeof dump === 'string') {
    try {
      value = JSON.parse(dump) as unknown
    } catch (error) {
      throw new Error('Некорректный дамп БД: JSON не разбирается', { cause: error })
    }
  }

  const save = recordAt(value, 'save')
  if (save.id !== 'main') return dumpError('save.id', 'строкой "main"')
  if (save.version !== 7) return dumpError('save.version', 'числом 7')
  const lastActiveBedId = save.lastActiveBedId === null
    ? null
    : stringAt(save.lastActiveBedId, 'save.lastActiveBedId')
  const rawCards = recordAt(save.cards, 'save.cards')
  const cards = Object.fromEntries(
    Object.entries(rawCards).map(([id, card]) => [id, cardAt(card, `save.cards.${id}`)]),
  )
  if (!Array.isArray(save.reviewEvents)) return dumpError('save.reviewEvents', 'массивом')
  const playerProgress = recordAt(save.playerProgress, 'save.playerProgress')
  const achievements = recordAt(save.achievements, 'save.achievements')
  if (!Array.isArray(achievements.unlockedAchievements)) return dumpError('save.achievements.unlockedAchievements', 'массивом')
  const perfectBedsToday = recordAt(achievements.perfectBedsToday, 'save.achievements.perfectBedsToday')

  return {
    id: 'main',
    version: 7,
    unlockedBedIds: stringArrayAt(save.unlockedBedIds, 'save.unlockedBedIds'),
    masteredBedIds: stringArrayAt(save.masteredBedIds, 'save.masteredBedIds'),
    lastActiveBedId,
    seenCharacterIds: stringArrayAt(save.seenCharacterIds, 'save.seenCharacterIds'),
    cards,
    reviewEvents: save.reviewEvents.map((event, index) => reviewEventAt(event, `save.reviewEvents[${index}]`)),
    playerProgress: {
      totalXp: numberAt(playerProgress.totalXp, 'save.playerProgress.totalXp'),
      lifetimeCorrectStrokes: integerAt(playerProgress.lifetimeCorrectStrokes, 'save.playerProgress.lifetimeCorrectStrokes'),
      lifetimeErrors: integerAt(playerProgress.lifetimeErrors, 'save.playerProgress.lifetimeErrors'),
      lifetimeCompletedKanji: integerAt(playerProgress.lifetimeCompletedKanji, 'save.playerProgress.lifetimeCompletedKanji'),
      lifetimeCompletedBeds: integerAt(playerProgress.lifetimeCompletedBeds, 'save.playerProgress.lifetimeCompletedBeds'),
      bestComboEver: integerAt(playerProgress.bestComboEver, 'save.playerProgress.bestComboEver'),
      perfectComplexKanjiCount: integerAt(playerProgress.perfectComplexKanjiCount, 'save.playerProgress.perfectComplexKanjiCount'),
      completedBiomeIds: stringArrayAt(playerProgress.completedBiomeIds, 'save.playerProgress.completedBiomeIds'),
    },
    achievements: {
      unlockedAchievements: achievements.unlockedAchievements.map((value, index) => {
        const item = recordAt(value, `save.achievements.unlockedAchievements[${index}]`)
        return {
          id: stringAt(item.id, `save.achievements.unlockedAchievements[${index}].id`),
          unlockedAt: stringAt(item.unlockedAt, `save.achievements.unlockedAchievements[${index}].unlockedAt`),
        }
      }),
      currentDailyStreak: integerAt(achievements.currentDailyStreak, 'save.achievements.currentDailyStreak'),
      bestDailyStreak: integerAt(achievements.bestDailyStreak, 'save.achievements.bestDailyStreak'),
      ...(achievements.lastActiveDate === undefined ? {} : { lastActiveDate: stringAt(achievements.lastActiveDate, 'save.achievements.lastActiveDate') }),
      perfectBedsToday: {
        ...(perfectBedsToday.date === undefined ? {} : { date: stringAt(perfectBedsToday.date, 'save.achievements.perfectBedsToday.date') }),
        count: integerAt(perfectBedsToday.count, 'save.achievements.perfectBedsToday.count'),
      },
    },
    characterNotes: stringRecordAt(save.characterNotes, 'save.characterNotes'),
    updatedAt: numberAt(save.updatedAt, 'save.updatedAt'),
  }
}

export function stringifySaveDump(save: SaveGame): string {
  return JSON.stringify(parseSaveDump(save), null, 2)
}

export function registerBattleCheatDriver(driver: BattleCheatDriver): () => void {
  activeBattleDriver = driver
  return () => {
    if (activeBattleDriver === driver) activeBattleDriver = null
  }
}

function requireBattleDriver(): BattleCheatDriver {
  if (!activeBattleDriver) {
    throw new Error('Чит штрихов доступен только после открытия боя и загрузки иероглифа')
  }
  return activeBattleDriver
}

async function dumpDatabase(): Promise<string>
async function dumpDatabase(format: 'json'): Promise<string>
async function dumpDatabase(format: 'object'): Promise<SaveGame>
async function dumpDatabase(format: SaveDumpFormat = 'json'): Promise<string | SaveGame> {
  const save = parseSaveDump(await loadSave())
  return format === 'object' ? structuredClone(save) : stringifySaveDump(save)
}

export function installGameCheats(saveDriver: SaveCheatDriver): () => void {
  const api: HanziGardenCheats = {
    drawCorrectStroke: () => requireBattleDriver().drawCorrectStroke(),
    drawWrongStroke: () => requireBattleDriver().drawWrongStroke(),
    dumpDb: dumpDatabase,
    async loadDb(dump: string | SaveGame): Promise<void> {
      const save = parseSaveDump(dump)
      await restoreSave(save)
      saveDriver.applyLoadedSave(structuredClone(save))
    },
  }
  window.hanziGardenCheats = api
  return () => {
    if (window.hanziGardenCheats === api) Reflect.deleteProperty(window, 'hanziGardenCheats')
  }
}

function mouseEvent(type: string, point: DOMPoint, buttons: number): MouseEvent {
  return new MouseEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    buttons,
    clientX: point.x,
    clientY: point.y,
  })
}

/** Feed a canonical Hanzi median through the same DOM input path as a real mouse stroke. */
export async function dispatchQuizStroke(
  writer: HanziWriter,
  target: HTMLElement,
  strokeIndex: number,
  backwards: boolean,
): Promise<void> {
  const character = await writer.getCharacterData()
  const stroke = character.strokes[strokeIndex]
  if (!stroke) throw new Error(`Текущий штрих ${strokeIndex + 1} не найден`)
  const svg = target.querySelector(':scope > svg')
  const positionedGroup = svg?.querySelector(':scope > g[transform]') as SVGGraphicsElement | null | undefined
  const matrix = positionedGroup?.getScreenCTM()
  if (!(svg instanceof SVGSVGElement) || !matrix) {
    throw new Error('Hanzi Writer ещё не подготовил SVG для чит-штриха')
  }

  const points = backwards ? [...stroke.points].reverse() : stroke.points
  const screenPoints = points.map((point) => new DOMPoint(point.x, point.y).matrixTransform(matrix))
  const first = screenPoints[0]
  if (!first || screenPoints.length < 2) throw new Error('Медиана текущего штриха пуста')

  svg.dispatchEvent(mouseEvent('mousedown', first, 1))
  for (const point of screenPoints.slice(1)) svg.dispatchEvent(mouseEvent('mousemove', point, 1))
  document.dispatchEvent(mouseEvent('mouseup', screenPoints.at(-1)!, 0))
}
