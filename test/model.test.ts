import { describe, expect, test } from 'bun:test'
import { beds, biomes, characters, sourceRthListIds } from '../src/data/model'

describe('garden model', () => {
  test('splits all 110 source lists into 220 ordered beds without losing characters', () => {
    expect(sourceRthListIds).toHaveLength(110)
    expect(beds).toHaveLength(220)
    expect(characters).toHaveLength(2974)
    expect(new Set(characters.map((character) => character.id)).size).toBe(2974)
    expect(new Set(beds.flatMap((bed) => bed.characterIds)).size).toBe(2974)

    sourceRthListIds.forEach((listId) => {
      const halves = beds.filter((bed) => bed.sourceRthListId === listId)
      expect(halves).toHaveLength(2)
      expect(halves.map((bed) => bed.sourceHalf)).toEqual([0, 1])
      expect(Math.abs(halves[0]!.characters.length - halves[1]!.characters.length)).toBeLessThanOrEqual(1)
      const frames = halves.flatMap((bed) => bed.characters.map((character) => character.frame))
      expect(frames).toEqual([...frames].sort((left, right) => left - right))
    })
  })

  test('occupies the garden geometry exactly once', () => {
    expect(biomes).toHaveLength(15)
    const cells = beds.flatMap((bed) => bed.cells)
    expect(cells).toHaveLength(225)
    expect(new Set(cells.map((cell) => `${cell.x}:${cell.y}`)).size).toBe(225)
    expect(cells.every((cell) => cell.x >= 0 && cell.x < 15 && cell.y >= 0 && cell.y < 15)).toBe(true)
    expect(beds.slice(0, 5).every((bed) => bed.cells.length === 2)).toBe(true)
    expect(beds.slice(5).every((bed) => bed.cells.length === 1)).toBe(true)
    expect(beds.filter((bed) => bed.biomeId === biomes[0]!.id)).toHaveLength(10)
    biomes.slice(1).forEach((biome) => {
      expect(beds.filter((bed) => bed.biomeId === biome.id)).toHaveLength(15)
    })
  })

  test('has symmetrical adjacency derived from shared cell edges', () => {
    const byId = new Map(beds.map((bed) => [bed.id, bed]))
    beds.forEach((bed) => bed.neighbors.forEach((neighborId) => {
      expect(byId.get(neighborId)?.neighbors).toContain(bed.id)
    }))
  })
})
