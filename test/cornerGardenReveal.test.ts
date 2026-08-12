import { describe, expect, test } from 'bun:test'
import { gardenRegions } from '../src/data/mapLayout'
import { cornerGardenExteriorRevealRects } from '../src/map/cornerGardenReveal'

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
  test('fully clearing the top-left garden reveals the whole left and top scenery', () => {
    const region = gardenRegions[0]!

    expect(cornerGardenExteriorRevealRects(region, 'top-left', 1)).toEqual([
      { x: 0, y: 0, width: region.mapRect.x, height: 1 },
      { x: 0, y: 0, width: 1, height: region.mapRect.y },
    ])
  })

  test('each corner only reveals its two adjacent image edges', () => {
    const topRight = gardenRegions[4]!
    const bottomLeft = gardenRegions[10]!
    const bottomRight = gardenRegions[14]!

    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(topRight, 'top-right', 1), [
      { x: topRight.mapRect.x + topRight.mapRect.width, y: 0, width: 1 - topRight.mapRect.x - topRight.mapRect.width, height: 1 },
      { x: 0, y: 0, width: 1, height: topRight.mapRect.y },
    ])
    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(bottomLeft, 'bottom-left', 1), [
      { x: 0, y: 0, width: bottomLeft.mapRect.x, height: 1 },
      { x: 0, y: bottomLeft.mapRect.y + bottomLeft.mapRect.height, width: 1, height: 1 - bottomLeft.mapRect.y - bottomLeft.mapRect.height },
    ])
    expectRectsToBeCloseTo(cornerGardenExteriorRevealRects(bottomRight, 'bottom-right', 1), [
      { x: bottomRight.mapRect.x + bottomRight.mapRect.width, y: 0, width: 1 - bottomRight.mapRect.x - bottomRight.mapRect.width, height: 1 },
      { x: 0, y: bottomRight.mapRect.y + bottomRight.mapRect.height, width: 1, height: 1 - bottomRight.mapRect.y - bottomRight.mapRect.height },
    ])
  })

  test('the exterior grows outward with the garden clearing progress', () => {
    const region = gardenRegions[0]!
    const [left, top] = cornerGardenExteriorRevealRects(region, 'top-left', .5)

    expect(left).toEqual({ x: region.mapRect.x / 2, y: 0, width: region.mapRect.x / 2, height: 1 })
    expect(top).toEqual({ x: 0, y: region.mapRect.y / 2, width: 1, height: region.mapRect.y / 2 })
  })
})
