import { describe, expect, test } from 'bun:test'
import { State } from 'ts-fsrs'
import { type SaveGame } from '../src/db'
import { parseSaveDump, stringifySaveDump } from '../src/gameCheats'

function saveFixture(): SaveGame {
  return {
    id: 'main',
    version: 3,
    unlockedPlotIds: ['plot-unknown'],
    masteredPlotIds: ['plot-locked-but-mastered'],
    lastActivePlotId: 'plot-not-unlocked',
    seenCharacterIds: ['character-unknown'],
    cards: {
      'character-unknown': {
        due: new Date('2099-01-02T03:04:05.000Z'),
        stability: 12,
        difficulty: 4,
        elapsed_days: 3,
        scheduled_days: 30,
        learning_steps: 0,
        reps: 2,
        lapses: 1,
        state: State.Review,
        last_review: new Date('2026-08-19T10:00:00.000Z'),
      },
    },
    reviewEvents: [{
      id: 'event-debug',
      characterId: 'character-unknown',
      timestamp: 123,
      rating: 'good',
      totalMistakes: 1,
      hintUsed: false,
      durationMs: 456,
      inputDevice: 'mouse',
    }],
    updatedAt: 789,
  }
}

describe('game cheat save dumps', () => {
  test('round-trips JSON and restores FSRS dates', () => {
    const restored = parseSaveDump(stringifySaveDump(saveFixture()))
    const card = restored.cards['character-unknown']!

    expect(card.due).toBeInstanceOf(Date)
    expect(card.due.toISOString()).toBe('2099-01-02T03:04:05.000Z')
    expect(card.last_review).toBeInstanceOf(Date)
    expect(card.last_review?.toISOString()).toBe('2026-08-19T10:00:00.000Z')
    expect(restored.reviewEvents).toEqual(saveFixture().reviewEvents)
  })

  test('clones object input instead of sharing mutable values', () => {
    const source = saveFixture()
    const restored = parseSaveDump(source)
    restored.unlockedPlotIds.push('plot-added-after-parse')
    restored.cards['character-unknown']!.due.setUTCFullYear(2100)

    expect(source.unlockedPlotIds).toEqual(['plot-unknown'])
    expect(source.cards['character-unknown']!.due.getUTCFullYear()).toBe(2099)
  })

  test('rejects a structurally damaged or obsolete dump', () => {
    expect(() => parseSaveDump(JSON.stringify({ ...saveFixture(), version: 2 }) as SaveGame))
      .toThrow('save.version')
    expect(() => parseSaveDump({ ...saveFixture(), cards: { broken: {} } } as SaveGame))
      .toThrow('save.cards.broken.state')
  })

  test('preserves semantically inconsistent debug state', () => {
    const restored = parseSaveDump(saveFixture())

    expect(restored.unlockedPlotIds).toEqual(['plot-unknown'])
    expect(restored.masteredPlotIds).toEqual(['plot-locked-but-mastered'])
    expect(restored.lastActivePlotId).toBe('plot-not-unlocked')
    expect(restored.seenCharacterIds).toEqual(['character-unknown'])
  })
})
