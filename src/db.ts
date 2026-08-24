import Dexie, { type EntityTable } from 'dexie'
import { bedIdsByLegacyFieldId, beds, biomes, characterById } from './data/model'
import type { CardState, ReviewEvent } from './learning'
import { completeKanji, initialPlayerProgress, initialSessionProgress, type PlayerProgress } from './progression'
import {
  initialAchievementPersistence,
  processAchievementEvents,
  type AchievementPersistence,
  type AchievementEvent,
} from './achievements'
import { CURRENT_GARDEN_GENERATION_VERSION } from './garden/gardenGenerator'
import { CENTER_HEX_ID, createGardenSeed } from './garden/gardenState'

export type SaveGame = {
  id: 'main'
  version: 7
  unlockedBedIds: string[]
  masteredBedIds: string[]
  lastActiveBedId: string | null
  gardenSeed: string
  gardenGenerationVersion: 1
  clearedHexes: string[]
  pendingClearActions: number
  lastActiveHexId: string | null
  seenCharacterIds: string[]
  cards: Record<string, CardState>
  reviewEvents: ReviewEvent[]
  playerProgress: PlayerProgress
  achievements: AchievementPersistence
  updatedAt: number
}

export type SaveGameV6 = Omit<
  SaveGame,
  'version' | 'gardenSeed' | 'gardenGenerationVersion' | 'clearedHexes' | 'pendingClearActions' | 'lastActiveHexId'
> & { version: 6 }
export type SaveGameV5 = Omit<SaveGameV6, 'version' | 'achievements'> & { version: 5 }
export type SaveGameV4 = Omit<SaveGameV5, 'version' | 'playerProgress'> & { version: 4 }

export type SaveGameV3 = {
  id: 'main'
  version: 3
  unlockedPlotIds: string[]
  masteredPlotIds: string[]
  lastActivePlotId: string | null
  seenCharacterIds: string[]
  cards: Record<string, CardState>
  reviewEvents: ReviewEvent[]
  updatedAt: number
}

export type SaveGameV2 = Omit<SaveGameV3, 'version' | 'lastActivePlotId'> & {
  version: 2
}

export type SaveGameV1 = {
  id: 'main'
  version: 1
  unlockedFieldIds: string[]
  masteredFieldIds: string[]
  seenCharacterIds: string[]
  cards: Record<string, CardState>
  reviewEvents: ReviewEvent[]
  updatedAt: number
}

type StoredSave = SaveGame | SaveGameV6 | SaveGameV5 | SaveGameV4 | SaveGameV3 | SaveGameV2 | SaveGameV1

function migrateLegacyFieldIds(fieldIds: readonly string[]): string[] {
  return [...new Set(fieldIds.flatMap((fieldId) => bedIdsByLegacyFieldId.get(fieldId) ?? []))]
}

function migrateLegacyPlotIds(plotIds: readonly string[]): string[] {
  return [...new Set(plotIds.map((plotId) => plotId.replace(/^plot-/, 'bed-')))]
}

/** Pure export keeps the data-loss-sensitive migration independently testable. */
function lastActiveBedId(
  reviewEvents: readonly ReviewEvent[],
  unlockedBedIds: readonly string[],
): string | null {
  const latest = [...reviewEvents].sort((left, right) => right.timestamp - left.timestamp)
    .find((event) => characterById.has(event.characterId))
  return (latest ? characterById.get(latest.characterId)?.bedId : undefined)
    ?? unlockedBedIds[0]
    ?? null
}

export function migrateV3Save(save: SaveGameV3): SaveGameV4 {
  const unlockedBedIds = migrateLegacyPlotIds(save.unlockedPlotIds)
  return {
    id: 'main',
    version: 4,
    unlockedBedIds,
    masteredBedIds: migrateLegacyPlotIds(save.masteredPlotIds),
    lastActiveBedId: save.lastActivePlotId
      ? migrateLegacyPlotIds([save.lastActivePlotId])[0]!
      : lastActiveBedId(save.reviewEvents, unlockedBedIds),
    seenCharacterIds: save.seenCharacterIds,
    cards: save.cards,
    reviewEvents: save.reviewEvents,
    updatedAt: save.updatedAt,
  }
}

