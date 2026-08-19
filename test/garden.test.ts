import { describe, expect, test } from 'bun:test'
import { battlePlotCleanliness, plotDueFraction, plotInfection } from '../src/garden'
import type { CardState } from '../src/learning'

const plot = {
  characters: [
    { id: 'new-character', strokeCount: 2 },
    { id: 'reviewed-character', strokeCount: 6 },
  ],
}

describe('plotInfection', () => {
  test('treats every new plot as fully overgrown without an access flag', () => {
    expect(plotInfection(plot, {})).toBe(1)
  })

  test('uses due stroke weight and not plot accessibility', () => {
    const cards = {
      'reviewed-character': { due: new Date('2100-01-01T00:00:00Z') } as CardState,
    }
    expect(plotInfection(plot, cards, new Date('2026-08-08T00:00:00Z'))).toBe(0.25)
  })

  test('marks a plot as clean when none of its characters are due', () => {
    const futureCard = { due: new Date('2100-01-01T00:00:00Z') } as CardState
    expect(plotInfection(plot, { 'new-character': futureCard, 'reviewed-character': futureCard }, new Date('2026-08-08T00:00:00Z'))).toBe(0)
  })
})

describe('map due fraction', () => {
  test('counts characters equally instead of weighting their strokes', () => {
    const futureCard = { due: new Date('2100-01-01T00:00:00Z') } as CardState
    expect(plotDueFraction(plot, { 'reviewed-character': futureCard }, new Date('2026-08-08T00:00:00Z'))).toBe(0.5)
  })

  test('keeps the old battle health projection', () => {
    expect(battlePlotCleanliness(1)).toBe(0)
    expect(battlePlotCleanliness(0.75)).toBe(0.25)
    expect(battlePlotCleanliness(0.25)).toBe(0.4)
    expect(battlePlotCleanliness(0)).toBe(1)
  })
})
