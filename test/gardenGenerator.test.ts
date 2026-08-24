import { describe, expect, test } from 'bun:test'
import { BIOME_REGISTRY } from '../src/garden/biomeRegistry'
import {
  deterministicRandom,
  generateGarden,
  generateGardenCell,
  plantRarityForRoll,
} from '../src/garden/gardenGenerator'
import { GARDEN_HEXES, hexId, hexNeighbors } from '../src/garden/hexGrid'

function contentKey(seed: string, q: number, r: number): string {
  const cell = generateGardenCell(seed, { q, r })
  return `${cell.biome.id}:${cell.plant.id}`
}

describe('deterministic garden generation', () => {
  test('repeats the same biome and plant for a seed and coordinate', () => {
    const first = contentKey('permanent-seed', 3, -2)
    for (let restart = 0; restart < 20; restart += 1) {
      expect(contentKey('permanent-seed', 3, -2)).toBe(first)
    }
  })

  test('is independent of reveal order', () => {
    const forward = GARDEN_HEXES.map((hex) => [hexId(hex), contentKey('shared', hex.q, hex.r)])
    const reverse = [...GARDEN_HEXES].reverse()
      .map((hex) => [hexId(hex), contentKey('shared', hex.q, hex.r)])
    expect(Object.fromEntries(reverse)).toEqual(Object.fromEntries(forward))
  })

  test('different seeds produce different maps', () => {
    const signature = (seed: string) => generateGarden(seed).map((cell) => `${cell.biome.id}:${cell.plant.id}`).join('|')
    expect(signature('garden-a')).not.toBe(signature('garden-b'))
  })

  test('uses all established biomes in coherent neighboring regions', () => {
    const garden = generateGarden('region-quality')
    const biomeByHex = new Map(garden.map((cell) => [hexId(cell.coordinate), cell.biome.id]))
    expect(new Set(biomeByHex.values()).size).toBe(BIOME_REGISTRY.length)

    let matchingEdges = 0
    let edges = 0
    for (const cell of garden) {
      for (const neighbor of hexNeighbors(cell.coordinate)) {
        if (hexId(cell.coordinate) >= hexId(neighbor)) continue
        edges += 1
        if (biomeByHex.get(hexId(neighbor)) === cell.biome.id) matchingEdges += 1
      }
    }
    expect(matchingEdges / edges).toBeGreaterThan(0.55)
  })

  test('plant stream approaches the configured 85/10/5 probabilities', () => {
    const counts = { common: 0, rare: 0, veryRare: 0 }
    const samples = 100_000
    for (let index = 0; index < samples; index += 1) {
      const coordinate = { q: index % 997, r: Math.floor(index / 997) }
      const roll = deterministicRandom(`distribution-${Math.floor(index / 217)}`, coordinate, 'plant:rarity')
      counts[plantRarityForRoll(roll)] += 1
    }
    expect(counts.common / samples).toBeCloseTo(0.85, 2)
    expect(counts.rare / samples).toBeCloseTo(0.10, 2)
    expect(counts.veryRare / samples).toBeCloseTo(0.05, 2)
  })
})
