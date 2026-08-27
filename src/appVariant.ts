export type AppVariant = 'main' | 'hsk1'

export const appVariant: AppVariant = import.meta.env.MODE === 'hsk1' ? 'hsk1' : 'main'
export const isHsk1Variant = appVariant === 'hsk1'

export const appName = isHsk1Variant ? 'Hanzi Garden HSK 1' : 'Hanzi Garden'
export const databaseName = isHsk1Variant ? 'memory-garden-hsk1' : 'memory-garden'

/** HSK 1 beds hold one Hanzi, so the results screen is worth showing only on a level-up. */
export function shouldShowClearedBedSummary(
  variant: AppVariant,
  levelsGained: readonly number[],
): boolean {
  return variant !== 'hsk1' || levelsGained.length > 0
}

