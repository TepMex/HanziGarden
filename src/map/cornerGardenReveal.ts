import type { GardenRegion, NormalizedRect } from '../data/mapLayout'

export type CornerGarden = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Corner gardens restore the non-playable scenery on their two adjacent image
 * edges once they are mostly cultivated.  Early partial progress used to open
 * hairline full-edge strips that read as Android compositing glitches, so the
 * exterior only starts after a meaningful clearing threshold and then grows
 * toward the image border.
 */
export function exteriorEdgeProgress(cleared: number): number {
  const progress = Math.max(0, Math.min(1, cleared))
  if (progress <= 0.62) return 0
  return ((progress - 0.62) / 0.38) ** 1.15
}

export function cornerGardenExteriorRevealRects(
  region: GardenRegion,
  corner: CornerGarden,
  cleared: number,
): NormalizedRect[] {
  const edge = exteriorEdgeProgress(cleared)
  if (edge === 0) return []

  const { x, y, width, height } = region.mapRect
  const right = x + width
  const bottom = y + height

  switch (corner) {
    case 'top-left':
      return [
        // Left band only as tall as this corner garden (+ its top margin).
        { x: x * (1 - edge), y: 0, width: x * edge, height: bottom },
        // Top band only as wide as this corner garden (+ its left margin).
        { x: 0, y: y * (1 - edge), width: right, height: y * edge },
      ]
    case 'top-right':
      return [
        { x: right, y: 0, width: (1 - right) * edge, height: bottom },
        { x: x, y: y * (1 - edge), width: 1 - x, height: y * edge },
      ]
    case 'bottom-left':
      return [
        { x: x * (1 - edge), y: y, width: x * edge, height: 1 - y },
        { x: 0, y: bottom, width: right, height: (1 - bottom) * edge },
      ]
    case 'bottom-right':
      return [
        { x: right, y: y, width: (1 - right) * edge, height: 1 - y },
        { x: x, y: bottom, width: 1 - x, height: (1 - bottom) * edge },
      ]
  }
}
