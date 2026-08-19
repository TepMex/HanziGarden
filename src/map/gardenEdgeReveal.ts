import {
  GARDEN_INTERSECTIONS,
  REGION_COLUMNS,
  REGION_ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  gardenRegions,
  quadPoint,
  type NormalizedPoint,
} from '../data/mapLayout'

type PixelPoint = { x: number; y: number }
type GardenSide = { id: string; seed: PixelPoint; adjacentRegion: number }
type GardenCorner = { id: string; seed: PixelPoint; adjacentSides: [string, string] }

export type GardenEdgeRasterModel = {
  labels: Int16Array
  regionLabels: number[]
  sideLabels: Map<string, number>
  cornerLabels: Map<string, number>
}

function toPixel(point: NormalizedPoint): PixelPoint {
  return { x: point.x * WORLD_WIDTH, y: point.y * WORLD_HEIGHT }
}

function mix(left: PixelPoint, right: PixelPoint, amount: number): PixelPoint {
  return { x: left.x + (right.x - left.x) * amount, y: left.y + (right.y - left.y) * amount }
}

const intersections = GARDEN_INTERSECTIONS.map((row) => row.map(toPixel))

const sides: GardenSide[] = [
  ...Array.from({ length: REGION_COLUMNS }, (_, column): GardenSide => ({
    id: `top-${column + 1}`,
    seed: mix({ x: intersections[0]![column]!.x, y: 10 }, { x: intersections[0]![column + 1]!.x, y: 10 }, 0.5),
    adjacentRegion: column,
  })),
  ...Array.from({ length: REGION_COLUMNS }, (_, column): GardenSide => ({
    id: `bottom-${column + 1}`,
    seed: { x: (intersections[REGION_ROWS]![column]!.x + intersections[REGION_ROWS]![column + 1]!.x) / 2, y: WORLD_HEIGHT - 16 },
    adjacentRegion: (REGION_ROWS - 1) * REGION_COLUMNS + column,
  })),
  ...Array.from({ length: REGION_ROWS }, (_, row): GardenSide => ({
    id: `left-${row + 1}`,
    seed: {
      x: Math.max(8, Math.min(intersections[row]![0]!.x, intersections[row + 1]![0]!.x) / 2),
      y: (intersections[row]![0]!.y + intersections[row + 1]![0]!.y) / 2,
    },
    adjacentRegion: row * REGION_COLUMNS,
  })),
  ...Array.from({ length: REGION_ROWS }, (_, row): GardenSide => ({
    id: `right-${row + 1}`,
    seed: {
      x: (Math.max(intersections[row]![REGION_COLUMNS]!.x, intersections[row + 1]![REGION_COLUMNS]!.x) + WORLD_WIDTH) / 2,
      y: (intersections[row]![REGION_COLUMNS]!.y + intersections[row + 1]![REGION_COLUMNS]!.y) / 2,
    },
    adjacentRegion: row * REGION_COLUMNS + REGION_COLUMNS - 1,
  })),
]

const corners: GardenCorner[] = [
  { id: 'top-left', seed: { x: 12, y: 12 }, adjacentSides: ['top-1', 'left-1'] },
  { id: 'top-right', seed: { x: WORLD_WIDTH - 12, y: 12 }, adjacentSides: ['top-5', 'right-1'] },
  { id: 'bottom-left', seed: { x: 12, y: WORLD_HEIGHT - 12 }, adjacentSides: ['bottom-1', 'left-3'] },
  { id: 'bottom-right', seed: { x: WORLD_WIDTH - 12, y: WORLD_HEIGHT - 12 }, adjacentSides: ['bottom-5', 'right-3'] },
]

export function completedGardenRegionIndexes(
  coverages: readonly { gardenId: string; coverage: number }[],
): Set<number> {
  return new Set(gardenRegions.flatMap((region) => {
    const regionCoverages = coverages.filter((item) => item.gardenId === region.id)
    return regionCoverages.length > 0 && regionCoverages.every((item) => item.coverage === 0)
      ? [region.index]
      : []
  }))
}

export function gardenEdgeExposureForCompletedRegions(completedRegions: ReadonlySet<number>): {
  sideIds: Set<string>
  cornerIds: Set<string>
} {
  const sideIds = new Set(sides
    .filter((side) => completedRegions.has(side.adjacentRegion))
    .map((side) => side.id))
  const cornerIds = new Set(corners
    .filter((corner) => corner.adjacentSides.every((sideId) => sideIds.has(sideId)))
    .map((corner) => corner.id))
  return { sideIds, cornerIds }
}

