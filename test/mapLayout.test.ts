import { describe, expect, test } from 'bun:test'
import {
  cellRect,
  gardenPoint,
  GARDEN_INTERSECTIONS,
  biomes,
  bedQuad,
  BIOME_COLUMNS,
  BIOME_ROWS,
} from '../src/data/mapLayout'

describe('perspective garden layout', () => {
  test('the garden is a trapezoid that widens toward the near edge', () => {
    const topLeft = gardenPoint(0, 0)
    const topRight = gardenPoint(1, 0)
    const bottomLeft = gardenPoint(0, 1)
    const bottomRight = gardenPoint(1, 1)

    expect(topRight.x - topLeft.x).toBeLessThan(bottomRight.x - bottomLeft.x)
    expect(bottomLeft.x).toBeLessThan(topLeft.x)
    expect(bottomRight.x).toBeGreaterThan(topRight.x)
  })

  test('biomes follow the painted 5 by 3 grid without overlapping', () => {
    expect(biomes).toHaveLength(BIOME_COLUMNS * BIOME_ROWS)

    for (let index = 0; index < biomes.length; index += 1) {
      const biome = biomes[index]!
      const column = index % BIOME_COLUMNS
      const row = Math.floor(index / BIOME_COLUMNS)
      expect(biome.mapQuad.tl.x).toBeLessThan(biome.mapQuad.tr.x)
      expect(biome.mapQuad.bl.x).toBeLessThan(biome.mapQuad.br.x)
      expect(biome.mapQuad.tl.y).toBeLessThan(biome.mapQuad.bl.y)

      if (column > 0) {
        const left = biomes[index - 1]!
        expect(biome.mapQuad.tl.x).toBeGreaterThanOrEqual(left.mapQuad.tr.x - 1e-9)
      }
      if (row > 0) {
        const above = biomes[index - BIOME_COLUMNS]!
        expect(biome.mapQuad.tl.y).toBeGreaterThanOrEqual(above.mapQuad.bl.y - 1e-9)
      }
    }
  })

  test('uses the measured Garden.svg intersections as biome corners', () => {
    expect(biomes[0]!.mapQuad.tl).toEqual(GARDEN_INTERSECTIONS[0]![0]!)
    expect(biomes[0]!.mapQuad.br).toEqual(GARDEN_INTERSECTIONS[1]![1]!)
    expect(biomes[14]!.mapQuad.tl).toEqual(GARDEN_INTERSECTIONS[2]![4]!)
    expect(biomes[14]!.mapQuad.br).toEqual(GARDEN_INTERSECTIONS[3]![5]!)
  })

  test('subdivides the first biome into the required two bed columns', () => {
    const left = bedQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }])
    const right = bedQuad([{ x: 2, y: 0 }])
    const biome = biomes[0]!.mapQuad

    expect(left.tl).toEqual(biome.tl)
    expect(left.tr.x).toBeCloseTo((biome.tl.x + biome.tr.x) / 2)
    expect(right.tl).toEqual(left.tr)
    expect(right.tr).toEqual(biome.tr)
  })

  test('bed cells stay inside their biome bounds', () => {
    const biome = biomes[0]!
    const rect = cellRect({ x: 0, y: 0 })
    expect(rect.x).toBeGreaterThanOrEqual(biome.mapRect.x - 1e-6)
    expect(rect.y).toBeGreaterThanOrEqual(biome.mapRect.y - 1e-6)
    expect(rect.x + rect.width).toBeLessThanOrEqual(biome.mapRect.x + biome.mapRect.width + 1e-6)
    expect(rect.y + rect.height).toBeLessThanOrEqual(biome.mapRect.y + biome.mapRect.height + 1e-6)
  })
})
