import { describe, expect, test } from 'bun:test'
import { existsSync } from 'node:fs'
import { beds, biomes } from '../src/data/model'
import { GARDEN_HEIGHT, GARDEN_WIDTH } from '../src/data/mapLayout'
import { gardenHexes, hexBiomeBounds, hexBounds, hexCorners, hexNeighbors } from '../src/map/hexGardenLayout'
import { hexGardenArt } from '../src/map/hexGardenArt'

function connected(cells: typeof gardenHexes): boolean {
  const remaining = new Set(cells.map((hex) => hex.id))
  const queue = [cells[0]!]
  remaining.delete(queue[0]!.id)
  for (let i = 0; i < queue.length; i += 1) {
    for (const neighbor of hexNeighbors(queue[i]!)) {
      if (remaining.delete(neighbor.id)) queue.push(neighbor)
    }
  }
  return remaining.size === 0
}

describe('living-garden hex map', () => {
  test('maps all existing beds to unique hexes with their original biome identities', () => {
    expect(gardenHexes).toHaveLength(220)
    expect(new Set(gardenHexes.map((hex) => `${hex.q},${hex.r}`)).size).toBe(220)
    expect(gardenHexes.map((hex) => hex.id)).toEqual(beds.map((bed) => bed.id))
    gardenHexes.forEach((hex) => expect(hex.biomeId).toBe(beds[hex.bedIndex]!.biomeId))
  })

  test('forms one connected island and 15 connected biomes with exact quotas', () => {
    expect(connected(gardenHexes)).toBe(true)
    expect(biomes).toHaveLength(15)
    for (const biome of biomes) {
      const cells = gardenHexes.filter((hex) => hex.biomeId === biome.id)
      expect(cells).toHaveLength(biome.index === 0 ? 10 : 15)
      expect(connected(cells)).toBe(true)
      expect(cells.every((hex) => hexNeighbors(hex).some((neighbor) => neighbor.biomeId === biome.id))).toBe(true)
    }
  })

  test('shares exactly two corners between adjacent hexes, without overlapping interiors', () => {
    for (const hex of gardenHexes) {
      for (const neighbor of hexNeighbors(hex)) {
        expect(hexNeighbors(neighbor)).toContain(hex)
        const shared = hexCorners(hex).filter((point) => hexCorners(neighbor).some((other) => Math.hypot(point.x - other.x, point.y - other.y) < 1e-6))
        expect(shared).toHaveLength(2)
      }
    }
  })

  test('keeps terrain, click bounds and biome framing in the same garden coordinates', () => {
    for (const hex of gardenHexes) {
      const bounds = hexBounds(hex)
      const biome = hexBiomeBounds(hex.biomeId)
      expect(bounds.x).toBeGreaterThanOrEqual(biome.x - 1e-9)
      expect(bounds.y).toBeGreaterThanOrEqual(biome.y - 1e-9)
      expect(bounds.x + bounds.width).toBeLessThanOrEqual(biome.x + biome.width + 1e-9)
      expect(bounds.y + bounds.height).toBeLessThanOrEqual(biome.y + biome.height + 1e-9)
      for (const point of hexCorners(hex)) {
        expect(point.x).toBeGreaterThan(0)
        expect(point.x).toBeLessThan(GARDEN_WIDTH)
        expect(point.y).toBeGreaterThan(0)
        expect(point.y).toBeLessThan(GARDEN_HEIGHT)
        expect(point.x / GARDEN_WIDTH).toBeGreaterThanOrEqual(bounds.x - 1e-9)
        expect(point.x / GARDEN_WIDTH).toBeLessThanOrEqual(bounds.x + bounds.width + 1e-9)
      }
    }
  })

  test('represents all cultures and ships every source sprite, including rare variants', () => {
    expect(Object.keys(hexGardenArt)).toHaveLength(15)
    for (const biome of biomes) {
      const art = hexGardenArt[biome.culture]
      expect(art).toBeDefined()
      for (const sprite of art.sprites) expect(existsSync(new URL(`../public/assets/hex-garden/${sprite}.webp`, import.meta.url))).toBe(true)
    }
  })
})
