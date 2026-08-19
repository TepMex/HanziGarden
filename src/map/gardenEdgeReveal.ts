import {
  GARDEN_INTERSECTIONS,
  BIOME_COLUMNS,
  BIOME_ROWS,
  GARDEN_HEIGHT,
  GARDEN_WIDTH,
  biomes,
  quadPoint,
  type NormalizedPoint,
} from '../data/mapLayout'

type PixelPoint = { x: number; y: number }
type GardenSide = { id: string; seed: PixelPoint; adjacentBiome: number }
type GardenCorner = { id: string; seed: PixelPoint; adjacentSides: [string, string] }

export type GardenEdgeRasterModel = {
  labels: Int16Array
  biomeLabels: number[]
  sideLabels: Map<string, number>
  cornerLabels: Map<string, number>
}

function toPixel(point: NormalizedPoint): PixelPoint {
  return { x: point.x * GARDEN_WIDTH, y: point.y * GARDEN_HEIGHT }
}

function mix(left: PixelPoint, right: PixelPoint, amount: number): PixelPoint {
  return { x: left.x + (right.x - left.x) * amount, y: left.y + (right.y - left.y) * amount }
}

const intersections = GARDEN_INTERSECTIONS.map((row) => row.map(toPixel))

const sides: GardenSide[] = [
  ...Array.from({ length: BIOME_COLUMNS }, (_, column): GardenSide => ({
    id: `top-${column + 1}`,
    seed: mix({ x: intersections[0]![column]!.x, y: 10 }, { x: intersections[0]![column + 1]!.x, y: 10 }, 0.5),
    adjacentBiome: column,
  })),
  ...Array.from({ length: BIOME_COLUMNS }, (_, column): GardenSide => ({
    id: `bottom-${column + 1}`,
    seed: { x: (intersections[BIOME_ROWS]![column]!.x + intersections[BIOME_ROWS]![column + 1]!.x) / 2, y: GARDEN_HEIGHT - 16 },
    adjacentBiome: (BIOME_ROWS - 1) * BIOME_COLUMNS + column,
  })),
  ...Array.from({ length: BIOME_ROWS }, (_, row): GardenSide => ({
    id: `left-${row + 1}`,
    seed: {
      x: Math.max(8, Math.min(intersections[row]![0]!.x, intersections[row + 1]![0]!.x) / 2),
      y: (intersections[row]![0]!.y + intersections[row + 1]![0]!.y) / 2,
    },
    adjacentBiome: row * BIOME_COLUMNS,
  })),
  ...Array.from({ length: BIOME_ROWS }, (_, row): GardenSide => ({
    id: `right-${row + 1}`,
    seed: {
      x: (Math.max(intersections[row]![BIOME_COLUMNS]!.x, intersections[row + 1]![BIOME_COLUMNS]!.x) + GARDEN_WIDTH) / 2,
      y: (intersections[row]![BIOME_COLUMNS]!.y + intersections[row + 1]![BIOME_COLUMNS]!.y) / 2,
    },
    adjacentBiome: row * BIOME_COLUMNS + BIOME_COLUMNS - 1,
  })),
]

const corners: GardenCorner[] = [
  { id: 'top-left', seed: { x: 12, y: 12 }, adjacentSides: ['top-1', 'left-1'] },
  { id: 'top-right', seed: { x: GARDEN_WIDTH - 12, y: 12 }, adjacentSides: ['top-5', 'right-1'] },
  { id: 'bottom-left', seed: { x: 12, y: GARDEN_HEIGHT - 12 }, adjacentSides: ['bottom-1', 'left-3'] },
  { id: 'bottom-right', seed: { x: GARDEN_WIDTH - 12, y: GARDEN_HEIGHT - 12 }, adjacentSides: ['bottom-5', 'right-3'] },
]

export function completedBiomeIndexes(
  coverages: readonly { biomeId: string; coverage: number }[],
): Set<number> {
  return new Set(biomes.flatMap((biome) => {
    const biomeCoverages = coverages.filter((item) => item.biomeId === biome.id)
    return biomeCoverages.length > 0 && biomeCoverages.every((item) => item.coverage === 0)
      ? [biome.index]
      : []
  }))
}

