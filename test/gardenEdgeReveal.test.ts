import { describe, expect, test } from 'bun:test'
import {
  completedGardenRegionIndexes,
  gardenEdgeExposureForCompletedRegions,
} from '../src/map/gardenEdgeReveal'

describe('garden edge reveal rules', () => {
  test('completes a region only when every one of its plots has zero weed coverage', () => {
    expect(completedGardenRegionIndexes([
      { gardenId: 'garden-01', coverage: 0 },
      { gardenId: 'garden-01', coverage: 0 },
      { gardenId: 'garden-02', coverage: 0.3 },
    ])).toEqual(new Set([0]))
    expect(completedGardenRegionIndexes([
      { gardenId: 'garden-01', coverage: 0 },
      { gardenId: 'garden-01', coverage: 0.3 },
    ])).toEqual(new Set())
  })

  test('keeps every exterior component covered before a border region is complete', () => {
    const exposure = gardenEdgeExposureForCompletedRegions(new Set())
    expect(exposure.sideIds).toEqual(new Set())
    expect(exposure.cornerIds).toEqual(new Set())
  })

  test('reveals only sides adjacent to completed border regions', () => {
    const topMiddle = gardenEdgeExposureForCompletedRegions(new Set([1]))
    expect(topMiddle.sideIds).toEqual(new Set(['top-2']))
    expect(topMiddle.cornerIds).toEqual(new Set())

    const interior = gardenEdgeExposureForCompletedRegions(new Set([6]))
    expect(interior.sideIds).toEqual(new Set())
    expect(interior.cornerIds).toEqual(new Set())
  })

  test('reveals a corner only after both of its adjacent sides are exposed', () => {
    const topLeft = gardenEdgeExposureForCompletedRegions(new Set([0]))
    expect(topLeft.sideIds).toEqual(new Set(['top-1', 'left-1']))
    expect(topLeft.cornerIds).toEqual(new Set(['top-left']))
  })
})
