/** Axial hex coordinates. Cube `s` is always `-q - r`. */

export type Axial = { q: number; r: number }

export const HEX_RADIUS = 8
export const HEX_COUNT = 1 + 3 * HEX_RADIUS * (HEX_RADIUS + 1)
export const ORIGIN: Axial = { q: 0, r: 0 }

/** Pointy-top axial neighbor order, clockwise from east. */
export const AXIAL_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 1, r: -1 },
  { q: 0, r: -1 },
  { q: -1, r: 0 },
  { q: -1, r: 1 },
  { q: 0, r: 1 },
]

export function hexId(hex: Axial): string {
  return `${hex.q},${hex.r}`
}

export function parseHexId(id: string): Axial {
  const [q, r] = id.split(',').map(Number)
  return { q: q!, r: r! }
}

export function cubeS(hex: Axial): number {
  return -hex.q - hex.r
}

/** Cube distance from origin, equal to `max(|q|, |r|, |s|)`. */
export function cubeDistance(hex: Axial, other: Axial = ORIGIN): number {
  return (
    Math.abs(hex.q - other.q)
    + Math.abs(hex.r - other.r)
    + Math.abs(cubeS(hex) - cubeS(other))
  ) / 2
}

export function isInGarden(hex: Axial, radius = HEX_RADIUS): boolean {
  return cubeDistance(hex) <= radius
}

export function allHexes(radius = HEX_RADIUS): Axial[] {
  const hexes: Axial[] = []
  for (let q = -radius; q <= radius; q += 1) {
    const rMin = Math.max(-radius, -q - radius)
    const rMax = Math.min(radius, -q + radius)
    for (let r = rMin; r <= rMax; r += 1) hexes.push({ q, r })
  }
  return hexes
}

const hexes = allHexes()
const hexIds = new Set(hexes.map(hexId))

export function gardenHexes(): readonly Axial[] {
  return hexes
}

export function hasHex(hex: Axial): boolean {
  return hexIds.has(hexId(hex))
}

export function neighbors(hex: Axial): Axial[] {
  return AXIAL_DIRECTIONS
    .map((dir) => ({ q: hex.q + dir.q, r: hex.r + dir.r }))
    .filter(hasHex)
}

export function neighborIds(id: string): string[] {
  return neighbors(parseHexId(id)).map(hexId)
}
