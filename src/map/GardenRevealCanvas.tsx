import { useEffect, useRef } from 'react'
import { assetUrl } from '../assetUrl'
import { plots } from '../data/model'
import {
  GARDEN_INTERSECTIONS,
  REGION_COLUMNS,
  REGION_ROWS,
  WORLD_HEIGHT,
  WORLD_WIDTH,
  gardenRegions,
  plotQuad,
  quadPoint,
  type NormalizedPoint,
} from '../data/mapLayout'
import type { SaveGame } from '../db'
import { plotInfection } from '../garden'

type PixelPoint = { x: number; y: number }
type GardenSide = { id: string; seed: PixelPoint; adjacentBed: number }
type GardenCorner = { id: string; seed: PixelPoint; adjacentSides: [string, string] }
type RasterModel = {
  labels: Int16Array
  bedLabels: number[]
  sideLabels: Map<string, number>
  cornerLabels: Map<string, number>
}
type PlantState = {
  id: string
  bedIndex: number
  column: number
  row: number
  center: PixelPoint
  cleared: number
}

type GardenRevealCanvasProps = {
  save: SaveGame
  loadAttempt: number
  onReady: () => void
  onError: () => void
}

const GRID_URL = assetUrl('assets/garden-grid.svg')

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
    adjacentBed: column,
  })),
  ...Array.from({ length: REGION_COLUMNS }, (_, column): GardenSide => ({
    id: `bottom-${column + 1}`,
    seed: { x: (intersections[REGION_ROWS]![column]!.x + intersections[REGION_ROWS]![column + 1]!.x) / 2, y: WORLD_HEIGHT - 16 },
    adjacentBed: (REGION_ROWS - 1) * REGION_COLUMNS + column,
  })),
  ...Array.from({ length: REGION_ROWS }, (_, row): GardenSide => ({
    id: `left-${row + 1}`,
    seed: {
      x: Math.max(8, Math.min(intersections[row]![0]!.x, intersections[row + 1]![0]!.x) / 2),
      y: (intersections[row]![0]!.y + intersections[row + 1]![0]!.y) / 2,
    },
    adjacentBed: row * REGION_COLUMNS,
  })),
  ...Array.from({ length: REGION_ROWS }, (_, row): GardenSide => ({
    id: `right-${row + 1}`,
    seed: {
      x: (Math.max(intersections[row]![REGION_COLUMNS]!.x, intersections[row + 1]![REGION_COLUMNS]!.x) + WORLD_WIDTH) / 2,
      y: (intersections[row]![REGION_COLUMNS]!.y + intersections[row + 1]![REGION_COLUMNS]!.y) / 2,
    },
    adjacentBed: row * REGION_COLUMNS + REGION_COLUMNS - 1,
  })),
]

const corners: GardenCorner[] = [
  { id: 'top-left', seed: { x: 12, y: 12 }, adjacentSides: ['top-1', 'left-1'] },
  { id: 'top-right', seed: { x: WORLD_WIDTH - 12, y: 12 }, adjacentSides: ['top-5', 'right-1'] },
  { id: 'bottom-left', seed: { x: 12, y: WORLD_HEIGHT - 12 }, adjacentSides: ['bottom-1', 'left-3'] },
  { id: 'bottom-right', seed: { x: WORLD_WIDTH - 12, y: WORLD_HEIGHT - 12 }, adjacentSides: ['bottom-5', 'right-3'] },
]

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error(`Could not load ${url}`))
    image.src = url
  })
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

