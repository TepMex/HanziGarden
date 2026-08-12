import { describe, expect, test } from 'bun:test'
import { gardenRegions } from '../src/data/mapLayout'
import { cornerGardenExteriorRevealRects, exteriorEdgeProgress } from '../src/map/cornerGardenReveal'

function expectRectsToBeCloseTo(
  actual: Array<{ x: number; y: number; width: number; height: number }>,
  expected: Array<{ x: number; y: number; width: number; height: number }>,
) {
  expect(actual).toHaveLength(expected.length)
  actual.forEach((rect, index) => {
    const target = expected[index]!
    expect(rect.x).toBeCloseTo(target.x)
    expect(rect.y).toBeCloseTo(target.y)
    expect(rect.width).toBeCloseTo(target.width)
    expect(rect.height).toBeCloseTo(target.height)
  })
}

describe('corner garden exterior reveal', () => {
  test('early cultivation does not open hairline exterior strips', () => {
    expect(exteriorEdgeProgress(0)).toBe(0)
    expect(exteriorEdgeProgress(0.3)).toBe(0)
    expect(exteriorEdgeProgress(0.62)).toBe(0)
    expect(exteriorEdgeProgress(1)).toBeCloseTo(1)
    expect(cornerGardenExteriorRevealRects(gardenRegions[0]!, 'top-left', 0.4)).toEqual([])
  })

  test('fully clearing the top-left garden reveals its adjacent left and top scenery', () => {
    const region = gardenRegions[0]!
    const { x, y, width, height } = region.mapRect

    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(region, 'top-left', 1), [
      { x: 0, y: 0, width: x, height: y + height },
      { x: 0, y: 0, width: x + width, height: y },
    ])
  })

  test('each corner only reveals scenery beside that garden', () => {
    const topRight = gardenRegions[4]!
    const bottomLeft = gardenRegions[10]!
    const bottomRight = gardenRegions[14]!

    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(topRight, 'top-right', 1), [
      { x: topRight.mapRect.x + topRight.mapRect.width, y: 0, width: 1 - topRight.mapRect.x - topRight.mapRect.width, height: topRight.mapRect.y + topRight.mapRect.height },
      { x: topRight.mapRect.x, y: 0, width: 1 - topRight.mapRect.x, height: topRight.mapRect.y },
    ])
    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(bottomLeft, 'bottom-left', 1), [
      { x: 0, y: bottomLeft.mapRect.y, width: bottomLeft.mapRect.x, height: 1 - bottomLeft.mapRect.y },
      { x: 0, y: bottomLeft.mapRect.y + bottomLeft.mapRect.height, width: bottomLeft.mapRect.x + bottomLeft.mapRect.width, height: 1 - bottomLeft.mapRect.y - bottomLeft.mapRect.height },
    ])
    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(bottomRight, 'bottom-right', 1), [
      { x: bottomRight.mapRect.x + bottomRight.mapRect.width, y: bottomRight.mapRect.y, width: 1 - bottomRight.mapRect.x - bottomRight.mapRect.width, height: 1 - bottomRight.mapRect.y },
      { x: bottomRight.mapRect.x, y: bottomRight.mapRect.y + bottomRight.mapRect.height, width: 1 - bottomRight.mapRect.x, height: 1 - bottomRight.mapRect.y - bottomRight.mapRect.height },
    ])
  })

  test('the exterior grows outward once past the cultivation threshold', () => {
    const region = gardenRegions[0]!
    const edge = exteriorEdgeProgress(0.81)
    const [left, top] = cornerGardenExteriorRevealRects(region, 'top-left', 0.81)
    const { x, y, width, height } = region.mapRect

    expect(left).toEqual({
      x: x * (1 - edge),
      y: 0,
      width: x * edge,
      height: y + height,
    })
    expect(top).toEqual({
      x: 0,
      y: y * (1 - edge),
      width: x + width,
      height: y * edge,
    })
  })
})