export function migrateV2Save(save: SaveGameV2): SaveGameV4 {
  return migrateV3Save({
    ...save,
    version: 3,
    lastActivePlotId: null,
  })
}

export function migrateV1Save(save: SaveGameV1): SaveGameV4 {
  const unlockedBedIds = migrateLegacyFieldIds(save.unlockedFieldIds)
  return {
    id: 'main',
    version: 4,
    unlockedBedIds,
    masteredBedIds: migrateLegacyFieldIds(save.masteredFieldIds),
    lastActiveBedId: lastActiveBedId(save.reviewEvents, unlockedBedIds),
    seenCharacterIds: save.seenCharacterIds,
    cards: save.cards,
    reviewEvents: save.reviewEvents,
    updatedAt: save.updatedAt,
  }
}

function isV1Save(save: StoredSave): save is SaveGameV1 {
  return save.version === 1
}

function isV2Save(save: StoredSave): save is SaveGameV2 {
  return save.version === 2
}

function isV3Save(save: StoredSave): save is SaveGameV3 {
  return save.version === 3
}

function isV4Save(save: StoredSave): save is SaveGameV4 {
  return save.version === 4
}

/** Reconstruct every progression fact that the retained review history can prove. */
export function migrateV4Save(save: SaveGameV4): SaveGame {
  let player = structuredClone(initialPlayerProgress)
  let session = structuredClone(initialSessionProgress)
  for (const event of [...save.reviewEvents].sort((left, right) => left.timestamp - right.timestamp)) {
    const strokeCount = characterById.get(event.characterId)?.strokeCount ?? 1
    const completed = completeKanji(player, session, {
      correctStrokeCount: strokeCount,
      errorCount: event.totalMistakes,
      strokeCount,
    })
    player = completed.player
    session = completed.session
  }
  const mastered = new Set(save.masteredBedIds)
  player.completedBiomeIds = biomes
    .filter((biome) => beds.filter((bed) => bed.biomeId === biome.id).every((bed) => mastered.has(bed.id)))
    .map((biome) => biome.id)
  return migrateV5Save({ ...save, version: 5, playerProgress: player })
}

export function migrateV5Save(save: SaveGameV5): SaveGame {
  let achievements = structuredClone(initialAchievementPersistence)
  let replayPlayer = structuredClone(initialPlayerProgress)
  let replaySession = structuredClone(initialSessionProgress)
  for (const event of [...save.reviewEvents].sort((left, right) => left.timestamp - right.timestamp)) {
    const strokeCount = characterById.get(event.characterId)?.strokeCount ?? 1
    const completed = completeKanji(replayPlayer, replaySession, {
      correctStrokeCount: strokeCount,
      errorCount: event.totalMistakes,
      strokeCount,
    })
    replayPlayer = completed.player
    replaySession = completed.session
    const achievementEvent: AchievementEvent = {
      type: 'kanji.completed',
      timestamp: event.timestamp,
      strokeCount,
      errorCount: event.totalMistakes,
      earnedXp: completed.reward.earnedXp,
      kanjiXp: completed.reward.kanjiXp,
      previousCombo: completed.reward.previousCombo,
      combo: completed.reward.combo,
      finalStrokeError: false,
    }
    achievements = processAchievementEvents(achievements, replayPlayer, replaySession, [achievementEvent]).state
  }
  achievements = processAchievementEvents(achievements, save.playerProgress, replaySession, [{
    type: 'player.migrated', timestamp: save.updatedAt,
  }]).state
  return migrateV6Save({ ...save, version: 6, achievements })
}

/**
 * The old rectangular geography has no truthful coordinate mapping. Preserve
 * every learning/SRS field and convert completed learning into unspent choices
 * instead of inventing a route through the new garden.
 */
export function migrateV6Save(save: SaveGameV6, gardenSeed = createGardenSeed()): SaveGame {
  return {
    ...save,
    version: 7,
    gardenSeed,
    gardenGenerationVersion: CURRENT_GARDEN_GENERATION_VERSION,
    clearedHexes: [CENTER_HEX_ID],
    pendingClearActions: Math.min(216, new Set(save.seenCharacterIds).size),
    lastActiveHexId: CENTER_HEX_ID,
  }
}

