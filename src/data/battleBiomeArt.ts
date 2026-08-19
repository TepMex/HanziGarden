import { biomes } from './mapLayout'

/** A distinct battle artwork set is reserved for every biome, numbered row by row. */
export type BattleBackdropStage = 'fullDirty' | 'halfDirty' | 'quarterDirty' | 'clean'

export type BattleBiomeArtwork = {
  biomeAssetId: string
  backgrounds: Record<BattleBackdropStage, string>
}

const stageFileNames: Record<BattleBackdropStage, string> = {
  fullDirty: 'full_dirty.webp',
  halfDirty: 'half_dirty.webp',
  quarterDirty: 'quorter_dirty.webp',
  clean: 'clean.webp',
}

function artworkForBiome(biomeNumber: number): BattleBiomeArtwork {
  const biomeAssetId = `biome${biomeNumber}`
  const directory = `assets/battle-biomes/${biomeAssetId}`
  return {
    biomeAssetId,
    backgrounds: {
      fullDirty: `${directory}/${stageFileNames.fullDirty}`,
      halfDirty: `${directory}/${stageFileNames.halfDirty}`,
      quarterDirty: `${directory}/${stageFileNames.quarterDirty}`,
      clean: `${directory}/${stageFileNames.clean}`,
    },
  }
}

/**
 * `biomes` is already ordered left-to-right, then top-to-bottom, so
 * biome1 is the upper-left biome and biome15 is the lower-right biome.
 * Replace only the files under a biome directory when its bespoke artwork is ready.
 */
export const battleArtworkByBiomeId = new Map(
  biomes.map((biome) => [biome.id, artworkForBiome(biome.index + 1)]),
)

export function battleArtworkForBiome(biomeId: string): BattleBiomeArtwork {
  const artwork = battleArtworkByBiomeId.get(biomeId)
  if (!artwork) throw new Error(`No battle artwork registered for ${biomeId}`)
  return artwork
}

/**
 * Decide the visible cleaning state from the one-based count of correct strokes.
 * The clean state has priority so it remains visible between completing one
 * character and starting the next one.
 */
export function battleBackdropStage(
  totalStrokes: number,
  correctStrokes: number,
): BattleBackdropStage {
  if (totalStrokes <= 0 || correctStrokes >= totalStrokes) return 'clean'
  if (correctStrokes * 10 >= totalStrokes * 7) return 'quarterDirty'
  if (correctStrokes * 2 > totalStrokes) return 'halfDirty'
  return 'fullDirty'
}
