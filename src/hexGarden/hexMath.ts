import { cubeS, HEX_RADIUS, type Axial } from './hexGrid'

/** Neighbors matching pointy-top edges clockwise from the east face. */
export const EDGE_DIRECTIONS: readonly Axial[] = [
  { q: 1, r: 0 },
  { q: 0, r: 1 },
  { q: -1, r: 1 },
  { q: -1, r: 0 },
  { q: 0, r: -1 },
  { q: 1, r: -1 },
]

const SQRT3 = Math.sqrt(3)

/** Pointy-top pixel size of one hex in garden space. */
export const HEX_SIZE = 36

/** Garden-space origin of axial (0, 0), centered on the existing island. */
export const HEX_ORIGIN = { x: 800, y: 612 }

export function axialToPixel(hex: Axial, size = HEX_SIZE): { x: number; y: number } {
  return {
    x: HEX_ORIGIN.x + size * (SQRT3 * hex.q + SQRT3 / 2 * hex.r),
    y: HEX_ORIGIN.y + size * (1.5 * hex.r),
  }
}

export function pixelToAxial(x: number, y: number, size = HEX_SIZE): Axial {
  const localX = x - HEX_ORIGIN.x
  const localY = y - HEX_ORIGIN.y
  const q = (SQRT3 / 3 * localX - 1 / 3 * localY) / size
  const r = (2 / 3 * localY) / size
  return cubeRound(q, r, -q - r)
}

function cubeRound(fracQ: number, fracR: number, fracS: number): Axial {
  let q = Math.round(fracQ)
  let r = Math.round(fracR)
  let s = Math.round(fracS)
  const dq = Math.abs(q - fracQ)
  const dr = Math.abs(r - fracR)
  const ds = Math.abs(s - fracS)
  if (dq > dr && dq > ds) q = -r - s
  else if (dr > ds) r = -q - s
  else s = -q - r
  void s
  return { q, r }
}

export function hexCorners(cx: number, cy: number, size = HEX_SIZE): Array<{ x: number; y: number }> {
  return Array.from({ length: 6 }, (_, index) => {
    const angle = Math.PI / 180 * (60 * index - 30)
    return { x: cx + size * Math.cos(angle), y: cy + size * Math.sin(angle) }
  })
}

export function hexPoints(cx: number, cy: number, size = HEX_SIZE): string {
  return hexCorners(cx, cy, size).map((point) => `${point.x},${point.y}`).join(' ')
}

/** True if the garden-space point is inside the hex polygon, not its AABB. */
export function pointInHex(x: number, y: number, hex: Axial, size = HEX_SIZE): boolean {
  const center = axialToPixel(hex, size)
  const corners = hexCorners(center.x, center.y, size)
  let inside = false
  for (let index = 0, prev = corners.length - 1; index < corners.length; prev = index, index += 1) {
    const current = corners[index]!
    const previous = corners[prev]!
    const intersects = (current.y > y) !== (previous.y > y)
      && x < (previous.x - current.x) * (y - current.y) / (previous.y - current.y) + current.x
    if (intersects) inside = !inside
  }
  return inside
}

export function hexEdge(hex: Axial, directionIndex: number, size = HEX_SIZE): { a: { x: number; y: number }; b: { x: number; y: number } } {
  const center = axialToPixel(hex, size)
  const corners = hexCorners(center.x, center.y, size)
  return {
    a: corners[directionIndex]!,
    b: corners[(directionIndex + 1) % 6]!,
  }
}

export function neighborInDirection(hex: Axial, directionIndex: number): Axial {
  const dir = EDGE_DIRECTIONS[directionIndex]!
  return { q: hex.q + dir.q, r: hex.r + dir.r }
}

export function gardenBoundsForRadius(radius = HEX_RADIUS, size = HEX_SIZE): {
  x: number
  y: number
  width: number
  height: number
} {
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const samples: Axial[] = [
    { q: radius, r: -radius },
    { q: radius, r: 0 },
    { q: 0, r: radius },
    { q: -radius, r: radius },
    { q: -radius, r: 0 },
    { q: 0, r: -radius },
  ]
  for (const hex of samples) {
    for (const corner of hexCorners(axialToPixel(hex, size).x, axialToPixel(hex, size).y, size)) {
      minX = Math.min(minX, corner.x)
      maxX = Math.max(maxX, corner.x)
      minY = Math.min(minY, corner.y)
      maxY = Math.max(maxY, corner.y)
    }
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
}

export { cubeS }
