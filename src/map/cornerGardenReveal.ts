import type { GardenRegion, NormalizedRect } from '../data/mapLayout'

export type CornerGarden = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * The four outer gardens also restore the non-playable scenery leading to
 * their two adjacent image edges.  This keeps the estate's frame from
 * remaining covered after the whole corner garden has been cultivated.
 */
export function cornerGardenExteriorRevealRects(
  region: GardenRegion,
  corner: CornerGarden,
  cleared: number,
): NormalizedRect[] {
  const progress = Math.max(0, Math.min(1, cleared))
  if (progress === 0) return []

  const { x, y, width, height } = region.mapRect
  const right = x + width
  const bottom = y + height

  switch (corner) {
    case 'top-left':
      return [
        { x: x * (1 - progress), y: 0, width: x * progress, height: 1 },
        { x: 0, y: y * (1 - progress), width: 1, height: y * progress },
      ]
    case 'top-right':
      return [
        { x: right, y: 0, width: (1 - right) * progress, height: 1 },
        { x: 0, y: y * (1 - progress), width: 1, height: y * progress },
      ]
    case 'bottom-left':
      return [
        { x: x * (1 - progress), y: 0, width: x * progress, height: 1 },
        { x: 0, y: bottom, width: 1, height: (1 - bottom) * progress },
      ]
    case 'bottom-right':
      return [
        { x: right, y: 0, width: (1 - right) * progress, height: 1 },
        { x: 0, y: bottom, width: 1, height: (1 - bottom) * progress },
      ]
  }
}
