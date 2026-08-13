import { describe, expect, test } from 'bun:test'
import { gardenRegions } from '../src/data/mapLayout'
import {
  cornerGardenClearedFraction,
  cornerGardenExteriorRevealEllipses,
  exteriorEdgeProgress,
} from '../src/map/cornerGardenReveal'

describe('corner garden exterior reveal', () => {
  test('early cultivation does not open exterior scenery', () => {
    expect(exteriorEdgeProgress(0)).toBe(0)
    expect(exteriorEdgeProgress(0.5)).toBe(0)
    expect(exteriorEdgeProgress(0.84)).toBe(0)
    expect(exteriorEdgeProgress(1)).toBeCloseTo(1)
    expect(cornerGardenExteriorRevealEllipses(gardenRegions[0]!, 'top-left', 0.4)).toEqual([])
  })

  test('empty plots do not inflate the corner cleared fraction', () => {
    expect(cornerGardenClearedFraction([
      { characterCount: 0, cleared: 1 },
      { characterCount: 8, cleared: 0.2 },
      { characterCount: 6, cleared: 0.4 },
    ])).toBeCloseTo(0.3)
    expect(cornerGardenClearedFraction([{ characterCount: 0, cleared: 1 }])).toBe(0)
  })

  test('fully clearing the top-left garden opens soft lobes only beside that garden', () => {
    const region = gardenRegions[0]!
    const { x, y, width, height } = region.mapRect
    const [left, top] = cornerGardenExteriorRevealEllipses(region, 'top-left', 1)

    expect(left!.centerX).toBeCloseTo(x * 0.5)
    expect(left!.centerY).toBeCloseTo((y + height) * 0.48)
    expect(left!.radiusX).toBeCloseTo(x * 1.08)
    expect(left!.radiusY).toBeCloseTo((y + height) * 0.62)
    // Stay on the left margin — do not span the full image height as a hard strip.
    expect(left!.centerY + left!.radiusY).toBeLessThan(1)

    expect(top!.centerX).toBeCloseTo((x + width) * 0.48)
    expect(top!.centerY).toBeCloseTo(y * 0.5)
    expect(top!.radiusX).toBeCloseTo((x + width) * 0.62)
    expect(top!.radiusY).toBeCloseTo(y * 1.08)
    expect(top!.centerX + top!.radiusX).toBeLessThan(1)
  })

  test('each corner only reveals scenery beside that garden', () => {
    const topRight = gardenRegions[4]!
    const bottomLeft = gardenRegions[10]!
    const bottomRight = gardenRegions[14]!

    const [trRight] = cornerGardenExteriorRevealEllipses(topRight, 'top-right', 1)
    expect(trRight!.centerX).toBeGreaterThan(topRight.mapRect.x + topRight.mapRect.width)
    expect(trRight!.centerX + trRight!.radiusX).toBeGreaterThan(0.95)

    const [blLeft] = cornerGardenExteriorRevealEllipses(bottomLeft, 'bottom-left', 1)
    expect(blLeft!.centerX).toBeLessThan(bottomLeft.mapRect.x)
    expect(blLeft!.centerX - blLeft!.radiusX).toBeLessThan(0.05)

    const [brRight] = cornerGardenExteriorRevealEllipses(bottomRight, 'bottom-right', 1)
    expect(brRight!.centerX).toBeGreaterThan(bottomRight.mapRect.x + bottomRight.mapRect.width)
  })

  test('exterior lobes grow smoothly once past the cultivation threshold', () => {
    const region = gardenRegions[0]!
    const early = cornerGardenExteriorRevealEllipses(region, 'top-left', 0.9)
    const late = cornerGardenExteriorRevealEllipses(region, 'top-left', 1)
    expect(early).toHaveLength(2)
    expect(late[0]!.radiusX).toBeGreaterThan(early[0]!.radiusX)
    expect(late[1]!.radiusY).toBeGreaterThan(early[1]!.radiusY)
  })
})
