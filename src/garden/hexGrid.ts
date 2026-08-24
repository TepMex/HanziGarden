export type AxialHex = Readonly<{ q: number; r: number }>

export const GARDEN_HEX_RADIUS = 8
export const GARDEN_HEX_COUNT = 1 + 3 * GARDEN_HEX_RADIUS * (GARDEN_HEX_RADIUS + 1)
export const HEX_DIRECTIONS: readonly AxialHex[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexId(hex: AxialHex): string {
  return `${hex.q},${hex.r}`
}

export function parseHexId(id: string): AxialHex | null {
  const match = /^(-?\d+),(-?\d+)$/.exec(id)
  if (!match) return null
  const q = Number(match[1])
  const r = Number(match[2])
  return Number.isSafeInteger(q) && Number.isSafeInteger(r) ? { q, r } : null
}

export function hexS(hex: AxialHex): number {
  return -hex.q - hex.r
}

export function hexDistance(left: AxialHex, right: AxialHex = { q: 0, r: 0 }): number {
  return Math.max(
    Math.abs(left.q - right.q),
    Math.abs(left.r - right.r),
    Math.abs(hexS(left) - hexS(right)),
  )
}

export function isHexInRadius(hex: AxialHex, radius = GARDEN_HEX_RADIUS): boolean {
  return Number.isInteger(hex.q)
    && Number.isInteger(hex.r)
    && Math.max(Math.abs(hex.q), Math.abs(hex.r), Math.abs(hexS(hex))) <= radius
}

export function createHexGrid(radius = GARDEN_HEX_RADIUS): AxialHex[] {
  const result: AxialHex[] = []
  for (let q = -radius; q <= radius; q += 1) {
    const minimumR = Math.max(-radius, -q - radius)
    const maximumR = Math.min(radius, -q + radius)
    for (let r = minimumR; r <= maximumR; r += 1) result.push({ q, r })
  }
  return result
}

export const GARDEN_HEXES = createHexGrid()
export const GARDEN_HEX_IDS = new Set(GARDEN_HEXES.map(hexId))

export function hexNeighbors(hex: AxialHex, radius = GARDEN_HEX_RADIUS): AxialHex[] {
  return HEX_DIRECTIONS
    .map((direction) => ({ q: hex.q + direction.q, r: hex.r + direction.r }))
    .filter((neighbor) => isHexInRadius(neighbor, radius))
}

export type HexPixel = Readonly<{ x: number; y: number }>

/** Pointy-top axial projection; callers may squash Y for a light isometric look. */
export function axialToPixel(hex: AxialHex, size: number): HexPixel {
  return {
    x: size * Math.sqrt(3) * (hex.q + hex.r / 2),
    y: size * 1.5 * hex.r,
  }
}

export function pointyHexCorners(center: HexPixel, size: number): HexPixel[] {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = (Math.PI / 180) * (60 * index - 30)
    return {
      x: center.x + size * Math.cos(angle),
      y: center.y + size * Math.sin(angle),
    }
  })
}
