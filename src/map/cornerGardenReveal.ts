import type { GardenRegion } from '../data/mapLayout'
import type { RevealEllipse } from './plotReveal'

export type CornerGarden = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

/**
 * Corner gardens restore the non-playable scenery on their two adjacent image
 * edges once they are mostly cultivated.
 *
 * Hard black rectangles used to open axis-aligned strips that read as Android
 * compositing glitches (bright crosshair seams).  Exterior progress therefore:
 * 1. stays at 0 until the corner beds themselves look mostly healthy;
 * 2. grows with a smooth ease toward the image border;
 * 3. is rendered as soft ellipses, never as full-edge rectangles.
 */
export function exteriorEdgeProgress(cleared: number): number {
  const progress = Math.max(0, Math.min(1, cleared))
  if (progress < 0.85) return 0
  return ((progress - 0.85) / 0.15) ** 1.25
}

/**
 * Soft exterior lobes beside a corner garden.  Coordinates are normalized
 * (0..1) in map space — same system as region.mapRect.
 */
export function cornerGardenExteriorRevealEllipses(
  region: GardenRegion,
  corner: CornerGarden,
  cleared: number,
): RevealEllipse[] {
  const edge = exteriorEdgeProgress(cleared)
  if (edge === 0) return []

  const { x, y, width, height } = region.mapRect
  const right = x + width
  const bottom = y + height
  // Opaque core of the radial gradient ends at 68% radius; size lobes so the
  // exterior margin is covered by that core when edge === 1.
  const cover = 1.08

  switch (corner) {
    case 'top-left':
      return [
        {
          // Left margin beside this garden only (not the full image height).
          centerX: x * (1 - edge * 0.5),
          centerY: bottom * 0.48,
          radiusX: Math.max(x * edge * cover, 1e-4),
          radiusY: bottom * (0.40 + 0.22 * edge),
          rotation: -0.06,
        },
        {
          // Top margin above this garden only (not the full image width).
          centerX: right * 0.48,
          centerY: y * (1 - edge * 0.5),
          radiusX: right * (0.40 + 0.22 * edge),
          radiusY: Math.max(y * edge * cover, 1e-4),
          rotation: 0.08,
        },
      ]
    case 'top-right':
      return [
        {
          centerX: right + (1 - right) * edge * 0.5,
          centerY: bottom * 0.48,
          radiusX: Math.max((1 - right) * edge * cover, 1e-4),
          radiusY: bottom * (0.40 + 0.22 * edge),
          rotation: 0.06,
        },
        {
          centerX: x + (1 - x) * 0.52,
          centerY: y * (1 - edge * 0.5),
          radiusX: (1 - x) * (0.40 + 0.22 * edge),
          radiusY: Math.max(y * edge * cover, 1e-4),
          rotation: -0.08,
        },
      ]
    case 'bottom-left':
      return [
        {
          centerX: x * (1 - edge * 0.5),
          centerY: y + (1 - y) * 0.52,
          radiusX: Math.max(x * edge * cover, 1e-4),
          radiusY: (1 - y) * (0.40 + 0.22 * edge),
          rotation: 0.06,
        },
        {
          centerX: right * 0.48,
          centerY: bottom + (1 - bottom) * edge * 0.5,
          radiusX: right * (0.40 + 0.22 * edge),
          radiusY: Math.max((1 - bottom) * edge * cover, 1e-4),
          rotation: -0.06,
        },
      ]
    case 'bottom-right':
      return [
        {
          centerX: right + (1 - right) * edge * 0.5,
          centerY: y + (1 - y) * 0.52,
          radiusX: Math.max((1 - right) * edge * cover, 1e-4),
          radiusY: (1 - y) * (0.40 + 0.22 * edge),
          rotation: -0.06,
        },
        {
          centerX: x + (1 - x) * 0.52,
          centerY: bottom + (1 - bottom) * edge * 0.5,
          radiusX: (1 - x) * (0.40 + 0.22 * edge),
          radiusY: Math.max((1 - bottom) * edge * cover, 1e-4),
          rotation: 0.06,
        },
      ]
  }
}

/** Average cleared fraction of a corner garden, ignoring empty plots. */
export function cornerGardenClearedFraction(
  plotStates: ReadonlyArray<{ characterCount: number; cleared: number }>,
): number {
  const cultivated = plotStates.filter((plot) => plot.characterCount > 0)
  if (cultivated.length === 0) return 0
  return cultivated.reduce((sum, plot) => sum + plot.cleared, 0) / cultivated.length
}
