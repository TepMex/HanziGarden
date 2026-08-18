import { describe, expect, test } from 'bun:test'
import {
  cellRect,
  estatePoint,
  GARDEN_INTERSECTIONS,
  gardenRegions,
  plotQuad,
  REGION_COLUMNS,
  REGION_ROWS,
} from '../src/data/mapLayout'

describe('perspective estate layout', () => {
  test('the estate is a trapezoid that widens toward the near edge', () => {
    const topLeft = estatePoint(0, 0)
    const topRight = estatePoint(1, 0)
    const bottomLeft = estatePoint(0, 1)
    const bottomRight = estatePoint(1, 1)

    expect(topRight.x - topLeft.x).toBeLessThan(bottomRight.x - bottomLeft.x)
    expect(bottomLeft.x).toBeLessThan(topLeft.x)
    expect(bottomRight.x).toBeGreaterThan(topRight.x)
  })

  test('garden regions follow the painted 5 by 3 beds without overlapping', () => {
    expect(gardenRegions).toHaveLength(REGION_COLUMNS * REGION_ROWS)

    for (let index = 0; index < gardenRegions.length; index += 1) {
      const region = gardenRegions[index]!
      const column = index % REGION_COLUMNS
      const row = Math.floor(index / REGION_COLUMNS)
      expect(region.mapQuad.tl.x).toBeLessThan(region.mapQuad.tr.x)
      expect(region.mapQuad.bl.x).toBeLessThan(region.mapQuad.br.x)
      expect(region.mapQuad.tl.y).toBeLessThan(region.mapQuad.bl.y)

      if (column > 0) {
        const left = gardenRegions[index - 1]!
        expect(region.mapQuad.tl.x).toBeGreaterThanOrEqual(left.mapQuad.tr.x - 1e-9)
      }
      if (row > 0) {
        const above = gardenRegions[index - REGION_COLUMNS]!
        expect(region.mapQuad.tl.y).toBeGreaterThanOrEqual(above.mapQuad.bl.y - 1e-9)
      }
    }
  })

  test('uses the measured Garden.svg intersections as region corners', () => {
    expect(gardenRegions[0]!.mapQuad.tl).toEqual(GARDEN_INTERSECTIONS[0]![0]!)
    expect(gardenRegions[0]!.mapQuad.br).toEqual(GARDEN_INTERSECTIONS[1]![1]!)
    expect(gardenRegions[14]!.mapQuad.tl).toEqual(GARDEN_INTERSECTIONS[2]![4]!)
    expect(gardenRegions[14]!.mapQuad.br).toEqual(GARDEN_INTERSECTIONS[3]![5]!)
  })

  test('subdivides the first bed into the prototype\'s two equal plot columns', () => {
    const left = plotQuad([{ x: 0, y: 0 }, { x: 1, y: 0 }])
    const right = plotQuad([{ x: 2, y: 0 }])
    const bed = gardenRegions[0]!.mapQuad

    expect(left.tl).toEqual(bed.tl)
    expect(left.tr.x).toBeCloseTo((bed.tl.x + bed.tr.x) / 2)
    expect(right.tl).toEqual(left.tr)
    expect(right.tr).toEqual(bed.tr)
  })

  test('plot cells stay inside their garden region bounds', () => {
    const region = gardenRegions[0]!
    const rect = cellRect({ x: 0, y: 0 })
    expect(rect.x).toBeGreaterThanOrEqual(region.mapRect.x - 1e-6)
    expect(rect.y).toBeGreaterThanOrEqual(region.mapRect.y - 1e-6)
    expect(rect.x + rect.width).toBeLessThanOrEqual(region.mapRect.x + region.mapRect.width + 1e-6)
    expect(rect.y + rect.height).toBeLessThanOrEqual(region.mapRect.y + region.mapRect.height + 1e-6)
  })
})