function floodLabel(blocked: Uint8Array, labels: Int16Array, seed: PixelPoint, label: number): number {
  const startX = Math.max(0, Math.min(WORLD_WIDTH - 1, Math.round(seed.x)))
  const startY = Math.max(0, Math.min(WORLD_HEIGHT - 1, Math.round(seed.y)))
  const start = startY * WORLD_WIDTH + startX
  if (blocked[start] || labels[start] >= 0) return labels[start] ?? -1

  const queue = new Int32Array(WORLD_WIDTH * WORLD_HEIGHT)
  let head = 0
  let tail = 0
  queue[tail++] = start
  labels[start] = label

  while (head < tail) {
    const offset = queue[head++]!
    const x = offset % WORLD_WIDTH
    const candidates = [offset - WORLD_WIDTH, offset + WORLD_WIDTH, offset - 1, offset + 1]
    for (let index = 0; index < candidates.length; index += 1) {
      if ((index === 2 && x === 0) || (index === 3 && x === WORLD_WIDTH - 1)) continue
      const next = candidates[index]!
      if (next < 0 || next >= labels.length || blocked[next] || labels[next] >= 0) continue
      labels[next] = label
      queue[tail++] = next
    }
  }
  return label
}

export function buildGardenEdgeRasterModel(grid: HTMLImageElement): GardenEdgeRasterModel {
  const boundary = document.createElement('canvas')
  boundary.width = WORLD_WIDTH
  boundary.height = WORLD_HEIGHT
  const context = boundary.getContext('2d', { willReadFrequently: true })!

  // Seal small gaps only in this analysis copy of the hand-painted grid.
  for (let y = -5; y <= 5; y += 1) {
    for (let x = -5; x <= 5; x += 1) context.drawImage(grid, x, y, WORLD_WIDTH, WORLD_HEIGHT)
  }
  context.strokeStyle = '#000'
  context.lineWidth = 11
  context.beginPath()
  for (let column = 0; column <= REGION_COLUMNS; column += 1) {
    const top = intersections[0]![column]!
    const bottom = intersections[REGION_ROWS]![column]!
    context.moveTo(top.x, top.y)
    context.lineTo(top.x, 0)
    context.moveTo(bottom.x, bottom.y)
    context.lineTo(bottom.x, WORLD_HEIGHT)
  }
  for (let row = 0; row <= REGION_ROWS; row += 1) {
    const left = intersections[row]![0]!
    const right = intersections[row]![REGION_COLUMNS]!
    context.moveTo(left.x, left.y)
    context.lineTo(0, left.y)
    context.moveTo(right.x, right.y)
    context.lineTo(WORLD_WIDTH, right.y)
  }
  context.stroke()

  const pixels = context.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT).data
  const blocked = new Uint8Array(WORLD_WIDTH * WORLD_HEIGHT)
  for (let offset = 0; offset < blocked.length; offset += 1) {
    blocked[offset] = pixels[offset * 4 + 3]! > 20 ? 1 : 0
  }

  const labels = new Int16Array(WORLD_WIDTH * WORLD_HEIGHT)
  labels.fill(-1)
  const regionLabels: number[] = []
  const sideLabels = new Map<string, number>()
  const cornerLabels = new Map<string, number>()
  let nextLabel = 0

  for (const region of gardenRegions) {
    const label = nextLabel++
    regionLabels.push(floodLabel(blocked, labels, toPixel(quadPoint(region.mapQuad, 0.5, 0.5)), label))
  }
  for (const side of sides) {
    const existing = labels[Math.round(side.seed.y) * WORLD_WIDTH + Math.round(side.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, side.seed, nextLabel++)
    sideLabels.set(side.id, label)
  }
  for (const corner of corners) {
    const existing = labels[Math.round(corner.seed.y) * WORLD_WIDTH + Math.round(corner.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, corner.seed, nextLabel++)
    cornerLabels.set(corner.id, label)
  }
  return { labels, regionLabels, sideLabels, cornerLabels }
}

function lineTouchesRevealedRegion(
  offset: number,
  labels: Int16Array,
  revealedLabels: ReadonlySet<number>,
): boolean {
  const x = offset % WORLD_WIDTH
  const y = Math.floor(offset / WORLD_WIDTH)
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const
  for (let radius = 3; radius <= 18; radius += 3) {
    for (const [directionX, directionY] of directions) {
      const sampleX = x + directionX * radius
      const sampleY = y + directionY * radius
      if (sampleX < 0 || sampleX >= WORLD_WIDTH || sampleY < 0 || sampleY >= WORLD_HEIGHT) continue
      if (revealedLabels.has(labels[sampleY * WORLD_WIDTH + sampleX]!)) return true
    }
  }
  return false
}

/** Paint weed alpha outside the garden, clearing only earned sides and corners. */
export function drawGardenEdgeWeedMask(
  context: CanvasRenderingContext2D,
  model: GardenEdgeRasterModel,
  completedRegions: ReadonlySet<number>,
): void {
  const { sideIds, cornerIds } = gardenEdgeExposureForCompletedRegions(completedRegions)
  const revealedLabels = new Set([
    ...[...completedRegions].map((regionIndex) => model.regionLabels[regionIndex]!),
    ...[...sideIds].map((sideId) => model.sideLabels.get(sideId)!),
    ...[...cornerIds].map((cornerId) => model.cornerLabels.get(cornerId)!),
  ])
  const regionLabels = new Set(model.regionLabels)
  const image = context.createImageData(WORLD_WIDTH, WORLD_HEIGHT)

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    const label = model.labels[offset]!
    const pixel = offset * 4
    const isGardenInterior = regionLabels.has(label)
    const isRevealedExterior = revealedLabels.has(label)
    const isRevealedLine = label < 0 && lineTouchesRevealedRegion(offset, model.labels, revealedLabels)
    image.data[pixel] = 255
    image.data[pixel + 1] = 255
    image.data[pixel + 2] = 255
    image.data[pixel + 3] = isGardenInterior || isRevealedExterior || isRevealedLine ? 0 : 255
  }
  context.putImageData(image, 0, 0)
}

