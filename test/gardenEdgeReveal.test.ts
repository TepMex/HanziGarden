import { describe, expect, test } from 'bun:test'
import {
  completedBiomeIndexes,
  gardenEdgeExposureForCompletedBiomes,
} from '../src/map/gardenEdgeReveal'

describe('garden edge reveal rules', () => {
  test('completes a biome only when every one of its beds has zero weed coverage', () => {
    expect(completedBiomeIndexes([
      { biomeId: 'biome-01', coverage: 0 },
      { biomeId: 'biome-01', coverage: 0 },
      { biomeId: 'biome-02', coverage: 0.3 },
    ])).toEqual(new Set([0]))
    expect(completedBiomeIndexes([
      { biomeId: 'biome-01', coverage: 0 },
      { biomeId: 'biome-01', coverage: 0.3 },
    ])).toEqual(new Set())
  })

  test('keeps every exterior component covered before a border biome is complete', () => {
    const exposure = gardenEdgeExposureForCompletedBiomes(new Set())
    expect(exposure.sideIds).toEqual(new Set())
    expect(exposure.cornerIds).toEqual(new Set())
  })

  test('reveals only sides adjacent to completed border biomes', () => {
    const topMiddle = gardenEdgeExposureForCompletedBiomes(new Set([1]))
    expect(topMiddle.sideIds).toEqual(new Set(['top-2']))
    expect(topMiddle.cornerIds).toEqual(new Set())

    const interior = gardenEdgeExposureForCompletedBiomes(new Set([6]))
    expect(interior.sideIds).toEqual(new Set())
    expect(interior.cornerIds).toEqual(new Set())
  })

  test('reveals a corner only after both of its adjacent sides are exposed', () => {
    const topLeft = gardenEdgeExposureForCompletedBiomes(new Set([0]))
    expect(topLeft.sideIds).toEqual(new Set(['top-1', 'left-1']))
    expect(topLeft.cornerIds).toEqual(new Set(['top-left']))
  })
})
