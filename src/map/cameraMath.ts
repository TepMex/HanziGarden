import { MAX_ZOOM, MIN_ZOOM, GARDEN_HEIGHT, GARDEN_WIDTH } from '../data/mapLayout'

export type CameraState = { x: number; y: number; zoom: number }
export type Point = { x: number; y: number }
export type Viewport = { width: number; height: number }
export type GardenBounds = { x: number; y: number; width: number; height: number }

export const initialCamera: CameraState = { x: 0, y: 0, zoom: MIN_ZOOM }

export function baseMapScale(viewport: Viewport): number {
  return Math.min(viewport.width / GARDEN_WIDTH, viewport.height / GARDEN_HEIGHT)
}

export function clampZoom(zoom: number): number {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom))
}

export function screenToGarden(point: Point, camera: CameraState, viewport: Viewport): Point {
  const scale = baseMapScale(viewport) * camera.zoom
  return {
    x: GARDEN_WIDTH / 2 + (point.x - viewport.width / 2 - camera.x) / scale,
    y: GARDEN_HEIGHT / 2 + (point.y - viewport.height / 2 - camera.y) / scale,
  }
}

export function gardenToScreen(point: Point, camera: CameraState, viewport: Viewport): Point {
  const scale = baseMapScale(viewport) * camera.zoom
  return {
    x: viewport.width / 2 + camera.x + (point.x - GARDEN_WIDTH / 2) * scale,
    y: viewport.height / 2 + camera.y + (point.y - GARDEN_HEIGHT / 2) * scale,
  }
}

export function cameraForGardenPoint(gardenPoint: Point, screenPoint: Point, zoom: number, viewport: Viewport): CameraState {
  const scale = baseMapScale(viewport) * clampZoom(zoom)
  return {
    zoom: clampZoom(zoom),
    x: screenPoint.x - viewport.width / 2 - (gardenPoint.x - GARDEN_WIDTH / 2) * scale,
    y: screenPoint.y - viewport.height / 2 - (gardenPoint.y - GARDEN_HEIGHT / 2) * scale,
  }
}

export function zoomAroundPoint(camera: CameraState, screenPoint: Point, zoom: number, viewport: Viewport): CameraState {
  return cameraForGardenPoint(screenToGarden(screenPoint, camera, viewport), screenPoint, zoom, viewport)
}

export function clampCamera(camera: CameraState, viewport: Viewport, overscroll = 48): CameraState {
  const zoom = clampZoom(camera.zoom)
  const scale = baseMapScale(viewport) * zoom
  const rangeX = Math.max(0, (GARDEN_WIDTH * scale - viewport.width) / 2) + overscroll
  const rangeY = Math.max(0, (GARDEN_HEIGHT * scale - viewport.height) / 2) + overscroll
  return {
    zoom,
    x: Math.min(rangeX, Math.max(-rangeX, camera.x)),
    y: Math.min(rangeY, Math.max(-rangeY, camera.y)),
  }
}

export function focusGardenPoint(point: Point, zoom: number, viewport: Viewport): CameraState {
  return clampCamera(cameraForGardenPoint(point, { x: viewport.width / 2, y: viewport.height / 2 }, zoom, viewport), viewport)
}

/** Center bounds and fit their width with equal horizontal margins. */
export function cameraForGardenBounds(
  bounds: GardenBounds,
  viewport: Viewport,
  horizontalMargin = 0.1,
): CameraState {
  const margin = Math.max(0, Math.min(0.45, horizontalMargin))
  const availableWidth = viewport.width * (1 - margin * 2)
  const zoom = clampZoom(availableWidth / Math.max(1, bounds.width) / baseMapScale(viewport))
  return focusGardenPoint(
    { x: bounds.x + bounds.width / 2, y: bounds.y + bounds.height / 2 },
    zoom,
    viewport,
  )
}

/** Desktop deliberately keeps its current camera. */
export function mobileCameraForGardenBounds(
  bounds: GardenBounds,
  viewport: Viewport,
  horizontalMargin = 0.1,
): CameraState | null {
  if (viewport.width > 820) return null
  return cameraForGardenBounds(bounds, viewport, horizontalMargin)
}