function buildRasterModel(grid: HTMLImageElement): RasterModel {
  const boundary = document.createElement('canvas')
  boundary.width = WORLD_WIDTH
  boundary.height = WORLD_HEIGHT
  const context = boundary.getContext('2d', { willReadFrequently: true })!

  // Seal the hand-traced lines in an invisible analysis copy. The displayed
  // artwork is untouched; thickening only prevents flood-fill leaks through
  // sub-pixel gaps in the SVG.
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
  for (let offset = 0; offset < blocked.length; offset += 1) blocked[offset] = pixels[offset * 4 + 3]! > 20 ? 1 : 0

  const labels = new Int16Array(WORLD_WIDTH * WORLD_HEIGHT)
  labels.fill(-1)
  const bedLabels: number[] = []
  const sideLabels = new Map<string, number>()
  const cornerLabels = new Map<string, number>()
  let nextLabel = 0

  for (const region of gardenRegions) {
    const label = nextLabel++
    bedLabels.push(floodLabel(blocked, labels, toPixel(quadPoint(region.mapQuad, 0.5, 0.5)), label))
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
  return { labels, bedLabels, sideLabels, cornerLabels }
}

let rasterModelPromise: Promise<RasterModel> | null = null

function rasterModel(): Promise<RasterModel> {
  rasterModelPromise ??= loadImage(GRID_URL).then(buildRasterModel).catch((error: unknown) => {
    rasterModelPromise = null
    throw error
  })
  return rasterModelPromise
}

function lineTouchesRevealedRegion(offset: number, labels: Int16Array, revealedLabels: ReadonlySet<number>): boolean {
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

function plantStates(save: SaveGame): PlantState[] {
  const unlocked = new Set(save.unlockedPlotIds)
  return plots.map((plot) => {
    const region = gardenRegions.find((candidate) => candidate.id === plot.gardenId)!
    const firstCell = plot.cells[0]!
    const center = toPixel(quadPoint(plotQuad(plot.cells), 0.5, 0.5))
    const firstGarden = region.index === 0
    return {
      id: plot.id,
      bedIndex: region.index,
      column: firstGarden ? (firstCell.x < 2 ? 0 : 1) : firstCell.x % 3,
      row: firstCell.y % 5,
      center,
      cleared: unlocked.has(plot.id) ? Math.max(0, Math.min(1, 1 - plotInfection(plot, save.cards))) : 0,
    }
  })
}

function makeRevealLayer(states: readonly PlantState[], model: RasterModel): HTMLCanvasElement {
  const reveal = document.createElement('canvas')
  reveal.width = WORLD_WIDTH
  reveal.height = WORLD_HEIGHT
  const context = reveal.getContext('2d', { willReadFrequently: true })!
  const statesByBed = gardenRegions.map((region) => states.filter((state) => state.bedIndex === region.index))
  const completeBeds = new Set(statesByBed.flatMap((bedStates, bedIndex) => (
    bedStates.length > 0 && bedStates.every((state) => state.cleared >= 1) ? [bedIndex] : []
  )))

  for (const state of states) {
    if (state.cleared <= 0 || completeBeds.has(state.bedIndex)) continue
    const siblings = statesByBed[state.bedIndex]!
    const right = siblings.find((candidate) => candidate.row === state.row && candidate.column === state.column + 1)
    const below = siblings.find((candidate) => candidate.row === state.row + 1 && candidate.column === state.column)
    const fullRadiusX = right ? Math.abs(right.center.x - state.center.x) * 0.78 : 62
    const fullRadiusY = below ? Math.abs(below.center.y - state.center.y) * 0.9 : 46
    const growth = state.cleared ** 0.62
    const radiusX = fullRadiusX * (0.45 + 0.55 * growth)
    const radiusY = fullRadiusY * (0.45 + 0.55 * growth)

    context.save()
    context.translate(state.center.x, state.center.y)
    context.scale(radiusX, radiusY)
    const gradient = context.createRadialGradient(0, 0, 0, 0, 0, 1)
    gradient.addColorStop(0, 'rgba(0,0,0,1)')
    gradient.addColorStop(0.58, 'rgba(0,0,0,1)')
    gradient.addColorStop(0.82, 'rgba(0,0,0,.55)')
    gradient.addColorStop(1, 'rgba(0,0,0,0)')
    context.fillStyle = gradient
    context.fillRect(-1, -1, 2, 2)
    context.restore()
  }

  const exposedSides = new Set(sides.filter((side) => completeBeds.has(side.adjacentBed)).map((side) => side.id))
  const exposedCorners = new Set(corners
    .filter((corner) => corner.adjacentSides.every((sideId) => exposedSides.has(sideId)))
    .map((corner) => corner.id))
  const image = context.getImageData(0, 0, WORLD_WIDTH, WORLD_HEIGHT)
  const revealedLabels = new Set([
    ...[...completeBeds].map((bedIndex) => model.bedLabels[bedIndex]!),
    ...[...exposedSides].map((sideId) => model.sideLabels.get(sideId)!),
    ...[...exposedCorners].map((cornerId) => model.cornerLabels.get(cornerId)!),
  ])
  const bedLabels = new Set(model.bedLabels)

  for (let offset = 0; offset < model.labels.length; offset += 1) {
    const label = model.labels[offset]!
    const alphaOffset = offset * 4 + 3
    if (revealedLabels.has(label)) image.data[alphaOffset] = 255
    else if (label < 0 && lineTouchesRevealedRegion(offset, model.labels, revealedLabels)) image.data[alphaOffset] = 255
    else if (!bedLabels.has(label)) image.data[alphaOffset] = 0
  }
  context.putImageData(image, 0, 0)
  return reveal
}

export function GardenRevealCanvas({ save, loadAttempt, onReady, onError }: GardenRevealCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    let cancelled = false
    const suffix = loadAttempt ? `?map-load-attempt=${loadAttempt}` : ''

    void Promise.all([
      loadImage(assetUrl(`assets/garden-map.webp${suffix}`)),
      loadImage(assetUrl(`assets/garden-map_negative.webp${suffix}`)),
      rasterModel(),
    ]).then(([clean, negative, model]) => {
      if (cancelled) return
      const context = canvas.getContext('2d', { alpha: false })!
      const reveal = makeRevealLayer(plantStates(save), model)
      context.globalCompositeOperation = 'source-over'
      context.drawImage(clean, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)

      const weedLayer = document.createElement('canvas')
      weedLayer.width = WORLD_WIDTH
      weedLayer.height = WORLD_HEIGHT
      const weedContext = weedLayer.getContext('2d')!
      weedContext.drawImage(negative, 0, 0, WORLD_WIDTH, WORLD_HEIGHT)
      weedContext.globalCompositeOperation = 'destination-out'
      weedContext.drawImage(reveal, 0, 0)
      context.drawImage(weedLayer, 0, 0)
      window.requestAnimationFrame(() => {
        if (!cancelled) onReady()
      })
    }).catch(() => {
      if (!cancelled) onError()
    })

    return () => { cancelled = true }
  }, [loadAttempt, onError, onReady, save])

  return <canvas className="world-map-canvas" ref={canvasRef} width={WORLD_WIDTH} height={WORLD_HEIGHT} aria-hidden="true" />
}
