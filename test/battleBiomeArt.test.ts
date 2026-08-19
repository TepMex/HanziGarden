import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import {
  battleArtworkByBiomeId,
  battleArtworkForBiome,
  battleBackdropStage,
} from '../src/data/battleBiomeArt'

describe('battle biome artwork', () => {
  test('reserves one independently replaceable artwork set for every biome in row-major order', () => {
    expect(battleArtworkByBiomeId).toHaveLength(15)
    expect(battleArtworkForBiome('biome-01')).toEqual({
      biomeAssetId: 'biome1',
      backgrounds: {
        fullDirty: 'assets/battle-biomes/biome1/full_dirty.webp',
        halfDirty: 'assets/battle-biomes/biome1/half_dirty.webp',
        quarterDirty: 'assets/battle-biomes/biome1/quorter_dirty.webp',
        clean: 'assets/battle-biomes/biome1/clean.webp',
      },
    })
    expect(battleArtworkForBiome('biome-06').biomeAssetId).toBe('biome6')
    expect(battleArtworkForBiome('biome-15').biomeAssetId).toBe('biome15')
    expect(battleArtworkForBiome('biome-06').backgrounds.clean).toBe(
      'assets/battle-biomes/biome6/clean.webp',
    )
    for (const artwork of battleArtworkByBiomeId.values()) {
      Object.values(artwork.backgrounds).forEach((path) => {
        expect(existsSync(`public/${path}`)).toBe(true)
      })
    }
  })

  test('changes background after the specified stroke thresholds', () => {
    expect(battleBackdropStage(10, 0)).toBe('fullDirty')
    expect(battleBackdropStage(10, 5)).toBe('fullDirty')
    expect(battleBackdropStage(10, 6)).toBe('halfDirty')
    expect(battleBackdropStage(10, 7)).toBe('quarterDirty')
    expect(battleBackdropStage(10, 10)).toBe('clean')
  })
})
