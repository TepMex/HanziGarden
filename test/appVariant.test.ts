import { describe, expect, test } from 'bun:test'
import { shouldShowClearedBedSummary } from '../src/appVariant'

describe('cleared-bed summary', () => {
  test('primary edition always shows the summary, even without a new level', () => {
    expect(shouldShowClearedBedSummary('main', [])).toBe(true)
    expect(shouldShowClearedBedSummary('main', [2])).toBe(true)
  })

  test('HSK 1 shows the summary only when the bed granted a new level', () => {
    expect(shouldShowClearedBedSummary('hsk1', [])).toBe(false)
    expect(shouldShowClearedBedSummary('hsk1', [2])).toBe(true)
    expect(shouldShowClearedBedSummary('hsk1', [5, 6])).toBe(true)
  })
})
