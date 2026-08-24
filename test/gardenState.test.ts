import { describe, expect, test } from 'bun:test'
import {
  CENTER_HEX_ID,
  canClearHex,
  clearGardenHex,
  createGardenSeed,
  gardenFrontier,
  gardenHexStatus,
  grantClearAction,
} from '../src/garden/gardenState'

describe('garden frontier', () => {
  test('starts cleared in the center with six available neighbors', () => {
    const frontier = gardenFrontier([CENTER_HEX_ID])
    expect(frontier).toHaveLength(6)
    expect(gardenHexStatus({ q: 0, r: 0 }, new Set([CENTER_HEX_ID]))).toBe('cleared')
    expect(gardenHexStatus({ q: 1, r: 0 }, new Set([CENTER_HEX_ID]))).toBe('available')
    expect(gardenHexStatus({ q: 2, r: 0 }, new Set([CENTER_HEX_ID]))).toBe('hidden')
  })

  test('only clears a frontier hex and spends exactly one action', () => {
    const progress = { clearedHexes: [CENTER_HEX_ID], pendingClearActions: 1 }
    expect(canClearHex(progress, '2,0')).toBe(false)
    expect(clearGardenHex(progress, '2,0')).toBe(progress)

    const cleared = clearGardenHex(progress, '1,0')
    expect(cleared.clearedHexes).toContain('1,0')
    expect(cleared.pendingClearActions).toBe(0)
    expect(gardenFrontier(cleared.clearedHexes).map(({ q, r }) => `${q},${r}`)).toContain('2,0')
  })

  test('supports compact expansion and long branches without shape penalties', () => {
    let progress = { clearedHexes: [CENTER_HEX_ID] as readonly string[], pendingClearActions: 8 }
    for (let q = 1; q <= 8; q += 1) progress = clearGardenHex(progress, `${q},0`)
    expect(progress.clearedHexes).toHaveLength(9)
    expect(progress.pendingClearActions).toBe(0)
  })

  test('grants clearing actions only up to remaining map capacity', () => {
    const granted = grantClearAction({ clearedHexes: [CENTER_HEX_ID], pendingClearActions: 0 })
    expect(granted.pendingClearActions).toBe(1)
  })
})

describe('garden seed creation', () => {
  test('serializes supplied entropy without using global random state', () => {
    expect(createGardenSeed(new Uint8Array([0, 1, 15, 16, 255]))).toBe('00010f10ff')
  })
})
