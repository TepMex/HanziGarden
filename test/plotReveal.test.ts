import { describe, expect, test } from 'bun:test'
import { cellQuad, plotBounds } from '../src/data/mapLayout'
import {
  clearedFromInfection,
  FULL_CLEAR_AXIS,
  FULL_PLOT_POLYGON_CLEARED,
  MAX_PARTIAL_CLEARED,
  plotRevealAxisScale,
  plotRevealEllipses,
  plotRevealGrowth,
  plotRevealQuads,
} from '../src/map/plotReveal'

const twoCellPlot = [{ x: 0, y: 0 }, { x: 1, y: 0 }] as const
const singleCell = [{ x: 2, y: 0 }] as const

describe('plot reveal formula', () => {
  test('caps visual cleanliness at 40% while any review is pending', () => {
    expect(clearedFromInfection(1)).toBe(0)
    expect(clearedFromInfection(0)).toBe(1)
    expect(clearedFromInfection(0.75)).toBeCloseTo(0.25)
    expect(clearedFromInfection(0.25)).toBe(MAX_PARTIAL_CLEARED)
    expect(clearedFromInfection(Number.EPSILON)).toBe(MAX_PARTIAL_CLEARED)
    expect(clearedFromInfection(-1)).toBe(1)
    expect(clearedFromInfection(2)).toBe(0)
  })

  test('growth is zero until there is progress and reaches one when fully cleared', () => {
    expect(plotRevealGrowth(0)).toBe(0)
    expect(plotRevealGrowth(0.25)).toBeGreaterThan(0.25)
    expect(plotRevealGrowth(0.25)).toBeLessThan(0.6)
    expect(plotRevealGrowth(1)).toBeCloseTo(1)
  })

  test('axis scale covers AABB corners inside the opaque gradient core when fully cleared', () => {
    // Opaque core ends at 68% of radius.  Corners of a w×h AABB need
    // (0.5/k)^2 + (0.5/k)^2 <= 0.68^2  ⇒  k >= sqrt(0.5 / 0.68^2) ≈ 1.04.
    expect(FULL_CLEAR_AXIS).toBeGreaterThanOrEqual(1.04)
    expect(plotRevealAxisScale(1)).toBeCloseTo(FULL_CLEAR_AXIS)

    const bounds = plotBounds(twoCellPlot)
    const [main] = plotRevealEllipses(twoCellPlot, 42, 0)
    const halfW = bounds.width / 2
    const halfH = bounds.height / 2
    const cornerDistance = (halfW / main!.radiusX) ** 2 + (halfH / main!.radiusY) ** 2
    expect(cornerDistance).toBeLessThanOrEqual(0.68 ** 2 + 1e-6)
  })

  test('fully infected plots reveal nothing; partial clears stay smaller than full clears', () => {
    expect(plotRevealEllipses(singleCell, 7, 1)).toEqual([])
    const partial = plotRevealEllipses(singleCell, 7, 0.5)
    const full = plotRevealEllipses(singleCell, 7, 0)
    expect(partial).toHaveLength(3)
    expect(full).toHaveLength(3)
    expect(full[0]!.radiusX).toBeGreaterThan(partial[0]!.radiusX)
    expect(full[0]!.radiusY).toBeGreaterThan(partial[0]!.radiusY)
  })

  test('exact bed polygons appear only when a plot is effectively clean', () => {
    expect(plotRevealQuads(twoCellPlot, 0.2)).toEqual([])
    expect(plotRevealQuads(twoCellPlot, 1 - FULL_PLOT_POLYGON_CLEARED + 0.01)).toEqual([])
    const quads = plotRevealQuads(twoCellPlot, 0)
    expect(quads).toHaveLength(2)
    expect(quads[0]).toEqual(cellQuad(twoCellPlot[0]!))
    expect(quads[1]).toEqual(cellQuad(twoCellPlot[1]!))
  })

  test('seeded lobes stay stable for the same plot seed', () => {
    const first = plotRevealEllipses(singleCell, 99, 0.4)
    const second = plotRevealEllipses(singleCell, 99, 0.4)
    expect(first).toEqual(second)
    const otherSeed = plotRevealEllipses(singleCell, 100, 0.4)
    expect(otherSeed[0]!.rotation).not.toBeCloseTo(first[0]!.rotation)
  })
})
