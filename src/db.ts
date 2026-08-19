import Dexie, { type EntityTable } from 'dexie'
import { characterById, plotIdsByLegacyFieldId } from './data/model'
import type { CardState, ReviewEvent } from './learning'

export type SaveGame = {
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

export type SaveGameV2 = Omit<SaveGame, 'version' | 'lastActivePlotId'> & {
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

type StoredSave = SaveGame | SaveGameV2 | SaveGameV1

function migrateFieldIds(fieldIds: readonly string[]): string[] {
  return [...new Set(fieldIds.flatMap((fieldId) => plotIdsByLegacyFieldId.get(fieldId) ?? []))]
}

/** Pure export keeps the data-loss-sensitive migration independently testable. */
function lastActivePlotId(
  reviewEvents: readonly ReviewEvent[],
  unlockedPlotIds: readonly string[],
): string | null {
  const latest = [...reviewEvents].sort((left, right) => right.timestamp - left.timestamp)
    .find((event) => characterById.has(event.characterId))
  return (latest ? characterById.get(latest.characterId)?.plotId : undefined)
    ?? unlockedPlotIds[0]
    ?? null
}

export function migrateV2Save(save: SaveGameV2): SaveGame {
  return {
    ...save,
    version: 3,
    lastActivePlotId: lastActivePlotId(save.reviewEvents, save.unlockedPlotIds),
  }
}

export function migrateV1Save(save: SaveGameV1): SaveGame {
  const unlockedPlotIds = migrateFieldIds(save.unlockedFieldIds)
  return {
    id: 'main',
    version: 3,
    unlockedPlotIds,
    masteredPlotIds: migrateFieldIds(save.masteredFieldIds),
    lastActivePlotId: lastActivePlotId(save.reviewEvents, unlockedPlotIds),
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

function migrateStoredSave(save: StoredSave): SaveGame {
  if (isV1Save(save)) return migrateV1Save(save)
  if (isV2Save(save)) return migrateV2Save(save)
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

export const initialSave: SaveGame = {
  id: 'main',
  version: 3,
  unlockedPlotIds: ['plot-001'],
  masteredPlotIds: [],
  lastActivePlotId: null,
  seenCharacterIds: [],
  cards: {},
  reviewEvents: [],
  updatedAt: Date.now(),
}

export async function loadSave(): Promise<SaveGame> {
  await pendingSaveOperation
  const stored = await database.saves.get('main')
  if (!stored) return structuredClone(initialSave)
  if (stored.version === 3) return stored
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
