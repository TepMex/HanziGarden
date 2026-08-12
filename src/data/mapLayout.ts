export type GardenCulture =
  | 'bamboo'
  | 'rice'
  | 'lotus'
  | 'tea'
  | 'blossom'
  | 'peony'
  | 'chrysanthemum'
  | 'pine'
  | 'persimmon'
  | 'orchid'
  | 'berries'
  | 'rapeseed'
  | 'wheat'
  | 'wisteria'
  | 'herbs'

export type NormalizedPoint = { x: number; y: number }
export type NormalizedRect = { x: number; y: number; width: number; height: number }
export type NormalizedQuad = {
  tl: NormalizedPoint
  tr: NormalizedPoint
  bl: NormalizedPoint
  br: NormalizedPoint
}
export type GridCell = { x: number; y: number }

export type GardenRegion = {
  id: string
  index: number
  culture: GardenCulture
  /** Axis-aligned bounds covering the perspective cell (hotspots / reveal AABB). */
  mapRect: NormalizedRect
  /** Perspective quad that tracks the painted beds and stone paths. */
  mapQuad: NormalizedQuad
}

export const MAP_ASPECT_RATIO = 4 / 3
export const WORLD_WIDTH = 1600
export const WORLD_HEIGHT = WORLD_WIDTH / MAP_ASPECT_RATIO
export const GRID_COLUMNS = 15
export const GRID_ROWS = 15
export const REGION_COLUMNS = 5
export const REGION_ROWS = 3
export const REGION_CELL_COLUMNS = 3
export const REGION_CELL_ROWS = 5
export const MIN_ZOOM = 1
export const MAX_ZOOM = 12
export const ENTER_ZOOM_THRESHOLD = 4.5

const cultures: GardenCulture[] = [
  'bamboo', 'rice', 'lotus', 'tea', 'blossom',
  'peony', 'chrysanthemum', 'pine', 'persimmon', 'orchid',
  'berries', 'rapeseed', 'wheat', 'wisteria', 'herbs',
]

/*
 * The playable beds live inside the framed garden artwork. The painting uses a
 * mild top-down perspective: the far (top) edge is narrower than the near
 * (bottom) edge, and the center path is a touch wider than the side paths.
 * Keep these as normalized quads so replacing artwork only needs this table.
 */
const ESTATE_QUAD: NormalizedQuad = {
  tl: { x: 0.138, y: 0.155 },
  tr: { x: 0.862, y: 0.155 },
  bl: { x: 0.062, y: 0.900 },
  br: { x: 0.938, y: 0.900 },
}

/** Column stops across the estate (0..1). Center path is slightly wider. */
const COLUMN_STOPS = [0, 0.188, 0.372, 0.628, 0.812, 1]
/** Row stops down the estate (0..1). Mild foreshortening on the far row. */
const ROW_STOPS = [0, 0.322, 0.650, 1]

const REGION_INSET = 0.035
const CELL_GAP = 0.035

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t
}

/** Map estate UV coordinates into the painted trapezoid. */
export function estatePoint(u: number, v: number): NormalizedPoint {
  const topX = lerp(ESTATE_QUAD.tl.x, ESTATE_QUAD.tr.x, u)
  const topY = lerp(ESTATE_QUAD.tl.y, ESTATE_QUAD.tr.y, u)
  const bottomX = lerp(ESTATE_QUAD.bl.x, ESTATE_QUAD.br.x, u)
  const bottomY = lerp(ESTATE_QUAD.bl.y, ESTATE_QUAD.br.y, u)
  return {
    x: lerp(topX, bottomX, v),
    y: lerp(topY, bottomY, v),
  }
}

export function quadFromUv(u0: number, v0: number, u1: number, v1: number): NormalizedQuad {
  return {
    tl: estatePoint(u0, v0),
    tr: estatePoint(u1, v0),
    bl: estatePoint(u0, v1),
    br: estatePoint(u1, v1),
  }
}

export function rectFromQuad(quad: NormalizedQuad): NormalizedRect {
  const xs = [quad.tl.x, quad.tr.x, quad.bl.x, quad.br.x]
  const ys = [quad.tl.y, quad.tr.y, quad.bl.y, quad.br.y]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return {
    x,
    y,
    width: Math.max(...xs) - x,
    height: Math.max(...ys) - y,
  }
}