export function gardenEdgeExposureForCompletedBiomes(completedBiomes: ReadonlySet<number>): {
  sideIds: Set<string>
  cornerIds: Set<string>
} {
  const sideIds = new Set(sides
    .filter((side) => completedBiomes.has(side.adjacentBiome))
    .map((side) => side.id))
  const cornerIds = new Set(corners
    .filter((corner) => corner.adjacentSides.every((sideId) => sideIds.has(sideId)))
    .map((corner) => corner.id))
  return { sideIds, cornerIds }
}

function floodLabel(blocked: Uint8Array, labels: Int16Array, seed: PixelPoint, label: number): number {
  const startX = Math.max(0, Math.min(GARDEN_WIDTH - 1, Math.round(seed.x)))
  const startY = Math.max(0, Math.min(GARDEN_HEIGHT - 1, Math.round(seed.y)))
  const start = startY * GARDEN_WIDTH + startX
  if (blocked[start] || labels[start] >= 0) return labels[start] ?? -1

  const queue = new Int32Array(GARDEN_WIDTH * GARDEN_HEIGHT)
  let head = 0
  let tail = 0
  queue[tail++] = start
  labels[start] = label

  while (head < tail) {
    const offset = queue[head++]!
    const x = offset % GARDEN_WIDTH
    const candidates = [offset - GARDEN_WIDTH, offset + GARDEN_WIDTH, offset - 1, offset + 1]
    for (let index = 0; index < candidates.length; index += 1) {
      if ((index === 2 && x === 0) || (index === 3 && x === GARDEN_WIDTH - 1)) continue
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
  boundary.width = GARDEN_WIDTH
  boundary.height = GARDEN_HEIGHT
  const context = boundary.getContext('2d', { willReadFrequently: true })!

  // Seal small gaps only in this analysis copy of the hand-painted grid.
  for (let y = -5; y <= 5; y += 1) {
    for (let x = -5; x <= 5; x += 1) context.drawImage(grid, x, y, GARDEN_WIDTH, GARDEN_HEIGHT)
  }
  context.strokeStyle = '#000'
  context.lineWidth = 11
  context.beginPath()
  for (let column = 0; column <= BIOME_COLUMNS; column += 1) {
    const top = intersections[0]![column]!
    const bottom = intersections[BIOME_ROWS]![column]!
    context.moveTo(top.x, top.y)
    context.lineTo(top.x, 0)
    context.moveTo(bottom.x, bottom.y)
    context.lineTo(bottom.x, GARDEN_HEIGHT)
  }
  for (let row = 0; row <= BIOME_ROWS; row += 1) {
    const left = intersections[row]![0]!
    const right = intersections[row]![BIOME_COLUMNS]!
    context.moveTo(left.x, left.y)
    context.lineTo(0, left.y)
    context.moveTo(right.x, right.y)
    context.lineTo(GARDEN_WIDTH, right.y)
  }
  context.stroke()

  const pixels = context.getImageData(0, 0, GARDEN_WIDTH, GARDEN_HEIGHT).data
  const blocked = new Uint8Array(GARDEN_WIDTH * GARDEN_HEIGHT)
  for (let offset = 0; offset < blocked.length; offset += 1) {
    blocked[offset] = pixels[offset * 4 + 3]! > 20 ? 1 : 0
  }

  const labels = new Int16Array(GARDEN_WIDTH * GARDEN_HEIGHT)
  labels.fill(-1)
  const biomeLabels: number[] = []
  const sideLabels = new Map<string, number>()
  const cornerLabels = new Map<string, number>()
  let nextLabel = 0

  for (const biome of biomes) {
    const label = nextLabel++
    biomeLabels.push(floodLabel(blocked, labels, toPixel(quadPoint(biome.mapQuad, 0.5, 0.5)), label))
  }
  for (const side of sides) {
    const existing = labels[Math.round(side.seed.y) * GARDEN_WIDTH + Math.round(side.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, side.seed, nextLabel++)
    sideLabels.set(side.id, label)
  }
  for (const corner of corners) {
    const existing = labels[Math.round(corner.seed.y) * GARDEN_WIDTH + Math.round(corner.seed.x)]!
    const label = existing >= 0 ? existing : floodLabel(blocked, labels, corner.seed, nextLabel++)
    cornerLabels.set(corner.id, label)
  }
  return { labels, biomeLabels, sideLabels, cornerLabels }
}

function lineTouchesRevealedArea(
  offset: number,
  labels: Int16Array,
  revealedLabels: ReadonlySet<number>,
): boolean {
  const x = offset % GARDEN_WIDTH
  const y = Math.floor(offset / GARDEN_WIDTH)
  const directions = [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, -1], [-1, 1], [1, 1]] as const
  for (let radius = 3; radius <= 18; radius += 3) {
    for (const [directionX, directionY] of directions) {
      const sampleX = x + directionX * radius
      const sampleY = y + directionY * radius
      if (sampleX < 0 || sampleX >= GARDEN_WIDTH || sampleY < 0 || sampleY >= GARDEN_HEIGHT) continue
      if (revealedLabels.has(labels[sampleY * GARDEN_WIDTH + sampleX]!)) return true
    }
  }
  return false
}

/** Paint weed alpha outside the garden, clearing only earned sides and corners. */
export function drawGardenEdgeWeedMask(
  context: CanvasRenderingContext2D,
  model: GardenEdgeRasterModel,
  completedBiomes: ReadonlySet<number>,
): void {
  const { sideIds, cornerIds } = gardenEdgeExposureForCompletedBiomes(completedBiomes)
  const revealedLabels = new Set([
    ...[...completedBiomes].map((biomeIndex) => model.biomeLabels[biomeIndex]!),
    ...[...sideIds].map((sideId) => model.sideLabels.get(sideId)!),
    ...[...cornerIds].map((cornerId) => model.cornerLabels.get(cornerId)!),
  ])
  const biomeLabels = new Set(model.biomeLabels)
  const image = context.createImageData(GARDEN_WIDTH, GARDEN_HEIGHT)

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    const label = model.labels[offset]!
    const pixel = offset * 4
    const isGardenInterior = biomeLabels.has(label)
    const isRevealedExterior = revealedLabels.has(label)
    const isRevealedLine = label < 0 && lineTouchesRevealedArea(offset, model.labels, revealedLabels)
    image.data[pixel] = 255
    image.data[pixel + 1] = 255
    image.data[pixel + 2] = 255
    image.data[pixel + 3] = isGardenInterior || isRevealedExterior || isRevealedLine ? 0 : 255
  }
  context.putImageData(image, 0, 0)
}

/**
 * The painted biome contour bows between measured intersections, while bed
 * quads connect those intersections with straight segments. Extend only the
 * bed mask into raster-interior pixels missed by that vector union. Each gap
 * inherits alpha from the nearest connected bed pixel in the same biome, so
 * partial/clean beds keep their state and no exterior component is polluted.
 */
export function extendBedMaskToRasterGardenEdges(
  context: CanvasRenderingContext2D,
  model: GardenEdgeRasterModel,
  bedGeometry: HTMLCanvasElement,
): void {
  const geometryContext = bedGeometry.getContext('2d', { willReadFrequently: true })!
  const geometry = geometryContext.getImageData(0, 0, GARDEN_WIDTH, GARDEN_HEIGHT).data
  const mask = context.getImageData(0, 0, GARDEN_WIDTH, GARDEN_HEIGHT)
  const biomeLabels = new Set(model.biomeLabels)
  const gaps = new Uint8Array(model.labels.length)
  const resolved = new Uint8Array(model.labels.length)
  const queue = new Int32Array(model.labels.length)
  let head = 0
  let tail = 0

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    if (biomeLabels.has(model.labels[offset]!) && geometry[offset * 4 + 3]! < 255) gaps[offset] = 1
  }

  const visitNeighbors = (offset: number, visit: (neighbor: number) => boolean): void => {
    const x = offset % GARDEN_WIDTH
    const candidates = [offset - GARDEN_WIDTH, offset + GARDEN_WIDTH, offset - 1, offset + 1]
    for (let index = 0; index < candidates.length; index += 1) {
      if ((index === 2 && x === 0) || (index === 3 && x === GARDEN_WIDTH - 1)) continue
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