/**
 * The painted region contour bows between measured intersections, while plot
 * quads connect those intersections with straight segments. Extend only the
 * plot mask into raster-interior pixels missed by that vector union. Each gap
 * inherits alpha from the nearest connected plot pixel in the same region, so
 * partial/clean plots keep their state and no exterior component is polluted.
 */
export function extendPlotMaskToRasterGardenEdges(
  context: CanvasRenderingContext2D,
  model: GardenEdgeRasterModel,
  plotGeometry: HTMLCanvasElement,
): void {
  const geometryContext = plotGeometry.getContext('2d', { willReadFrequently: true })!
  const geometry = geometryContext.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT).data
  const mask = context.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  const regionLabels = new Set(model.regionLabels)
  const gaps = new Uint8Array(model.labels.length)
  const resolved = new Uint8Array(model.labels.length)
  const queue = new Int32Array(model.labels.length)
  let head = 0
  let tail = 0

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    if (regionLabels.has(model.labels[offset]!) && geometry[offset * 4 + 3]! < 255) gaps[offset] = 1
  }

  const visitNeighbors = (offset: number, visit: (neighbor: number) => boolean): void => {
    const x = offset % WORLD_WIDTH
    const candidates = [offset - WORLD_WIDTH, offset + WORLD_WIDTH, offset - 1, offset + 1]
    for (let index = 0; index < candidates.length; index += 1) {
      if ((index === 2 && x === 0) || (index === 3 && x === WORLD_WIDTH - 1)) continue
      const neighbor = candidates[index]!
      if (neighbor < 0 || neighbor >= model.labels.length || model.labels[neighbor] !== model.labels[offset]) continue
      if (visit(neighbor)) return
    }
  }

  // Seed every connected gap from the vector-covered interior next to it.
  for (let offset = 0; offset < gaps.length; offset += 1) {
    if (!gaps[offset]) continue
    visitNeighbors(offset, (neighbor) => {
      if (gaps[neighbor]) return false
      mask.data[offset * 4 + 3] = mask.data[neighbor * 4 + 3]!
      resolved[offset] = 1
      queue[tail++] = offset
      return true
    })
  }

  // Flood the inherited edge state through the remaining raster-only strip.
  while (head < tail) {
    const offset = queue[head++]!
    visitNeighbors(offset, (neighbor) => {
      if (!gaps[neighbor] || resolved[neighbor]) return false
      mask.data[neighbor * 4 + 3] = mask.data[offset * 4 + 3]!
      resolved[neighbor] = 1
      queue[tail++] = neighbor
      return false
    })
  }

  context.putImageData(mask, 0, 0)
}
