import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { HEX_BIOME_IDS, HEX_BIOMES, plantById } from '../src/hexGarden/biomeRegistry'
import { PLANT_ASSET_MANIFEST } from '../src/hexGarden/plantManifest'
import { nextStudyCharacter, grantClearForMasteredBed } from '../src/hexGarden/curriculum'
import {
  biomeIdAt,
  COMMON_WEIGHT,
  GARDEN_GENERATION_VERSION,
  hexContent,
  plantRarityAt,
  RARE_WEIGHT,
  VERY_RARE_WEIGHT,
} from '../src/hexGarden/gardenGenerator'
import {
  availableHexIds,
  canClearHex,
  CENTER_HEX_ID,
  clearHex,
  hexVisibility,
} from '../src/hexGarden/gardenState'
import {
  allHexes,
  cubeDistance,
  gardenHexes,
  hasHex,
  HEX_COUNT,
  HEX_RADIUS,
  hexId,
  neighbors,
  ORIGIN,
} from '../src/hexGarden/hexGrid'
import { beds, characters } from '../src/data/model'

describe('hex geometry', () => {
  test(`radius ${HEX_RADIUS} produces exactly ${HEX_COUNT} hexes`, () => {
    expect(HEX_COUNT).toBe(217)
    expect(gardenHexes()).toHaveLength(217)
    expect(allHexes(HEX_RADIUS)).toHaveLength(217)
    expect(gardenHexes().every((hex) => cubeDistance(hex) <= HEX_RADIUS)).toBe(true)
  })

  test('an interior cell has six neighbors inside the garden', () => {
    expect(neighbors(ORIGIN)).toHaveLength(6)
    expect(new Set(neighbors(ORIGIN).map(hexId)).size).toBe(6)
  })

  test('edge cells never produce neighbors outside radius 8', () => {
    gardenHexes().forEach((hex) => {
      neighbors(hex).forEach((neighbor) => {
        expect(cubeDistance(neighbor)).toBeLessThanOrEqual(HEX_RADIUS)
        expect(hasHex(neighbor)).toBe(true)
      })
      if (cubeDistance(hex) === HEX_RADIUS) expect(neighbors(hex).length).toBeLessThan(6)
    })
  })
})

describe('deterministic generation', () => {
  test('same seed and coordinate always yield the same biome and plant', () => {
    const seed = 'garden-seed-alpha'
    const hex = { q: 3, r: -5 }
    const first = hexContent(seed, hex)
    for (let index = 0; index < 20; index += 1) {
      expect(hexContent(seed, hex)).toEqual(first)
      expect(biomeIdAt(seed, hex)).toBe(first.biomeId)
      expect(plantRarityAt(seed, hex)).toBe(first.rarity)
    }
  })

  test('reveal order does not change cell contents', () => {
    const seed = 'shared-map'
    const hexes = [{ q: 0, r: 1 }, { q: 1, r: 0 }, { q: -2, r: 3 }, { q: 4, r: -4 }]
    const playerA = hexes.map((hex) => hexContent(seed, hex))
    const playerB = [...hexes].reverse().map((hex) => hexContent(seed, hex)).reverse()
    expect(playerA).toEqual(playerB)
  })

  test('different seeds almost always produce different maps', () => {
    const hexes = gardenHexes()
    const signature = (seed: string) => hexes.map((hex) => `${hexContent(seed, hex).biomeId}:${hexContent(seed, hex).plantId}`).join('|')
    expect(signature('seed-a')).not.toBe(signature('seed-b'))
    expect(signature('seed-a')).not.toBe(signature('seed-c'))
  })

  test('generation version 1 is required for current maps', () => {
    expect(GARDEN_GENERATION_VERSION).toBe(1)
    expect(() => hexContent('seed', ORIGIN, 2)).toThrow('gardenGenerationVersion')
  })
})

