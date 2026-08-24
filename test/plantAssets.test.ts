import { describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { BIOME_REGISTRY, PLANT_REGISTRY } from '../src/garden/biomeRegistry'

describe('garden plant registry and generated assets', () => {
  test('defines exactly three related rarity entries for every established biome', () => {
    expect(BIOME_REGISTRY).toHaveLength(15)
    expect(PLANT_REGISTRY).toHaveLength(45)
    for (const biome of BIOME_REGISTRY) {
      expect(Object.keys(biome.plants).sort()).toEqual(['common', 'rare', 'veryRare'])
      expect(Object.values(biome.plants).every((plant) => plant.biomeId === biome.id)).toBe(true)
    }
  })

  test('ships every plant as an individual 1024-square RGBA PNG', () => {
    for (const plant of PLANT_REGISTRY) {
      const path = fileURLToPath(new URL(`../public/${plant.asset}`, import.meta.url))
      const png = readFileSync(path)
      expect(png.subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a')
      expect(png.readUInt32BE(16)).toBe(1024)
      expect(png.readUInt32BE(20)).toBe(1024)
      expect(png[25]).toBe(6) // PNG truecolour with alpha
    }
  })
})
