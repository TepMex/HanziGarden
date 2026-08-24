import { describe, expect, test } from 'bun:test'
import {
  GARDEN_HEX_COUNT,
  GARDEN_HEXES,
  createHexGrid,
  hexDistance,
  hexNeighbors,
  isHexInRadius,
} from '../src/garden/hexGrid'

describe('radius-eight hex geometry', () => {
  test('contains exactly 217 unique axial cells', () => {
    const grid = createHexGrid(8)
    expect(grid).toHaveLength(217)
    expect(GARDEN_HEX_COUNT).toBe(217)
    expect(new Set(grid.map(({ q, r }) => `${q},${r}`)).size).toBe(217)
    expect(grid.every((hex) => isHexInRadius(hex, 8))).toBe(true)
  })

  test('gives an internal cell six computed neighbors', () => {
    expect(hexNeighbors({ q: 0, r: 0 })).toHaveLength(6)
    expect(hexNeighbors({ q: 2, r: -3 })).toHaveLength(6)
  })

  test('never returns an out-of-radius neighbor at an edge', () => {
    const edge = GARDEN_HEXES.filter((hex) => hexDistance(hex) === 8)
    expect(edge).toHaveLength(48)
    expect(edge.every((hex) => hexNeighbors(hex).every((neighbor) => isHexInRadius(neighbor)))).toBe(true)
    expect(hexNeighbors({ q: 8, r: 0 })).toHaveLength(3)
  })
})
