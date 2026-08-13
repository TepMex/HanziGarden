import { cellQuad, plotBounds, type GridCell, type NormalizedQuad, type NormalizedRect } from '../data/mapLayout'

export type RevealEllipse = {
  centerX: number
  centerY: number
  radiusX: number
  radiusY: number
  rotation: number
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function seededUnit(seed: number, salt: number): number {
  let value = (seed + Math.imul(salt, 0x9e3779b9)) >>> 0
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b)
  return ((value ^ (value >>> 16)) >>> 0) / 4294967295
}

/**
 * Cleared fraction from infection.  Infection 1 (all due/new) → 0;
 * infection 0 (fully reviewed) → 1.
 */
export function clearedFromInfection(infection: number): number {
  return clamp01(1 - infection)
}

/**
 * Ease-out growth so early reviews open a modest patch while late progress
 * fills the bed.  Exponent < 1 grows faster than linear at the start of the
 * remaining work, which matches the satisfying "field coming back" feel.
 */
export function plotRevealGrowth(cleared: number): number {
  const progress = clamp01(cleared)
  if (progress <= 0) return 0
  return progress ** 0.62
}

/**
 * Half-axis scale relative to the plot AABB.
 *
 * The radial mask gradient stays opaque to 68% of its radius.  Covering the
 * AABB corners inside that opaque core needs about 1.04× the half-width /
 * half-height; 1.06 leaves a thin feathered fringe into the surrounding path.
 */
export const FULL_CLEAR_AXIS = 1.06

export function plotRevealAxisScale(cleared: number): number {
  const progress = clamp01(cleared)
  const growth = plotRevealGrowth(progress)
  // Hold back from the edges until cards are nearly all caught up.
  const fill = 0.70 + 0.30 * progress ** 3
  return FULL_CLEAR_AXIS * fill * growth
}

/** Past this cleared fraction the plot polygon punches an exact clean hole. */
export const FULL_PLOT_POLYGON_CLEARED = 0.97

export function plotRevealEllipses(
  cells: readonly GridCell[],
  seed: number,
  infection: number,
): RevealEllipse[] {
  const cleared = clearedFromInfection(infection)
  if (cleared <= 0) return []

  const bounds = plotBounds(cells)
  const axis = plotRevealAxisScale(cleared)
  const centerX = bounds.x + bounds.width / 2
  const centerY = bounds.y + bounds.height / 2
  const rotation = (seededUnit(seed, 1) - 0.5) * 0.28
  const drift = 1 - cleared
  const offsetX = (seededUnit(seed, 2) - 0.5) * bounds.width * 0.14 * drift
  const offsetY = (seededUnit(seed, 3) - 0.5) * bounds.height * 0.14 * drift
  const radiusX = bounds.width * axis
  const radiusY = bounds.height * axis
  // Side lobes stay smaller so partial clears read as organic patches, not a
  // merged hard rectangle across neighbouring beds.
  const lobeRadius = 0.36 + cleared * 0.10

  return [
    { centerX: centerX + offsetX, centerY: centerY + offsetY, radiusX, radiusY, rotation },
    {
      centerX: centerX + offsetX + (seededUnit(seed, 4) - 0.5) * radiusX * 0.55,
      centerY: centerY + offsetY + (seededUnit(seed, 5) - 0.5) * radiusY * 0.50,
      radiusX: radiusX * lobeRadius,
      radiusY: radiusY * lobeRadius,
      rotation: rotation - 0.32,
    },
    {
      centerX: centerX + offsetX + (seededUnit(seed, 6) - 0.5) * radiusX * 0.55,
      centerY: centerY + offsetY + (seededUnit(seed, 7) - 0.5) * radiusY * 0.50,
      radiusX: radiusX * lobeRadius,
      radiusY: radiusY * lobeRadius,
      rotation: rotation + 0.36,
    },
  ]
}

/**
 * Exact bed geometry once a plot is effectively clean.  Ellipses alone leave
 * feathered corners on perspective quads; the polygon guarantees the whole
 * cultivated cell shows the clean plate.
 */
export function plotRevealQuads(cells: readonly GridCell[], infection: number): NormalizedQuad[] {
  if (clearedFromInfection(infection) < FULL_PLOT_POLYGON_CLEARED) return []
  return cells.map(cellQuad)
}

export function plotRevealBounds(cells: readonly GridCell[]): NormalizedRect {
  return plotBounds(cells)
}
