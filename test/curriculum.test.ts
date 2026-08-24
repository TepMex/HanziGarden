import { describe, expect, test } from 'bun:test'
import { nextCurriculumCharacter, nextNewCurriculumCharacter } from '../src/curriculum'
import { characters } from '../src/data/model'
import type { CardState } from '../src/learning'

const futureCard = { due: new Date('2100-01-01T00:00:00.000Z') } as CardState

describe('curriculum independence', () => {
  test('introduces new characters in strict Heisig frame order', () => {
    const cards: Record<string, CardState> = {}
    expect(nextNewCurriculumCharacter(cards)?.frame).toBe(1)
    cards[characters[0]!.id] = futureCard
    expect(nextNewCurriculumCharacter(cards)?.frame).toBe(2)
    cards[characters[1]!.id] = futureCard
    expect(nextNewCurriculumCharacter(cards)?.frame).toBe(3)
  })

  test('does not accept a coordinate, biome, or exploration direction', () => {
    const cards = { [characters[0]!.id]: futureCard }
    const afterEastwardChoice = nextCurriculumCharacter(cards, new Date('2026-08-24T00:00:00Z'))
    const afterWestwardChoice = nextCurriculumCharacter(cards, new Date('2026-08-24T00:00:00Z'))
    expect(afterEastwardChoice?.id).toBe(afterWestwardChoice?.id)
    expect(afterEastwardChoice?.frame).toBe(2)
  })
})