function migrateStoredSave(save: StoredSave): SaveGame {
  if (isV1Save(save)) return migrateV4Save(migrateV1Save(save))
  if (isV2Save(save)) return migrateV4Save(migrateV2Save(save))
  if (isV3Save(save)) return migrateV4Save(migrateV3Save(save))
  if (isV4Save(save)) return migrateV4Save(save)
  if (save.version === 5) return migrateV5Save(save)
  if (save.version === 6) return migrateV6Save(save)
  return save
}

const database = new Dexie('memory-garden') as Dexie & {
  saves: EntityTable<StoredSave, 'id'>
}

let pendingSaveOperation: Promise<void> = Promise.resolve()

function enqueueSaveOperation(operation: () => Promise<void>): Promise<void> {
  const result = pendingSaveOperation.then(operation)
  pendingSaveOperation = result.catch(() => undefined)
  return result
}

database.version(1).stores({ saves: 'id, version, updatedAt' })
database.version(2).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    if (!isV1Save(stored)) return
    const migrated = migrateV1Save(stored)
    Object.assign(stored, migrated)
    delete (stored as Partial<SaveGameV1>).unlockedFieldIds
    delete (stored as Partial<SaveGameV1>).masteredFieldIds
  })
})
database.version(3).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    const migrated = migrateStoredSave(stored)
    Object.assign(stored, migrated)
    delete (stored as Partial<SaveGameV1>).unlockedFieldIds
    delete (stored as Partial<SaveGameV1>).masteredFieldIds
  })
})
database.version(4).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    const migrated = migrateStoredSave(stored)
    Object.assign(stored, migrated)
    delete (stored as Partial<SaveGameV3>).unlockedPlotIds
    delete (stored as Partial<SaveGameV3>).masteredPlotIds
    delete (stored as Partial<SaveGameV3>).lastActivePlotId
    delete (stored as Partial<SaveGameV1>).unlockedFieldIds
    delete (stored as Partial<SaveGameV1>).masteredFieldIds
  })
})
database.version(5).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    if (!isV4Save(stored)) return
    Object.assign(stored, migrateV4Save(stored))
  })
})
database.version(6).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    if (stored.version !== 5) return
    Object.assign(stored, migrateV5Save(stored))
  })
})
database.version(7).stores({ saves: 'id, version, updatedAt' }).upgrade((transaction) => {
  return transaction.table('saves').toCollection().modify((stored: StoredSave) => {
    if (stored.version !== 6) return
    Object.assign(stored, migrateV6Save(stored))
  })
})

export function createInitialSave(): SaveGame {
  return {
    id: 'main',
    version: 7,
    unlockedBedIds: ['bed-001'],
    masteredBedIds: [],
    lastActiveBedId: null,
    gardenSeed: createGardenSeed(),
    gardenGenerationVersion: CURRENT_GARDEN_GENERATION_VERSION,
    clearedHexes: [CENTER_HEX_ID],
    pendingClearActions: 0,
    lastActiveHexId: CENTER_HEX_ID,
    seenCharacterIds: [],
    cards: {},
    reviewEvents: [],
    playerProgress: structuredClone(initialPlayerProgress),
    achievements: structuredClone(initialAchievementPersistence),
    updatedAt: Date.now(),
  }
}

export const initialSave: SaveGame = createInitialSave()

export async function loadSave(): Promise<SaveGame> {
  await pendingSaveOperation
  const stored = await database.saves.get('main')
  if (!stored) {
    const created = createInitialSave()
    await database.saves.put(created)
    return created
  }
  if (stored.version === 7) return stored
  const migrated = migrateStoredSave(stored)
  await database.saves.put(migrated)
  return migrated
}

export async function persistSave(save: SaveGame): Promise<void> {
  const snapshot = structuredClone(save)
  await enqueueSaveOperation(async () => {
    await database.saves.put({ ...snapshot, updatedAt: Date.now() })
  })
}

/** Restore a debug/backup snapshot exactly, without changing its timestamp. */
export async function restoreSave(save: SaveGame): Promise<void> {
  const snapshot = structuredClone(save)
  await enqueueSaveOperation(async () => {
    await database.saves.put(snapshot)
  })
}

export async function resetSave(): Promise<SaveGame> {
  const created = createInitialSave()
  await enqueueSaveOperation(async () => {
    await database.saves.put(created)
  })
  return structuredClone(created)
}