describe('plant rarity', () => {
  test('statistical distribution over many generated hexes is about 85 / 10 / 5', () => {
    const counts = { common: 0, rare: 0, veryRare: 0 }
    const seeds = Array.from({ length: 24 }, (_, index) => `rarity-seed-${index}`)
    for (const seed of seeds) {
      for (const hex of gardenHexes()) counts[plantRarityAt(seed, hex)] += 1
    }
    const total = counts.common + counts.rare + counts.veryRare
    expect(total).toBe(24 * 217)
    expect(counts.common / total).toBeGreaterThan(COMMON_WEIGHT - 0.03)
    expect(counts.common / total).toBeLessThan(COMMON_WEIGHT + 0.03)
    expect(counts.rare / total).toBeGreaterThan(RARE_WEIGHT - 0.02)
    expect(counts.rare / total).toBeLessThan(RARE_WEIGHT + 0.02)
    expect(counts.veryRare / total).toBeGreaterThan(VERY_RARE_WEIGHT - 0.02)
    expect(counts.veryRare / total).toBeLessThan(VERY_RARE_WEIGHT + 0.02)
  })

  test('every generated plant belongs to its biome registry entry', () => {
    const content = hexContent('registry-check', { q: -3, r: 2 })
    expect(HEX_BIOME_IDS).toContain(content.biomeId)
    expect(plantById.get(content.plantId)?.biomeId).toBe(content.biomeId)
    expect(plantById.get(content.plantId)?.rarity).toBe(content.rarity)
  })
})

describe('frontier', () => {
  test('only hexes adjacent to cleared territory can be opened', () => {
    const cleared = new Set([CENTER_HEX_ID])
    expect(hexVisibility(cleared, ORIGIN)).toBe('cleared')
    const available = availableHexIds(cleared)
    expect(available).toHaveLength(6)
    expect(available.every((id) => canClearHex(cleared, 1, { q: Number(id.split(',')[0]), r: Number(id.split(',')[1]) }))).toBe(true)
    expect(canClearHex(cleared, 1, { q: 3, r: 0 })).toBe(false)
    expect(canClearHex(cleared, 0, { q: 1, r: 0 })).toBe(false)
    const opened = clearHex({ clearedHexes: [CENTER_HEX_ID], pendingClearActions: 1 }, { q: 1, r: 0 })
    expect(opened?.clearedHexes).toEqual([CENTER_HEX_ID, '1,0'])
    expect(opened?.pendingClearActions).toBe(0)
    expect(clearHex({ clearedHexes: [CENTER_HEX_ID], pendingClearActions: 1 }, { q: 3, r: 0 })).toBeNull()
  })
})

describe('curriculum independence', () => {
  test('choosing a hex never changes the next Heisig character', () => {
    const unlockedBedIds = ['bed-001']
    const cards = {}
    const before = nextStudyCharacter(unlockedBedIds, cards)
    expect(before?.frame).toBe(1)
    expect(before?.id).toBe(characters[0]!.id)

    const first = clearHex({ clearedHexes: [CENTER_HEX_ID], pendingClearActions: 2 }, { q: 1, r: 0 })!
    const second = clearHex(first, { q: 0, r: 1 })!
    expect(nextStudyCharacter(unlockedBedIds, cards)?.id).toBe(before?.id)
    expect(second.clearedHexes).toEqual([CENTER_HEX_ID, '1,0', '0,1'])
  })

  test('mastering a bed unlocks the next Heisig bed instead of a geographic neighbor', () => {
    const result = grantClearForMasteredBed({
      unlockedBedIds: ['bed-001'],
      masteredBedIds: ['bed-001'],
    })
    expect(result.unlockedBedIds).toContain('bed-001')
    expect(result.unlockedBedIds).toContain('bed-002')
    expect(result.grantedClears).toBe(1)
    const geographicNeighbors = new Set(beds[0]!.neighbors)
    expect(result.unlockedBedIds.filter((id) => id !== 'bed-001' && id !== 'bed-002').every((id) => !geographicNeighbors.has(id) || id === 'bed-002')).toBe(true)
    expect(result.unlockedBedIds).toEqual(['bed-001', 'bed-002'])
  })
})

describe('plant assets', () => {
  test('every registry plant has a dedicated sprite file', () => {
    expect(HEX_BIOMES).toHaveLength(15)
    expect(PLANT_ASSET_MANIFEST).toHaveLength(45)
    const publicRoot = fileURLToPath(new URL('../public/', import.meta.url))
    PLANT_ASSET_MANIFEST.forEach((plant) => {
      expect(existsSync(new URL(plant.asset, `file://${publicRoot}`))).toBe(true)
    })
  })
})

describe('biome regions', () => {
  test('most cells share a biome with at least one neighbor', () => {
    const seed = 'coherent-regions'
    let joined = 0
    for (const hex of gardenHexes()) {
      const biome = biomeIdAt(seed, hex)
      if (neighbors(hex).some((neighbor) => biomeIdAt(seed, neighbor) === biome)) joined += 1
    }
    expect(joined / gardenHexes().length).toBeGreaterThan(0.8)
  })
})