function regionUv(column: number, row: number): { u0: number; v0: number; u1: number; v1: number } {
  return {
    u0: COLUMN_STOPS[column]!,
    u1: COLUMN_STOPS[column + 1]!,
    v0: ROW_STOPS[row]!,
    v1: ROW_STOPS[row + 1]!,
  }
}

export const gardenRegions: GardenRegion[] = cultures.map((culture, index) => {
  const column = index % REGION_COLUMNS
  const row = Math.floor(index / REGION_COLUMNS)
  const { u0, v0, u1, v1 } = regionUv(column, row)
  const mapQuad = quadFromUv(u0, v0, u1, v1)
  return {
    id: `garden-${String(index + 1).padStart(2, '0')}`,
    index,
    culture,
    mapQuad,
    mapRect: rectFromQuad(mapQuad),
  }
})

export function regionForCell(cell: GridCell): GardenRegion {
  const column = Math.floor(cell.x / REGION_CELL_COLUMNS)
  const row = Math.floor(cell.y / REGION_CELL_ROWS)
  return gardenRegions[row * REGION_COLUMNS + column]!
}

function cellUv(cell: GridCell): { u0: number; v0: number; u1: number; v1: number } {
  const regionColumn = Math.floor(cell.x / REGION_CELL_COLUMNS)
  const regionRow = Math.floor(cell.y / REGION_CELL_ROWS)
  const localColumn = cell.x % REGION_CELL_COLUMNS
  const localRow = cell.y % REGION_CELL_ROWS
  const { u0, v0, u1, v1 } = regionUv(regionColumn, regionRow)
  const usableU0 = lerp(u0, u1, REGION_INSET)
  const usableU1 = lerp(u0, u1, 1 - REGION_INSET)
  const usableV0 = lerp(v0, v1, REGION_INSET)
  const usableV1 = lerp(v0, v1, 1 - REGION_INSET)
  const cellWidth = (usableU1 - usableU0) / REGION_CELL_COLUMNS
  const cellHeight = (usableV1 - usableV0) / REGION_CELL_ROWS
  const gapU = cellWidth * CELL_GAP
  const gapV = cellHeight * CELL_GAP
  const cellU0 = usableU0 + localColumn * cellWidth + gapU / 2
  const cellV0 = usableV0 + localRow * cellHeight + gapV / 2
  return {
    u0: cellU0,
    v0: cellV0,
    u1: cellU0 + cellWidth - gapU,
    v1: cellV0 + cellHeight - gapV,
  }
}

export function cellQuad(cell: GridCell): NormalizedQuad {
  const { u0, v0, u1, v1 } = cellUv(cell)
  return quadFromUv(u0, v0, u1, v1)
}

export function cellRect(cell: GridCell): NormalizedRect {
  return rectFromQuad(cellQuad(cell))
}

/** The visual location of plot N (zero based).  The first five span 2 cells. */
export function cellsForPlotIndex(index: number): GridCell[] {
  if (index < 5) return [{ x: 0, y: index }, { x: 1, y: index }]
  if (index < 10) return [{ x: 2, y: index - 5 }]

  const remaining = index - 10
  const regionIndex = 1 + Math.floor(remaining / 15)
  const insideRegion = remaining % 15
  const regionColumn = regionIndex % REGION_COLUMNS
  const regionRow = Math.floor(regionIndex / REGION_COLUMNS)
  return [{
    x: regionColumn * REGION_CELL_COLUMNS + (insideRegion % REGION_CELL_COLUMNS),
    y: regionRow * REGION_CELL_ROWS + Math.floor(insideRegion / REGION_CELL_COLUMNS),
  }]
}

export function plotBounds(cells: readonly GridCell[]): NormalizedRect {
  const rects = cells.map(cellRect)
  const x = Math.min(...rects.map((rect) => rect.x))
  const y = Math.min(...rects.map((rect) => rect.y))
  const right = Math.max(...rects.map((rect) => rect.x + rect.width))
  const bottom = Math.max(...rects.map((rect) => rect.y + rect.height))
  return { x, y, width: right - x, height: bottom - y }
}
