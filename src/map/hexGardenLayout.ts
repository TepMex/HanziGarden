import layout from '../data/hexGardenLayout.json'
import { GARDEN_HEIGHT, GARDEN_WIDTH, type NormalizedPoint, type NormalizedRect } from '../data/mapLayout'

// Geometry and projection follow the living-garden Site, not the repository's prototype.
export const HEX_SIZE = 47
export const HEX_Y_SCALE = 0.76
export const HEX_DIRECTIONS = [[1, 0], [0, 1], [-1, 1], [-1, 0], [0, -1], [1, -1]] as const
export type GardenHex = typeof layout[number] & { id: string; biomeId: string; x: number; y: number }

export const gardenHexes: GardenHex[] = layout.map((hex) => ({
  ...hex,
  id: `bed-${String(hex.bedIndex + 1).padStart(3, '0')}`,
  biomeId: `biome-${String(hex.biomeIndex + 1).padStart(2, '0')}`,
  x: GARDEN_WIDTH / 2 + Math.sqrt(3) * HEX_SIZE * (hex.q + hex.r / 2),
  y: GARDEN_HEIGHT / 2 + 45 + 1.5 * HEX_SIZE * hex.r * HEX_Y_SCALE,
}))
export const hexByBedId = new Map(gardenHexes.map((hex) => [hex.id, hex]))
const hexByAxial = new Map(gardenHexes.map((hex) => [`${hex.q},${hex.r}`, hex]))

export function hexNeighbors(hex: GardenHex): GardenHex[] {
  return HEX_DIRECTIONS.flatMap(([q, r]) => {
    const neighbor = hexByAxial.get(`${hex.q + q},${hex.r + r}`)
    return neighbor ? [neighbor] : []
  })
}

export function hexCorners(hex: GardenHex, scale = 1): NormalizedPoint[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (60 * index - 30) * Math.PI / 180
    return { x: hex.x + Math.cos(angle) * HEX_SIZE * scale, y: hex.y + Math.sin(angle) * HEX_SIZE * HEX_Y_SCALE * scale }
  })
}

export function hexBounds(hex: GardenHex): NormalizedRect {
  return {
    x: (hex.x - Math.sqrt(3) / 2 * HEX_SIZE) / GARDEN_WIDTH,
    y: (hex.y - HEX_SIZE * HEX_Y_SCALE) / GARDEN_HEIGHT,
    width: Math.sqrt(3) * HEX_SIZE / GARDEN_WIDTH,
    height: 2 * HEX_SIZE * HEX_Y_SCALE / GARDEN_HEIGHT,
  }
}

export function hexClipPath(): string {
  return 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'
}

/** Include crowns when framing a biome on mobile. Gameplay cells remain unchanged. */
export function hexBiomeBounds(biomeId: string): NormalizedRect {
  const cells = gardenHexes.filter((hex) => hex.biomeId === biomeId)
  const left = Math.min(...cells.map((hex) => hexBounds(hex).x))
  const right = Math.max(...cells.map((hex) => hexBounds(hex).x + hexBounds(hex).width))
  const top = Math.min(...cells.map((hex) => hexBounds(hex).y)) - 55 / GARDEN_HEIGHT
  const bottom = Math.max(...cells.map((hex) => hexBounds(hex).y + hexBounds(hex).height))
  return { x: left, y: top, width: right - left, height: bottom - top }
}
