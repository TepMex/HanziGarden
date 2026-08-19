import Dexie, { type EntityTable } from 'dexie'
import { bedIdsByLegacyFieldId, characterById } from './data/model'
import type { CardState, ReviewEvent } from './learning'

export type SaveGame = {
  id: 'main'
  version: 4
  unlockedBedIds: string[]
  masteredBedIds: string[]
  lastActiveBedId: string | null
  seenCharacterIds: string[]
  cards: Record<string, CardState>
  reviewEvents: ReviewEvent[]
  updatedAt: number
}

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

type StoredSave = SaveGame | SaveGameV3 | SaveGameV2 | SaveGameV1

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

export function migrateV3Save(save: SaveGameV3): SaveGame {
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

export function migrateV2Save(save: SaveGameV2): SaveGame {
  return migrateV3Save({
    ...save,
    version: 3,
    lastActivePlotId: null,
  })
}

export function migrateV1Save(save: SaveGameV1): SaveGame {
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

function migrateStoredSave(save: StoredSave): SaveGame {
  if (isV1Save(save)) return migrateV1Save(save)
  if (isV2Save(save)) return migrateV2Save(save)
  if (isV3Save(save)) return migrateV3Save(save)
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

export const initialSave: SaveGame = {
  id: 'main',
  version: 4,
  unlockedBedIds: ['bed-001'],
  masteredBedIds: [],
  lastActiveBedId: null,
  seenCharacterIds: [],
  cards: {},
  reviewEvents: [],
  updatedAt: Date.now(),
}

export async function loadSave(): Promise<SaveGame> {
  await pendingSaveOperation
  const stored = await database.saves.get('main')
  if (!stored) return structuredClone(initialSave)
  if (stored.version === 4) return stored
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
  await enqueueSaveOperation(async () => {
    await database.saves.delete('main')
  })
  return structuredClone(initialSave)
}
