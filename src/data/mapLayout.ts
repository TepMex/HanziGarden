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
  /** Exact quadrilateral between four intersections in the traced garden grid. */
  mapQuad: NormalizedQuad
  /** Axis-aligned bounds used to position HTML controls over the quadrilateral. */
  mapRect: NormalizedRect
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

/**
 * Intersections measured from Garden.svg at the map's 1600 × 1200 working size.
 * Keeping the traced points as the source of truth makes hotspots, reveal
 * regions and the painted grid agree even where the hand-drawn paths bow.
 */
export const GARDEN_INTERSECTIONS: readonly (readonly NormalizedPoint[])[] = [
  [{ x: 140, y: 134 }, { x: 434, y: 134 }, { x: 682, y: 149 }, { x: 929, y: 139 }, { x: 1158, y: 134 }, { x: 1460, y: 136 }],
  [{ x: 103, y: 435 }, { x: 416, y: 440 }, { x: 674, y: 455 }, { x: 939, y: 463 }, { x: 1178, y: 456 }, { x: 1516, y: 453 }],
  [{ x: 42, y: 732 }, { x: 393, y: 742 }, { x: 670, y: 752 }, { x: 942, y: 749 }, { x: 1207, y: 756 }, { x: 1537, y: 752 }],
  [{ x: 11, y: 1116 }, { x: 357, y: 1118 }, { x: 656, y: 1125 }, { x: 942, y: 1121 }, { x: 1242, y: 1103 }, { x: 1546, y: 1144 }],
].map((row) => row.map((point) => ({ x: point.x / WORLD_WIDTH, y: point.y / WORLD_HEIGHT })))

function lerp(start: number, end: number, amount: number): number {
  return start + (end - start) * amount
}

export function quadPoint(quad: NormalizedQuad, x: number, y: number): NormalizedPoint {
  const top = { x: lerp(quad.tl.x, quad.tr.x, x), y: lerp(quad.tl.y, quad.tr.y, x) }
  const bottom = { x: lerp(quad.bl.x, quad.br.x, x), y: lerp(quad.bl.y, quad.br.y, x) }
  return { x: lerp(top.x, bottom.x, y), y: lerp(top.y, bottom.y, y) }
}

function subQuad(quad: NormalizedQuad, x0: number, y0: number, x1: number, y1: number): NormalizedQuad {
  return {
    tl: quadPoint(quad, x0, y0),
    tr: quadPoint(quad, x1, y0),
    bl: quadPoint(quad, x0, y1),
    br: quadPoint(quad, x1, y1),
  }
}

export function rectFromQuad(quad: NormalizedQuad): NormalizedRect {
  const xs = [quad.tl.x, quad.tr.x, quad.bl.x, quad.br.x]
  const ys = [quad.tl.y, quad.tr.y, quad.bl.y, quad.br.y]
  const x = Math.min(...xs)
  const y = Math.min(...ys)
  return { x, y, width: Math.max(...xs) - x, height: Math.max(...ys) - y }
}

function regionQuad(column: number, row: number): NormalizedQuad {
  return {
    tl: GARDEN_INTERSECTIONS[row]![column]!,
    tr: GARDEN_INTERSECTIONS[row]![column + 1]!,
    bl: GARDEN_INTERSECTIONS[row + 1]![column]!,
    br: GARDEN_INTERSECTIONS[row + 1]![column + 1]!,
  }
}

export const gardenRegions: GardenRegion[] = cultures.map((culture, index) => {
  const mapQuad = regionQuad(index % REGION_COLUMNS, Math.floor(index / REGION_COLUMNS))
  return {
    id: `garden-${String(index + 1).padStart(2, '0')}`,
    index,
    culture,
    mapQuad,
    mapRect: rectFromQuad(mapQuad),
  }
})

/** Interpolate across the traced 5 × 3 grid; retained for layout consumers. */
export function estatePoint(u: number, v: number): NormalizedPoint {
  const clampedU = Math.max(0, Math.min(1, u))
  const clampedV = Math.max(0, Math.min(1, v))
  const columnPosition = clampedU * REGION_COLUMNS
  const rowPosition = clampedV * REGION_ROWS
  const column = Math.min(REGION_COLUMNS - 1, Math.floor(columnPosition))
  const row = Math.min(REGION_ROWS - 1, Math.floor(rowPosition))
  return quadPoint(regionQuad(column, row), columnPosition - column, rowPosition - row)
}

export function quadFromUv(u0: number, v0: number, u1: number, v1: number): NormalizedQuad {
  return { tl: estatePoint(u0, v0), tr: estatePoint(u1, v0), bl: estatePoint(u0, v1), br: estatePoint(u1, v1) }
}

export function regionForCell(cell: GridCell): GardenRegion {
  const column = Math.floor(cell.x / REGION_CELL_COLUMNS)
  const row = Math.floor(cell.y / REGION_CELL_ROWS)
  return gardenRegions[row * REGION_COLUMNS + column]!
}

function cellLocalBounds(cell: GridCell): { x0: number; y0: number; x1: number; y1: number } {
  const regionColumn = Math.floor(cell.x / REGION_CELL_COLUMNS)
  const regionRow = Math.floor(cell.y / REGION_CELL_ROWS)
  const localColumn = cell.x % REGION_CELL_COLUMNS
  const localRow = cell.y % REGION_CELL_ROWS
  // The first garden has ten gameplay plots: five wide left plots backed by
  // two logical cells, and five right plots. This reproduces the prototype's
  // 2 × 5 subdivision while preserving stable save IDs and adjacency data.
  const columnStops = regionColumn === 0 && regionRow === 0
    ? [0, 0.25, 0.5, 1]
    : [0, 1 / 3, 2 / 3, 1]
  return {
    x0: columnStops[localColumn]!,
    x1: columnStops[localColumn + 1]!,
    y0: localRow / REGION_CELL_ROWS,
    y1: (localRow + 1) / REGION_CELL_ROWS,
  }
}

export function cellQuad(cell: GridCell): NormalizedQuad {
  const bounds = cellLocalBounds(cell)
  return subQuad(regionForCell(cell).mapQuad, bounds.x0, bounds.y0, bounds.x1, bounds.y1)
}

export function cellRect(cell: GridCell): NormalizedRect {
  return rectFromQuad(cellQuad(cell))
}

/** The visual location of plot N (zero based). The first five span 2 cells. */
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

/** One quadrilateral covering a plot, including the first garden's two-cell plots. */
export function plotQuad(cells: readonly GridCell[]): NormalizedQuad {
  const region = regionForCell(cells[0]!)
  const bounds = cells.map(cellLocalBounds)
  return subQuad(
    region.mapQuad,
    Math.min(...bounds.map((item) => item.x0)),
    Math.min(...bounds.map((item) => item.y0)),
    Math.max(...bounds.map((item) => item.x1)),
    Math.max(...bounds.map((item) => item.y1)),
  )
}

export function plotBounds(cells: readonly GridCell[]): NormalizedRect {
  return rectFromQuad(plotQuad(cells))
}
