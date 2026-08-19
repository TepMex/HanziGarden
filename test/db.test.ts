import { describe, expect, test } from 'bun:test'
import { migrateV1Save, migrateV2Save, migrateV3Save, type SaveGameV1, type SaveGameV2, type SaveGameV3 } from '../src/db'
import type { CardState } from '../src/learning'

describe('v1 save migration', () => {
  test('preserves review history and maps legacy field progress to both beds', () => {
    const card = { due: new Date('2099-01-01T00:00:00Z') } as CardState
    const event = { id: 'event-1', characterId: 'rsh-0001', timestamp: 1, rating: 'good' as const, totalMistakes: 0, hintUsed: false, durationMs: 100, inputDevice: 'mouse' as const }
    const v1: SaveGameV1 = {
      id: 'main', version: 1, unlockedFieldIds: ['field-001'], masteredFieldIds: ['field-002'],
      seenCharacterIds: ['rsh-0001'], cards: { 'rsh-0001': card }, reviewEvents: [event], updatedAt: 42,
    }
    const migrated = migrateV1Save(v1)
    expect(migrated.version).toBe(4)
    expect(migrated.unlockedBedIds).toEqual(['bed-001', 'bed-002'])
    expect(migrated.masteredBedIds).toEqual(['bed-003', 'bed-004'])
    expect(migrated.cards).toBe(v1.cards)
    expect(migrated.seenCharacterIds).toBe(v1.seenCharacterIds)
    expect(migrated.reviewEvents).toBe(v1.reviewEvents)
    expect(migrated.lastActiveBedId).toBe('bed-001')
  })

  test('falls back to the first unlocked bed without review history', () => {
    const v1: SaveGameV1 = {
      id: 'main', version: 1, unlockedFieldIds: ['field-002'], masteredFieldIds: [],
      seenCharacterIds: [], cards: {}, reviewEvents: [], updatedAt: 42,
    }
    expect(migrateV1Save(v1).lastActiveBedId).toBe('bed-003')
  })
})

describe('v2 save migration', () => {
  test('uses the bed of the most recent review event', () => {
    const v2: SaveGameV2 = {
      id: 'main', version: 2, unlockedPlotIds: ['plot-001', 'plot-002'], masteredPlotIds: [],
      seenCharacterIds: [], cards: {}, reviewEvents: [
        { id: 'newer', characterId: 'rsh-0002', timestamp: 20, rating: 'good', totalMistakes: 0, hintUsed: false, durationMs: 1, inputDevice: 'touch' },
        { id: 'older', characterId: 'rsh-0001', timestamp: 10, rating: 'good', totalMistakes: 0, hintUsed: false, durationMs: 1, inputDevice: 'touch' },
      ], updatedAt: 42,
    }
    const migrated = migrateV2Save(v2)
    expect(migrated.version).toBe(4)
    expect(migrated.lastActiveBedId).toBe('bed-001')
    expect(migrated.reviewEvents).toBe(v2.reviewEvents)
  })
})

describe('v3 save migration', () => {
  test('renames plot IDs to bed IDs without losing the active bed', () => {
    const v3: SaveGameV3 = {
      id: 'main', version: 3,
      unlockedPlotIds: ['plot-001', 'plot-004'],
      masteredPlotIds: ['plot-001'],
      lastActivePlotId: 'plot-004',
      seenCharacterIds: [], cards: {}, reviewEvents: [], updatedAt: 42,
    }

    expect(migrateV3Save(v3)).toMatchObject({
      version: 4,
      unlockedBedIds: ['bed-001', 'bed-004'],
      masteredBedIds: ['bed-001'],
      lastActiveBedId: 'bed-004',
    })
  })
})
