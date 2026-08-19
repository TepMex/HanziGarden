import { describe, expect, test } from 'bun:test'
import { weedCoverageFromDueFraction } from '../src/garden'
import { measuredWeedCoverage, organicWeedMask } from '../src/map/weedMask'

describe('weed mask formula', () => {
  test('maps due fractions to the required visible area', () => {
    expect(weedCoverageFromDueFraction(0)).toBe(0)
    expect(weedCoverageFromDueFraction(0.01)).toBe(0.3)
    expect(weedCoverageFromDueFraction(0.3)).toBe(0.3)
    expect(weedCoverageFromDueFraction(0.31)).toBe(0.31)
    expect(weedCoverageFromDueFraction(0.99)).toBe(0.99)
    expect(weedCoverageFromDueFraction(1)).toBe(1)
  })

  test('is stable for a plot seed and changes shape for another seed', () => {
    const first = organicWeedMask(42, 0.37, 64, 48)
    expect(organicWeedMask(42, 0.37, 64, 48)).toEqual(first)
    expect(organicWeedMask(43, 0.37, 64, 48)).not.toEqual(first)
  })

  test('keeps measured area close to requested coverage', () => {
    for (const coverage of [0, 0.3, 0.31, 0.75, 0.99, 1]) {
      const mask = organicWeedMask(99, coverage, 80, 50)
      expect(measuredWeedCoverage(mask)).toBeCloseTo(coverage, 3)
    }
  })
})
