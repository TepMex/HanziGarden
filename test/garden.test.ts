import { describe, expect, test } from 'bun:test'
import { battleBedCleanliness, bedDueFraction, bedInfection } from '../src/garden'
import type { CardState } from '../src/learning'

const bed = {
  characters: [
    { id: 'new-character', strokeCount: 2 },
    { id: 'reviewed-character', strokeCount: 6 },
  ],
}

describe('bedInfection', () => {
  test('treats every new bed as fully overgrown without an access flag', () => {
    expect(bedInfection(bed, {})).toBe(1)
  })

  test('uses due stroke weight and not bed accessibility', () => {
    const cards = {
      'reviewed-character': { due: new Date('2100-01-01T00:00:00Z') } as CardState,
    }
    expect(bedInfection(bed, cards, new Date('2026-08-08T00:00:00Z'))).toBe(0.25)
  })

  test('marks a bed as clean when none of its characters are due', () => {
    const futureCard = { due: new Date('2100-01-01T00:00:00Z') } as CardState
    expect(bedInfection(bed, { 'new-character': futureCard, 'reviewed-character': futureCard }, new Date('2026-08-08T00:00:00Z'))).toBe(0)
  })
})

describe('garden due fraction', () => {
  test('counts characters equally instead of weighting their strokes', () => {
    const futureCard = { due: new Date('2100-01-01T00:00:00Z') } as CardState
    expect(bedDueFraction(bed, { 'reviewed-character': futureCard }, new Date('2026-08-08T00:00:00Z'))).toBe(0.5)
  })

  test('keeps the old battle health projection', () => {
    expect(battleBedCleanliness(1)).toBe(0)
    expect(battleBedCleanliness(0.75)).toBe(0.25)
    expect(battleBedCleanliness(0.25)).toBe(0.4)
    expect(battleBedCleanliness(0)).toBe(1)
  })
})
